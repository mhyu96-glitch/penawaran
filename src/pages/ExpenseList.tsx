import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  PlusCircle, 
  Pencil, 
  Trash2, 
  Wallet, 
  Calendar as CalendarIcon, 
  Search, 
  X, 
  Download, 
  TrendingDown, 
  Receipt, 
  Layers, 
  Briefcase,
  Fuel,
  Utensils,
  Users,
  Hotel,
  Wrench,
  Tag
} from 'lucide-react';
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
import { format, isThisMonth } from 'date-fns';
import { formatCurrency, cn, safeFormat } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';

type ExpenseWithProject = Expense & {
  projects?: {
    id: string;
    name: string;
  } | null;
};

const CATEGORY_COLORS: Record<string, { icon: any; color: string }> = {
  'Bensin & Transportasi': { icon: Fuel, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  'Makan & Konsumsi': { icon: Utensils, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
  'Gaji & Upah Teknisi': { icon: Users, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  'Penginapan & Hotel': { icon: Hotel, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  'Alat & Lain-lain': { icon: Wrench, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
};

const ExpenseList = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchExpenses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, projects(id, name)')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false });

      if (error) {
        showError('Gagal memuat daftar pengeluaran.');
      } else {
        setExpenses((data as ExpenseWithProject[]) || []);
      }
    } catch (err) {
      console.error(err);
      showError('Terjadi kesalahan memuat data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [user]);

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase.from('expenses').delete().match({ id: expenseId });
      if (error) {
        showError('Gagal menghapus pengeluaran.');
      } else {
        showSuccess('Pengeluaran berhasil dihapus.');
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
      }
    } catch {
      showError('Gagal menghapus pengeluaran.');
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

  // Unique categories for filter dropdown
  const categories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category).filter(Boolean));
    return Array.from(cats);
  }, [expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.expense_date);
      
      const matchesSearch = !searchQuery.trim() || 
        (expense.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (expense.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (expense.projects?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDate = !dateRange || !dateRange.from ? true : 
        (expenseDate >= dateRange.from && (!dateRange.to || expenseDate <= dateRange.to));
      
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;

      return matchesSearch && matchesDate && matchesCategory;
    });
  }, [expenses, searchQuery, dateRange, categoryFilter]);

  // Key KPI stats
  const stats = useMemo(() => {
    const totalAll = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalFiltered = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    // Month expenses
    const thisMonthTotal = expenses
      .filter(e => isThisMonth(new Date(e.expense_date)))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Top Category
    const catMap: Record<string, number> = {};
    expenses.forEach(e => {
      const cat = e.category || 'Lain-lain';
      catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0);
    });

    let topCatName = '-';
    let topCatAmount = 0;
    Object.entries(catMap).forEach(([cat, amt]) => {
      if (amt > topCatAmount) {
        topCatAmount = amt;
        topCatName = cat;
      }
    });

    return {
      totalAll,
      totalFiltered,
      thisMonthTotal,
      topCatName,
      topCatAmount,
      totalCount: filteredExpenses.length
    };
  }, [expenses, filteredExpenses]);

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) return;

    const headers = ["Tanggal", "Deskripsi", "Kategori", "Proyek", "Jumlah", "Catatan"];
    const rows = filteredExpenses.map(exp => [
      safeFormat(exp.expense_date, 'yyyy-MM-dd'),
      `"${exp.description.replace(/"/g, '""')}"`,
      `"${(exp.category || '-').replace(/"/g, '""')}"`,
      `"${(exp.projects?.name || '-').replace(/"/g, '""')}"`,
      exp.amount,
      `"${(exp.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Pengeluaran_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isFilterActive = !!searchQuery || !!dateRange || categoryFilter !== 'all';

  return (
    <div className="container mx-auto p-3 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* ========================================================================= */}
      {/* HERO BANNER & HEADER */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Buku Kas & Operasional
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Pengeluaran Bisnis
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Catat, kelompokkan, dan pantau seluruh pengeluaran operasional & belanja proyek secara akurat.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {filteredExpenses.length > 0 && (
              <Button 
                variant="outline" 
                onClick={handleExportCSV}
                className="rounded-xl font-bold h-11 text-xs gap-2 border-border/80 hover:bg-muted"
              >
                <Download className="h-4 w-4" /> Ekspor CSV
              </Button>
            )}
            <Button 
              onClick={() => handleOpenForm()}
              className="rounded-xl font-bold h-11 px-5 text-xs gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <PlusCircle className="h-4 w-4" /> Tambah Pengeluaran
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KPI METRIC CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Pengeluaran */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Pengeluaran</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
              {formatCurrency(stats.totalFiltered)}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Dari {stats.totalCount} transaksi</span>
            {isFilterActive && <span className="text-amber-500 font-bold">Hasil Filter</span>}
          </div>
        </Card>

        {/* Card 2: Bulan Ini */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bulan Ini</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <CalendarIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {formatCurrency(stats.thisMonthTotal)}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Bulan {format(new Date(), 'MMMM yyyy')}</span>
          </div>
        </Card>

        {/* Card 3: Kategori Terbesar */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kategori Terbesar</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500">
              <Tag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-foreground truncate">
              {stats.topCatName}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Total:</span>
            <span className="font-bold text-foreground">{formatCurrency(stats.topCatAmount)}</span>
          </div>
        </Card>

        {/* Card 4: Total Semua Transaksi */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Catatan</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {expenses.length} <span className="text-xs font-normal text-muted-foreground">Catatan</span>
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Akumulasi Keseluruhan</span>
            <span className="font-bold text-foreground">{formatCurrency(stats.totalAll)}</span>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* MAIN CONTENT & TABLE CARD */}
      {/* ========================================================================= */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        {/* Filter Toolbar */}
        <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari deskripsi, catatan, atau nama proyek..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl h-10 text-xs bg-background"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Date Range & Category Dropdown */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              {/* Date Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={cn(
                      "rounded-xl h-10 text-xs font-semibold justify-start text-left bg-background border-border/80 min-w-[210px]",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <span>{format(dateRange.from, "d MMM")} - {format(dateRange.to, "d MMM yyyy")}</span>
                      ) : (
                        <span>{format(dateRange.from, "d MMM yyyy")}</span>
                      )
                    ) : (
                      <span>Filter Tanggal</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
                  <Calendar 
                    initialFocus 
                    mode="range" 
                    defaultMonth={dateRange?.from} 
                    selected={dateRange} 
                    onSelect={setDateRange} 
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              {/* Category Select */}
              <div className="w-full sm:w-[180px]">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="rounded-xl h-10 text-xs font-semibold bg-background border-border/80">
                    <SelectValue placeholder="Pilih Kategori" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="all" className="text-xs font-semibold">Semua Kategori</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat as string} value={cat as string} className="text-xs">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Filter Button */}
              {isFilterActive && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => { 
                    setSearchQuery('');
                    setDateRange(undefined); 
                    setCategoryFilter('all'); 
                  }} 
                  className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Reset Semua Filter"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Table Content */}
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                <Wallet className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-foreground">
                  {isFilterActive ? 'Tidak Ada Pengeluaran yang Cocok' : 'Belum Ada Catatan Pengeluaran'}
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isFilterActive 
                    ? 'Coba ubah kata kunci pencarian, rentang tanggal, atau filter kategori yang dipilih.' 
                    : 'Mulai catat biaya operasional, bensin, konsumsi, upah teknisi, atau belanja bisnis Anda.'}
                </p>
              </div>
              {isFilterActive ? (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchQuery(''); setDateRange(undefined); setCategoryFilter('all'); }}
                  className="rounded-xl text-xs font-semibold"
                >
                  Reset Filter
                </Button>
              ) : (
                <Button 
                  onClick={() => handleOpenForm()}
                  className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" /> Tambah Pengeluaran Sekarang
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border/80">
                    <TableHead className="w-[140px] font-bold text-xs uppercase text-muted-foreground">Tanggal</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-muted-foreground">Deskripsi & Keterangan</TableHead>
                    <TableHead className="w-[180px] font-bold text-xs uppercase text-muted-foreground">Kategori</TableHead>
                    <TableHead className="w-[180px] font-bold text-xs uppercase text-muted-foreground">Proyek Terkait</TableHead>
                    <TableHead className="w-[160px] text-right font-bold text-xs uppercase text-muted-foreground">Jumlah (Rp)</TableHead>
                    <TableHead className="w-[100px] text-center font-bold text-xs uppercase text-muted-foreground">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/60">
                  {filteredExpenses.map((expense) => {
                    const matchedCat = CATEGORY_COLORS[expense.category || ''] || {
                      icon: Tag,
                      color: 'text-muted-foreground bg-muted border-border'
                    };
                    const CatIcon = matchedCat.icon;

                    return (
                      <TableRow key={expense.id} className="hover:bg-muted/30 transition-colors group">
                        {/* Tanggal */}
                        <TableCell className="text-xs font-semibold text-muted-foreground whitespace-nowrap py-3.5">
                          {safeFormat(expense.expense_date, 'd MMM yyyy')}
                        </TableCell>

                        {/* Deskripsi & Catatan */}
                        <TableCell className="py-3.5">
                          <span className="font-bold text-xs sm:text-sm block text-foreground">
                            {expense.description}
                          </span>
                          {expense.notes && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 italic">
                              Catatan: {expense.notes}
                            </p>
                          )}
                        </TableCell>

                        {/* Kategori Badge */}
                        <TableCell>
                          {expense.category ? (
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border", matchedCat.color)}>
                              <CatIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">{expense.category}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Proyek Terkait */}
                        <TableCell>
                          {expense.projects ? (
                            <Button asChild variant="ghost" size="sm" className="h-auto p-0 font-bold text-xs text-primary hover:underline flex items-center gap-1">
                              <Link to={`/project/${expense.projects.id}`}>
                                <Briefcase className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="truncate max-w-[150px]">{expense.projects.name}</span>
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Jumlah Nominal */}
                        <TableCell className="text-right font-black text-xs sm:text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                          {formatCurrency(expense.amount)}
                        </TableCell>

                        {/* Aksi Edit & Hapus */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenForm(expense)}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                              title="Edit Pengeluaran"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Hapus Pengeluaran"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl p-6">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-base font-bold">Hapus Catatan Pengeluaran?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs text-muted-foreground">
                                    Tindakan ini akan menghapus pengeluaran "{expense.description}" sebesar {formatCurrency(expense.amount)} secara permanen.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2 pt-2">
                                  <AlertDialogCancel className="rounded-xl text-xs font-semibold">Batal</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteExpense(expense.id)}
                                    className="rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Footer Total */}
          {filteredExpenses.length > 0 && (
            <div className="bg-muted/30 border-t border-border/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-xs text-muted-foreground font-semibold">
                Menampilkan {filteredExpenses.length} dari total {expenses.length} pengeluaran
              </span>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-xs text-muted-foreground font-medium">Total Akumulasi:</span>
                <strong className="text-rose-600 dark:text-rose-400 font-black text-base sm:text-lg tabular-nums">
                  {formatCurrency(stats.totalFiltered)}
                </strong>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Modal Dialog */}
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