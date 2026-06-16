import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, FileText, Clock, Calendar as CalendarIcon, AlertCircle, Wallet, TrendingUp, Users, Activity, Bell, Target, Pencil, Check, Package, AlertTriangle, Plus, Receipt, ArrowUpRight, ArrowDownRight, Sparkles, CreditCard, BarChart3 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { format, addDays, differenceInDays, eachDayOfInterval, startOfDay, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatCurrency, safeFormat, safeFormatDistance, calculateSubtotal, calculateTotal, calculateItemTotal, isDateBeforeToday } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';

type Quote = {
  id: string;
  status: string;
  quote_items: { quantity: number; unit_price: number; cost_price: number; }[];
  to_client: string;
  created_at: string;
  clients: { name: string } | null;
  client_id: string;
};

type Invoice = {
    id: string;
    status: string;
    due_date: string;
    to_client: string;
    discount_amount: number;
    tax_amount: number;
    invoice_items: { quantity: number; unit_price: number; }[];
};

type Expense = {
    amount: number;
    expense_date: string;
};

type Payment = {
    amount: number;
    payment_date: string;
    invoices: {
        discount_amount: number | null;
        tax_amount: number | null;
        invoice_items: {
            quantity: number;
            unit_price: number;
            cost_price: number | null;
        }[];
    } | null;
};

type Notification = {
    id: string;
    message: string;
    created_at: string;
    link: string | null;
};

type LowStockItem = {
    id: string;
    description: string;
    stock: number;
    min_stock_alert: number;
    unit: string;
};

type StockItemRow = LowStockItem;

const compactNumber = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  compactDisplay: 'short',
});

const getAllocatedPaymentCost = (payment: Payment) => {
  const invoice = payment.invoices;
  if (!invoice?.invoice_items?.length) return 0;

  const subtotal = calculateSubtotal(invoice.invoice_items);
  const invoiceTotal = calculateTotal(subtotal, invoice.discount_amount || 0, invoice.tax_amount || 0);
  const invoiceCost = invoice.invoice_items.reduce(
    (sum, item) => sum + calculateItemTotal(item.quantity, item.cost_price || 0),
    0
  );

  if (invoiceTotal <= 0) return invoiceCost;
  return invoiceCost * Math.min(payment.amount / invoiceTotal, 1);
};

const Dashboard = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recentActivities, setRecentActivities] = useState<Notification[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -29),
    to: new Date(),
  });
  
  // Target States
  const [revenueGoal, setRevenueGoal] = useState(0);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      const fromDate = date?.from ? startOfDay(date.from).toISOString() : undefined;
      const toDate = date?.to ? startOfDay(addDays(date.to, 1)).toISOString() : undefined;

      const quoteQuery = supabase.from('quotes').select('id, status, to_client, created_at, client_id, clients(name), quote_items(quantity, unit_price, cost_price)').eq('user_id', user.id).order('created_at', { ascending: false });
      const invoiceQuery = supabase.from('invoices').select('id, status, due_date, to_client, discount_amount, tax_amount, invoice_items(quantity, unit_price)').eq('user_id', user.id);
      const expenseQuery = supabase.from('expenses').select('amount, expense_date').eq('user_id', user.id);
      const paymentQuery = supabase
        .from('payments')
        .select('amount, payment_date, invoices(discount_amount, tax_amount, invoice_items(quantity, unit_price, cost_price))')
        .eq('user_id', user.id)
        .eq('status', 'Lunas');
      const activityQuery = supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
      const profileQuery = supabase.from('profiles').select('monthly_revenue_goal').eq('id', user.id).single();
      
      const stockQuery = supabase.from('items').select('id, description, stock, min_stock_alert, unit').eq('user_id', user.id).eq('track_stock', true);

      if (fromDate) {
        quoteQuery.gte('quote_date', fromDate);
        invoiceQuery.gte('invoice_date', fromDate);
        expenseQuery.gte('expense_date', fromDate);
        paymentQuery.gte('payment_date', fromDate);
      }
      if (toDate) {
        quoteQuery.lt('quote_date', toDate);
        invoiceQuery.lt('invoice_date', toDate);
        expenseQuery.lt('expense_date', toDate);
        paymentQuery.lt('payment_date', toDate);
      }

      const [quoteRes, invoiceRes, expenseRes, paymentRes, activityRes, profileRes, stockRes] = await Promise.all([quoteQuery, invoiceQuery, expenseQuery, paymentQuery, activityQuery, profileQuery, stockQuery]);

      if (quoteRes.error) console.error('Error fetching quotes:', quoteRes.error); else setQuotes(quoteRes.data as Quote[]);
      if (invoiceRes.error) console.error('Error fetching invoices:', invoiceRes.error); else setInvoices(invoiceRes.data as Invoice[]);
      if (expenseRes.error) console.error('Error fetching expenses:', expenseRes.error); else setExpenses(expenseRes.data as Expense[]);
      if (paymentRes.error) console.error('Error fetching payments:', paymentRes.error); else setPayments(paymentRes.data as Payment[]);
      if (activityRes.data) setRecentActivities(activityRes.data as Notification[]);
      if (profileRes.data) setRevenueGoal(profileRes.data.monthly_revenue_goal || 0);
      
      if (stockRes.data) {
          const lowStock = (stockRes.data as StockItemRow[]).filter((item) => item.stock <= (item.min_stock_alert || 5));
          setLowStockItems(lowStock);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [user, date]);

  const updateGoal = async () => {
    if (!user) return;
    const newGoal = parseFloat(tempGoal);
    if (isNaN(newGoal) || newGoal < 0) return;

    const { error } = await supabase.from('profiles').update({ monthly_revenue_goal: newGoal }).eq('id', user.id);
    if (error) {
        showError('Gagal memperbarui target.');
    } else {
        setRevenueGoal(newGoal);
        setIsEditingGoal(false);
        showSuccess('Target pendapatan diperbarui!');
    }
  };

  const totalRevenue = useMemo(() => payments.reduce((acc, payment) => acc + payment.amount, 0), [payments]);
  const totalCostOfGoods = useMemo(() => payments.reduce((acc, payment) => acc + getAllocatedPaymentCost(payment), 0), [payments]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, exp) => acc + exp.amount, 0), [expenses]);
  const netProfit = totalRevenue - totalCostOfGoods - totalExpenses;

  const invoiceStats = useMemo(() => {
    let unpaidAmount = 0;
    let overdueAmount = 0;
    invoices.forEach(invoice => {
        if (invoice.status !== 'Lunas') {
            const subtotal = calculateSubtotal(invoice.invoice_items);
            const total = calculateTotal(subtotal, invoice.discount_amount, invoice.tax_amount);
            unpaidAmount += total;
            
            // Safe date check
            if (isDateBeforeToday(invoice.due_date)) {
                overdueAmount += total;
            }
        }
    });
    return { unpaidAmount, overdueAmount };
  }, [invoices]);

  const quoteConversionRate = useMemo(() => {
    const sentOrAcceptedQuotes = quotes.filter(q => q.status === 'Terkirim' || q.status === 'Diterima' || q.status === 'Ditolak');
    if (sentOrAcceptedQuotes.length === 0) return 0;
    const acceptedCount = quotes.filter(q => q.status === 'Diterima').length;
    return (acceptedCount / sentOrAcceptedQuotes.length) * 100;
  }, [quotes]);

  const financialChartData = useMemo(() => {
    if (!date?.from || !date?.to) return [];
    try {
        const days = eachDayOfInterval({ start: date.from, end: date.to });
        return days.map(day => {
            const formattedDate = format(day, 'dd MMM');
            const dayStart = startOfDay(day);

            const dailyRevenue = payments
                .filter(p => {
                    const d = new Date(p.payment_date);
                    return isValid(d) && startOfDay(d).getTime() === dayStart.getTime();
                })
                .reduce((sum, p) => sum + p.amount, 0);

            const dailyExpenses = expenses
                .filter(e => {
                    const d = new Date(e.expense_date);
                    return isValid(d) && startOfDay(d).getTime() === dayStart.getTime();
                })
                .reduce((sum, e) => sum + e.amount, 0);

            const dailyCostOfGoods = payments
                .filter(p => {
                    const d = new Date(p.payment_date);
                    return isValid(d) && startOfDay(d).getTime() === dayStart.getTime();
                })
                .reduce((sum, p) => sum + getAllocatedPaymentCost(p), 0);

            return { name: formattedDate, Pendapatan: dailyRevenue, Biaya: dailyExpenses + dailyCostOfGoods };
        });
    } catch (e) {
        console.error("Error generating chart data", e);
        return [];
    }
  }, [payments, expenses, date]);

  const pendingQuotes = useMemo(() => quotes.filter(q => q.status === 'Terkirim').slice(0, 5), [quotes]);
  
  const overdueInvoices = useMemo(() => {
      return invoices
        .filter(inv => {
            if (inv.status === 'Lunas' || !inv.due_date) return false;
            return isDateBeforeToday(inv.due_date);
        })
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5);
  }, [invoices]);

  const currentMonthRevenue = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return payments
        .filter(p => {
            const d = new Date(p.payment_date);
            return isValid(d) && d >= start && d <= end;
        })
        .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const currentMonthExpenses = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return expenses
        .filter(e => {
            const d = new Date(e.expense_date);
            return isValid(d) && d >= start && d <= end;
        })
        .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const currentMonthCostOfGoods = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return payments
        .filter(p => {
            const d = new Date(p.payment_date);
            return isValid(d) && d >= start && d <= end;
        })
        .reduce((sum, p) => sum + getAllocatedPaymentCost(p), 0);
  }, [payments]);

  const monthlyCashflow = currentMonthRevenue - currentMonthCostOfGoods - currentMonthExpenses;
  const goalProgress = revenueGoal > 0 ? Math.min((currentMonthRevenue / revenueGoal) * 100, 100) : 0;
  const overdueInvoicesCount = overdueInvoices.length;
  const activeInvoiceCount = invoices.filter(invoice => invoice.status !== 'Lunas').length;
  const draftQuotesCount = quotes.filter(quote => quote.status === 'Draft').length;
  const sentQuotesCount = quotes.filter(quote => quote.status === 'Terkirim').length;
  const acceptedQuotesTotal = quotes.filter(quote => quote.status === 'Diterima').length;
  const documentHealthData = [
    { name: 'Draft', value: draftQuotesCount, fill: '#64748b' },
    { name: 'Terkirim', value: sentQuotesCount, fill: '#0f766e' },
    { name: 'Diterima', value: acceptedQuotesTotal, fill: '#16a34a' },
    { name: 'Faktur aktif', value: activeInvoiceCount, fill: '#2563eb' },
    { name: 'Overdue', value: overdueInvoicesCount, fill: '#dc2626' },
  ];
  const attentionCount = overdueInvoices.length + pendingQuotes.length + lowStockItems.length;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <Skeleton className="h-56 rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <section className="relative overflow-hidden rounded-lg bg-slate-950 text-white">
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.32),_transparent_42%),radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_36%)]" />
        <div className="relative space-y-5 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-teal-100">Ringkasan hari ini</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard bisnis</h1>
              <p className="mt-1 text-sm text-slate-300">Cashflow, dokumen, dan follow-up dalam satu layar mobile.</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="secondary"
                  size="sm"
                  className={cn("h-10 shrink-0 bg-white/10 text-white hover:bg-white/15", !date && "text-white")}
                >
                  <CalendarIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {date?.from ? (date.to ? `${safeFormat(date.from.toISOString(), "dd MMM")} - ${safeFormat(date.to.toISOString(), "dd MMM")}` : safeFormat(date.from.toISOString(), "dd MMM")) : 'Periode'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={1} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg bg-white/[0.07] p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-300">Laba bulan ini</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-3xl font-semibold tracking-tight sm:text-4xl">{formatCurrency(monthlyCashflow)}</p>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", monthlyCashflow >= 0 ? "bg-emerald-400/15 text-emerald-100" : "bg-rose-400/15 text-rose-100")}>
                      {monthlyCashflow >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {monthlyCashflow >= 0 ? 'Surplus' : 'Defisit'}
                    </span>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-teal-400/15 text-teal-100">
                  <BarChart3 className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-white/[0.06] p-3">
                  <p className="text-slate-300">Masuk</p>
                  <p className="mt-1 font-semibold text-emerald-100">{formatCurrency(currentMonthRevenue)}</p>
                </div>
                <div className="rounded-md bg-white/[0.06] p-3">
                  <p className="text-slate-300">Biaya</p>
                  <p className="mt-1 font-semibold text-amber-100">{formatCurrency(currentMonthCostOfGoods + currentMonthExpenses)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white/[0.07] p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-300">Target pendapatan</p>
                  <p className="mt-1 text-xl font-semibold">{goalProgress.toFixed(0)}% tercapai</p>
                </div>
                {!isEditingGoal ? (
                  <Button variant="secondary" size="icon" className="h-9 w-9 bg-white/10 text-white hover:bg-white/15" onClick={() => { setTempGoal(String(revenueGoal)); setIsEditingGoal(true); }}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit target</span>
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={tempGoal}
                      onChange={(e) => setTempGoal(e.target.value)}
                      className="h-9 w-28 border-white/20 bg-white text-slate-950"
                      placeholder="Target Rp"
                    />
                    <Button size="icon" className="h-9 w-9" onClick={updateGoal}>
                      <Check className="h-4 w-4" />
                      <span className="sr-only">Simpan target</span>
                    </Button>
                  </div>
                )}
              </div>
              <Progress value={goalProgress} className="mt-4 h-2 bg-white/15" indicatorClassName="bg-teal-300" />
              <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                <span>{formatCurrency(currentMonthRevenue)}</span>
                <span>{formatCurrency(revenueGoal)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button asChild className="h-14 justify-start rounded-lg">
          <Link to="/quote/new"><FileText className="h-5 w-5" /> Penawaran</Link>
        </Button>
        <Button asChild variant="outline" className="h-14 justify-start rounded-lg bg-card">
          <Link to="/invoice/new"><Receipt className="h-5 w-5 text-primary" /> Faktur</Link>
        </Button>
        <Button asChild variant="outline" className="h-14 justify-start rounded-lg bg-card">
          <Link to="/expenses"><CreditCard className="h-5 w-5 text-amber-700" /> Expense</Link>
        </Button>
        <Button asChild variant="outline" className="h-14 justify-start rounded-lg bg-card">
          <Link to="/clients"><Users className="h-5 w-5 text-sky-700" /> Klien</Link>
        </Button>
      </section>

      {lowStockItems.length > 0 && (
        <Card className="border-rose-200 bg-rose-50 text-rose-950">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" /> Stok menipis
            </CardTitle>
            <CardDescription className="text-rose-800">Barang ini perlu dipesan ulang sebelum workflow penawaran terganggu.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {lowStockItems.map(item => (
                <Link key={item.id} to="/items" className="min-w-48 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm">
                  <span className="block truncate font-medium">{item.description}</span>
                  <span className="mt-1 block text-xs text-rose-700">{item.stock} {item.unit} tersisa</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Laba bersih', value: formatCurrency(netProfit), helper: 'Pendapatan - HPP - biaya', icon: DollarSign, tone: 'text-emerald-700' },
          { label: 'Total biaya', value: formatCurrency(totalCostOfGoods + totalExpenses), helper: 'HPP + pengeluaran', icon: Wallet, tone: 'text-rose-700' },
          { label: 'Belum dibayar', value: formatCurrency(invoiceStats.unpaidAmount), helper: `${activeInvoiceCount} faktur aktif`, icon: Clock, tone: 'text-sky-700' },
          { label: 'Overdue', value: formatCurrency(invoiceStats.overdueAmount), helper: `${overdueInvoicesCount} faktur`, icon: AlertCircle, tone: 'text-amber-700' },
          { label: 'Konversi', value: `${quoteConversionRate.toFixed(1)}%`, helper: 'Penawaran diterima', icon: TrendingUp, tone: 'text-teal-700' },
        ].map((item) => (
          <Card key={item.label} className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-2 truncate text-lg font-semibold tabular-nums sm:text-xl">{item.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.helper}</p>
                </div>
                <item.icon className={cn("h-5 w-5 shrink-0", item.tone)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.85fr]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Grafik cashflow</CardTitle>
            <CardDescription>Pendapatan dan biaya harian.</CardDescription>
              </div>
              <Badge variant="secondary" className="hidden sm:inline-flex">{financialChartData.length} hari</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-72 px-2 sm:h-80 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} minTickGap={18} />
                <YAxis tickLine={false} axisLine={false} width={42} fontSize={11} tickFormatter={(value) => compactNumber.format(value as number)} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} labelClassName="text-foreground" />
                <Area type="monotone" dataKey="Pendapatan" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revenueGradient)" />
                <Area type="monotone" dataKey="Biaya" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#expenseGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Health dokumen</CardTitle>
            <CardDescription>Distribusi status operasional.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 px-2 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={documentHealthData} layout="vertical" margin={{ top: 6, right: 16, left: 18, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis type="category" dataKey="name" width={82} tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip formatter={(value) => [`${value} dokumen`, 'Jumlah']} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Butuh perhatian</CardTitle>
            <CardDescription>{attentionCount > 0 ? `${attentionCount} hal perlu ditindaklanjuti.` : 'Semua aman untuk saat ini.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueInvoices.length > 0 && overdueInvoices.map(inv => (
              <Link key={inv.id} to={`/invoice/${inv.id}`} className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm transition-colors hover:bg-accent">
                <div className="min-w-0">
                  <p className="truncate font-medium">{inv.to_client}</p>
                  <p className="text-xs text-muted-foreground">Faktur jatuh tempo</p>
                </div>
                <Badge variant="destructive">{differenceInDays(new Date(), new Date(inv.due_date))} hari</Badge>
              </Link>
            ))}
            {pendingQuotes.length > 0 && pendingQuotes.map(q => (
              <Link key={q.id} to={`/quote/${q.id}`} className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm transition-colors hover:bg-accent">
                <div className="min-w-0">
                  <p className="truncate font-medium">{q.to_client}</p>
                  <p className="text-xs text-muted-foreground">Menunggu respons sejak {safeFormat(q.created_at, 'dd MMM')}</p>
                </div>
                <Badge variant="secondary">Follow up</Badge>
              </Link>
            ))}
            {attentionCount === 0 && (
              <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                Tidak ada faktur terlambat, penawaran tertunda, atau stok menipis.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Aktivitas terkini</CardTitle>
            <CardDescription>Update terbaru dari workflow bisnis.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.length > 0 ? (
                recentActivities.map(activity => (
                  <div key={activity.id} className="flex gap-3 rounded-md border bg-card p-3 text-sm">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{activity.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{safeFormatDistance(activity.created_at)}</p>
                      {activity.link && (
                        <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
                          <Link to={activity.link}>Lihat detail</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">Belum ada aktivitas baru.</div>
              )}
            </div>
            </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
