import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, Users, Package, DollarSign, Award, 
  Sparkles, RefreshCw, Layers, ArrowUpRight, CheckCircle2,
  Wrench, Search, X, HelpCircle, Info, ShieldCheck, Wallet
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, calculateItemTotal, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type AcceptedQuote = {
  id: string;
  clients: { name: string } | null;
  client_id: string;
  quote_number: string;
  discount_amount?: number;
  tax_amount?: number;
  quote_items: {
    id: string;
    description: string;
    quantity: number;
    unit?: string | null;
    unit_price: number;
    cost_price: number;
  }[];
};

// Helper: Deteksi Header / Pembatas
const isHeaderOrDivider = (item: { description?: string | null; quantity?: number; unit_price?: number; cost_price?: number }) => {
  const desc = (item.description || '').trim().toLowerCase();
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price) || 0;
  const cost = Number(item.cost_price) || 0;

  if (qty <= 0) return true;
  if (price === 0 && cost === 0) return true;
  if (/^[-=_*~#]{2,}/.test(desc) || /^\[.*\]$/.test(desc)) return true;

  const headerKeywords = [
    'item utama', 'material utama', 'daftar barang', 'daftar material',
    'peralatan', 'perangkat', 'pembatas', 'header', 'kategori',
    'rincian barang', 'rincian jasa', 'sub total', 'subtotal', 'section'
  ];
  if (headerKeywords.some(kw => desc === kw || desc === `${kw}:` || desc === `[${kw}]` || desc.startsWith(`${kw} `))) {
    if (price === 0 || qty <= 0) return true;
  }

  return false;
};

// Helper: Deteksi Item Jasa
const isServiceItem = (item: { description?: string | null; unit?: string | null }) => {
  const desc = (item.description || '').trim().toLowerCase();
  const unit = (item.unit || '').trim().toLowerCase();

  if (['jasa', 'srv', 'service', 'titik pasang', 'titik'].includes(unit)) return true;

  const serviceKeywords = [
    'jasa pasang', 'jasa instalasi', 'jasa pemasangan', 'jasa setting',
    'jasa konfigurasi', 'jasa tarik kabel', 'jasa penarikan', 'jasa borongan',
    'jasa maintenance', 'jasa perbaikan', 'jasa servis', 'jasa service',
    'ongkos pasang', 'ongkos kerja', 'biaya pasang', 'biaya instalasi',
    'biaya setting', 'upah kerja', 'upah teknisi', 'instalasi & setting',
    'instalasi cctv', 'tarik kabel', 'setting nvr', 'setting dvr', 'setting cctv',
    'transportasi dan akomodasi', 'akomodasi'
  ];

  return serviceKeywords.some(kw => desc.startsWith(kw) || desc.includes(` ${kw}`) || desc === kw) || desc.startsWith('jasa ');
};

const ProfitabilityReports = () => {
  const { user } = useAuth();
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [clientSearch, setClientSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'goods' | 'services'>('all');

  const fetchAcceptedQuotes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, client_id, quote_number, discount_amount, tax_amount, clients(name), quote_items(id, description, quantity, unit, unit_price, cost_price)')
        .eq('user_id', user.id)
        .eq('status', 'Diterima');

      if (error) {
        console.error('Error fetching accepted quotes:', error);
      } else {
        setAcceptedQuotes((data as AcceptedQuote[]) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcceptedQuotes();
  }, [user]);

  // Aggregate Data
  const reportData = useMemo(() => {
    const clientProfit: Record<string, { name: string; totalRevenue: number; totalCost: number; totalProfit: number; quoteCount: number }> = {};
    const itemProfit: Record<string, { description: string; isService: boolean; totalQuantity: number; totalRevenue: number; totalCost: number; totalProfit: number }> = {};

    let grandRevenue = 0;
    let grandCost = 0;
    let grandProfit = 0;

    acceptedQuotes.forEach(quote => {
      const clientId = quote.client_id || 'unknown';
      const clientName = quote.clients?.name || 'Klien Umum';

      if (!clientProfit[clientId]) {
        clientProfit[clientId] = { name: clientName, totalRevenue: 0, totalCost: 0, totalProfit: 0, quoteCount: 0 };
      }
      clientProfit[clientId].quoteCount += 1;

      (quote.quote_items || []).forEach(item => {
        // Skip header / pembatas
        if (isHeaderOrDivider(item)) return;

        const qty = Number(item.quantity) || 0;
        const uPrice = Number(item.unit_price) || 0;
        const cPrice = Number(item.cost_price) || 0;
        const isService = isServiceItem(item);

        const revenue = calculateItemTotal(qty, uPrice);
        const cost = calculateItemTotal(qty, cPrice);
        const profit = revenue - cost;
        
        grandRevenue += revenue;
        grandCost += cost;
        grandProfit += profit;

        // Aggregate by client
        clientProfit[clientId].totalRevenue += revenue;
        clientProfit[clientId].totalCost += cost;
        clientProfit[clientId].totalProfit += profit;

        // Aggregate by item description
        const itemKey = (item.description || 'Tanpa Deskripsi').trim();
        if (!itemProfit[itemKey]) {
          itemProfit[itemKey] = { 
            description: itemKey, 
            isService, 
            totalQuantity: 0, 
            totalRevenue: 0, 
            totalCost: 0, 
            totalProfit: 0 
          };
        }
        itemProfit[itemKey].totalQuantity += qty;
        itemProfit[itemKey].totalRevenue += revenue;
        itemProfit[itemKey].totalCost += cost;
        itemProfit[itemKey].totalProfit += profit;
      });
    });

    const sortedClients = Object.values(clientProfit).sort((a, b) => b.totalProfit - a.totalProfit);
    const sortedItems = Object.values(itemProfit).sort((a, b) => b.totalProfit - a.totalProfit);

    const overallMargin = grandRevenue > 0 ? (grandProfit / grandRevenue) * 100 : 0;
    const topClient = sortedClients[0]?.name || '-';
    const topItem = sortedItems[0]?.description || '-';

    return { 
      clients: sortedClients, 
      items: sortedItems,
      grandRevenue,
      grandCost,
      grandProfit,
      overallMargin,
      topClient,
      topItem
    };
  }, [acceptedQuotes]);

  // Filtered Clients
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return reportData.clients;
    return reportData.clients.filter(c => 
      c.name.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [reportData.clients, clientSearch]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return reportData.items.filter(item => {
      const matchesSearch = !itemSearch.trim() || 
        item.description.toLowerCase().includes(itemSearch.toLowerCase());
      
      const matchesType = 
        itemTypeFilter === 'all' ? true :
        itemTypeFilter === 'services' ? item.isService :
        !item.isService;

      return matchesSearch && matchesType;
    });
  }, [reportData.items, itemSearch, itemTypeFilter]);

  return (
    <div className="container mx-auto p-3 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* ========================================================================= */}
      {/* HERO COMMAND HEADER */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Analisis Profitabilitas Bisnis
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border/60">
                {acceptedQuotes.length} Penawaran Diterima
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Laporan Profitabilitas
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Analisis kontribusi laba kotor per klien dan performa penjualan barang/jasa untuk menentukan strategi harga & prioritas proyek.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button 
              onClick={fetchAcceptedQuotes} 
              variant="outline" 
              className="rounded-xl font-bold text-xs h-10 gap-2 border-border/80 hover:bg-muted"
              title="Refresh Data"
            >
              <RefreshCw className={cn("h-4 w-4 text-emerald-500", loading && "animate-spin")} />
              <span>Refresh Data</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 KPI SUMMARY CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Nilai Kontrak/Penjualan */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Penjualan</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {formatCurrency(reportData.grandRevenue)}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Modal HPP:</span>
            <span className="font-bold text-foreground">{formatCurrency(reportData.grandCost)}</span>
          </div>
        </Card>

        {/* Card 2: Total Estimasi Laba */}
        <Card className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Estimasi Laba Kotor</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(reportData.grandProfit)}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-emerald-700/80 dark:text-emerald-300 font-bold border-t border-emerald-500/20 pt-2 flex items-center justify-between">
            <span>Rata-rata Margin:</span>
            <span>{reportData.overallMargin.toFixed(1)}%</span>
          </div>
        </Card>

        {/* Card 3: Top Client */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Klien Teratas</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-foreground truncate" title={reportData.topClient}>
              {reportData.topClient}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Kontributor laba tertinggi</span>
          </div>
        </Card>

        {/* Card 4: Top Item */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Item Paling Laris</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-foreground truncate" title={reportData.topItem}>
              {reportData.topItem}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Laba per produk/layanan</span>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 2 MAIN COMPARISON TABLES */}
      {/* ========================================================================= */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Table 1: Profitability by Client (5 cols) */}
        <Card className="lg:col-span-5 rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground">Profitabilitas per Klien</h3>
                  <p className="text-[11px] text-muted-foreground">Klien penyumbang omzet & laba terbesar.</p>
                </div>
              </div>

              <span className="font-extrabold text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                {reportData.clients.length} Klien
              </span>
            </div>

            {/* Search Klien */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari nama klien..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl bg-background"
              />
              {clientSearch && (
                <button onClick={() => setClientSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            {loading ? (
              <div className="p-5 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12 px-4 text-xs text-muted-foreground">
                Tidak ada data klien yang sesuai.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-xs">
                    <TableRow className="border-b border-border/80">
                      <TableHead className="font-bold text-[11px] uppercase text-muted-foreground">Nama Klien</TableHead>
                      <TableHead className="text-right font-bold text-[11px] uppercase text-muted-foreground">Penjualan</TableHead>
                      <TableHead className="text-right font-bold text-[11px] uppercase text-muted-foreground">Total Laba</TableHead>
                      <TableHead className="text-center font-bold text-[11px] uppercase text-muted-foreground">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60 text-xs">
                    {filteredClients.map((client, i) => {
                      const margin = client.totalRevenue > 0 ? (client.totalProfit / client.totalRevenue) * 100 : 0;
                      return (
                        <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-bold text-xs text-foreground py-3">
                            <span className="block truncate max-w-[140px]" title={client.name}>{client.name}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">{client.quoteCount} Proyek/Penawaran</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-muted-foreground tabular-nums">
                            {formatCurrency(client.totalRevenue)}
                          </TableCell>
                          <TableCell className="text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(client.totalProfit)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                              client.totalProfit >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                            )}>
                              {margin.toFixed(0)}%
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

        {/* Table 2: Profitability by Items & Services (7 cols) */}
        <Card className="lg:col-span-7 rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground">Profitabilitas Barang & Jasa</h3>
                  <p className="text-[11px] text-muted-foreground">Rincian penjualan, modal beli (HPP), dan laba per produk.</p>
                </div>
              </div>

              {/* Type Filter Pills */}
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/60 self-start sm:self-auto">
                <button
                  onClick={() => setItemTypeFilter('all')}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all",
                    itemTypeFilter === 'all' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Semua ({reportData.items.length})
                </button>
                <button
                  onClick={() => setItemTypeFilter('goods')}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all",
                    itemTypeFilter === 'goods' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  📦 Barang ({reportData.items.filter(i => !i.isService).length})
                </button>
                <button
                  onClick={() => setItemTypeFilter('services')}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all",
                    itemTypeFilter === 'services' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  🔧 Jasa ({reportData.items.filter(i => i.isService).length})
                </button>
              </div>
            </div>

            {/* Search Item */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari deskripsi barang atau layanan jasa..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl bg-background"
              />
              {itemSearch && (
                <button onClick={() => setItemSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            {loading ? (
              <div className="p-5 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 px-4 text-xs text-muted-foreground">
                Tidak ada data barang/jasa yang sesuai filter.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-xs">
                    <TableRow className="border-b border-border/80">
                      <TableHead className="font-bold text-[11px] uppercase text-muted-foreground">Deskripsi Item</TableHead>
                      <TableHead className="text-center font-bold text-[11px] uppercase text-muted-foreground w-[60px]">Qty</TableHead>
                      <TableHead className="text-right font-bold text-[11px] uppercase text-muted-foreground">Penjualan</TableHead>
                      <TableHead className="text-right font-bold text-[11px] uppercase text-muted-foreground">Modal (HPP)</TableHead>
                      <TableHead className="text-right font-bold text-[11px] uppercase text-muted-foreground">Laba</TableHead>
                      <TableHead className="text-center font-bold text-[11px] uppercase text-muted-foreground w-[70px]">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60 text-xs">
                    {filteredItems.map((item, i) => {
                      const margin = item.totalRevenue > 0 ? (item.totalProfit / item.totalRevenue) * 100 : 0;
                      return (
                        <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                          {/* Deskripsi & Badge */}
                          <TableCell className="py-3">
                            <span className="font-bold text-xs text-foreground block truncate max-w-[200px]" title={item.description}>
                              {item.description}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium mt-0.5">
                              {item.isService ? (
                                <span className="text-blue-500 font-semibold flex items-center gap-0.5">
                                  <Wrench className="h-2.5 w-2.5" /> Jasa Layanan
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                                  <Package className="h-2.5 w-2.5" /> Barang Fisik
                                </span>
                              )}
                            </span>
                          </TableCell>

                          {/* Terjual */}
                          <TableCell className="text-center font-black text-xs text-foreground">
                            {item.totalQuantity}
                          </TableCell>

                          {/* Pendapatan Penjualan */}
                          <TableCell className="text-right font-semibold text-muted-foreground tabular-nums">
                            {formatCurrency(item.totalRevenue)}
                          </TableCell>

                          {/* Modal HPP */}
                          <TableCell className="text-right font-semibold text-foreground tabular-nums">
                            {item.totalCost > 0 ? (
                              formatCurrency(item.totalCost)
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">Rp 0</span>
                            )}
                          </TableCell>

                          {/* Total Laba */}
                          <TableCell className="text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(item.totalProfit)}
                          </TableCell>

                          {/* Margin % */}
                          <TableCell className="text-center">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                              item.totalProfit >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                            )}>
                              {margin.toFixed(0)}%
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
      </div>
    </div>
  );
};

export default ProfitabilityReports;