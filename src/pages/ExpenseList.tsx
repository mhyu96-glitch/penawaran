import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Pencil, Trash2, Wallet, Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import ExpenseForm, { Expense } from '@/components/ExpenseForm';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ExpenseList = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchExpenses = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('expense_date', { ascending: false });

    if (error) {
      showError('Gagal memuat daftar pengeluaran.');
    } else {
      setExpenses(data as Expense[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, [user]);

  const handleDeleteExpense = async (expenseId: string) => {
    const { error } = await supabase.from('expenses').delete().match({ id: expenseId });
    if (error) {
      showError('Gagal menghapus pengeluaran.');
    } else {
      showSuccess('Pengeluaran berhasil dihapus.');
      setExpenses(expenses.filter(e => e.id !== expenseId));
    }
  };

  const handleOpenForm = (expense: Expense | null = null) => {
    setSelectedExpense(expense);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    setIsFormOpen(false);
    fetchExpenses();
  };

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category).filter(Boolean));
    return Array.from(cats);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.expense_date);
      
      const matchesDate = !dateRange || !dateRange.from ? true : 
        (expenseDate >= dateRange.from && (!dateRange.to || expenseDate <= dateRange.to));
      
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;

      return matchesDate && matchesCategory;
    });
  }, [expenses, dateRange, categoryFilter]);

  const totalFiltered = useMemo(() => filteredExpenses.reduce((sum, e) => sum + e.amount, 0), [filteredExpenses]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <div>
                <div className="flex items-center gap-3">
                <Wallet className="h-7 w-7" />
                <CardTitle className="text-3xl">Pengeluaran</CardTitle>
                </div>
                <CardDescription>Catat dan kelola semua pengeluaran bisnis Anda.</CardDescription>
            </div>
            <Button onClick={() => handleOpenForm()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Tambah
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
            <div className="w-full sm:w-auto">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button id="date" variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "dd MMM")} - {format(dateRange.to, "dd MMM yyyy")}</>) : (format(dateRange.from, "PPP"))) : (<span>Filter Tanggal</span>)}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent>
                </Popover>
            </div>
            <div className="w-full sm:w-[200px]">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {categories.map(cat => (
                            <SelectItem key={cat as string} value={cat as string}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {(dateRange || categoryFilter !== 'all') && (
                <Button variant="ghost" size="icon" onClick={() => { setDateRange(undefined); setCategoryFilter('all'); }} title="Reset Filter">
                    <X className="h-4 w-4" />
                </Button>
            )}
            <div className="ml-auto font-medium text-sm">
                Total: <span className="text-lg font-bold">{formatCurrency(totalFiltered)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Tidak ada pengeluaran yang sesuai dengan filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{format(new Date(expense.expense_date), 'PPP', { locale: localeId })}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>
                        {expense.category ? <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">{expense.category}</span> : '-'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenForm(expense)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                            <AlertDialogDescription>Tindakan ini akan menghapus catatan pengeluaran secara permanen.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteExpense(expense.id)}>Hapus</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ExpenseForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        expense={selectedExpense}
        onSave={handleFormSave}
      />
    </div>
  );
};

export default ExpenseList;