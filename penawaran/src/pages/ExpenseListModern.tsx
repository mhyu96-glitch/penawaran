import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus,
  Search,
  Filter,
  TrendingDown,
  TrendingUp,
  Wallet,
  Cloud,
  Plane,
  Laptop,
  AlertTriangle,
  Building,
  Coffee,
  ShoppingCart,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  status: string;
  reference_number: string;
  created_at: string;
};

const ExpenseListModern = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchExpenses = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('expense_date', { ascending: false });

    if (error) {
      console.error('Error fetching expenses:', error);
    } else {
      setExpenses(data || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, [user]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const ytdExpenses = expenses.filter(e => {
      const expenseYear = new Date(e.expense_date).getFullYear();
      return expenseYear === currentYear;
    });

    const totalYTD = ytdExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Calculate last year for comparison
    const lastYearExpenses = expenses.filter(e => {
      const expenseYear = new Date(e.expense_date).getFullYear();
      return expenseYear === currentYear - 1;
    });
    const totalLastYear = lastYearExpenses.reduce((sum, e) => sum + e.amount, 0);

    const percentageChange = totalLastYear > 0 
      ? ((totalYTD - totalLastYear) / totalLastYear) * 100
      : 0;

    return {
      totalYTD,
      percentageChange,
      isDecrease: percentageChange < 0
    };
  }, [expenses]);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const matchesSearch = 
        (expense.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (expense.reference_number?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchTerm, categoryFilter]);

  // Paginate
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredExpenses, currentPage]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

  // Get icon for category
  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: any } = {
      'Software': Cloud,
      'Travel': Plane,
      'Hardware': Laptop,
      'Facility': Building,
      'Food': Coffee,
      'Supplies': ShoppingCart,
      'Other': AlertTriangle
    };
    const Icon = icons[category] || AlertTriangle;
    return <Icon className="h-5 w-5" />;
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-[#4edea3]/20 text-[#4edea3] border-[#4edea3]/30';
      case 'Pending':
        return 'bg-[#adc6ff]/20 text-[#adc6ff] border-[#adc6ff]/30';
      case 'Rejected':
      case 'Alert':
        return 'bg-[#ffb4ab]/20 text-[#ffb4ab] border-[#ffb4ab]/30';
      default:
        return 'bg-white/10 text-white border-white/20';
    }
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(expenses.map(e => e.category).filter(Boolean)));
    return ['all', ...cats];
  }, [expenses]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
          <div className="grid grid-cols-12 gap-6">
            <Skeleton className="col-span-4 h-48 rounded-2xl bg-white/5" />
            <Skeleton className="col-span-8 h-48 rounded-2xl bg-white/5" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] text-[#dbe2fd] relative">
      {/* Decorative gradient orbs */}
      <div className="fixed top-[20%] left-[30%] w-96 h-96 bg-[#adc6ff]/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-[10%] right-[20%] w-80 h-80 bg-[#4edea3]/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="mx-auto max-w-7xl p-6 md:p-8 relative z-10">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Expenses</h2>
            <p className="text-[#c4c6d0] mt-1">Manage and track company expenditures.</p>
          </div>
          
          <Button 
            className="bg-[#adc6ff] text-[#122f5f] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#d8e2ff] transition-all shadow-[0_0_15px_rgba(173,198,255,0.2)] flex items-center gap-2 border border-[#adc6ff]/30"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>

        {/* Bento Grid Dashboard */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Total Expenses Card */}
          <div className="col-span-12 md:col-span-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-[#adc6ff]/20 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                  Total Expenses (YTD)
                </h3>
                <Wallet className="h-5 w-5 text-[#adc6ff]" />
              </div>
              
              <div className="text-4xl font-bold text-white mt-2 tracking-tight">
                {formatCurrency(metrics.totalYTD).replace('Rp', '$').replace(',00', '')}
                <span className="text-[#c4c6d0] text-2xl">.00</span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-[#4edea3] relative z-10">
              {metrics.isDecrease ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              <span className="text-xs font-mono font-medium">
                {Math.abs(metrics.percentageChange).toFixed(1)}% vs last year
              </span>
            </div>
          </div>

          {/* Visual Analytics */}
          <div className="col-span-12 md:col-span-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden h-[240px] relative">
            <div className="absolute inset-0 bg-white/5">
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <div className="w-full h-full grid grid-cols-6 gap-4 p-8">
                  <div className="bg-[#adc6ff]/30 rounded-t-lg h-1/2 self-end backdrop-blur-sm border border-white/10" />
                  <div className="bg-[#adc6ff]/50 rounded-t-lg h-3/4 self-end backdrop-blur-sm border border-white/10" />
                  <div className="bg-[#adc6ff]/70 rounded-t-lg h-full self-end backdrop-blur-sm border border-white/10" />
                  <div className="bg-[#adc6ff]/40 rounded-t-lg h-2/3 self-end backdrop-blur-sm border border-white/10" />
                  <div className="bg-[#adc6ff]/60 rounded-t-lg h-5/6 self-end backdrop-blur-sm border border-white/10" />
                  <div className="bg-[#adc6ff]/80 rounded-t-lg h-3/4 self-end backdrop-blur-sm border border-white/10" />
                </div>
              </div>
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1326]/90 via-transparent to-transparent" />
            
            <div className="absolute bottom-6 left-6 z-10">
              <h3 className="text-xl font-semibold text-white drop-shadow-md">Expenditure Analytics</h3>
              <p className="text-[#c4c6d0] drop-shadow-md">Real-time visualization of company spending patterns.</p>
            </div>
          </div>
        </div>

        {/* Expenses List Section */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-xl font-semibold text-white">Recent Transactions</h3>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e909a] h-4 w-4" />
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-8 text-white appearance-none focus:ring-2 focus:ring-[#adc6ff] focus:outline-none backdrop-blur-md"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat} className="bg-[#131b2e]">
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
                <ChevronLeft className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e909a] pointer-events-none h-4 w-4 rotate-[-90deg]" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                    Description
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                    Category
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                    Date
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                    Status
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a] text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#8e909a]">
                      No expenses found. Add your first expense to get started!
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-sm text-[#c4c6d0]">
                            {getCategoryIcon(expense.category)}
                          </div>
                          <div>
                            <p className="font-medium text-white">{expense.description}</p>
                            <p className="text-xs font-mono text-[#8e909a]">
                              {expense.reference_number || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-[#c4c6d0]">
                        {expense.category || 'Other'}
                      </td>
                      <td className="py-4 px-6 text-[#c4c6d0] font-mono text-xs">
                        {format(new Date(expense.expense_date), 'MMM dd, yyyy', { locale: localeId })}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`
                          inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                          border backdrop-blur-md
                          ${getStatusBadgeClass(expense.status || 'Pending')}
                        `}>
                          {expense.status || 'Pending'}
                        </span>
                      </td>
                      <td className={`
                        py-4 px-6 font-mono text-right font-semibold
                        ${expense.status === 'Alert' ? 'text-[#ffb4ab]' : 'text-white'}
                      `}
                      style={expense.status === 'Alert' ? { textShadow: '0 0 8px rgba(255, 180, 171, 0.3)' } : {}}
                      >
                        {formatCurrency(expense.amount).replace('Rp', '$')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer / Pagination */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between bg-white/5 rounded-b-2xl">
            <p className="text-xs font-mono text-[#8e909a]">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredExpenses.length)} of {filteredExpenses.length} expenses
            </p>
            
            <div className="flex gap-2">
              <Button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[#c4c6d0] hover:text-white hover:border-[#adc6ff]/50 disabled:opacity-50 transition-all font-mono text-xs backdrop-blur-md"
              >
                Prev
              </Button>
              <Button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[#c4c6d0] hover:text-white hover:border-[#adc6ff]/50 disabled:opacity-50 transition-all font-mono text-xs backdrop-blur-md"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseListModern;
