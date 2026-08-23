import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, FileText, Clock, Calendar as CalendarIcon, AlertCircle, Wallet, TrendingUp, Users, 
  Activity, Bell, Target, Pencil, Check, Package, AlertTriangle, Plus, Receipt, ArrowUpRight, 
  ArrowDownRight, Sparkles, CreditCard, BarChart3, Zap, TrendingDown, Eye, Star, 
  ShoppingCart, CheckCircle, XCircle, Clock4, Briefcase, PieChart, LineChart, Calendar,
  Trophy, Flame, Crown, Diamond, MapPin, Globe
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';
import { Link } from 'react-router-dom';
import { format, addDays, differenceInDays, eachDayOfInterval, startOfDay, startOfMonth, endOfMonth, isValid, startOfWeek, endOfWeek, subMonths } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatCurrency, safeFormat, safeFormatDistance, calculateSubtotal, calculateTotal, calculateItemTotal, isDateBeforeToday } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* Modern Hero Section with Gradient & Glass Effect */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.15),_transparent_50%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.15),_transparent_50%)]" />
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.05),_transparent_70%)]" />
        
        <div className="relative p-6 sm:p-8">
          {/* Header with Date Range */}
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                  <Crown className="h-4 w-4 text-green-400" />
                </div>
                <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
                  Dashboard Premium
                </Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Selamat {new Date().getHours() < 12 ? 'Pagi' : new Date().getHours() < 18 ? 'Siang' : 'Malam'}! 👋
              </h1>
              <p className="mt-2 text-lg text-slate-300">
                Mari lihat performa bisnis Anda hari ini
              </p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  className="bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (date.to ? `${safeFormat(date.from.toISOString(), "dd MMM")} - ${safeFormat(date.to.toISOString(), "dd MMM")}` : safeFormat(date.from.toISOString(), "dd MMM")) : 'Pilih Periode'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Enhanced KPI Cards */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Revenue Card with Trend */}
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-600/10 p-6 backdrop-blur-sm ring-1 ring-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-200">Pendapatan Bulan Ini</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold text-white">{formatCurrency(currentMonthRevenue)}</h3>
                    <div className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-200">
                      <TrendingUp className="h-3 w-3" />
                      +12%
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">vs bulan lalu</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20">
                  <DollarSign className="h-7 w-7 text-emerald-300" />
                </div>
              </div>
            </div>

            {/* Profit Card */}
            <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-600/10 p-6 backdrop-blur-sm ring-1 ring-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-200">Laba Bersih</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold text-white">{formatCurrency(monthlyCashflow)}</h3>
                    <div className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", 
                      monthlyCashflow >= 0 ? "bg-blue-500/20 text-blue-200" : "bg-red-500/20 text-red-200")}>
                      {monthlyCashflow >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {((monthlyCashflow / (currentMonthRevenue || 1)) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">margin keuntungan</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20">
                  <TrendingUp className="h-7 w-7 text-blue-300" />
                </div>
              </div>
            </div>

            {/* Goal Progress Card */}
            <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-600/10 p-6 backdrop-blur-sm ring-1 ring-white/10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-purple-200">Target Bulanan</p>
                    {!isEditingGoal ? (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white hover:bg-white/10" onClick={() => { setTempGoal(String(revenueGoal)); setIsEditingGoal(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          value={tempGoal}
                          onChange={(e) => setTempGoal(e.target.value)}
                          className="h-6 w-20 text-xs text-black"
                        />
                        <Button size="sm" className="h-6 w-6 p-0" onClick={updateGoal}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <h3 className="text-2xl font-bold text-white">{goalProgress.toFixed(0)}%</h3>
                    <Progress value={goalProgress} className="mt-3 h-2 bg-white/10" />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-400">
                    <span>{formatCurrency(currentMonthRevenue)}</span>
                    <span>{formatCurrency(revenueGoal)}</span>
                  </div>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/20">
                  <Target className="h-7 w-7 text-purple-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modern Quick Actions */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Button asChild className="group h-16 justify-start rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <Link to="/quote/new" className="flex items-center gap-3">
            <div className="rounded-lg bg-white/20 p-2">
              <FileText className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Penawaran</p>
              <p className="text-xs opacity-90">Buat baru</p>
            </div>
          </Link>
        </Button>
        
        <Button asChild variant="outline" className="group h-16 justify-start rounded-xl border-2 shadow-sm transition-all hover:shadow-md hover:scale-105">
          <Link to="/invoice/new" className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 text-green-700">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Faktur</p>
              <p className="text-xs text-muted-foreground">Buat invoice</p>
            </div>
          </Link>
        </Button>

        <Button asChild variant="outline" className="group h-16 justify-start rounded-xl border-2 shadow-sm transition-all hover:shadow-md hover:scale-105">
          <Link to="/expenses" className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Expenses</p>
              <p className="text-xs text-muted-foreground">Catat biaya</p>
            </div>
          </Link>
        </Button>

        <Button asChild variant="outline" className="group h-16 justify-start rounded-xl border-2 shadow-sm transition-all hover:shadow-md hover:scale-105">
          <Link to="/clients" className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <Users className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Klien</p>
              <p className="text-xs text-muted-foreground">Kelola data</p>
            </div>
          </Link>
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

      {/* Enhanced Metrics Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="group relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-500 to-green-600"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Laba Bersih</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(netProfit)}</p>
                <p className="text-xs text-muted-foreground">Margin: {((netProfit/(totalRevenue || 1))*100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-rose-500 to-red-600"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Total Biaya</p>
                <p className="text-lg font-bold text-rose-600">{formatCurrency(totalCostOfGoods + totalExpenses)}</p>
                <p className="text-xs text-muted-foreground">HPP + Operasional</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-2">
                <Wallet className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-cyan-600"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Piutang</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(invoiceStats.unpaidAmount)}</p>
                <p className="text-xs text-muted-foreground">{activeInvoiceCount} faktur aktif</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-amber-500 to-orange-600"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Overdue</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(invoiceStats.overdueAmount)}</p>
                <p className="text-xs text-muted-foreground">{overdueInvoicesCount} terlambat</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-teal-500 to-green-600"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Konversi</p>
                <p className="text-lg font-bold text-teal-600">{quoteConversionRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{acceptedQuotesTotal} diterima</p>
              </div>
              <div className="rounded-lg bg-teal-50 p-2">
                <Target className="h-5 w-5 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-purple-500 to-indigo-600"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Klien Aktif</p>
                <p className="text-lg font-bold text-purple-600">{quotes.filter(q => q.status === 'Diterima').length}</p>
                <p className="text-xs text-muted-foreground">Periode ini</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-2">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Advanced Analytics Section with Tabs */}
      <section>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-3 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="trends" className="hidden lg:flex">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              {/* Enhanced Cashflow Chart */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-blue-600" />
                        Tren Cashflow
                      </CardTitle>
                      <CardDescription>Analisis pendapatan vs biaya harian</CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {financialChartData.length} hari
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="h-80 px-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialChartData}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                      <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(value) => compactNumber.format(value)} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value as number)}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Area type="monotone" dataKey="Pendapatan" stroke="#10b981" strokeWidth={3} fill="url(#revenueGradient)" />
                      <Area type="monotone" dataKey="Biaya" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Document Status Distribution */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-600" />
                    Status Dokumen
                  </CardTitle>
                  <CardDescription>Distribusi status operasional</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={documentHealthData} layout="vertical">
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" axisLine={false} tickLine={false} fontSize={12} />
                      <YAxis type="category" dataKey="name" width={80} axisLine={false} tickLine={false} fontSize={12} />
                      <Tooltip 
                        formatter={(value) => [`${value} dokumen`, 'Jumlah']}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown Biaya</CardTitle>
                  <CardDescription>Analisis struktur biaya operasional</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'HPP', value: totalCostOfGoods, fill: '#ef4444' },
                          { name: 'Operasional', value: totalExpenses, fill: '#f97316' },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'HPP', value: totalCostOfGoods, fill: '#ef4444' },
                          { name: 'Operasional', value: totalExpenses, fill: '#f97316' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Kesehatan Keuangan</CardTitle>
                  <CardDescription>Indikator performa bisnis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Margin Keuntungan</span>
                      <span className="font-medium">{((netProfit/(totalRevenue || 1))*100).toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, ((netProfit/(totalRevenue || 1))*100)))} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Rasio Piutang</span>
                      <span className="font-medium">{((invoiceStats.unpaidAmount/(totalRevenue || 1))*100).toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.min(100, ((invoiceStats.unpaidAmount/(totalRevenue || 1))*100))} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Target Achievement</span>
                      <span className="font-medium">{goalProgress.toFixed(1)}%</span>
                    </div>
                    <Progress value={goalProgress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    Top Performa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg">
                    <span className="font-medium">Konversi Rate</span>
                    <Badge className="bg-yellow-500">{quoteConversionRate.toFixed(1)}%</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                    <span className="font-medium">Margin Profit</span>
                    <Badge className="bg-green-500">{((netProfit/(totalRevenue || 1))*100).toFixed(1)}%</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                    <span className="font-medium">Faktur Aktif</span>
                    <Badge className="bg-blue-500">{activeInvoiceCount}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pipeline Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="text-sm">Draft</span>
                    </div>
                    <span className="font-semibold">{draftQuotesCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">Terkirim</span>
                    </div>
                    <span className="font-semibold">{sentQuotesCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Diterima</span>
                    </div>
                    <span className="font-semibold">{acceptedQuotesTotal}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{quotes.length}</p>
                    <p className="text-sm text-purple-700">Total Penawaran</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-indigo-600">{invoices.length}</p>
                    <p className="text-sm text-indigo-700">Total Faktur</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <div className="text-center py-12">
              <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Fitur Trends Segera Hadir</h3>
              <p className="text-gray-500">Analisis mendalam tentang tren bisnis dan prediksi akan tersedia dalam update mendatang.</p>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Enhanced Attention & Activities Section */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Attention Items dengan Priority Levels */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Flame className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-red-900">Perlu Perhatian</p>
                <p className="text-sm text-red-700">{attentionCount > 0 ? `${attentionCount} item prioritas` : 'Semua terkendali'}</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {/* Overdue Invoices - Highest Priority */}
              {overdueInvoices.length > 0 && overdueInvoices.map(inv => (
                <Link key={inv.id} to={`/invoice/${inv.id}`} className="group flex items-center gap-4 border-l-4 border-red-500 bg-red-50/50 p-4 transition-all hover:bg-red-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-red-900 group-hover:text-red-800">{inv.to_client}</p>
                    <p className="text-sm text-red-700">Faktur terlambat {differenceInDays(new Date(), new Date(inv.due_date))} hari</p>
                  </div>
                  <Badge variant="destructive" className="font-mono">
                    URGENT
                  </Badge>
                </Link>
              ))}
              
              {/* Pending Quotes - Medium Priority */}
              {pendingQuotes.length > 0 && pendingQuotes.map(q => (
                <Link key={q.id} to={`/quote/${q.id}`} className="group flex items-center gap-4 border-l-4 border-amber-500 bg-amber-50/50 p-4 transition-all hover:bg-amber-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                    <Clock4 className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-amber-900 group-hover:text-amber-800">{q.to_client}</p>
                    <p className="text-sm text-amber-700">Menunggu respons sejak {safeFormat(q.created_at, 'dd MMM')}</p>
                  </div>
                  <Badge variant="outline" className="border-amber-500 text-amber-700">
                    Follow Up
                  </Badge>
                </Link>
              ))}
              
              {/* Low Stock Items - Low Priority */}
              {lowStockItems.slice(0, 3).map(item => (
                <Link key={item.id} to="/items" className="group flex items-center gap-4 border-l-4 border-blue-500 bg-blue-50/50 p-4 transition-all hover:bg-blue-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-blue-900 group-hover:text-blue-800">{item.description}</p>
                    <p className="text-sm text-blue-700">Stok: {item.stock} {item.unit} tersisa</p>
                  </div>
                  <Badge variant="outline" className="border-blue-500 text-blue-700">
                    LOW STOCK
                  </Badge>
                </Link>
              ))}
              
              {attentionCount === 0 && (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="font-medium text-green-800 mb-2">Semua Aman!</h3>
                  <p className="text-center text-sm text-green-600">
                    Tidak ada item yang memerlukan perhatian khusus saat ini.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Activities Timeline */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-blue-900">Timeline Aktivitas</p>
                <p className="text-sm text-blue-700">Update terbaru dari sistem</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <div key={activity.id} className="group relative flex items-start gap-4 p-4 transition-all hover:bg-blue-50/50">
                    {/* Timeline Line */}
                    {index < recentActivities.length - 1 && (
                      <div className="absolute left-8 top-12 h-full w-px bg-gradient-to-b from-blue-200 to-transparent"></div>
                    )}
                    
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 ring-4 ring-white">
                      <Bell className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 group-hover:text-blue-900">
                        {activity.message}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          {safeFormatDistance(activity.created_at)}
                        </p>
                        {activity.link && (
                          <Button asChild variant="ghost" size="sm" className="h-6 text-xs">
                            <Link to={activity.link}>Lihat →</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                    <Activity className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-gray-600 mb-2">Belum Ada Aktivitas</h3>
                  <p className="text-center text-sm text-gray-500">
                    Aktivitas sistem akan muncul di sini.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
