import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, Users, Package, DollarSign, Award, 
  Sparkles, RefreshCw, Layers, ArrowUpRight, CheckCircle2,
  Wrench, Search, X, HelpCircle, Info, ShieldCheck, Wallet,
  BarChart3, ArrowDownRight, AlertCircle, Percent, Receipt, FileText
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, calculateItemTotal, calculateSubtotal, calculateTotal, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

type InvoiceData = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  to_client: string;
  client_id?: string | null;
  status: string;
  discount_amount: number;
  tax_amount: number;
  clients?: { name: string } | null;
  projects?: { id: string; name: string } | null;
  invoice_items: {
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

// Helper: Deteksi Item Jasa (Layanan & Tenaga Kerja)
const isServiceItem = (item: { description?: string | null; unit?: string | null }) => {
  const desc = (item.description || '').trim().toLowerCase();
  const unit = (item.unit || '').trim().toLowerCase();

  if (['jasa', 'srv', 'service', 'titik pasang', 'titik', 'lot', 'ls', 'hari', 'org/hari', 'sesi'].includes(unit)) return true;

  const serviceKeywords = [
    'jasa', 'service', 'servis',
    'instalasi', 'pemasangan', 'pasang',
    'setting', 'konfigurasi', 'config',
    'tarik kabel', 'penarikan kabel', 'penarikan',
    'terminasi', 'crimping', 'splicing',
    'borongan', 'upah', 'gaji', 'ongkos',
    'maintenance', 'perbaikan', 'troubleshooting',
    'survey', 'inspeksi', 'supervisi',
    'transportasi', 'akomodasi', 'delivery', 'kirim',
    'sewa', 'rental', 'pelatihan', 'training'
  ];

  return serviceKeywords.some(kw => desc.includes(kw));
};

const ProfitabilityReports = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab & Searches
  const [activeTab, setActiveTab] = useState<'goods' | 'services' | 'clients'>('goods');
  const [goodsSearch, setGoodsSearch] = useState('');
  const [servicesSearch, setServicesSearch] = useState('');
  const [clientsSearch, setClientsSearch] = useState('');

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, to_client, client_id, status, discount_amount, tax_amount, clients(name), projects(id, name), invoice_items(id, description, quantity, unit, unit_price, cost_price)')
        .eq('user_id', user.id)
        .order('invoice_date', { ascending: false });

      if (error) {
        console.error('Error fetching invoices for profitability report:', error);
      } else {
        setInvoices((data as InvoiceData[]) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  // Aggregate Data from Invoices
  const reportData = useMemo(() => {
    const clientProfit: Record<string, { name: string; totalRevenue: number; totalCost: number; totalProfit: number; invoiceCount: number; paidCount: number }> = {};
    const goodsProfit: Record<string, { description: string; totalQuantity: number; totalRevenue: number; totalCost: number; totalProfit: number; hasMissingHpp: boolean }> = {};
    const servicesProfit: Record<string, { description: string; totalQuantity: number; totalRevenue: number; totalCost: number; totalProfit: number }> = {};

    let grandRevenue = 0;
    let grandCost = 0;
    let grandProfit = 0;
    let paidRevenue = 0;

    invoices.forEach(inv => {
      const isPaid = inv.status === 'Lunas';
      const clientName = inv.clients?.name || inv.to_client || 'Klien Umum';
      const clientKey = clientName.trim().toLowerCase();

      if (!clientProfit[clientKey]) {
        clientProfit[clientKey] = { name: clientName, totalRevenue: 0, totalCost: 0, totalProfit: 0, invoiceCount: 0, paidCount: 0 };
      }
      clientProfit[clientKey].invoiceCount += 1;
      if (isPaid) clientProfit[clientKey].paidCount += 1;

      (inv.invoice_items || []).forEach(item => {
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
        if (isPaid) paidRevenue += revenue;

        // Aggregate by client
        clientProfit[clientKey].totalRevenue += revenue;
        clientProfit[clientKey].totalCost += cost;
        clientProfit[clientKey].totalProfit += profit;

        const itemKey = (item.description || 'Tanpa Deskripsi').trim();

        if (isService) {
          if (!servicesProfit[itemKey]) {
            servicesProfit[itemKey] = { description: itemKey, totalQuantity: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0 };
          }
          servicesProfit[itemKey].totalQuantity += qty;
          servicesProfit[itemKey].totalRevenue += revenue;
          servicesProfit[itemKey].totalCost += cost;
          servicesProfit[itemKey].totalProfit += profit;
        } else {
          if (!goodsProfit[itemKey]) {
            goodsProfit[itemKey] = { description: itemKey, totalQuantity: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, hasMissingHpp: false };
          }
          goodsProfit[itemKey].totalQuantity += qty;
          goodsProfit[itemKey].totalRevenue += revenue;
          goodsProfit[itemKey].totalCost += cost;
          goodsProfit[itemKey].totalProfit += profit;
          if (cPrice === 0 && uPrice > 0) {
            goodsProfit[itemKey].hasMissingHpp = true;
          }
        }
      });
    });

    const sortedClients = Object.values(clientProfit).sort((a, b) => b.totalProfit - a.totalProfit);
    const sortedGoods = Object.values(goodsProfit).sort((a, b) => b.totalProfit - a.totalProfit);
    const sortedServices = Object.values(servicesProfit).sort((a, b) => b.totalProfit - a.totalProfit);

    const overallMargin = grandRevenue > 0 ? (grandProfit / grandRevenue) * 100 : 0;
    const topClient = sortedClients[0]?.name || '-';
    const topGood = sortedGoods[0]?.description || '-';
    const topService = sortedServices[0]?.description || '-';

    return { 
      clients: sortedClients, 
      goods: sortedGoods,
      services: sortedServices,
      grandRevenue,
      grandCost,
      grandProfit,
      paidRevenue,
      overallMargin,
      topClient,
      topGood,
      topService
    };
  }, [invoices]);

  // Filtered lists
  const filteredGoods = useMemo(() => {
    if (!goodsSearch.trim()) return reportData.goods;
    return reportData.goods.filter(g => g.description.toLowerCase().includes(goodsSearch.toLowerCase()));
  }, [reportData.goods, goodsSearch]);

  const filteredServices = useMemo(() => {
    if (!servicesSearch.trim()) return reportData.services;
    return reportData.services.filter(s => s.description.toLowerCase().includes(servicesSearch.toLowerCase()));
  }, [reportData.services, servicesSearch]);

  const filteredClients = useMemo(() => {
    if (!clientsSearch.trim()) return reportData.clients;
    return reportData.clients.filter(c => c.name.toLowerCase().includes(clientsSearch.toLowerCase()));
  }, [reportData.clients, clientsSearch]);

  return (
    <div className="container mx-auto p-3 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* ========================================================================= */}
      {/* HERO COMMAND HEADER */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Sumber Data: Faktur Tagihan Penjualan (Invoices)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border/60">
                {invoices.length} Faktur Tagihan
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Laporan Laba & Margin Penjualan
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Laporan keuntungan riil dan persentase margin berdasarkan seluruh faktur tagihan yang diterbitkan kepada klien.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button 
              onClick={fetchInvoices} 
              variant="outline" 
              className="rounded-xl font-bold text-xs h-11 gap-2 border-border/80 hover:bg-muted"
              title="Refresh Data"
            >
              <RefreshCw className={cn("h-4 w-4 text-emerald-500", loading && "animate-spin")} />
              <span>Perbarui Data</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 KPI SUMMARY CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Nilai Faktur */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Penjualan Faktur</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {formatCurrency(reportData.grandRevenue)}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Modal HPP: {formatCurrency(reportData.grandCost)}</span>
            {reportData.paidRevenue > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Lunas: {formatCurrency(reportData.paidRevenue)}</span>
            )}
          </div>
        </Card>

        {/* Card 2: Total Estimasi Laba */}
        <Card className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Estimasi Laba</p>
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

        {/* Card 3: Top Good */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Barang Terbanyak Terjual</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate" title={reportData.topGood}>
              {reportData.topGood}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Total {reportData.goods.length} Jenis Barang</span>
          </div>
        </Card>

        {/* Card 4: Top Service */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jasa Terbanyak Ditagihkan</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate" title={reportData.topService}>
              {reportData.topService}
            </h3>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Total {reportData.services.length} Layanan Jasa</span>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* MAIN FULL-WIDTH TABBED ANALYSIS */}
      {/* ========================================================================= */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        {/* Full-width Responsive Tabs Header */}
        <TabsList className="grid grid-cols-3 w-full h-auto p-1.5 rounded-2xl bg-card border border-border/80 shadow-2xs gap-1.5">
          <TabsTrigger 
            value="goods" 
            className="rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold gap-2 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
          >
            <Package className="h-4 w-4 shrink-0" />
            <span>📦 Barang Fisik</span>
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-[11px] font-black leading-none shrink-0">
              {reportData.goods.length}
            </span>
          </TabsTrigger>

          <TabsTrigger 
            value="services" 
            className="rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold gap-2 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
          >
            <Wrench className="h-4 w-4 shrink-0" />
            <span>🔧 Jasa & Layanan</span>
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-[11px] font-black leading-none shrink-0">
              {reportData.services.length}
            </span>
          </TabsTrigger>

          <TabsTrigger 
            value="clients" 
            className="rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold gap-2 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
          >
            <Users className="h-4 w-4 shrink-0" />
            <span>👥 Klien (Customers)</span>
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-[11px] font-black leading-none shrink-0">
              {reportData.clients.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: PROFITABILITAS BARANG FISIK */}
        {/* ========================================================================= */}
        <TabsContent value="goods">
          <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-amber-500" />
                    Laba & Margin Penjualan Barang Fisik di Faktur
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Membandingkan harga penjualan faktur dan modal beli supplier (HPP) untuk setiap produk fisik.
                  </CardDescription>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama barang..."
                    value={goodsSearch}
                    onChange={(e) => setGoodsSearch(e.target.value)}
                    className="pl-9 rounded-xl h-10 text-xs bg-background"
                  />
                  {goodsSearch && (
                    <button onClick={() => setGoodsSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : filteredGoods.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  Belum ada catatan barang fisik pada faktur tagihan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="w-[60px] text-center font-bold text-xs uppercase text-muted-foreground">#</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-muted-foreground">Nama Barang / Deskripsi</TableHead>
                        <TableHead className="w-[100px] text-center font-bold text-xs uppercase text-muted-foreground">Terjual</TableHead>
                        <TableHead className="w-[160px] text-right font-bold text-xs uppercase text-muted-foreground">Total Penjualan</TableHead>
                        <TableHead className="w-[160px] text-right font-bold text-xs uppercase text-muted-foreground">Modal Beli (HPP)</TableHead>
                        <TableHead className="w-[160px] text-right font-bold text-xs uppercase text-muted-foreground">Laba Kotor</TableHead>
                        <TableHead className="w-[130px] text-center font-bold text-xs uppercase text-muted-foreground">Margin (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {filteredGoods.map((good, i) => {
                        const margin = good.totalRevenue > 0 ? (good.totalProfit / good.totalRevenue) * 100 : 0;

                        return (
                          <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="text-center font-bold text-xs text-muted-foreground">
                              {i + 1}
                            </TableCell>

                            <TableCell className="py-3.5">
                              <span className="font-bold text-xs sm:text-sm block text-foreground">
                                {good.description}
                              </span>
                              {good.hasMissingHpp && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-semibold mt-0.5">
                                  <AlertCircle className="h-2.5 w-2.5" /> HPP belum diisi di faktur
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-center font-black text-xs sm:text-sm text-foreground">
                              {good.totalQuantity} <span className="text-[11px] font-normal text-muted-foreground">unit</span>
                            </TableCell>

                            <TableCell className="text-right font-semibold text-xs sm:text-sm text-muted-foreground tabular-nums">
                              {formatCurrency(good.totalRevenue)}
                            </TableCell>

                            <TableCell className="text-right font-semibold text-xs sm:text-sm text-foreground tabular-nums">
                              {good.totalCost > 0 ? (
                                formatCurrency(good.totalCost)
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Rp 0</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatCurrency(good.totalProfit)}
                            </TableCell>

                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={cn(
                                  "text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border",
                                  margin >= 30 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" :
                                  margin > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25" :
                                  "bg-rose-500/10 text-rose-600 border-rose-500/25"
                                )}>
                                  {margin.toFixed(1)}%
                                </span>
                                <Progress value={Math.min(margin, 100)} className="h-1.5 w-14 rounded-full" />
                              </div>
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
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: PROFITABILITAS JASA & LAYANAN */}
        {/* ========================================================================= */}
        <TabsContent value="services">
          <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-sky-500" />
                    Laba & Kontribusi Layanan / Jasa di Faktur
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Daftar pekerjaan jasa pasang, setting, penarikan kabel, dan akomodasi yang ditagihkan di faktur.
                  </CardDescription>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama jasa/layanan..."
                    value={servicesSearch}
                    onChange={(e) => setServicesSearch(e.target.value)}
                    className="pl-9 rounded-xl h-10 text-xs bg-background"
                  />
                  {servicesSearch && (
                    <button onClick={() => setServicesSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  Belum ada catatan layanan jasa pada faktur tagihan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="w-[60px] text-center font-bold text-xs uppercase text-muted-foreground">#</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-muted-foreground">Nama Jasa / Layanan</TableHead>
                        <TableHead className="w-[100px] text-center font-bold text-xs uppercase text-muted-foreground">Volume</TableHead>
                        <TableHead className="w-[180px] text-right font-bold text-xs uppercase text-muted-foreground">Total Penjualan Jasa</TableHead>
                        <TableHead className="w-[180px] text-right font-bold text-xs uppercase text-muted-foreground">Modal Langsung</TableHead>
                        <TableHead className="w-[180px] text-right font-bold text-xs uppercase text-muted-foreground">Pendapatan Bersih Jasa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {filteredServices.map((service, i) => (
                        <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-center font-bold text-xs text-muted-foreground">
                            {i + 1}
                          </TableCell>

                          <TableCell className="py-3.5">
                            <span className="font-bold text-xs sm:text-sm block text-foreground">
                              {service.description}
                            </span>
                            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold inline-flex items-center gap-1 mt-0.5">
                              <Wrench className="h-2.5 w-2.5" /> Jasa & Tenaga Kerja
                            </span>
                          </TableCell>

                          <TableCell className="text-center font-black text-xs sm:text-sm text-foreground">
                            {service.totalQuantity} <span className="text-[11px] font-normal text-muted-foreground">titik/sesi</span>
                          </TableCell>

                          <TableCell className="text-right font-semibold text-xs sm:text-sm text-muted-foreground tabular-nums">
                            {formatCurrency(service.totalRevenue)}
                          </TableCell>

                          <TableCell className="text-right font-semibold text-xs sm:text-sm text-foreground tabular-nums">
                            {service.totalCost > 0 ? formatCurrency(service.totalCost) : <span className="text-xs text-muted-foreground italic">Rp 0 (Upah Lapangan)</span>}
                          </TableCell>

                          <TableCell className="text-right font-black text-xs sm:text-sm text-sky-600 dark:text-sky-400 tabular-nums">
                            {formatCurrency(service.totalProfit)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: PROFITABILITAS PER KLIEN */}
        {/* ========================================================================= */}
        <TabsContent value="clients">
          <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-500" />
                    Profitabilitas & Kontribusi per Klien
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Peringkat klien berdasarkan total omzet faktur yang diterbitkan dan laba kotor yang dihasilkan.
                  </CardDescription>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama klien..."
                    value={clientsSearch}
                    onChange={(e) => setClientsSearch(e.target.value)}
                    className="pl-9 rounded-xl h-10 text-xs bg-background"
                  />
                  {clientsSearch && (
                    <button onClick={() => setClientsSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  Belum ada data faktur klien.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="w-[60px] text-center font-bold text-xs uppercase text-muted-foreground">#</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-muted-foreground">Nama Klien</TableHead>
                        <TableHead className="w-[140px] text-center font-bold text-xs uppercase text-muted-foreground">Jumlah Faktur</TableHead>
                        <TableHead className="w-[180px] text-right font-bold text-xs uppercase text-muted-foreground">Total Penjualan</TableHead>
                        <TableHead className="w-[180px] text-right font-bold text-xs uppercase text-muted-foreground">Total Modal (HPP)</TableHead>
                        <TableHead className="w-[180px] text-right font-bold text-xs uppercase text-muted-foreground">Total Laba Kotor</TableHead>
                        <TableHead className="w-[130px] text-center font-bold text-xs uppercase text-muted-foreground">Margin (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {filteredClients.map((client, i) => {
                        const margin = client.totalRevenue > 0 ? (client.totalProfit / client.totalRevenue) * 100 : 0;

                        return (
                          <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="text-center font-bold text-xs text-muted-foreground">
                              {i + 1}
                            </TableCell>

                            <TableCell className="py-3.5">
                              <span className="font-bold text-xs sm:text-sm block text-foreground">
                                {client.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                {client.paidCount} dari {client.invoiceCount} Faktur Lunas
                              </span>
                            </TableCell>

                            <TableCell className="text-center font-black text-xs sm:text-sm text-foreground">
                              {client.invoiceCount} <span className="text-[11px] font-normal text-muted-foreground">Faktur</span>
                            </TableCell>

                            <TableCell className="text-right font-semibold text-xs sm:text-sm text-muted-foreground tabular-nums">
                              {formatCurrency(client.totalRevenue)}
                            </TableCell>

                            <TableCell className="text-right font-semibold text-xs sm:text-sm text-foreground tabular-nums">
                              {formatCurrency(client.totalCost)}
                            </TableCell>

                            <TableCell className="text-right font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatCurrency(client.totalProfit)}
                            </TableCell>

                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={cn(
                                  "text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border",
                                  margin >= 30 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" : "bg-rose-500/10 text-rose-600 border-rose-500/25"
                                )}>
                                  {margin.toFixed(1)}%
                                </span>
                                <Progress value={Math.min(margin, 100)} className="h-1.5 w-14 rounded-full" />
                              </div>
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfitabilityReports;