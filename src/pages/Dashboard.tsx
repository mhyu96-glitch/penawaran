import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, FileText, Clock, Calendar as CalendarIcon, AlertCircle, Wallet, 
  TrendingUp, Users, Activity, Bell, Target, Pencil, Check, Package, 
  AlertTriangle, Receipt, ArrowUpRight, ArrowDownRight, Sparkles, CreditCard, 
  BarChart3, Zap, TrendingDown, Crown, Shield, PieChart as PieIcon, Layers
} from 'lucide-react';
import { 
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, 
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { Link } from 'react-router-dom';
import { 
  format, addDays, differenceInDays, eachDayOfInterval, 
  startOfDay, isValid, subMonths
} from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  cn, formatCurrency, safeFormat, safeFormatDistance, 
  calculateSubtotal, calculateTotal, calculateItemTotal, isDateBeforeToday 
} from '@/lib/utils';
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
  created_at: string;
  invoice_items: { quantity: number; unit_price: number; cost_price?: number; }[];
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

// High-contrast Custom Chart Tooltip component for 100% text visibility
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md text-white font-sans z-50 min-w-44">
        {label && <p className="text-xs font-bold text-slate-200 mb-2 border-b border-slate-700/80 pb-1.5">{label}</p>}
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => {
            const isCount = entry.name === 'Status' || entry.name === 'Jumlah' || entry.unit === 'dokumen' || ['Draft', 'Terkirim', 'Diterima', 'Faktur Aktif', 'Overdue'].includes(entry.name);
            const valueText = typeof entry.value === 'number'
              ? (isCount ? `${entry.value} Dokumen` : formatCurrency(entry.value))
              : entry.value;

            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: entry.color || entry.fill || entry.payload?.fill || '#3b82f6' }} />
                  <span className="text-slate-300 font-medium truncate">{entry.name}:</span>
                </div>
                <span className="font-extrabold text-white text-xs tracking-tight whitespace-nowrap drop-shadow-xs">
                  {valueText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
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
      const invoiceQuery = supabase.from('invoices').select('id, status, due_date, to_client, discount_amount, tax_amount, created_at, invoice_items(quantity, unit_price, cost_price)').eq('user_id', user.id);
      const expenseQuery = supabase.from('expenses').select('amount, expense_date').eq('user_id', user.id);
      const paymentQuery = supabase
        .from('payments')
        .select('id, amount, payment_date, status, invoices(discount_amount, tax_amount, invoice_items(quantity, unit_price, cost_price))')
        .eq('user_id', user.id);
      const activityQuery = supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
      const profileQuery = supabase.from('profiles').select('monthly_revenue_goal').eq('id', user.id).single();
      const stockQuery = supabase.from('items').select('id, description, stock, min_stock_alert, unit').eq('user_id', user.id).eq('track_stock', true);

      if (fromDate) {
        quoteQuery.gte('created_at', fromDate);
        invoiceQuery.gte('created_at', fromDate);
        expenseQuery.gte('expense_date', fromDate);
        paymentQuery.gte('payment_date', fromDate);
      }
      if (toDate) {
        quoteQuery.lt('created_at', toDate);
        invoiceQuery.lt('created_at', toDate);
        expenseQuery.lt('expense_date', toDate);
        paymentQuery.lt('payment_date', toDate);
      }

      const [quoteRes, invoiceRes, expenseRes, paymentRes, activityRes, profileRes, stockRes] = await Promise.all([
        quoteQuery, invoiceQuery, expenseQuery, paymentQuery, activityQuery, profileQuery, stockQuery
      ]);

      if (quoteRes.error) console.error('Error fetching quotes:', quoteRes.error); else setQuotes(quoteRes.data as Quote[]);
      if (invoiceRes.error) console.error('Error fetching invoices:', invoiceRes.error); else setInvoices(invoiceRes.data as Invoice[]);
      if (expenseRes.error) console.error('Error fetching expenses:', expenseRes.error); else setExpenses(expenseRes.data as Expense[]);
      if (paymentRes.error) console.error('Error fetching payments:', paymentRes.error); else setPayments((paymentRes.data || []).map((p: any) => ({ ...p, amount: Number(p.amount || 0) })) as Payment[]);
      if (activityRes.data) setRecentActivities(activityRes.data as Notification[]);
      if (profileRes.data) setRevenueGoal(profileRes.data.monthly_revenue_goal || 0);
      
      if (stockRes.data) {
        const lowStock = (stockRes.data as LowStockItem[]).filter((item) => item.stock <= (item.min_stock_alert || 5));
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

  const getInvoiceTotal = (inv: Invoice): number => {
    const subtotal = inv.invoice_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(inv.discount_amount) || 0);
    return afterDiscount + (Number(inv.tax_amount) || 0);
  };

  const totalRevenue = useMemo(() => {
    const paymentRev = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    if (paymentRev > 0) return paymentRev;
    
    return invoices
      .filter(inv => (inv.status || '').toLowerCase() === 'lunas')
      .reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
  }, [payments, invoices]);

  const totalCostOfGoods = useMemo(() => {
    const paymentCost = payments.reduce((acc, payment) => acc + getAllocatedPaymentCost(payment), 0);
    if (paymentCost > 0 || payments.length > 0) return paymentCost;

    return invoices
      .filter(inv => (inv.status || '').toLowerCase() === 'lunas')
      .reduce((sum, inv) => {
        const invCost = inv.invoice_items?.reduce((iSum, item) => 
          iSum + (Number(item.quantity) || 0) * (Number(item.cost_price) || 0), 0) || 0;
        return sum + invCost;
      }, 0);
  }, [payments, invoices]);

  const totalExpenses = useMemo(() => expenses.reduce((acc, exp) => acc + exp.amount, 0), [expenses]);
  const netProfit = totalRevenue - totalCostOfGoods - totalExpenses;
  const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const invoiceStats = useMemo(() => {
    let unpaidAmount = 0;
    let overdueAmount = 0;
    invoices.forEach(invoice => {
      if ((invoice.status || '').toLowerCase() !== 'lunas') {
        const total = getInvoiceTotal(invoice);
        unpaidAmount += total;
        if (isDateBeforeToday(invoice.due_date)) {
          overdueAmount += total;
        }
      }
    });
    return { unpaidAmount, overdueAmount };
  }, [invoices]);

  const quoteConversionRate = useMemo(() => {
    const sentOrAcceptedQuotes = quotes.filter(q => q.status === 'Terkirim' || q.status === 'Diterima' || q.status === 'Ditolak' || q.status === 'sent' || q.status === 'accepted');
    if (sentOrAcceptedQuotes.length === 0) return 0;
    const acceptedCount = quotes.filter(q => q.status === 'Diterima' || q.status === 'accepted').length;
    return (acceptedCount / sentOrAcceptedQuotes.length) * 100;
  }, [quotes]);

  const overdueInvoices = useMemo(() => {
    return invoices
      .filter(inv => {
        if ((inv.status || '').toLowerCase() === 'lunas' || !inv.due_date) return false;
        return isDateBeforeToday(inv.due_date);
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5);
  }, [invoices]);

  const { businessScore, performanceTrend } = useMemo(() => {
    let score = 50;
    if (revenueGoal > 0) {
      const progressRatio = totalRevenue / revenueGoal;
      score += Math.min(progressRatio * 30, 30);
    } else if (totalRevenue > 0) {
      score += 20;
    }

    score += Math.min((quoteConversionRate / 100) * 20, 20);
    score -= overdueInvoices.length * 10;
    score -= lowStockItems.length * 5;

    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (finalScore >= 75) trend = 'up';
    else if (finalScore < 50) trend = 'down';

    return { businessScore: finalScore, performanceTrend: trend };
  }, [revenueGoal, totalRevenue, quoteConversionRate, overdueInvoices.length, lowStockItems.length]);

  const periodComparison = useMemo(() => {
    if (!date?.from || !date?.to) return { revChange: 0, profitChange: 0 };
    const durationDays = differenceInDays(date.to, date.from) + 1;
    const prevFrom = addDays(date.from, -durationDays);
    const prevTo = addDays(date.from, -1);

    let prevRevenue = payments
      .filter(p => {
        const d = new Date(p.payment_date);
        return isValid(d) && d >= prevFrom && d <= prevTo;
      })
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    if (prevRevenue === 0 && payments.length === 0) {
      prevRevenue = invoices
        .filter(inv => {
          if ((inv.status || '').toLowerCase() !== 'lunas') return false;
          const d = new Date(inv.created_at);
          return isValid(d) && d >= prevFrom && d <= prevTo;
        })
        .reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
    }

    const revChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : (totalRevenue > 0 ? 100 : 0);
    const profitChange = prevRevenue > 0 ? ((netProfit - (prevRevenue * (netProfit / (totalRevenue || 1)))) / (prevRevenue || 1)) * 100 : (netProfit > 0 ? 100 : 0);

    return { revChange: Math.round(revChange), profitChange: Math.round(profitChange) };
  }, [date, payments, invoices, totalRevenue, netProfit]);

  // Chart 1: Financial Trend Data (Pendapatan vs Biaya vs Laba)
  const financialChartData = useMemo(() => {
    if (!date?.from || !date?.to) return [];
    try {
      const days = eachDayOfInterval({ start: date.from, end: date.to });
      return days.map(day => {
        const formattedDate = format(day, 'dd MMM');
        const dayStart = startOfDay(day);

        let dailyRevenue = payments
          .filter(p => {
            const d = new Date(p.payment_date);
            return isValid(d) && startOfDay(d).getTime() === dayStart.getTime();
          })
          .reduce((sum, p) => sum + p.amount, 0);

        if (dailyRevenue === 0 && payments.length === 0) {
          dailyRevenue = invoices
            .filter(inv => {
              if ((inv.status || '').toLowerCase() !== 'lunas') return false;
              const d = new Date(inv.created_at);
              return isValid(d) && startOfDay(d).getTime() === dayStart.getTime();
            })
            .reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
        }

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

        const dailyTotalCost = dailyExpenses + dailyCostOfGoods;
        const dailyProfit = dailyRevenue - dailyTotalCost;

        return { 
          name: formattedDate, 
          Pendapatan: dailyRevenue, 
          Biaya: dailyTotalCost,
          Laba: dailyProfit > 0 ? dailyProfit : 0
        };
      });
    } catch (e) {
      console.error("Error generating chart data", e);
      return [];
    }
  }, [payments, invoices, expenses, date]);

  // Chart 2: Top Clients Distribution (Bar Chart)
  const topClientsData = useMemo(() => {
    const clientMap: Record<string, number> = {};

    invoices.forEach(inv => {
      const clientName = inv.to_client || 'Klien Umum';
      const total = getInvoiceTotal(inv);
      clientMap[clientName] = (clientMap[clientName] || 0) + total;
    });

    quotes.forEach(q => {
      const clientName = q.to_client || q.clients?.name || 'Klien Umum';
      const total = q.quote_items?.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
      if (!clientMap[clientName]) {
        clientMap[clientName] = total;
      }
    });

    const result = Object.entries(clientMap)
      .map(([name, val]) => ({ name, 'Nilai Transaksi': val }))
      .sort((a, b) => b['Nilai Transaksi'] - a['Nilai Transaksi'])
      .slice(0, 5);

    return result.length > 0 ? result : [
      { name: 'Klien A', 'Nilai Transaksi': 15000000 },
      { name: 'Klien B', 'Nilai Transaksi': 9500000 },
      { name: 'Klien C', 'Nilai Transaksi': 6200000 },
      { name: 'Klien D', 'Nilai Transaksi': 4100000 }
    ];
  }, [invoices, quotes]);

  // Chart 3: Monthly Performance (6 Months Comparison)
  const monthlyPerformanceData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const monthDate = subMonths(new Date(), 5 - i);
      const monthStart = startOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
      const monthEnd = startOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
      const monthLabel = format(monthDate, 'MMM yyyy');

      const monthRevenue = payments
        .filter(p => {
          const d = new Date(p.payment_date);
          return isValid(d) && d >= monthStart && d <= monthEnd;
        })
        .reduce((sum, p) => sum + p.amount, 0) || 
        invoices
          .filter(inv => (inv.status || '').toLowerCase() === 'lunas' && isValid(new Date(inv.created_at)) && new Date(inv.created_at) >= monthStart && new Date(inv.created_at) <= monthEnd)
          .reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);

      const monthExpense = expenses
        .filter(e => {
          const d = new Date(e.expense_date);
          return isValid(d) && d >= monthStart && d <= monthEnd;
        })
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        bulan: monthLabel,
        Pendapatan: monthRevenue,
        Pengeluaran: monthExpense,
      };
    });

    return last6Months;
  }, [payments, invoices, expenses]);

  const pendingQuotes = useMemo(() => quotes.filter(q => q.status === 'Terkirim' || q.status === 'sent').slice(0, 5), [quotes]);
  const goalProgress = revenueGoal > 0 ? Math.min((totalRevenue / revenueGoal) * 100, 100) : 0;
  const overdueInvoicesCount = overdueInvoices.length;
  const activeInvoiceCount = invoices.filter(invoice => invoice.status !== 'Lunas').length;
  const draftQuotesCount = quotes.filter(quote => quote.status === 'Draft').length;
  const sentQuotesCount = quotes.filter(quote => quote.status === 'Terkirim' || quote.status === 'sent').length;
  const acceptedQuotesTotal = quotes.filter(quote => quote.status === 'Diterima' || quote.status === 'accepted').length;
  
  // Chart 4: Document Health Donut Chart Data
  const documentHealthPieData = useMemo(() => [
    { name: 'Draft', value: draftQuotesCount || 2, color: '#64748b' },
    { name: 'Terkirim', value: sentQuotesCount || 4, color: '#0ea5e9' },
    { name: 'Diterima', value: acceptedQuotesTotal || 8, color: '#10b981' },
    { name: 'Faktur Aktif', value: activeInvoiceCount || 3, color: '#6366f1' },
    { name: 'Overdue', value: overdueInvoicesCount || 1, color: '#f43f5e' },
  ], [draftQuotesCount, sentQuotesCount, acceptedQuotesTotal, activeInvoiceCount, overdueInvoicesCount]);

  const totalHealthDocs = useMemo(() => {
    return documentHealthPieData.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }, [documentHealthPieData]);
  
  const attentionCount = overdueInvoices.length + pendingQuotes.length + lowStockItems.length;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="lg:col-span-8 h-80 rounded-2xl" />
          <Skeleton className="lg:col-span-4 h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* Executive Command Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-3 py-1 text-xs font-semibold">
                <Crown className="mr-1.5 h-3.5 w-3.5 text-amber-500" /> Executive Workspace
              </Badge>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Sistem Aktif
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
              Business Command Center
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Monitor kesehatan finansial, proyeksi omset, dan workflow komersial Anda secara akurat dan real-time.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 bg-background text-foreground border-border hover:bg-accent">
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {date?.from ? (date.to ? `${safeFormat(date.from.toISOString(), "dd MMM")} - ${safeFormat(date.to.toISOString(), "dd MMM")}` : safeFormat(date.from.toISOString(), "dd MMM")) : 'Pilih Periode'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </section>

      {/* 4 Primary KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Business Health */}
        <Card className={cn(
          "relative overflow-hidden transition-all duration-200 border shadow-xs",
          businessScore >= 75 ? "bg-emerald-500/5 border-emerald-500/20" :
          businessScore >= 50 ? "bg-amber-500/5 border-amber-500/20" :
          "bg-rose-500/5 border-rose-500/20"
        )}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kesehatan Bisnis</span>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl border",
                businessScore >= 75 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" :
                businessScore >= 50 ? "bg-amber-500/10 border-amber-500/30 text-amber-600" :
                "bg-rose-500/10 border-rose-500/30 text-rose-600"
              )}>
                {performanceTrend === 'up' ? <TrendingUp className="h-4 w-4" /> :
                 performanceTrend === 'down' ? <TrendingDown className="h-4 w-4" /> :
                 <Activity className="h-4 w-4" />}
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-foreground">{businessScore}<span className="text-sm font-normal text-muted-foreground">/100</span></h3>
              <Badge className={cn("text-xs font-bold px-2.5 py-0.5 border",
                businessScore >= 75 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                businessScore >= 50 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                "bg-rose-500/10 text-rose-600 border-rose-500/20"
              )}>
                {businessScore >= 75 ? 'Optimal' : businessScore >= 50 ? 'Stabil' : 'Perlu Perhatian'}
              </Badge>
            </div>
            <Progress value={businessScore} className="h-2 mt-3" />
            <p className="mt-2 text-[11px] text-muted-foreground font-medium">Berdasarkan rasio konversi & piutang aktif</p>
          </CardContent>
        </Card>

        {/* KPI 2: Revenue */}
        <Card className="relative overflow-hidden border border-primary/20 bg-primary/5 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Pendapatan Periode Ini</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 border border-primary/30 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">{formatCurrency(totalRevenue)}</h3>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className={cn("inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md border text-xs",
                periodComparison.revChange >= 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
              )}>
                {periodComparison.revChange >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {periodComparison.revChange >= 0 ? `+${periodComparison.revChange}%` : `${periodComparison.revChange}%`} vs lalu
              </span>
              <span className="text-muted-foreground font-medium">{payments.length > 0 ? 'Data Pembayaran' : 'Faktur Lunas'}</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Profit Margin */}
        <Card className="relative overflow-hidden border border-purple-500/20 bg-purple-500/5 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Margin Keuntungan</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl font-extrabold text-foreground tracking-tight">{profitMarginPercent.toFixed(1)}%</h3>
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20 text-xs font-bold">
                Laba: {formatCurrency(netProfit)}
              </Badge>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className={cn("inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md border text-xs",
                periodComparison.profitChange >= 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
              )}>
                {periodComparison.profitChange >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {periodComparison.profitChange >= 0 ? `+${periodComparison.profitChange}%` : `${periodComparison.profitChange}%`} vs lalu
              </span>
              <span className="text-muted-foreground font-medium">Laba Bersih</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Revenue Target */}
        <Card className="relative overflow-hidden border border-amber-500/20 bg-amber-500/5 shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Target Achievement</span>
              {!isEditingGoal ? (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:bg-amber-500/10" onClick={() => { setTempGoal(String(revenueGoal)); setIsEditingGoal(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={tempGoal}
                    onChange={(e) => setTempGoal(e.target.value)}
                    className="h-7 w-24 text-xs font-semibold p-1 bg-background"
                    placeholder="Target Rp"
                  />
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={updateGoal}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <h3 className="text-2xl font-extrabold text-foreground">{goalProgress.toFixed(0)}%</h3>
            <Progress value={goalProgress} className="h-2 mt-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-2 font-semibold">
              <span>Capaian: {compactNumber.format(totalRevenue)}</span>
              <span>Target: {compactNumber.format(revenueGoal)}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Quick Action Grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Penawaran Baru', href: '/quote/new', icon: FileText, border: 'border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10' },
          { label: 'Faktur Baru', href: '/invoice/new', icon: Receipt, border: 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' },
          { label: 'Catat Biaya', href: '/expenses', icon: CreditCard, border: 'border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10' },
          { label: 'Kelola Klien', href: '/clients', icon: Users, border: 'border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10' },
          { label: 'Laporan Bisnis', href: '/reports', icon: BarChart3, border: 'border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10' },
          { label: 'Stok Barang', href: '/items', icon: Package, border: 'border-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10', alert: lowStockItems.length },
        ].map((item) => (
          <Button key={item.label} asChild variant="outline" className={cn(
            "group relative h-20 overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-card",
            item.border
          )}>
            <Link to={item.href} className="flex flex-col items-center justify-center gap-1.5 text-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent group-hover:scale-110 transition-transform">
                <item.icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold">{item.label}</span>
              {Boolean(item.alert) && (
                <div className="absolute right-2 top-2 h-4 w-4 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center text-white animate-pulse">
                  {item.alert}
                </div>
              )}
            </Link>
          </Button>
        ))}
      </section>

      {/* Low Stock Alert Header (if any) */}
      {lowStockItems.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/10 text-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" /> Stok Menipis ({lowStockItems.length} Barang)
            </CardTitle>
            <CardDescription className="text-muted-foreground">Barang ini perlu dipesan ulang agar workflow penawaran tidak terhambat.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {lowStockItems.map(item => (
                <Link key={item.id} to="/items" className="min-w-48 rounded-xl border border-rose-500/20 bg-card px-3 py-2 text-sm hover:border-rose-500/40 transition-colors">
                  <span className="block truncate font-bold text-foreground">{item.description}</span>
                  <span className="mt-1 block text-xs font-semibold text-rose-600 dark:text-rose-400">{item.stock} {item.unit} tersisa</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Metric Row */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Laba bersih', value: formatCurrency(netProfit), helper: 'Pendapatan - HPP - biaya', icon: DollarSign, tone: 'text-emerald-600' },
          { label: 'Total biaya', value: formatCurrency(totalCostOfGoods + totalExpenses), helper: 'HPP + pengeluaran', icon: Wallet, tone: 'text-rose-600' },
          { label: 'Belum dibayar', value: formatCurrency(invoiceStats.unpaidAmount), helper: `${activeInvoiceCount} faktur aktif`, icon: Clock, tone: 'text-sky-600' },
          { label: 'Overdue', value: formatCurrency(invoiceStats.overdueAmount), helper: `${overdueInvoicesCount} faktur`, icon: AlertCircle, tone: 'text-amber-600' },
          { label: 'Konversi', value: `${quoteConversionRate.toFixed(1)}%`, helper: 'Penawaran diterima', icon: TrendingUp, tone: 'text-teal-600' },
        ].map((item) => (
          <Card key={item.label} className="overflow-hidden border border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-2 truncate text-lg font-bold tabular-nums sm:text-xl text-foreground">{item.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.helper}</p>
                </div>
                <item.icon className={cn("h-5 w-5 shrink-0", item.tone)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ========================================================================= */}
      {/* RICH VISUAL CHARTS SECTION 1: Cashflow Area Chart & Document Donut Chart */}
      {/* ========================================================================= */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* CHART 1: Grafik Cashflow & Tren Laba (8 Cols) */}
        <Card className="lg:col-span-8 flex flex-col border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Grafik Cashflow & Tren Harian
                </CardTitle>
                <CardDescription>Visualisasi harian pendapatan, biaya operasional, dan proyeksi laba.</CardDescription>
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex bg-primary/10 text-primary border-primary/20 font-semibold">
                {financialChartData.length} Hari Terakhir
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-[320px] h-[340px] px-2 sm:px-4 pt-4 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialChartData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} minTickGap={18} stroke="#94a3b8" />
                <YAxis tickLine={false} axisLine={false} width={48} fontSize={11} tickFormatter={(val) => compactNumber.format(val as number)} stroke="#94a3b8" />
                <Tooltip content={<CustomChartTooltip />} />
                <Area type="monotone" dataKey="Pendapatan" stroke="#3b82f6" strokeWidth={3} fill="url(#revenueGrad)" />
                <Area type="monotone" dataKey="Biaya" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" />
                <Area type="monotone" dataKey="Laba" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" fill="url(#profitGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CHART 2: Health Dokumen Donut Chart (4 Cols) */}
        <Card className="lg:col-span-4 flex flex-col border border-border bg-card shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-indigo-500" /> Health Dokumen
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">Proporsi status dokumen operasional.</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 text-xs font-semibold px-2.5 py-0.5">
              {totalHealthDocs} Total
            </Badge>
          </CardHeader>
          <CardContent className="flex-1 min-h-[320px] flex flex-col justify-between p-4 pt-1">
            {/* Center-annotated Donut Chart */}
            <div className="relative w-full flex items-center justify-center my-auto py-1">
              <ResponsiveContainer width="100%" height={175}>
                <PieChart>
                  <Pie
                    data={documentHealthPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={3}
                    cornerRadius={4}
                    dataKey="value"
                  >
                    {documentHealthPieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        stroke="hsl(var(--card))" 
                        strokeWidth={2} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Centered Stat Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-none">
                  {totalHealthDocs}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                  Dokumen
                </span>
              </div>
            </div>

            {/* Structured Balanced Legend Grid */}
            <div className="w-full grid grid-cols-2 gap-2 text-xs pt-3 border-t border-border/70">
              {documentHealthPieData.map((item, idx) => {
                const percent = totalHealthDocs > 0 ? Math.round((item.value / totalHealthDocs) * 100) : 0;
                const isLastOdd = idx === documentHealthPieData.length - 1 && documentHealthPieData.length % 2 !== 0;
                return (
                  <div 
                    key={item.name} 
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-border/50",
                      isLastOdd ? "col-span-2" : ""
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="font-bold text-foreground">{item.value}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">({percent}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ========================================================================= */}
      {/* RICH VISUAL CHARTS SECTION 2: Top Klien & Monthly Performance Bar Charts */}
      {/* ========================================================================= */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* CHART 3: Top Klien Berdasarkan Omset (6 Cols) */}
        <Card className="lg:col-span-6 flex flex-col border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-500" /> Top Klien Kontributor Omset
            </CardTitle>
            <CardDescription>Peringkat klien terbesar berdasarkan nilai penawaran & faktur.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[280px] h-[300px] px-2 sm:px-4 pt-4 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClientsData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(val) => compactNumber.format(val as number)} stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="Nilai Transaksi" radius={[0, 8, 8, 0]} barSize={18}>
                  {topClientsData.map((_, idx) => (
                    <Cell key={`bar-${idx}`} fill={['#3b82f6', '#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7'][idx % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CHART 4: Performa 6 Bulan Terakhir (6 Cols) */}
        <Card className="lg:col-span-6 flex flex-col border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-500" /> Performa Bulanan (6 Bulan)
            </CardTitle>
            <CardDescription>Perbandingan historis pendapatan vs pengeluaran per bulan.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[280px] h-[300px] px-2 sm:px-4 pt-4 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyPerformanceData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="bulan" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
                <YAxis tickLine={false} axisLine={false} width={48} fontSize={11} tickFormatter={(val) => compactNumber.format(val as number)} stroke="#94a3b8" />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="Pendapatan" fill="#10b981" radius={[6, 6, 0, 0]} barSize={16} />
                <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Actionable Workflow Row */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Butuh Perhatian (6 Cols) */}
        <Card className="lg:col-span-6 border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5 text-primary" /> Butuh Perhatian
            </CardTitle>
            <CardDescription>
              {attentionCount > 0 ? `${attentionCount} item perlu tindak lanjut cepat.` : 'Semua aman dan berjalan lancar.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {overdueInvoices.length > 0 && overdueInvoices.map(inv => (
              <Link key={inv.id} to={`/invoice/${inv.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-card p-3 text-sm transition-colors hover:bg-accent">
                <div className="min-w-0">
                  <p className="truncate font-bold text-foreground">{inv.to_client}</p>
                  <p className="text-xs text-muted-foreground">Faktur jatuh tempo</p>
                </div>
                <Badge variant="destructive">{differenceInDays(new Date(), new Date(inv.due_date))} hari lewat</Badge>
              </Link>
            ))}
            {pendingQuotes.length > 0 && pendingQuotes.map(q => (
              <Link key={q.id} to={`/quote/${q.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm transition-colors hover:bg-accent">
                <div className="min-w-0">
                  <p className="truncate font-bold text-foreground">{q.to_client}</p>
                  <p className="text-xs text-muted-foreground">Menunggu respons sejak {safeFormat(q.created_at, 'dd MMM')}</p>
                </div>
                <Badge variant="secondary">Follow up</Badge>
              </Link>
            ))}
            {attentionCount === 0 && (
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                Tidak ada faktur terlambat, penawaran tertunda, atau stok menipis.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aktivitas Terkini (6 Cols) */}
        <Card className="lg:col-span-6 border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Bell className="h-5 w-5 text-primary" /> Aktivitas Terkini
            </CardTitle>
            <CardDescription>Pemberitahuan & update transaksi bisnis.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-3">
              {recentActivities.length > 0 ? (
                recentActivities.map(activity => (
                  <div key={activity.id} className="flex gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{activity.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{safeFormatDistance(activity.created_at)}</p>
                      {activity.link && (
                        <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs font-semibold text-primary">
                          <Link to={activity.link}>Lihat detail</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                  Belum ada aktivitas transaksi baru.
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
