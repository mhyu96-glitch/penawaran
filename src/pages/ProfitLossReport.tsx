import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader } from '@/components/ui/table';
import { 
  TrendingUp, TrendingDown, Calendar as CalendarIcon, Printer, 
  DollarSign, ShoppingBag, Wallet, RefreshCw, FileText, CheckCircle2, 
  ArrowUpRight, ArrowDownRight, Layers, Sparkles, Receipt, AlertTriangle
} from 'lucide-react';
import { format, addDays, startOfMonth, startOfYear, subDays, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { calculateItemTotal, calculateSubtotal, calculateTotal, cn, formatCurrency } from '@/lib/utils';

type InvoiceItem = {
  quantity: number;
  unit_price: number;
  cost_price?: number | null;
};

type InvoiceData = {
  id: string;
  invoice_number: string;
  to_client: string;
  status: string;
  created_at: string;
  due_date: string | null;
  discount_amount: number | null;
  tax_amount: number | null;
  invoice_items: InvoiceItem[];
};

type PaymentData = {
  id: string;
  amount: number;
  amount_paid: number;
  payment_date: string | null;
  created_at: string;
  status: string;
  invoices?: {
    discount_amount: number | null;
    tax_amount: number | null;
    invoice_items: InvoiceItem[];
  } | null;
};

type ExpenseData = {
  id: string;
  amount: number;
  expense_date: string;
  created_at: string;
};

const ProfitLossReport = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Range State: Default undefined (Semua Waktu)
  const [date, setDate] = useState<DateRange | undefined>(undefined);

  // Method View: Accrual vs Cash Basis
  const [reportMethod, setReportMethod] = useState<'accrual' | 'cash'>('accrual');

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [invRes, payRes, expRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, to_client, status, created_at, due_date, discount_amount, tax_amount, invoice_items(quantity, unit_price, cost_price)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('payments')
          .select('id, amount, amount_paid, payment_date, created_at, status, invoices(discount_amount, tax_amount, invoice_items(quantity, unit_price, cost_price))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('expenses')
          .select('id, amount, expense_date, created_at')
          .eq('user_id', user.id)
          .order('expense_date', { ascending: false }),
      ]);

      if (invRes.data) setInvoices(invRes.data as InvoiceData[]);
      if (payRes.data) setPayments(payRes.data as PaymentData[]);
      if (expRes.data) setExpenses(expRes.data as ExpenseData[]);
    } catch (err) {
      console.error('Error fetching profit loss data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Invoice Calculator
  const getInvoiceTotal = (inv: InvoiceData) => {
    const subtotal = inv.invoice_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(inv.discount_amount) || 0);
    return afterDiscount + (Number(inv.tax_amount) || 0);
  };

  const getInvoiceCogs = (inv: InvoiceData) => {
    return inv.invoice_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.cost_price) || 0)), 0) || 0;
  };

  // Date Filter Check
  const isDateInFilter = (dateStr: string | null | undefined) => {
    if (!date?.from) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const from = startOfDay(date.from);
    const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
    return d >= from && d <= to;
  };

  // Financial Computations
  const financials = useMemo(() => {
    const filteredInvoices = invoices.filter(inv => isDateInFilter(inv.created_at || inv.due_date));
    const filteredPayments = payments.filter(p => isDateInFilter(p.payment_date || p.created_at));
    const filteredExpenses = expenses.filter(e => isDateInFilter(e.expense_date || e.created_at));

    // 1. Accrual Figures (Total Tagihan Diterbitkan)
    let totalInvoicedRevenue = 0;
    let totalInvoicedCogs = 0;
    let paidRevenue = 0;
    let paidCogs = 0;
    let unpaidReceivables = 0;

    filteredInvoices.forEach(inv => {
      const invTotal = getInvoiceTotal(inv);
      const invCogs = getInvoiceCogs(inv);
      const s = (inv.status || '').toLowerCase();

      totalInvoicedRevenue += invTotal;
      totalInvoicedCogs += invCogs;

      if (s === 'lunas' || s === 'paid') {
        paidRevenue += invTotal;
        paidCogs += invCogs;
      } else {
        unpaidReceivables += invTotal;
      }
    });

    // 2. Cash Collected Figures
    let totalPaymentsCollected = 0;
    filteredPayments.forEach(p => {
      const st = (p.status || '').toLowerCase();
      if (st !== 'failed' && st !== 'batal') {
        totalPaymentsCollected += Number(p.amount ?? p.amount_paid ?? 0);
      }
    });

    const cashRevenue = Math.max(paidRevenue, totalPaymentsCollected);
    const cashCogs = paidCogs;

    // 3. Operating Expenses
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // 4. Selected Method Metrics
    const revenue = reportMethod === 'accrual' ? totalInvoicedRevenue : cashRevenue;
    const cogs = reportMethod === 'accrual' ? totalInvoicedCogs : cashCogs;
    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netProfit = grossProfit - totalExpenses;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      filteredInvoicesCount: filteredInvoices.length,
      filteredExpensesCount: filteredExpenses.length,
      totalInvoicedRevenue,
      totalInvoicedCogs,
      cashRevenue,
      cashCogs,
      unpaidReceivables,
      totalExpenses,
      revenue,
      cogs,
      grossProfit,
      grossMargin,
      netProfit,
      netMargin,
    };
  }, [invoices, payments, expenses, date, reportMethod]);

  // Date Presets
  const handlePreset = (preset: 'today' | '30days' | 'month' | 'year' | 'all') => {
    const now = new Date();
    if (preset === 'today') {
      setDate({ from: now, to: now });
    } else if (preset === '30days') {
      setDate({ from: subDays(now, 30), to: now });
    } else if (preset === 'month') {
      setDate({ from: startOfMonth(now), to: now });
    } else if (preset === 'year') {
      setDate({ from: startOfYear(now), to: now });
    } else if (preset === 'all') {
      setDate(undefined);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6" id="report-page">
      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl print:hidden">
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Laporan Rugi Laba Usaha Komprehensif
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                {financials.netMargin.toFixed(1)}% Net Margin
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Laporan Laba Rugi
            </h1>

            <p className="text-slate-300/90 text-sm leading-relaxed max-w-xl">
              Hitung seluruh perputaran pendapatan usaha, alokasi HPP modal, beban operasional, dan laba bersih secara akurat.
            </p>
          </div>

          {/* Date Picker & Controls */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <Button 
              onClick={fetchData} 
              variant="outline" 
              size="lg"
              className="h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95"
              title="Refresh Data"
            >
              <RefreshCw className={cn("h-4 w-4 text-indigo-400", loading && "animate-spin")} />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  id="date" 
                  variant="outline" 
                  className={cn(
                    "h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md px-3.5 text-xs font-semibold gap-2",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>
                    {date?.from ? (
                      date.to ? (
                        `${format(date.from, "d MMM yyyy", { locale: localeId })} - ${format(date.to, "d MMM yyyy", { locale: localeId })}`
                      ) : (
                        format(date.from, "d MMM yyyy", { locale: localeId })
                      )
                    ) : (
                      "Semua Waktu (All Time)"
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border border-border/80 shadow-2xl" align="end">
                <div className="p-3 border-b border-border/70 flex items-center gap-1.5 bg-muted/30 flex-wrap">
                  <span className="text-xs font-bold text-muted-foreground mr-1">Preset:</span>
                  <Button variant="ghost" size="sm" onClick={() => handlePreset('all')} className="h-7 text-xs rounded-lg font-bold text-primary">Semua Waktu</Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePreset('month')} className="h-7 text-xs rounded-lg">Bulan Ini</Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePreset('30days')} className="h-7 text-xs rounded-lg">30 Hari</Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePreset('year')} className="h-7 text-xs rounded-lg">Tahun Ini</Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePreset('today')} className="h-7 text-xs rounded-lg">Hari Ini</Button>
                </div>
                <Calendar 
                  initialFocus 
                  mode="range" 
                  defaultMonth={date?.from || new Date()} 
                  selected={date} 
                  onSelect={setDate} 
                  numberOfMonths={2}
                  className="p-3"
                />
              </PopoverContent>
            </Popover>

            <Button 
              variant="outline" 
              onClick={() => window.print()}
              className="h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-4 font-bold text-xs"
            >
              <Printer className="mr-2 h-4 w-4 text-sky-400" /> Cetak / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="space-y-6">
        {/* Printable Title */}
        <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
          <h1 className="text-2xl font-black text-slate-900">Laporan Laba Rugi (Income Statement)</h1>
          <p className="text-sm text-slate-600">
            Metode: {reportMethod === 'accrual' ? 'Basis Akrual (Seluruh Tagihan Bisnis)' : 'Basis Kas (Realisasi Kas Masuk)'} • 
            Periode: {date?.from ? format(date.from, 'd MMMM yyyy', { locale: localeId }) : 'Semua Waktu'} s/d {date?.to ? format(date.to, 'd MMMM yyyy', { locale: localeId }) : 'Sekarang'}
          </p>
        </div>

      {/* Accounting Method Toggle Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/40 border border-border/80 print:hidden">
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pilihan Mode Perhitungan Laporan</h4>
          <p className="text-xs text-muted-foreground">Pilih untuk melihat seluruh potensi tagihan bisnis atau hanya kas lunas yang sudah masuk.</p>
        </div>

        <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border shadow-xs">
          <Button
            variant={reportMethod === 'accrual' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setReportMethod('accrual')}
            className="h-8 text-xs font-bold rounded-lg"
          >
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            Basis Akrual (Semua Tagihan: {formatCurrency(financials.totalInvoicedRevenue)})
          </Button>

          <Button
            variant={reportMethod === 'cash' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setReportMethod('cash')}
            className="h-8 text-xs font-bold rounded-lg"
          >
            <DollarSign className="mr-1.5 h-3.5 w-3.5" />
            Basis Kas Lunas ({formatCurrency(financials.cashRevenue)})
          </Button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Pendapatan Usaha */}
        <Card className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              {reportMethod === 'accrual' ? 'Total Pendapatan Tagihan' : 'Kas Masuk Lunas'}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              {formatCurrency(financials.revenue)}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-700/80 dark:text-emerald-300 font-bold border-t border-emerald-500/20 pt-2.5">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {financials.filteredInvoicesCount} Faktur
            </span>
            <span>Piutang: {formatCurrency(financials.unpaidReceivables)}</span>
          </div>
        </Card>

        {/* Card 2: HPP Modal */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Harga Pokok (HPP)</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-2xs">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground truncate">
              {formatCurrency(financials.cogs)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Biaya dasar barang/jasa</span>
          </div>
        </Card>

        {/* Card 3: Laba Kotor */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Laba Kotor</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 shadow-2xs">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground truncate">
              {formatCurrency(financials.grossProfit)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span>{financials.grossMargin.toFixed(1)}% Gross Profit Margin</span>
          </div>
        </Card>

        {/* Card 4: Laba Bersih */}
        <Card className={cn(
          "relative overflow-hidden rounded-2xl p-5 shadow-xs hover:shadow-md transition-all group",
          financials.netProfit >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
        )}>
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-bold uppercase tracking-wider", financials.netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
              Laba Bersih Real
            </p>
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl shadow-2xs",
              financials.netProfit >= 0 ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400"
            )}>
              {financials.netProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-3">
            <h3 className={cn("text-2xl sm:text-3xl font-black tracking-tight truncate", financials.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {formatCurrency(financials.netProfit)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold border-t border-border/60 pt-2.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", financials.netProfit >= 0 ? "bg-emerald-500" : "bg-rose-500")} />
            <span className={financials.netProfit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
              {financials.netMargin.toFixed(1)}% Net Profit Margin
            </span>
          </div>
        </Card>
      </div>

      {/* Main Income Statement Table Card */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Rincian Laporan Laba Rugi
              </h3>
              <p className="text-xs text-muted-foreground">
                Periode: <strong className="text-foreground">{date?.from ? format(date.from, "d MMMM yyyy", { locale: localeId }) : 'Semua Waktu'}</strong> s/d <strong className="text-foreground">{date?.to ? format(date.to, "d MMMM yyyy", { locale: localeId }) : 'Sekarang'}</strong>
              </p>
            </div>

            <div className="text-xs text-muted-foreground font-medium">
              Metode: <span className="font-bold text-foreground">{reportMethod === 'accrual' ? 'Basis Akrual (Seluruh Tagihan)' : 'Basis Kas Lunas'}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Komponen Keuangan</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Rasio %</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Nominal (IDR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/60">
                  {/* Row 1: Pendapatan Usaha */}
                  <TableRow className="hover:bg-muted/30 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-sm text-foreground">
                          {reportMethod === 'accrual' ? 'Total Pendapatan Tagihan (Invoiced Revenue)' : 'Realisasi Kas Masuk (Cash Collected)'}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {reportMethod === 'accrual' 
                            ? 'Akumulasi seluruh nilai faktur tagihan yang diterbitkan kepada klien.' 
                            : 'Penerimaan kas dari pembayaran faktur yang berhasil lunas.'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-bold text-xs text-muted-foreground">
                      100.0%
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right font-black text-base text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(financials.revenue)}
                    </TableCell>
                  </TableRow>

                  {/* Row 2: HPP */}
                  <TableRow className="hover:bg-muted/30 transition-colors bg-muted/10">
                    <TableCell className="px-6 py-4 pl-10">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-sm text-muted-foreground">(-) Harga Pokok Penjualan (HPP)</span>
                        <p className="text-xs text-muted-foreground/80">Akumulasi modal item barang/jasa sesuai metode yang dipilih.</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-bold text-xs text-muted-foreground">
                      {financials.revenue > 0 ? `${((financials.cogs / financials.revenue) * 100).toFixed(1)}%` : '0.0%'}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right font-bold text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                      ({formatCurrency(financials.cogs)})
                    </TableCell>
                  </TableRow>

                  {/* Row 3: Laba Kotor (Subtotal Highlight) */}
                  <TableRow className="bg-muted/40 hover:bg-muted/50 transition-colors font-bold border-y-2 border-border">
                    <TableCell className="px-6 py-4 font-black text-sm text-foreground">
                      (=) LABA KOTOR (GROSS PROFIT)
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-black text-xs text-primary">
                      {financials.grossMargin.toFixed(1)}%
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right font-black text-base text-foreground tabular-nums">
                      {formatCurrency(financials.grossProfit)}
                    </TableCell>
                  </TableRow>

                  {/* Row 4: Beban Operasional */}
                  <TableRow className="hover:bg-muted/30 transition-colors bg-muted/10">
                    <TableCell className="px-6 py-4 pl-10">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-sm text-muted-foreground">(-) Beban Operasional & Pengeluaran</span>
                        <p className="text-xs text-muted-foreground/80">Biaya umum, operasional harian, dan pengeluaran non-HPP.</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-bold text-xs text-muted-foreground">
                      {financials.revenue > 0 ? `${((financials.totalExpenses / financials.revenue) * 100).toFixed(1)}%` : '0.0%'}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right font-bold text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                      ({formatCurrency(financials.totalExpenses)})
                    </TableCell>
                  </TableRow>

                  {/* Row 5: Laba Bersih (Grand Total Highlight) */}
                  <TableRow className={cn(
                    "font-black text-base border-t-2 border-primary/40",
                    financials.netProfit >= 0 ? "bg-emerald-500/10 hover:bg-emerald-500/15" : "bg-rose-500/10 hover:bg-rose-500/15"
                  )}>
                    <TableCell className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        {financials.netProfit >= 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <TrendingDown className="h-5 w-5 text-rose-500" />}
                        <span className="font-black text-base text-foreground">(=) LABA BERSIH REAL (NET PROFIT)</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-5 text-center font-black text-sm text-emerald-600 dark:text-emerald-400">
                      {financials.netMargin.toFixed(1)}%
                    </TableCell>
                    <TableCell className={cn(
                      "px-6 py-5 text-right font-black text-xl tabular-nums",
                      financials.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {formatCurrency(financials.netProfit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <style>{`
        @media print {
          body { background-color: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          #report-page { padding: 0 !important; }
          .card { border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ProfitLossReport;