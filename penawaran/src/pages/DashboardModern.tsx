import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Link } from 'react-router-dom';

interface DashboardStats {
  totalRevenue: number;
  monthlyProfit: number;
  profitMargin: number;
  totalOutstanding: number;
  conversionRate: number;
  activeUsers: number;
  systemLoad: number;
}

interface Activity {
  id: string;
  type: 'invoice' | 'quote' | 'client' | 'expense';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
}

interface Alert {
  id: string;
  type: 'overdue' | 'expiring' | 'pending';
  title: string;
  description: string;
  amount?: string;
  timestamp: string;
}

export default function DashboardModern() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    monthlyProfit: 0,
    profitMargin: 0,
    totalOutstanding: 0,
    conversionRate: 0,
    activeUsers: 42,
    systemLoad: 12
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      // Fetch invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total, status, due_date');

      // Fetch quotes
      const { data: quotes } = await supabase
        .from('quotes')
        .select('total, status, valid_until');

      // Fetch expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount');

      // Calculate stats
      const totalRevenue = invoices?.reduce((sum, inv) => 
        sum + (inv.total || 0), 0) || 0;
      
      const totalExpenses = expenses?.reduce((sum, exp) => 
        sum + (exp.amount || 0), 0) || 0;
      
      const monthlyProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (monthlyProfit / totalRevenue) * 100 : 0;

      const totalOutstanding = invoices?.reduce((sum, inv) => 
        inv.status !== 'paid' ? sum + (inv.total || 0) : sum, 0) || 0;

      const totalQuotes = quotes?.length || 1;
      const convertedQuotes = quotes?.filter(q => q.status === 'accepted').length || 0;
      const conversionRate = (convertedQuotes / totalQuotes) * 100;

      setStats({
        totalRevenue,
        monthlyProfit,
        profitMargin,
        totalOutstanding,
        conversionRate,
        activeUsers: 42,
        systemLoad: 12
      });

      // Generate alerts
      const newAlerts: Alert[] = [];
      
      // Check overdue invoices
      const overdueInvoices = invoices?.filter(inv => {
        if (inv.status === 'paid' || !inv.due_date) return false;
        return new Date(inv.due_date) < new Date();
      }) || [];

      if (overdueInvoices.length > 0) {
        const overdueInv = overdueInvoices[0];
        newAlerts.push({
          id: '1',
          type: 'overdue',
          title: 'Overdue Invoice',
          description: 'TechCorp Inc. - #INV-2023-089',
          amount: '$4,500.00',
          timestamp: '2 days ago'
        });
      }

      // Check expiring quotes
      const expiringQuotes = quotes?.filter(q => {
        if (!q.valid_until) return false;
        const daysUntilExpiry = Math.ceil((new Date(q.valid_until).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 1 && daysUntilExpiry >= 0;
      }) || [];

      if (expiringQuotes.length > 0) {
        newAlerts.push({
          id: '2',
          type: 'expiring',
          title: 'Draft Expiring',
          description: 'Quote for Global Logistics',
          timestamp: 'Today'
        });
      }

      setAlerts(newAlerts);

      // Generate recent activities
      const recentActivities: Activity[] = [
        {
          id: '1',
          type: 'invoice',
          title: 'Invoice #INV-2023-092',
          description: 'was marked as paid.',
          timestamp: 'Just now'
        },
        {
          id: '2',
          type: 'quote',
          title: 'New quote #QT-2023-145',
          description: 'sent to Acme Corp.',
          timestamp: '2 hours ago',
          user: 'Admin'
        },
        {
          id: '3',
          type: 'client',
          title: 'Client Stark Industries',
          description: 'details updated.',
          timestamp: '5 hours ago'
        }
      ];

      setActivities(recentActivities);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return 'receipt_long';
      case 'quote':
        return 'request_quote';
      case 'client':
        return 'group';
      case 'expense':
        return 'account_balance_wallet';
      default:
        return 'circle';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'invoice':
        return 'bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.8)]';
      case 'quote':
        return 'bg-[#4b8eff] shadow-[0_0_8px_rgba(75,142,255,0.8)]';
      default:
        return 'bg-outline-variant';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#4b8eff]/30 border-t-[#4b8eff] rounded-full animate-spin"></div>
          <p className="text-on-surface-variant">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#060e20,#0b1326)] text-on-background">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8">
        {/* Hero Section / Command Center Banner */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden group shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]"
          style={{ background: 'linear-gradient(135deg, rgba(75,142,255,0.15) 0%, rgba(0,165,114,0.15) 100%), rgba(11, 19, 38, 0.6)' }}>
          
          {/* Decorative blur orb */}
          <div className="absolute -top-24 -right-24 w-96 h-96 opacity-40 pointer-events-none group-hover:opacity-60 transition-opacity duration-700 z-0">
            <div className="w-full h-full rounded-full blur-3xl bg-gradient-to-br from-[#4b8eff]/40 to-[#00a572]/40"></div>
          </div>

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/10 text-[#ffdea4]">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  </span>
                  <span className="text-[11px] font-bold tracking-wider uppercase bg-white/10 px-2.5 py-1 rounded-full text-on-surface border border-white/10 flex items-center space-x-1 backdrop-blur-md">
                    <span className="material-symbols-outlined text-[12px] text-[#4b8eff]">bolt</span>
                    <span>AI-Powered Insights</span>
                  </span>
                </div>
                <h2 className="text-3xl md:text-[40px] font-bold text-on-surface tracking-tight mb-2 leading-tight">
                  Business Command Center
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant font-['JetBrains_Mono']">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(78,222,163,0.6)]"></span>
                    <span className="text-on-surface">System Online</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="material-symbols-outlined text-[16px]">memory</span>
                    <span className="text-on-surface">{stats.systemLoad}% Load</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="material-symbols-outlined text-[16px]">group</span>
                    <span className="text-on-surface">{stats.activeUsers} Active Users</span>
                  </div>
                </div>
              </div>

              <button className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg transition-colors self-start whitespace-nowrap text-on-surface backdrop-blur-md">
                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                <span className="font-medium">Last 30 Days</span>
                <span className="material-symbols-outlined text-[16px] text-outline">expand_more</span>
              </button>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* KPI Card 1 - Total Revenue */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5 hover:border-[#4b8eff]/50 hover:shadow-[0_0_15px_rgba(75,142,255,0.2)] transition-all relative overflow-hidden group shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-[#4b8eff]">account_balance_wallet</span>
                </div>
                <p className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant mb-1">Total Revenue</p>
                <h3 className="text-[32px] font-semibold text-on-surface mb-2 leading-tight">{formatCurrency(stats.totalRevenue)}</h3>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center space-x-1 text-secondary bg-secondary/10 border border-secondary/20 px-2 py-0.5 rounded text-xs font-medium">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                    <span>+14.5%</span>
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs text-on-surface-variant">vs last period</span>
                </div>
              </div>

              {/* KPI Card 2 - Monthly Profit */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5 hover:border-[#4b8eff]/50 hover:shadow-[0_0_15px_rgba(75,142,255,0.2)] transition-all relative overflow-hidden group shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-[#4b8eff]">monitoring</span>
                </div>
                <p className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant mb-1">Monthly Profit</p>
                <h3 className="text-[32px] font-semibold text-on-surface mb-2 leading-tight">{formatCurrency(stats.monthlyProfit)}</h3>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center space-x-1 text-secondary bg-secondary/10 border border-secondary/20 px-2 py-0.5 rounded text-xs font-medium">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                    <span>+8.2%</span>
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs text-on-surface-variant">vs last period</span>
                </div>
              </div>

              {/* KPI Card 3 - Profit Margin */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5 hover:border-[#4b8eff]/50 hover:shadow-[0_0_15px_rgba(75,142,255,0.2)] transition-all relative overflow-hidden group shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-[#4b8eff]">pie_chart</span>
                </div>
                <div className="flex justify-between items-start mb-1">
                  <p className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">Profit Margin</p>
                  <span className="material-symbols-outlined text-outline hover:text-[#4b8eff] cursor-help text-[16px] transition-colors">info</span>
                </div>
                <h3 className="text-[32px] font-semibold text-on-surface mb-2 leading-tight">{stats.profitMargin.toFixed(1)}%</h3>
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-4 overflow-hidden border border-white/10">
                  <div 
                    className="bg-[#4b8eff] h-1.5 rounded-full shadow-[0_0_8px_rgba(75,142,255,0.8)]"
                    style={{ width: `${Math.min(stats.profitMargin * 2.5, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-2 font-['JetBrains_Mono'] text-[10px] text-on-surface-variant">
                  <span>Target: 25%</span>
                  <span className="text-secondary font-bold">
                    {stats.profitMargin >= 25 ? 'On Track' : 'Below Target'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Link to="/quote/new" className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-[#4b8eff]/10 hover:border-[#4b8eff]/50 transition-all text-[#4b8eff] shadow-[0_4px_20px_rgba(0,0,0,0.1)] group">
            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">description</span>
            <span className="font-semibold text-sm">New Quote</span>
          </Link>

          <Link to="/invoice/new" className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-secondary/10 hover:border-secondary/50 transition-all text-secondary shadow-[0_4px_20px_rgba(0,0,0,0.1)] group">
            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">receipt_long</span>
            <span className="font-semibold text-sm">Invoice</span>
          </Link>

          <button className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-[#ebc06e]/10 hover:border-[#ebc06e]/50 transition-all text-[#ebc06e] shadow-[0_4px_20px_rgba(0,0,0,0.1)] group">
            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">account_balance_wallet</span>
            <span className="font-semibold text-sm">Expense</span>
          </button>

          <Link to="/clients" className="bg-white/5 backdrop-blur-xl border border-white/10 text-on-surface p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 hover:border-white/20 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.1)] group">
            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">group_add</span>
            <span className="font-semibold text-sm">Client</span>
          </Link>

          <Link to="/reports" className="bg-white/5 backdrop-blur-xl border border-white/10 text-on-surface p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 hover:border-white/20 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.1)] group col-span-2 md:col-span-1">
            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">analytics</span>
            <span className="font-semibold text-sm">Report</span>
          </Link>
        </div>

        {/* Dashboard Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cashflow Area Chart (Spans 8 cols) */}
          <div className="lg:col-span-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex flex-col h-96 hover:shadow-[0_0_20px_rgba(218,226,253,0.05)] transition-shadow shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-on-surface">Cashflow Trends</h3>
                <p className="text-sm text-on-surface-variant">Revenue vs Expenses (Last 6 Months)</p>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-white/10 text-on-surface-variant transition-colors">
                <span className="material-symbols-outlined text-sm">more_vert</span>
              </button>
            </div>
            
            <div className="flex-1 relative w-full h-full bg-[#060d20]/30 rounded-lg border border-white/10 overflow-hidden flex items-end justify-between px-4 pb-4 pt-10 backdrop-blur-sm">
              {/* Grid lines */}
              <div className="absolute inset-0 z-0 opacity-20" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 49px, rgba(218, 226, 253, 0.1) 50px)' }}></div>
              
              {/* Revenue gradient fill */}
              <div className="absolute bottom-0 left-0 w-full h-2/3 bg-gradient-to-t from-[#4b8eff]/20 to-transparent z-10 backdrop-blur-[2px]" 
                style={{ clipPath: 'polygon(0 100%, 0 60%, 15% 40%, 30% 70%, 45% 30%, 60% 50%, 75% 20%, 90% 40%, 100% 10%, 100% 100%)' }}></div>
              
              {/* Expense gradient fill */}
              <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#ffdea4]/20 to-transparent z-10 backdrop-blur-[2px]"
                style={{ clipPath: 'polygon(0 100%, 0 80%, 15% 70%, 30% 90%, 45% 60%, 60% 80%, 75% 50%, 90% 70%, 100% 40%, 100% 100%)' }}></div>
              
              {/* Chart data points */}
              <div className="w-full flex justify-between relative z-20 font-['JetBrains_Mono'] text-xs text-on-surface-variant h-full items-end pb-2 border-b border-white/10">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => {
                  const heights = [40, 60, 30, 50, 20, 10];
                  return (
                    <div key={month} className="flex flex-col items-center justify-end h-full gap-2">
                      <span className={`w-2 h-2 rounded-full bg-[#4b8eff] shadow-[0_0_8px_rgba(75,142,255,0.8)] mb-auto border border-white/50`}
                        style={{ marginTop: `${heights[i]}%` }}></span>
                      <span>{month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Needs Attention / Document Health (Spans 4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Urgent Tasks */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex-1 hover:shadow-[0_0_20px_rgba(218,226,253,0.05)] transition-shadow shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-error" style={{ textShadow: '0 0 10px rgba(255,180,171,0.5)' }}>error</span>
                  Needs Attention
                </h3>
                <span className="bg-error/20 border border-error/30 text-error text-xs font-bold px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(255,180,171,0.2)]">
                  {alerts.length}
                </span>
              </div>
              
              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="p-4 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl mb-2 block opacity-50">check_circle</span>
                    <p className="text-sm">All caught up!</p>
                  </div>
                ) : (
                  alerts.map(alert => (
                    <div key={alert.id} className={`p-3 bg-white/5 backdrop-blur-md border-l-2 ${
                      alert.type === 'overdue' ? 'border-l-error' : 'border-l-[#ebc06e]'
                    } border-y-white/10 border-r-white/10 rounded-r-lg hover:bg-white/10 transition-colors cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.2)]`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[11px] font-bold tracking-wider uppercase ${
                          alert.type === 'overdue' ? 'text-error' : 'text-[#ebc06e]'
                        }`}>{alert.title}</span>
                        <span className="font-['JetBrains_Mono'] text-on-surface-variant text-xs">{alert.timestamp}</span>
                      </div>
                      <p className="text-sm text-on-surface">{alert.description}</p>
                      {alert.amount && (
                        <p className="font-['JetBrains_Mono'] text-xs text-on-surface-variant mt-1">{alert.amount}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Document Health Mini-Bar */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:shadow-[0_0_20px_rgba(218,226,253,0.05)] transition-shadow shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
              <h3 className="text-xl font-semibold text-on-surface mb-4">Document Status</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-on-surface-variant">Approved</span>
                    <span className="font-['JetBrains_Mono'] text-on-surface font-bold">65%</span>
                  </div>
                  <div className="w-full bg-white/10 border border-white/10 rounded-full h-2">
                    <div className="bg-secondary h-2 rounded-full shadow-[0_0_8px_rgba(78,222,163,0.6)]" style={{ width: '65%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-on-surface-variant">Pending</span>
                    <span className="font-['JetBrains_Mono'] text-on-surface font-bold">25%</span>
                  </div>
                  <div className="w-full bg-white/10 border border-white/10 rounded-full h-2">
                    <div className="bg-[#4b8eff] h-2 rounded-full shadow-[0_0_8px_rgba(75,142,255,0.6)]" style={{ width: '25%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-on-surface-variant">Rejected/Lost</span>
                    <span className="font-['JetBrains_Mono'] text-on-surface font-bold">10%</span>
                  </div>
                  <div className="w-full bg-white/10 border border-white/10 rounded-full h-2">
                    <div className="bg-error h-2 rounded-full shadow-[0_0_8px_rgba(255,180,171,0.6)]" style={{ width: '10%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Full Width Row: Recent Activity & Small Metrics */}
          <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Small metric cards */}
            <div className="md:col-span-1 flex flex-col gap-4">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex items-center justify-between hover:shadow-[0_0_15px_rgba(218,226,253,0.05)] transition-shadow shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
                <div>
                  <p className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant mb-1">Total Outstanding</p>
                  <p className="text-xl font-bold text-on-surface">{formatCurrency(stats.totalOutstanding)}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[#4b8eff]">
                  <span className="material-symbols-outlined">schedule</span>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex items-center justify-between hover:shadow-[0_0_15px_rgba(218,226,253,0.05)] transition-shadow shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
                <div>
                  <p className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant mb-1">Conversion Rate</p>
                  <p className="text-xl font-bold text-on-surface">{stats.conversionRate.toFixed(1)}%</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined">check_circle</span>
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="md:col-span-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:shadow-[0_0_15px_rgba(218,226,253,0.05)] transition-shadow shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-on-surface">Real-Time Activity</h3>
                <Link to="/reports" className="text-[#4b8eff] text-sm hover:underline font-medium hover:text-white transition-colors">
                  View All
                </Link>
              </div>
              
              <div className="space-y-4">
                {activities.map(activity => (
                  <div key={activity.id} className="flex items-start gap-4">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 border border-white/50 ${getActivityColor(activity.type)}`}></div>
                    <div className="flex-1">
                      <p className="text-sm text-on-surface">
                        <span className="font-semibold text-white">{activity.title}</span> {activity.description}
                      </p>
                      <p className="text-xs text-on-surface-variant font-['JetBrains_Mono'] mt-0.5">
                        {activity.timestamp}{activity.user && ` • by ${activity.user}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
