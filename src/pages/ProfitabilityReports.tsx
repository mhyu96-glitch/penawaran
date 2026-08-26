import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  TrendingUp, Users, Package, DollarSign, Award, 
  Sparkles, RefreshCw, Layers, ArrowUpRight, CheckCircle2 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, calculateItemTotal, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

type AcceptedQuote = {
  id: string;
  clients: { name: string } | null;
  client_id: string;
  quote_items: {
    description: string;
    quantity: number;
    unit_price: number;
    cost_price: number;
  }[];
};

const ProfitabilityReports = () => {
  const { user } = useAuth();
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAcceptedQuotes = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('id, client_id, clients(name), quote_items(description, quantity, unit_price, cost_price)')
      .eq('user_id', user.id)
      .eq('status', 'Diterima');

    if (error) {
      console.error('Error fetching accepted quotes:', error);
    } else {
      setAcceptedQuotes(data as AcceptedQuote[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAcceptedQuotes();
  }, [user]);

  const reportData = useMemo(() => {
    const clientProfit: Record<string, { name: string; totalRevenue: number; totalProfit: number; quoteCount: number }> = {};
    const itemProfit: Record<string, { totalQuantity: number; totalRevenue: number; totalProfit: number }> = {};

    let grandRevenue = 0;
    let grandProfit = 0;

    acceptedQuotes.forEach(quote => {
      const clientId = quote.client_id || 'unknown';
      const clientName = quote.clients?.name || 'Klien Umum';

      if (!clientProfit[clientId]) {
        clientProfit[clientId] = { name: clientName, totalRevenue: 0, totalProfit: 0, quoteCount: 0 };
      }
      clientProfit[clientId].quoteCount += 1;

      quote.quote_items.forEach(item => {
        const qty = Number(item.quantity) || 0;
        const uPrice = Number(item.unit_price) || 0;
        const cPrice = Number(item.cost_price) || 0;

        const revenue = calculateItemTotal(qty, uPrice);
        const cost = calculateItemTotal(qty, cPrice);
        const profit = revenue - cost;
        
        grandRevenue += revenue;
        grandProfit += profit;

        // Aggregate by client
        clientProfit[clientId].totalRevenue += revenue;
        clientProfit[clientId].totalProfit += profit;

        // Aggregate by item description
        const itemKey = item.description || 'Tanpa Deskripsi';
        if (!itemProfit[itemKey]) {
          itemProfit[itemKey] = { totalQuantity: 0, totalRevenue: 0, totalProfit: 0 };
        }
        itemProfit[itemKey].totalQuantity += qty;
        itemProfit[itemKey].totalRevenue += revenue;
        itemProfit[itemKey].totalProfit += profit;
      });
    });

    const sortedClients = Object.values(clientProfit).sort((a, b) => b.totalProfit - a.totalProfit);
    const sortedItems = Object.entries(itemProfit).map(([description, data]) => ({ description, ...data })).sort((a, b) => b.totalProfit - a.totalProfit);

    const overallMargin = grandRevenue > 0 ? (grandProfit / grandRevenue) * 100 : 0;
    const topClient = sortedClients[0]?.name || '-';
    const topItem = sortedItems[0]?.description || '-';

    return { 
      clients: sortedClients, 
      items: sortedItems,
      grandRevenue,
      grandProfit,
      overallMargin,
      topClient,
      topItem
    };
  }, [acceptedQuotes]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/80 text-white p-6 sm:p-8 shadow-2xl">
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Analisis Keuntungan Penjualan
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                {acceptedQuotes.length} Penawaran Goal Diterima
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Laporan Profitabilitas
            </h1>

            <p className="text-slate-300/90 text-sm leading-relaxed max-w-xl">
              Identifikasi klien dan produk/layanan yang memberikan kontribusi laba bersih terbesar bagi perkembangan bisnis Anda.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button 
              onClick={fetchAcceptedQuotes} 
              variant="outline" 
              size="lg"
              className="h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95"
              title="Refresh Data"
            >
              <RefreshCw className={cn("h-4 w-4 text-amber-400", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Pendapatan Diterima */}
        <Card className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Nilai Penawaran</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              {formatCurrency(reportData.grandRevenue)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700/80 dark:text-emerald-300 font-bold border-t border-emerald-500/20 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Dari penawaran yang diterima</span>
          </div>
        </Card>

        {/* Card 2: Total Margin Laba */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Estimasi Laba</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-2xs">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground truncate">
              {formatCurrency(reportData.grandProfit)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{reportData.overallMargin.toFixed(1)}% Rata-rata Profit Margin</span>
          </div>
        </Card>

        {/* Card 3: Top Client */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Klien Teratas</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-extrabold tracking-tight text-foreground truncate" title={reportData.topClient}>
              {reportData.topClient}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span>Kontributor laba tertinggi</span>
          </div>
        </Card>

        {/* Card 4: Top Item */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Item Paling Menguntungkan</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 shadow-2xs">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-extrabold tracking-tight text-foreground truncate" title={reportData.topItem}>
              {reportData.topItem}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span>Laba per produk/jasa</span>
          </div>
        </Card>
      </div>

      {/* Tables Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Table 1: Profitability by Client */}
        <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">Profitabilitas per Klien</h3>
                </div>
                <p className="text-xs text-muted-foreground">Klien yang menghasilkan margin keuntungan terbesar.</p>
              </div>

              <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                {reportData.clients.length} Klien
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            {loading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : reportData.clients.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-2">
                <p className="text-xs text-muted-foreground">Belum ada data penawaran berstatus diterima.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border/80">
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nama Klien</TableHead>
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Pendapatan</TableHead>
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Total Laba</TableHead>
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {reportData.clients.map((client, i) => {
                      const margin = client.totalRevenue > 0 ? (client.totalProfit / client.totalRevenue) * 100 : 0;
                      return (
                        <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="px-5 py-3.5 font-bold text-xs text-foreground">
                            {client.name}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right font-medium text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(client.totalRevenue)}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right font-black text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(client.totalProfit)}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-center">
                            <span className={cn(
                              "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                              client.totalProfit >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                            )}>
                              {margin.toFixed(1)}%
                            </span>
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

        {/* Table 2: Profitability by Items */}
        <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Package className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">Profitabilitas Barang / Jasa</h3>
                </div>
                <p className="text-xs text-muted-foreground">Item yang paling laris dan menghasilkan laba.</p>
              </div>

              <span className="font-bold text-xs text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20">
                {reportData.items.length} Item
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            {loading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : reportData.items.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-2">
                <p className="text-xs text-muted-foreground">Belum ada data barang/jasa dari penawaran.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border/80">
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Deskripsi Item</TableHead>
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Terjual</TableHead>
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Pendapatan</TableHead>
                      <TableHead className="px-5 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Total Laba</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {reportData.items.map((item, i) => (
                      <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="px-5 py-3.5 font-bold text-xs text-foreground truncate max-w-xs">
                          {item.description}
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-center font-bold text-xs text-foreground">
                          {item.totalQuantity}
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-right font-medium text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(item.totalRevenue)}
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-right font-black text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatCurrency(item.totalProfit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfitabilityReports;