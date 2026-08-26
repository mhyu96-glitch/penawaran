import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, Wallet, Calendar as CalendarIcon, Printer, 
  TrendingUp, TrendingDown, RefreshCw, ShoppingBag, 
  Layers, ArrowUpRight, CheckCircle2, FileText, Sparkles, 
  Receipt, AlertTriangle, Clock, FolderKanban, BarChart3, 
  Users, Building2, CheckSquare, Eye, ChevronRight, Filter
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, addDays, startOfMonth, startOfYear, subDays, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { calculateItemTotal, calculateSubtotal, calculateTotal, cn, formatCurrency, safeFormat, isDateBeforeToday } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

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
  discount_amount: number;
  tax_amount: number;
  down_payment_amount?: number;
  invoice_items?: InvoiceItem[];
};

type QuoteItem = {
  quantity: number;
  unit_price: number;
  cost_price?: number | null;
};

type QuoteData = {
  id: string;
  quote_number: string;
  to_client: string;
  status: string;
  created_at: string;
  valid_until?: string | null;
  discount_amount: number;
  tax_amount: number;
  quote_items?: QuoteItem[];
};

type PaymentData = {
  id: string;
  invoice_id?: string;
  amount?: number;
  amount_paid?: number;
  payment_date?: string;
  created_at: string;
  payment_method?: string;
  status?: string;
  notes?: string;
  invoices?: {
    id: string;
    invoice_number: string;
    to_client: string;
    discount_amount: number;
    tax_amount: number;
    invoice_items?: InvoiceItem[];
  } | null;
};

type ExpenseData = {
  id: string;
  amount: number;
  expense_date: string;
  created_at: string;
  description: string;
  category?: string | null;
};

type ProjectData = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  clients?: { name: string } | null;
};

const Reports = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [quotes, setQuotes] = useState<QuoteData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab View
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payments' | 'quotes' | 'expenses'>('overview');

  // Date Range Filter: Default undefined (Semua Waktu) so user immediately sees ALL numbers
  const [date, setDate] = useState<DateRange | undefined>(undefined);

  const fetchAllData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [invRes, quoteRes, payRes, expRes, projRes] = await Promise.all([
        // 1. Invoices
        supabase
          .from('invoices')
          .select('id, invoice_number, to_client, status, created_at, due_date, discount_amount, tax_amount, down_payment_amount, invoice_items(quantity, unit_price, cost_price)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        // 2. Quotes
        supabase
          .from('quotes')
          .select('id, quote_number, to_client, status, created_at, valid_until, discount_amount, tax_amount, quote_items(quantity, unit_price, cost_price)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        // 3. Payments
        supabase
          .from('payments')
          .select('id, invoice_id, amount, amount_paid, payment_date, created_at, payment_method, status, notes, invoices(id, invoice_number, to_client, discount_amount, tax_amount, invoice_items(quantity, unit_price, cost_price))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        // 4. Expenses
        supabase
          .from('expenses')
          .select('id, amount, expense_date, created_at, description, category')
          .eq('user_id', user.id)
          .order('expense_date', { ascending: false }),

        // 5. Projects
        supabase
          .from('projects')
          .select('id, name, status, created_at, clients(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (invRes.data) setInvoices(invRes.data as InvoiceData[]);
      if (quoteRes.data) setQuotes(quoteRes.data as QuoteData[]);
      if (payRes.data) setPayments(payRes.data as PaymentData[]);
      if (expRes.data) setExpenses(expRes.data as ExpenseData[]);
      if (projRes.data) setProjects(projRes.data as ProjectData[]);
    } catch (err) {
      console.error('Error fetching comprehensive report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
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

  // Quote Calculator
  const getQuoteTotal = (quote: QuoteData) => {
    const subtotal = quote.quote_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(quote.discount_amount) || 0);
    return afterDiscount + (Number(quote.tax_amount) || 0);
  };

  const getQuoteCogs = (quote: QuoteData) => {
    return quote.quote_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.cost_price) || 0)), 0) || 0;
  };

  // Filter helper by date
  const isDateInFilter = (dateStr: string | null | undefined) => {
    if (!date?.from) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const from = startOfDay(date.from);
    const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
    return d >= from && d <= to;
  };

  // Filtered Lists & Calculations
  const metrics = useMemo(() => {
    // 1. Invoices Filtering
    const filteredInvoices = invoices.filter(inv => isDateInFilter(inv.created_at || inv.due_date));
    
    let totalInvoicedAmount = 0; // Total Nilai Semua Tagihan
    let paidInvoicesAmount = 0;  // Total Lunas
    let unpaidInvoicesAmount = 0; // Total Belum Lunas (Piutang)
    let overdueInvoicesAmount = 0; // Total Jatuh Tempo
    let totalInvoicedCogs = 0;
    let paidInvoicesCogs = 0;

    let paidCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;

    filteredInvoices.forEach(inv => {
      const invTotal = getInvoiceTotal(inv);
      const invCogs = getInvoiceCogs(inv);
      const s = (inv.status || '').toLowerCase();

      totalInvoicedAmount += invTotal;
      totalInvoicedCogs += invCogs;

      if (s === 'lunas' || s === 'paid') {
        paidInvoicesAmount += invTotal;
        paidInvoicesCogs += invCogs;
        paidCount++;
      } else {
        unpaidInvoicesAmount += invTotal;
        unpaidCount++;
        if (isDateBeforeToday(inv.due_date)) {
          overdueInvoicesAmount += invTotal;
          overdueCount++;
        }
      }
    });

    // 2. Payments Filtering (Recorded Cash Transactions)
    const filteredPayments = payments.filter(p => isDateInFilter(p.payment_date || p.created_at));
    let totalPaymentsCollected = 0;
    filteredPayments.forEach(p => {
      const st = (p.status || '').toLowerCase();
      if (st !== 'failed' && st !== 'batal') {
        totalPaymentsCollected += Number(p.amount ?? p.amount_paid ?? 0);
      }
    });

    // Cash Realized: Gunakan pembayaran tercatat jika ada, atau fallback ke faktur lunas
    const realizedRevenue = Math.max(paidInvoicesAmount, totalPaymentsCollected);

    // 3. Quotes Filtering
    const filteredQuotes = quotes.filter(q => isDateInFilter(q.created_at || q.valid_until));
    let totalQuotesAmount = 0;
    let acceptedQuotesAmount = 0;
    let pendingQuotesAmount = 0;
    let totalQuotesCogs = 0;

    filteredQuotes.forEach(q => {
      const qTotal = getQuoteTotal(q);
      const qCogs = getQuoteCogs(q);
      const s = (q.status || '').toLowerCase();

      totalQuotesAmount += qTotal;
      totalQuotesCogs += qCogs;

      if (s === 'diterima' || s === 'accepted') {
        acceptedQuotesAmount += qTotal;
      } else {
        pendingQuotesAmount += qTotal;
      }
    });

    // 4. Expenses Filtering
    const filteredExpenses = expenses.filter(e => isDateInFilter(e.expense_date || e.created_at));
    const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // 5. Projects Filtering
    const filteredProjects = projects.filter(p => isDateInFilter(p.created_at));
    const activeProjectsCount = filteredProjects.filter(p => (p.status || '').toLowerCase() === 'ongoing').length;

    // Profit Calculations
    // A. Realized Basis (Berdasarkan Kas Lunas Masuk)
    const realizedGrossProfit = realizedRevenue - paidInvoicesCogs;
    const realizedNetProfit = realizedGrossProfit - totalExpensesAmount;
    const realizedMargin = realizedRevenue > 0 ? (realizedNetProfit / realizedRevenue) * 100 : 0;

    // B. Accrual / Potential Total Basis (Berdasarkan Semua Faktur Tagihan Bisnis)
    const totalGrossProfit = totalInvoicedAmount - totalInvoicedCogs;
    const totalNetProfit = totalGrossProfit - totalExpensesAmount;
    const totalMargin = totalInvoicedAmount > 0 ? (totalNetProfit / totalInvoicedAmount) * 100 : 0;

    return {
      filteredInvoices,
      filteredQuotes,
      filteredPayments,
      filteredExpenses,
      filteredProjects,

      // Invoices
      totalInvoicedAmount,
      paidInvoicesAmount,
      unpaidInvoicesAmount,
      overdueInvoicesAmount,
      totalInvoicedCogs,
      paidInvoicesCogs,
      paidCount,
      unpaidCount,
      overdueCount,

      // Payments & Cash Realized
      totalPaymentsCollected,
      realizedRevenue,

      // Quotes
      totalQuotesAmount,
      acceptedQuotesAmount,
      pendingQuotesAmount,
      totalQuotesCogs,

      // Expenses
      totalExpensesAmount,
      activeProjectsCount,

      // Profits
      realizedGrossProfit,
      realizedNetProfit,
      realizedMargin,
      totalGrossProfit,
      totalNetProfit,
      totalMargin,
    };
  }, [invoices, quotes, payments, expenses, projects, date]);

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
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6 px-3 py-3 sm:px-6 lg:px-8 pb-28 sm:pb-8" id="report-page">
      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/80 text-white p-4 sm:p-7 shadow-xl print:hidden">
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Laporan Finansial 360° Bisnis
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-300">
                {invoices.length} Faktur • {quotes.length} Penawaran
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              Laporan Keuangan Komprehensif
            </h1>

            <p className="text-slate-300/80 text-xs sm:text-sm leading-relaxed max-w-xl font-medium hidden sm:block">
              Rekapitulasi lengkap seluruh perputaran nilai bisnis: Total tagihan invoice, realisasi pelunasan, piutang tertahan, penawaran harga, biaya modal (HPP), dan laba bersih.
            </p>
          </div>

          {/* Date Picker & Action Controls */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <Button 
              onClick={fetchAllData} 
              variant="outline" 
              size="sm"
              className="h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-3 text-xs"
              title="Refresh Laporan"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-emerald-400", loading && "animate-spin")} />
            </Button>

            {/* Custom Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  id="date" 
                  variant="outline" 
                  size="sm"
                  className={cn(
                    "h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md px-3 text-xs font-semibold gap-1.5 grow sm:grow-0",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate max-w-[150px] sm:max-w-none">
                    {date?.from ? (
                      date.to ? (
                        `${format(date.from, "d MMM", { locale: localeId })} - ${format(date.to, "d MMM yyyy", { locale: localeId })}`
                      ) : (
                        format(date.from, "d MMM yyyy", { locale: localeId })
                      )
                    ) : (
                      "Semua Waktu"
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
              size="sm"
              onClick={() => window.print()}
              className="h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-3 font-bold text-xs"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5 text-sky-400" /> Cetak / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
        <h1 className="text-2xl font-black text-slate-900">Laporan Keuangan Eksekutif 360°</h1>
        <p className="text-sm text-slate-600">
          Periode: {date?.from ? format(date.from, 'd MMMM yyyy', { locale: localeId }) : 'Semua Waktu'} s/d {date?.to ? format(date.to, 'd MMMM yyyy', { locale: localeId }) : 'Sekarang'}
        </p>
      </div>

      {/* 4 Primary Financial KPI Cards - 2 Columns on Mobile, 4 Columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Nilai Seluruh Tagihan (Total Invoiced) */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Tagihan</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-2xs">
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(metrics.totalInvoicedAmount)}
            </h3>
          </div>
          <div className="mt-2 hidden sm:flex items-center justify-between text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {metrics.filteredInvoices.length} Faktur
            </span>
            <span className="font-bold text-foreground">{metrics.paidCount} Lunas / {metrics.unpaidCount} Pending</span>
          </div>
        </Card>

        {/* Card 2: Realisasi Kas Masuk (Paid Invoices / Pelunasan) */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Kas Masuk (Lunas)</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(metrics.realizedRevenue)}
            </h3>
          </div>
          <div className="mt-2 hidden sm:flex items-center justify-between text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Pelunasan Berhasil
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{metrics.totalInvoicedAmount > 0 ? `${((metrics.realizedRevenue / metrics.totalInvoicedAmount) * 100).toFixed(1)}% Terkumpul` : '100%'}</span>
          </div>
        </Card>

        {/* Card 3: Piutang Usaha & Tunggakan */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Piutang & Tunggakan</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 shadow-2xs">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(metrics.unpaidInvoicesAmount)}
            </h3>
          </div>
          <div className="mt-2 hidden sm:flex items-center justify-between text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {metrics.overdueCount} Jatuh Tempo
            </span>
            <span>{metrics.unpaidCount} Faktur</span>
          </div>
        </Card>

        {/* Card 4: Nilai Pipeline Penawaran */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Pipeline Penawaran</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-2xs">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(metrics.totalQuotesAmount)}
            </h3>
          </div>
          <div className="mt-2 hidden sm:flex items-center justify-between text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Goal: {formatCurrency(metrics.acceptedQuotesAmount)}
            </span>
            <span>{metrics.filteredQuotes.length} Proposal</span>
          </div>
        </Card>
      </div>

      {/* Profit & Health Comparison Card */}
      <Card className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-border/70">
          <div className="space-y-1 pr-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Harga Pokok (HPP)</span>
            <h4 className="text-xl font-extrabold text-foreground">{formatCurrency(metrics.totalInvoicedCogs)}</h4>
            <p className="text-xs text-muted-foreground">Total modal item barang/jasa dari seluruh tagihan.</p>
          </div>

          <div className="space-y-1 pt-4 md:pt-0 md:px-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Beban Operasional</span>
            <h4 className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{formatCurrency(metrics.totalExpensesAmount)}</h4>
            <p className="text-xs text-muted-foreground">{metrics.filteredExpenses.length} catatan beban pengeluaran.</p>
          </div>

          <div className="space-y-1 pt-4 md:pt-0 md:px-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Laba Bersih Terealisasi</span>
            <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(metrics.realizedNetProfit)}</h4>
            <p className="text-xs text-muted-foreground">Dari kas lunas yang berhasil diterima ({metrics.realizedMargin.toFixed(1)}% margin).</p>
          </div>

          <div className="space-y-1 pt-4 md:pt-0 md:pl-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Potensi Laba Total (Akrual)</span>
            <h4 className="text-xl font-black text-foreground">{formatCurrency(metrics.totalNetProfit)}</h4>
            <p className="text-xs text-muted-foreground">Jika seluruh tagihan faktur terbayar ({metrics.totalMargin.toFixed(1)}% margin).</p>
          </div>
        </div>
      </Card>

      {/* Interactive Tabs for Complete Document Breakdown */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 overflow-x-auto max-w-full">
              {[
                { key: 'overview', label: 'Ringkasan Eksekutif 360°', icon: BarChart3 },
                { key: 'invoices', label: `Semua Faktur (${metrics.filteredInvoices.length})`, icon: Receipt },
                { key: 'payments', label: `Kas Masuk (${metrics.filteredPayments.length})`, icon: DollarSign },
                { key: 'quotes', label: `Penawaran Harga (${metrics.filteredQuotes.length})`, icon: FileText },
                { key: 'expenses', label: `Beban Pengeluaran (${metrics.filteredExpenses.length})`, icon: Wallet },
              ].map(tab => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap select-none",
                      isActive
                        ? "bg-background text-foreground shadow-xs border border-border/70"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-muted-foreground font-semibold">
              Menampilkan data komprehensif seluruh transaksi
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
            <div>
              {/* TAB 1: OVERVIEW 360 */}
              {activeTab === 'overview' && (
                <div className="p-6 space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Matrix 1: Faktur Status Breakdown */}
                    <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-primary" />
                          Rincian Status Faktur Tagihan
                        </h4>
                        <span className="text-xs font-black text-foreground">{formatCurrency(metrics.totalInvoicedAmount)}</span>
                      </div>

                      <div className="space-y-3">
                        {/* Lunas */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Lunas ({metrics.paidCount})
                            </span>
                            <span>{formatCurrency(metrics.paidInvoicesAmount)}</span>
                          </div>
                          <Progress value={metrics.totalInvoicedAmount > 0 ? (metrics.paidInvoicesAmount / metrics.totalInvoicedAmount) * 100 : 0} className="h-2 rounded-full" />
                        </div>

                        {/* Piutang Pending / Jatuh Tempo */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Belum Lunas / Jatuh Tempo ({metrics.unpaidCount})
                            </span>
                            <span>{formatCurrency(metrics.unpaidInvoicesAmount)}</span>
                          </div>
                          <Progress value={metrics.totalInvoicedAmount > 0 ? (metrics.unpaidInvoicesAmount / metrics.totalInvoicedAmount) * 100 : 0} className="h-2 rounded-full" />
                        </div>
                      </div>
                    </div>

                    {/* Matrix 2: Penawaran Pipeline Breakdown */}
                    <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <FileText className="h-4 w-4 text-amber-500" />
                          Rincian Pipeline Penawaran
                        </h4>
                        <span className="text-xs font-black text-foreground">{formatCurrency(metrics.totalQuotesAmount)}</span>
                      </div>

                      <div className="space-y-3">
                        {/* Diterima */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Goal Diterima Klien
                            </span>
                            <span>{formatCurrency(metrics.acceptedQuotesAmount)}</span>
                          </div>
                          <Progress value={metrics.totalQuotesAmount > 0 ? (metrics.acceptedQuotesAmount / metrics.totalQuotesAmount) * 100 : 0} className="h-2 rounded-full" />
                        </div>

                        {/* Pending / Draft */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> Dalam Penjajakan / Draf
                            </span>
                            <span>{formatCurrency(metrics.pendingQuotesAmount)}</span>
                          </div>
                          <Progress value={metrics.totalQuotesAmount > 0 ? (metrics.pendingQuotesAmount / metrics.totalQuotesAmount) * 100 : 0} className="h-2 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SEMUA FAKTUR */}
              {activeTab === 'invoices' && (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">No. Faktur</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Klien</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Status</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Jatuh Tempo</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Modal HPP</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Total Tagihan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {metrics.filteredInvoices.map((inv) => {
                        const total = getInvoiceTotal(inv);
                        const cogs = getInvoiceCogs(inv);
                        const s = (inv.status || '').toLowerCase();
                        const isOverdue = s !== 'lunas' && isDateBeforeToday(inv.due_date);

                        return (
                          <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="px-5 py-3.5">
                              <Link to={`/invoice/${inv.id}`} className="font-mono font-bold text-xs text-primary hover:underline flex items-center gap-1">
                                #{inv.invoice_number}
                              </Link>
                            </TableCell>
                            <TableCell className="px-5 py-3.5 font-bold text-xs text-foreground">
                              {inv.to_client || 'Klien Umum'}
                            </TableCell>
                            <TableCell className="px-5 py-3.5">
                              {s === 'lunas' || s === 'paid' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold px-2 py-0.5">
                                  <CheckCircle2 className="h-3 w-3" /> Lunas
                                </span>
                              ) : isOverdue ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-bold px-2 py-0.5">
                                  <AlertTriangle className="h-3 w-3 animate-pulse" /> Jatuh Tempo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold px-2 py-0.5">
                                  <Clock className="h-3 w-3" /> {inv.status || 'Pending'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                              {inv.due_date ? safeFormat(inv.due_date, 'd MMM yyyy') : '-'}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-right font-medium text-xs text-muted-foreground tabular-nums">
                              {formatCurrency(cogs)}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-right font-black text-xs text-foreground tabular-nums">
                              {formatCurrency(total)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Seluruh Tagihan Faktur</span>
                    <span className="font-black text-base text-foreground tabular-nums">
                      {formatCurrency(metrics.totalInvoicedAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 3: KAS MASUK */}
              {activeTab === 'payments' && (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Tanggal</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Faktur & Klien</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Metode / Catatan</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Jumlah Diterima</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {metrics.filteredPayments.length === 0 && metrics.paidInvoicesAmount > 0 ? (
                        metrics.filteredInvoices.filter(i => (i.status || '').toLowerCase() === 'lunas').map(inv => (
                          <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="px-5 py-3.5 text-xs text-muted-foreground">
                              {safeFormat(inv.created_at, 'd MMM yyyy')}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 font-bold text-xs text-foreground">
                              #{inv.invoice_number} • {inv.to_client}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-xs text-muted-foreground">
                              Pelunasan Faktur
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-right font-black text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatCurrency(getInvoiceTotal(inv))}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        metrics.filteredPayments.map(p => (
                          <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="px-5 py-3.5 text-xs text-muted-foreground">
                              {safeFormat(p.payment_date || p.created_at, 'd MMM yyyy')}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 font-bold text-xs text-foreground">
                              #{p.invoices?.invoice_number || 'Faktur'} • {p.invoices?.to_client || 'Klien'}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-xs text-muted-foreground">
                              {p.payment_method || p.notes || 'Pembayaran Diterima'}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-right font-black text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatCurrency(Number(p.amount ?? p.amount_paid ?? 0))}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  <div className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Kas Masuk Terkumpul</span>
                    <span className="font-black text-base text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(metrics.realizedRevenue)}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 4: PENAWARAN HARGA */}
              {activeTab === 'quotes' && (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">No. Penawaran</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Klien</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Status</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Modal HPP</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Estimasi Nilai</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {metrics.filteredQuotes.map((q) => {
                        const total = getQuoteTotal(q);
                        const cogs = getQuoteCogs(q);
                        const s = (q.status || '').toLowerCase();

                        return (
                          <TableRow key={q.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="px-5 py-3.5">
                              <Link to={`/quote/${q.id}`} className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 hover:underline">
                                #{q.quote_number}
                              </Link>
                            </TableCell>
                            <TableCell className="px-5 py-3.5 font-bold text-xs text-foreground">
                              {q.to_client || 'Klien Umum'}
                            </TableCell>
                            <TableCell className="px-5 py-3.5">
                              <Badge variant="outline" className="text-[11px] font-bold">
                                {q.status || 'Draf'}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-right font-medium text-xs text-muted-foreground tabular-nums">
                              {formatCurrency(cogs)}
                            </TableCell>
                            <TableCell className="px-5 py-3.5 text-right font-black text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatCurrency(total)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Nilai Pipeline Penawaran</span>
                    <span className="font-black text-base text-amber-600 dark:text-amber-400 tabular-nums">
                      {formatCurrency(metrics.totalQuotesAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 5: BEBAN PENGELUARAN */}
              {activeTab === 'expenses' && (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Tanggal</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Deskripsi Beban</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Kategori</TableHead>
                        <TableHead className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Nominal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {metrics.filteredExpenses.map((e) => (
                        <TableRow key={e.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                            {safeFormat(e.expense_date, 'd MMM yyyy')}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 font-bold text-xs text-foreground">
                            {e.description}
                          </TableCell>
                          <TableCell className="px-5 py-3.5">
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md inline-block">
                              {e.category || 'Operasional'}
                            </span>
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right font-black text-xs text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatCurrency(e.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Beban Pengeluaran</span>
                    <span className="font-black text-base text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatCurrency(metrics.totalExpensesAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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

export default Reports;
