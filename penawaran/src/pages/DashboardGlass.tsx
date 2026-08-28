import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, FileText, Users, Package, Receipt, BarChart3,
  TrendingUp, TrendingDown, Target, Pencil, Check, Crown, Brain,
  Lightbulb, AlertTriangle, Plus, ArrowUpRight, Sparkles, Zap
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { format, addDays, startOfDay, startOfMonth, endOfMonth, isValid, eachDayOfInterval } from 'date-fns';
import { cn, formatCurrency, calculateSubtotal, calculateTotal, calculateItemTotal, isDateBeforeToday } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';

// Glass Components
import { 
  GlassCard, 
  GlassButton, 
  GlassBadge, 
  GlassInput,
  getBadgeVariant,
  getStatusLabel 
} from '@/components/glass';

// Types
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

const DashboardGlass = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Target States
  const [revenueGoal, setRevenueGoal] = useState(0);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState('');

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      const [quoteRes, invoiceRes, expenseRes, paymentRes, profileRes, stockRes] = await Promise.all([
        supabase.from('quotes').select('id, status, to_client, created_at, client_id, clients(name), quote_items(quantity, unit_price, cost_price)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, status, due_date, to_client, discount_amount, tax_amount, invoice_items(quantity, unit_price)').eq('user_id', user.id),
        supabase.from('expenses').select('amount, expense_date').eq('user_id', user.id),
        supabase.from('payments').select('amount, payment_date, invoices(discount_amount, tax_amount, invoice_items(quantity, unit_price, cost_price))').eq('user_id', user.id).eq('status', 'Lunas'),
        supabase.from('profiles').select('monthly_revenue_goal').eq('id', user.id).single(),
        supabase.from('items').select('id, description, stock, min_stock_alert, unit').eq('user_id', user.id).eq('track_stock', true)
      ]);

      if (!quoteRes.error) setQuotes(quoteRes.data as Quote[]);
      if (!invoiceRes.error) setInvoices(invoiceRes.data as Invoice[]);
      if (!expenseRes.error) setExpenses(expenseRes.data as Expense[]);
      if (!paymentRes.error) setPayments(paymentRes.data as Payment[]);
      if (profileRes.data) setRevenueGoal(profileRes.data.monthly_revenue_goal || 0);
      
      if (stockRes.data) {
        const lowStock = stockRes.data.filter((item: any) => item.stock <= (item.min_stock_alert || 5));
        setLowStockItems(lowStock);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [user]);

  // Update Revenue Goal
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

  // Calculated Metrics
  const totalRevenue = useMemo(() => payments.reduce((acc, payment) => acc + payment.amount, 0), [payments]);
  const totalCostOfGoods = useMemo(() => payments.reduce((acc, payment) => acc + getAllocatedPaymentCost(payment), 0), [payments]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, exp) => acc + exp.amount, 0), [expenses]);
  const netProfit = totalRevenue - totalCostOfGoods - totalExpenses;

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
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Business Health Score Calculation
  const businessScore = useMemo(() => {
    const revenueAchievement = revenueGoal > 0 ? Math.min(currentMonthRevenue / revenueGoal, 1) : 0.5;
    
    const sentQuotes = quotes.filter(q => q.status === 'Terkirim' || q.status === 'Diterima' || q.status === 'Ditolak').length;
    const acceptedQuotes = quotes.filter(q => q.status === 'Diterima').length;
    const conversionRate = sentQuotes > 0 ? acceptedQuotes / sentQuotes : 0;
    
    const profitMarginScore = Math.min(Math.max(profitMargin / 30, 0), 1);
    
    const overdueCount = invoices.filter(inv => inv.status !== 'Lunas' && inv.due_date && isDateBeforeToday(inv.due_date)).length;
    const operationalHealth = Math.max(1 - (overdueCount * 0.1), 0);
    
    const score = Math.round(
      revenueAchievement * 30 +
      conversionRate * 25 +
      profitMarginScore * 25 +
      operationalHealth * 20
    );
    
    return Math.min(score, 100);
  }, [quotes, invoices, currentMonthRevenue, revenueGoal, profitMargin]);

  // Quote Conversion Rate
  const quoteConversionRate = useMemo(() => {
    const sentQuotes = quotes.filter(q => q.status === 'Terkirim' || q.status === 'Diterima' || q.status === 'Ditolak');
    if (sentQuotes.length === 0) return 0;
    const acceptedCount = quotes.filter(q => q.status === 'Diterima').length;
    return (acceptedCount / sentQuotes.length) * 100;
  }, [quotes]);

  // Financial Chart Data (Last 30 days)
  const financialChartData = useMemo(() => {
    const from = addDays(new Date(), -29);
    const to = new Date();
    const days = eachDayOfInterval({ start: from, end: to });
    
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

      return { 
        name: formattedDate, 
        Pendapatan: dailyRevenue, 
        Biaya: dailyExpenses + dailyCostOfGoods 
      };
    });
  }, [payments, expenses]);

  // AI Insights Generator
  const aiInsights = useMemo(() => {
    const insights: string[] = [];
    
    if (goalProgress >= 100) {
      insights.push('≡ƒÄë Selamat! Target pendapatan bulan ini sudah tercapai.');
    } else if (goalProgress >= 80) {
      insights.push('≡ƒÆ¬ Hampir mencapai target! Hanya perlu sedikit lagi.');
    } else if (goalProgress < 50) {
      insights.push('ΓÜí Fokus pada closing penawaran untuk meningkatkan pendapatan.');
    }

    if (quoteConversionRate > 0) {
      if (quoteConversionRate >= 40) {
        insights.push(`Γ£à Conversion rate excellent (${quoteConversionRate.toFixed(0)}%). Pertahankan!`);
      } else if (quoteConversionRate < 20) {
        insights.push(`≡ƒôè Conversion rate rendah (${quoteConversionRate.toFixed(0)}%). Review strategi penawaran.`);
      }
    }

    const overdueCount = invoices.filter(inv => inv.status !== 'Lunas' && inv.due_date && isDateBeforeToday(inv.due_date)).length;
    if (overdueCount > 0) {
      insights.push(`ΓÜá∩╕Å ${overdueCount} faktur jatuh tempo. Segera follow up untuk arus kas optimal.`);
    }

    if (profitMargin >= 25) {
      insights.push(`≡ƒÆ░ Profit margin sehat (${profitMargin.toFixed(1)}%). Bisnis berjalan baik!`);
    } else if (profitMargin < 10 && profitMargin > 0) {
      insights.push(`≡ƒôë Profit margin tipis (${profitMargin.toFixed(1)}%). Evaluasi pricing atau biaya.`);
    }

    if (lowStockItems.length > 0) {
      insights.push(`≡ƒôª ${lowStockItems.length} item stok menipis. Pesan ulang untuk avoid delays.`);
    }

    return insights;
  }, [goalProgress, quoteConversionRate, invoices, profitMargin, lowStockItems]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-64 rounded-glass-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-40 rounded-glass-lg" />
          <Skeleton className="h-40 rounded-glass-lg" />
          <Skeleton className="h-40 rounded-glass-lg" />
          <Skeleton className="h-40 rounded-glass-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Hero Section - Glass Morphism */}
      <GlassCard 
        variant="heavy" 
        padding="lg" 
        rounded="2xl"
        className="relative overflow-hidden"
      >
        {/* Gradient Background Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-glass-accent-primary/10 via-transparent to-glass-accent-secondary/10 pointer-events-none" />
        
        <div className="relative">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-glass-md bg-glass-accent-primary/20">
                  <Crown className="h-5 w-5 text-glass-accent-primary" />
                </div>
                <GlassBadge variant="sent" size="sm">
                  <Zap className="h-3 w-3" />
                  <span className="ml-1">AI-Powered</span>
                </GlassBadge>
              </div>
              <h1 className="text-4xl font-bold text-glass-text-primary mb-2">
                Business Command Center
              </h1>
              <p className="text-sm text-glass-text-secondary">
                Real-time insights untuk keputusan bisnis yang lebih baik
              </p>
            </div>
            
            <GlassButton 
              variant="glass" 
              size="md"
              icon={<Sparkles className="h-4 w-4" />}
            >
              Quick Actions
            </GlassButton>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {/* Business Health Score */}
            <GlassCard 
              variant="medium" 
              padding="md"
              hoverable
              className="relative"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary">
                  Business Health
                </span>
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-glass-sm",
                  businessScore > 80 ? "bg-glass-accent-secondary/20" : 
                  businessScore > 60 ? "bg-glass-accent-tertiary/20" : 
                  "bg-glass-accent-error/20"
                )}>
                  {businessScore > 80 ? <TrendingUp className="h-4 w-4 text-glass-accent-secondary" /> : 
                   businessScore > 60 ? <Target className="h-4 w-4 text-glass-accent-tertiary" /> :
                   <TrendingDown className="h-4 w-4 text-glass-accent-error" />}
                </div>
              </div>
              
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-4xl font-bold text-glass-text-primary">{businessScore}</h3>
                <GlassBadge 
                  variant={businessScore > 80 ? 'accepted' : businessScore > 60 ? 'sent' : 'rejected'}
                  size="sm"
                >
                  {businessScore > 80 ? 'Excellent' : businessScore > 60 ? 'Good' : 'Need Fix'}
                </GlassBadge>
              </div>
              
              <div className="h-2 w-full rounded-full bg-glass-bg-light overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    businessScore > 80 ? "bg-glass-accent-secondary" :
                    businessScore > 60 ? "bg-glass-accent-tertiary" :
                    "bg-glass-accent-error"
                  )}
                  style={{ width: `${businessScore}%` }}
                />
              </div>
            </GlassCard>

            {/* Monthly Revenue */}
            <GlassCard 
              variant="medium" 
              padding="md"
              hoverable
              glowColor="blue"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary">
                  Pendapatan
                </span>
                <DollarSign className="h-8 w-8 text-glass-accent-primary opacity-50" />
              </div>
              
              <h3 className="text-2xl font-bold text-glass-text-primary mb-2">
                {formatCurrency(currentMonthRevenue)}
              </h3>
              
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 rounded-full bg-glass-accent-primary/20 px-2 py-0.5 text-xs text-glass-accent-primary">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>+12%</span>
                </div>
                <span className="text-xs text-glass-text-tertiary">vs last month</span>
              </div>
            </GlassCard>

            {/* Profit Margin */}
            <GlassCard 
              variant="medium" 
              padding="md"
              hoverable
              glowColor="green"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary">
                  Profit Margin
                </span>
                <BarChart3 className="h-8 w-8 text-glass-accent-secondary opacity-50" />
              </div>
              
              <h3 className="text-2xl font-bold text-glass-text-primary mb-2">
                {profitMargin.toFixed(1)}%
              </h3>
              
              <GlassBadge variant="accepted" size="sm">
                {formatCurrency(netProfit)}
              </GlassBadge>
            </GlassCard>

            {/* Target Achievement */}
            <GlassCard 
              variant="medium" 
              padding="md"
              hoverable
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary">
                  Target
                </span>
                {!isEditingGoal ? (
                  <button
                    onClick={() => {
                      setTempGoal(String(revenueGoal));
                      setIsEditingGoal(true);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-glass-sm bg-glass-bg-light hover:bg-glass-bg-medium transition-colors"
                  >
                    <Pencil className="h-3 w-3 text-glass-text-secondary" />
                  </button>
                ) : (
                  <div className="flex gap-1">
                    <GlassInput
                      type="number"
                      value={tempGoal}
                      onChange={(e) => setTempGoal(e.target.value)}
                      inputSize="sm"
                      className="w-20 text-xs"
                    />
                    <button
                      onClick={updateGoal}
                      className="flex h-6 w-6 items-center justify-center rounded-glass-sm bg-glass-accent-primary/20 hover:bg-glass-accent-primary/30 transition-colors"
                    >
                      <Check className="h-3 w-3 text-glass-accent-primary" />
                    </button>
                  </div>
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-glass-text-primary mb-3">
                {goalProgress.toFixed(0)}%
              </h3>
              
              <div className="h-2 w-full rounded-full bg-glass-bg-light overflow-hidden mb-2">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-glass-accent-primary to-glass-accent-secondary transition-all duration-500"
                  style={{ width: `${Math.min(goalProgress, 100)}%` }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-glass-text-tertiary">
                <span>{compactNumber.format(currentMonthRevenue)}</span>
                <span>{compactNumber.format(revenueGoal)}</span>
              </div>
            </GlassCard>
          </div>

          {/* AI Insights */}
          {aiInsights.length > 0 && (
            <GlassCard variant="light" padding="md" rounded="xl">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-glass-accent-primary" />
                <span className="text-sm font-semibold text-glass-text-primary">
                  AI Business Insights
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiInsights.slice(0, 3).map((insight, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 rounded-glass-md bg-glass-bg-light px-3 py-2 text-xs text-glass-text-secondary border border-glass-border-DEFAULT"
                  >
                    <Lightbulb className="h-3 w-3 text-glass-accent-tertiary mt-0.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </GlassCard>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Link to="/quote/new">
          <GlassCard 
            variant="medium" 
            padding="md"
            hoverable
            clickable
            className="h-full"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-glass-md bg-gradient-to-br from-glass-accent-primary/20 to-glass-accent-primary/10">
                <FileText className="h-6 w-6 text-glass-accent-primary" />
              </div>
              <span className="text-sm font-medium text-glass-text-primary">Penawaran</span>
            </div>
          </GlassCard>
        </Link>

        <Link to="/invoice/new">
          <GlassCard 
            variant="medium" 
            padding="md"
            hoverable
            clickable
            className="h-full"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-glass-md bg-gradient-to-br from-glass-accent-secondary/20 to-glass-accent-secondary/10">
                <Receipt className="h-6 w-6 text-glass-accent-secondary" />
              </div>
              <span className="text-sm font-medium text-glass-text-primary">Faktur</span>
            </div>
          </GlassCard>
        </Link>

        <Link to="/expenses">
          <GlassCard 
            variant="medium" 
            padding="md"
            hoverable
            clickable
            className="h-full"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-glass-md bg-gradient-to-br from-glass-accent-warning/20 to-glass-accent-warning/10">
                <DollarSign className="h-6 w-6 text-glass-accent-warning" />
              </div>
              <span className="text-sm font-medium text-glass-text-primary">Expenses</span>
            </div>
          </GlassCard>
        </Link>

        <Link to="/clients">
          <GlassCard 
            variant="medium" 
            padding="md"
            hoverable
            clickable
            className="h-full"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-glass-md bg-gradient-to-br from-purple-400/20 to-purple-400/10">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <span className="text-sm font-medium text-glass-text-primary">Klien</span>
            </div>
          </GlassCard>
        </Link>

        <Link to="/reports">
          <GlassCard 
            variant="medium" 
            padding="md"
            hoverable
            clickable
            className="h-full"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-glass-md bg-gradient-to-br from-pink-400/20 to-pink-400/10">
                <BarChart3 className="h-6 w-6 text-pink-400" />
              </div>
              <span className="text-sm font-medium text-glass-text-primary">Reports</span>
            </div>
          </GlassCard>
        </Link>

        <Link to="/items">
          <GlassCard 
            variant="medium" 
            padding="md"
            hoverable
            clickable
            className="h-full relative"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-glass-md bg-gradient-to-br from-indigo-400/20 to-indigo-400/10">
                <Package className="h-6 w-6 text-indigo-400" />
              </div>
              <span className="text-sm font-medium text-glass-text-primary">Inventory</span>
              {lowStockItems.length > 0 && (
                <div className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-glass-accent-error text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {lowStockItems.length}
                </div>
              )}
            </div>
          </GlassCard>
        </Link>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <GlassCard 
          variant="light" 
          padding="md"
          rounded="xl"
          className="border-glass-accent-error/30"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-glass-md bg-glass-accent-error/20 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-glass-accent-error" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-glass-text-primary mb-1">
                Stok Menipis
              </h3>
              <p className="text-xs text-glass-text-secondary mb-3">
                {lowStockItems.length} item perlu dipesan ulang untuk menghindari delay.
              </p>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.slice(0, 3).map(item => (
                  <GlassBadge key={item.id} variant="rejected" size="sm">
                    {item.description}: {item.stock} {item.unit}
                  </GlassBadge>
                ))}
                {lowStockItems.length > 3 && (
                  <GlassBadge variant="default" size="sm">
                    +{lowStockItems.length - 3} more
                  </GlassBadge>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Financial Chart */}
      <GlassCard variant="medium" padding="lg" rounded="xl">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-glass-text-primary mb-1">
            Cashflow Trend
          </h2>
          <p className="text-sm text-glass-text-secondary">
            Pendapatan vs Biaya (30 hari terakhir)
          </p>
        </div>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={financialChartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4edea3" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4edea3" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffb4ab" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ffb4ab" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(218, 226, 253, 0.1)" />
              <XAxis 
                dataKey="name" 
                stroke="#a8b4ca"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#a8b4ca"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => compactNumber.format(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(218, 226, 253, 0.15)',
                  borderRadius: '12px',
                  color: '#e4ecfa'
                }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Area
                type="monotone"
                dataKey="Pendapatan"
                stroke="#4edea3"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
              <Area
                type="monotone"
                dataKey="Biaya"
                stroke="#ffb4ab"
                strokeWidth={2}
                fill="url(#colorExpense)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
};

export default DashboardGlass;
