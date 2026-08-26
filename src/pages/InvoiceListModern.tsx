import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus,
  Search,
  Filter,
  Download,
  Send,
  Edit,
  MoreVertical,
  FileText,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { formatCurrency, calculateSubtotal, calculateTotal } from '@/lib/utils';

type InvoiceItem = {
  quantity: number;
  unit_price: number;
};

type Invoice = {
  id: string;
  invoice_number: string;
  to_client: string;
  invoice_date: string;
  due_date: string;
  status: string;
  discount_amount: number;
  tax_amount: number;
  invoice_items: InvoiceItem[];
  clients: { name: string } | null;
  client_id: string;
};

type TabType = 'all' | 'draft' | 'unpaid' | 'paid';

const InvoiceListModern = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        to_client,
        invoice_date,
        due_date,
        status,
        discount_amount,
        tax_amount,
        client_id,
        clients(name),
        invoice_items(quantity, unit_price)
      `)
      .eq('user_id', user.id)
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data as Invoice[] || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const unpaidInvoices = invoices.filter(inv => inv.status !== 'Lunas');
    const draftInvoices = invoices.filter(inv => inv.status === 'Draf');
    const today = startOfDay(new Date());

    let totalOutstanding = 0;
    let totalOverdue = 0;
    let totalDraft = 0;

    invoices.forEach(inv => {
      const subtotal = calculateSubtotal(inv.invoice_items);
      const total = calculateTotal(subtotal, inv.discount_amount || 0, inv.tax_amount || 0);

      if (inv.status === 'Draf') {
        totalDraft += total;
      } else if (inv.status !== 'Lunas') {
        totalOutstanding += total;
        
        if (inv.due_date && isBefore(new Date(inv.due_date), today)) {
          totalOverdue += total;
        }
      }
    });

    return {
      totalOutstanding,
      totalOverdue,
      totalDraft,
      draftCount: draftInvoices.length,
      unpaidCount: unpaidInvoices.length
    };
  }, [invoices]);

  // Filter by tab and search
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    // Tab filter
    if (activeTab === 'draft') {
      filtered = filtered.filter(inv => inv.status === 'Draf');
    } else if (activeTab === 'unpaid') {
      filtered = filtered.filter(inv => inv.status !== 'Lunas' && inv.status !== 'Draf');
    } else if (activeTab === 'paid') {
      filtered = filtered.filter(inv => inv.status === 'Lunas');
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(inv =>
        (inv.invoice_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (inv.to_client?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (inv.clients?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [invoices, activeTab, searchTerm]);

  // Paginate
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

  // Calculate invoice total
  const calculateInvoiceTotal = (invoice: Invoice): number => {
    const subtotal = calculateSubtotal(invoice.invoice_items);
    return calculateTotal(subtotal, invoice.discount_amount || 0, invoice.tax_amount || 0);
  };

  // Check if overdue
  const isOverdue = (invoice: Invoice): boolean => {
    if (invoice.status === 'Lunas' || !invoice.due_date) return false;
    return isBefore(new Date(invoice.due_date), startOfDay(new Date()));
  };

  // Get status badge class
  const getStatusBadgeClass = (invoice: Invoice) => {
    if (isOverdue(invoice)) {
      return 'bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/20';
    }
    
    switch (invoice.status) {
      case 'Lunas':
        return 'bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/20';
      case 'Terkirim':
        return 'bg-[#4b8eff]/10 text-[#4b8eff] border-[#4b8eff]/20';
      case 'Draf':
        return 'bg-white/10 text-white border-white/20';
      default:
        return 'bg-[#adc6ff]/10 text-[#adc6ff] border-[#adc6ff]/20';
    }
  };

  // Get status text
  const getStatusText = (invoice: Invoice): string => {
    if (isOverdue(invoice)) return 'Overdue';
    return invoice.status || 'Draf';
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedInvoices(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === paginatedInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(paginatedInvoices.map(inv => inv.id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-64 w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-96 w-full rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] text-[#dbe2fd]">
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-bold text-white mb-2">Invoices</h2>
            <p className="text-[#c4c6d0]">Manage and track your billing operations.</p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              className="bg-white/5 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2 hover:border-[#adc6ff]"
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            
            <Button 
              className="bg-white/5 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2 hover:border-[#adc6ff]"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Header Banner */}
        <div className="w-full h-48 md:h-64 rounded-2xl overflow-hidden mb-8 relative border border-white/10 bg-white/5 backdrop-blur-xl border-[#4b8eff]/20">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1326]/80 via-[#0b1326]/20 to-transparent" />
          
          <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4edea3] mb-1">
                Total Outstanding
              </p>
              <div className="text-4xl font-bold text-white">
                {formatCurrency(metrics.totalOutstanding).replace('Rp', '$')}
              </div>
            </div>
            
            <div className="text-right hidden sm:block">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#c4c6d0] mb-1">
                    Overdue
                  </p>
                  <p className="text-xl font-semibold text-[#ffb4ab]" style={{ textShadow: '0 0 10px rgba(255, 180, 171, 0.8)' }}>
                    {formatCurrency(metrics.totalOverdue).replace('Rp', '$')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#c4c6d0] mb-1">
                    Draft
                  </p>
                  <p className="text-xl font-semibold text-white">
                    {formatCurrency(metrics.totalDraft).replace('Rp', '$')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-white/10 px-6 py-4 flex gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`text-lg font-semibold pb-4 -mb-[17px] whitespace-nowrap transition-colors ${
                activeTab === 'all'
                  ? 'text-[#adc6ff] border-b-2 border-[#adc6ff]'
                  : 'text-[#c4c6d0] hover:text-white'
              }`}
            >
              All Invoices
            </button>
            <button
              onClick={() => setActiveTab('draft')}
              className={`text-lg font-semibold pb-4 -mb-[17px] whitespace-nowrap transition-colors ${
                activeTab === 'draft'
                  ? 'text-[#adc6ff] border-b-2 border-[#adc6ff]'
                  : 'text-[#c4c6d0] hover:text-white'
              }`}
            >
              Drafts ({metrics.draftCount})
            </button>
            <button
              onClick={() => setActiveTab('unpaid')}
              className={`text-lg font-semibold pb-4 -mb-[17px] whitespace-nowrap transition-colors ${
                activeTab === 'unpaid'
                  ? 'text-[#adc6ff] border-b-2 border-[#adc6ff]'
                  : 'text-[#c4c6d0] hover:text-white'
              }`}
            >
              Unpaid ({metrics.unpaidCount})
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`text-lg font-semibold pb-4 -mb-[17px] whitespace-nowrap transition-colors ${
                activeTab === 'paid'
                  ? 'text-[#adc6ff] border-b-2 border-[#adc6ff]'
                  : 'text-[#c4c6d0] hover:text-white'
              }`}
            >
              Paid
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="py-4 px-6 w-12">
                    <Checkbox
                      checked={selectedInvoices.length === paginatedInvoices.length && paginatedInvoices.length > 0}
                      onCheckedChange={toggleSelectAll}
                      className="border-[#44474f] bg-[#2d3449]"
                    />
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                    Invoice / Client
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                    Amount
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                    Issue Date
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                    Due Date
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a]">
                    Status
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-[#8e909a] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#8e909a]">
                      No invoices found. Create your first invoice!
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((invoice) => {
                    const total = calculateInvoiceTotal(invoice);
                    const overdue = isOverdue(invoice);
                    
                    return (
                      <tr key={invoice.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-4 px-6">
                          <Checkbox
                            checked={selectedInvoices.includes(invoice.id)}
                            onCheckedChange={() => toggleSelection(invoice.id)}
                            className="border-[#44474f] bg-[#2d3449]"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-xs font-mono text-[#adc6ff] mb-1">
                            {invoice.invoice_number || 'N/A'}
                          </div>
                          <div className="text-lg font-semibold text-white">
                            {invoice.clients?.name || invoice.to_client}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-mono text-sm">
                          {formatCurrency(total).replace('Rp', '$')}
                        </td>
                        <td className="py-4 px-6 text-[#c4c6d0]">
                          {format(new Date(invoice.invoice_date), 'MMM dd, yyyy', { locale: localeId })}
                        </td>
                        <td className={`py-4 px-6 ${overdue ? 'text-[#ffb4ab] font-medium' : 'text-[#c4c6d0]'}`}>
                          {invoice.due_date 
                            ? format(new Date(invoice.due_date), 'MMM dd, yyyy', { locale: localeId })
                            : '-'
                          }
                        </td>
                        <td className="py-4 px-6">
                          <span 
                            className={`
                              inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border backdrop-blur-md
                              ${getStatusBadgeClass(invoice)}
                            `}
                            style={
                              overdue 
                                ? { textShadow: '0 0 10px rgba(255, 180, 171, 0.8)', boxShadow: '0 0 15px rgba(255, 180, 171, 0.3)' }
                                : invoice.status === 'Lunas'
                                ? { textShadow: '0 0 10px rgba(78, 222, 163, 0.8)', boxShadow: '0 0 15px rgba(78, 222, 163, 0.3)' }
                                : invoice.status === 'Terkirim'
                                ? { textShadow: '0 0 10px rgba(75, 142, 255, 0.8)', boxShadow: '0 0 15px rgba(75, 142, 255, 0.3)' }
                                : {}
                            }
                          >
                            {overdue && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab] mr-1.5 animate-pulse" />
                            )}
                            {invoice.status === 'Lunas' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] mr-1.5" />
                            )}
                            {getStatusText(invoice)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => navigate(`/invoice/${invoice.id}`)}
                              className="p-2 text-[#c4c6d0] hover:text-[#adc6ff] transition-colors"
                              title="View"
                            >
                              <FileText className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => navigate(`/invoice/edit/${invoice.id}`)}
                              className="p-2 text-[#c4c6d0] hover:text-[#adc6ff] transition-colors"
                              title="Edit"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              className="p-2 text-[#c4c6d0] hover:text-[#adc6ff] transition-colors"
                              title="More"
                            >
                              <MoreVertical className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-white/10 px-6 py-4 flex items-center justify-between bg-white/5">
            <span className="text-[#c4c6d0]">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} entries
            </span>
            
            <div className="flex gap-2">
              <Button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded hover:bg-white/10 text-[#c4c6d0] transition-colors disabled:opacity-50 bg-transparent border-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`
                      w-8 h-8 rounded flex items-center justify-center font-medium transition-colors
                      ${currentPage === pageNum 
                        ? 'bg-[#adc6ff]/30 text-[#adc6ff] border border-white/10' 
                        : 'hover:bg-white/10 text-white bg-transparent border-0'
                      }
                    `}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              
              <Button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 rounded hover:bg-white/10 text-[#c4c6d0] transition-colors disabled:opacity-50 bg-transparent border-0"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceListModern;
