import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Wallet, RefreshCw, Layers, DollarSign, PieChart as PieChartIcon, 
  ArrowDownRight, TrendingDown 
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Expense = {
  amount: number;
  category: string | null;
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const ExpenseReport = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('amount, category')
      .eq('user_id', user.id);
    
    if (error) console.error('Error fetching expenses:', error);
    else setExpenses(data as Expense[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, [user]);

  const reportData = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Tanpa Kategori';
      if (!categoryMap[category]) {
        categoryMap[category] = 0;
      }
      categoryMap[category] += Number(expense.amount) || 0;
    });

    const chartData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
      
    const total = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const topCategory = chartData[0]?.name || '-';
    const topCategoryAmount = chartData[0]?.value || 0;

    return { chartData, total, topCategory, topCategoryAmount };
  }, [expenses]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/80 text-white p-6 sm:p-8 shadow-2xl">
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                Laporan Distribusi Pengeluaran
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                {expenses.length} Transaksi Beban
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Laporan Pengeluaran
            </h1>

            <p className="text-slate-300/90 text-sm leading-relaxed max-w-xl">
              Analisis alokasi dan sebaran beban operasional berdasarkan kategori pengeluaran bisnis Anda.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button 
              onClick={fetchExpenses} 
              variant="outline" 
              size="lg"
              className="h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95"
              title="Refresh Data"
            >
              <RefreshCw className={cn("h-4 w-4 text-rose-400", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Pengeluaran */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Beban Dicatat</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 shadow-2xs">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground truncate">
              {formatCurrency(reportData.total)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>Akumulasi semua pengeluaran</span>
          </div>
        </Card>

        {/* Card 2: Kategori Tertinggi */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kategori Beban Terbesar</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-2xs">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-foreground truncate">
              {reportData.topCategory}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{formatCurrency(reportData.topCategoryAmount)}</span>
          </div>
        </Card>

        {/* Card 3: Total Kategori Aktif */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Kategori</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {reportData.chartData.length}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span>Kategori pos anggaran</span>
          </div>
        </Card>
      </div>

      {/* Grid: Table & Pie Chart */}
      <div className="grid gap-6 md:grid-cols-5">
        {/* Table: Breakdown per Kategori */}
        <Card className="md:col-span-2 rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-rose-500" />
              Rincian per Kategori
            </h3>
            <p className="text-xs text-muted-foreground">Persentase dan total dana per kategori.</p>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            {loading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : reportData.chartData.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-2">
                <p className="text-xs text-muted-foreground">Belum ada data pengeluaran.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border/80">
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Kategori</TableHead>
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Porsi</TableHead>
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {reportData.chartData.map((entry, index) => {
                      const share = reportData.total > 0 ? (entry.value / reportData.total) * 100 : 0;
                      return (
                        <TableRow key={entry.name} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="px-5 py-3.5 font-bold text-xs text-foreground flex items-center gap-2">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                            />
                            <span>{entry.name}</span>
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-center font-bold text-xs text-muted-foreground">
                            {share.toFixed(1)}%
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right font-black text-xs text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatCurrency(entry.value)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart: Visual Distribution */}
        <Card className="md:col-span-3 rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-indigo-500" />
              Distribusi Pengeluaran
            </h3>
            <p className="text-xs text-muted-foreground">Visualisasi porsi pengeluaran untuk setiap pos.</p>
          </CardHeader>

          <CardContent className="p-6 flex-1 flex items-center justify-center min-h-[300px]">
            {loading ? (
              <Skeleton className="h-64 w-64 rounded-full" />
            ) : reportData.chartData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tidak ada grafik untuk ditampilkan.</p>
            ) : (
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportData.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {reportData.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpenseReport;