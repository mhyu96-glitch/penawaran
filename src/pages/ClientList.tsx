import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PlusCircle, Pencil, Trash2, Users, Search, 
  Mail, Phone, MapPin, RefreshCw, X, MessageSquare, 
  Eye, CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Receipt, ArrowUpRight
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import ClientForm from '@/components/ClientForm';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import CSVImporter from '@/components/CSVImporter';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatCurrency, isDateBeforeToday } from '@/lib/utils';

export type Client = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type ClientFinancialSummary = {
  totalInvoiced: number;
  totalPaid: number;
  totalOverdue: number;
  totalUnpaid: number;
  paidCount: number;
  overdueCount: number;
  pendingCount: number;
  invoicesCount: number;
  quotesCount: number;
};

const ClientList = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientFinancials, setClientFinancials] = useState<Record<string, ClientFinancialSummary>>({});
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'has_overdue' | 'has_paid' | 'has_pending' | 'has_email'>('all');

  const fetchClientsAndTransactions = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch Clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, address, phone, email, notes')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (clientsError) throw clientsError;

      const loadedClients = (clientsData as Client[]) || [];
      setClients(loadedClients);

      // 2. Fetch all invoices with items
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
          id,
          client_id,
          to_client,
          status,
          due_date,
          discount_amount,
          tax_amount,
          invoice_items(quantity, unit_price)
        `)
        .eq('user_id', user.id);

      // 3. Fetch all quotes with items
      const { data: quotesData } = await supabase
        .from('quotes')
        .select(`
          id,
          client_id,
          to_client,
          status,
          discount_amount,
          tax_amount,
          quote_items(quantity, unit_price)
        `)
        .eq('user_id', user.id);

      // 4. Map transactions per client
      const financialMap: Record<string, ClientFinancialSummary> = {};

      const calculateInvTotal = (inv: any) => {
        const subtotal = inv.invoice_items?.reduce((sum: number, item: any) => 
          sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
        const afterDiscount = subtotal - (Number(inv.discount_amount) || 0);
        return afterDiscount + (Number(inv.tax_amount) || 0);
      };

      loadedClients.forEach(c => {
        const cNameLower = (c.name || '').trim().toLowerCase();

        // Invoices for this client
        const clientInvoices = (invoicesData || []).filter(inv => 
          inv.client_id === c.id || ((inv.to_client || '').trim().toLowerCase() === cNameLower)
        );

        // Quotes for this client
        const clientQuotes = (quotesData || []).filter(q => 
          q.client_id === c.id || ((q.to_client || '').trim().toLowerCase() === cNameLower)
        );

        let totalInvoiced = 0;
        let totalPaid = 0;
        let totalOverdue = 0;
        let totalUnpaid = 0;
        let paidCount = 0;
        let overdueCount = 0;
        let pendingCount = 0;

        clientInvoices.forEach(inv => {
          const val = calculateInvTotal(inv);
          totalInvoiced += val;
          const s = (inv.status || '').toLowerCase();

          if (s === 'lunas') {
            totalPaid += val;
            paidCount++;
          } else {
            const isOverdue = inv.due_date && isDateBeforeToday(inv.due_date);
            if (isOverdue) {
              totalOverdue += val;
              overdueCount++;
            } else {
              totalUnpaid += val;
              pendingCount++;
            }
          }
        });

        financialMap[c.id] = {
          totalInvoiced,
          totalPaid,
          totalOverdue,
          totalUnpaid,
          paidCount,
          overdueCount,
          pendingCount,
          invoicesCount: clientInvoices.length,
          quotesCount: clientQuotes.length,
        };
      });

      setClientFinancials(financialMap);

    } catch (error: any) {
      console.error('Error fetching clients and transactions:', error);
      showError('Gagal memuat data klien & transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndTransactions();
  }, [user]);

  const handleDeleteClient = async (clientId: string) => {
    const { error } = await supabase.from('clients').delete().match({ id: clientId });

    if (error) {
      showError('Gagal menghapus klien.');
    } else {
      showSuccess('Klien berhasil dihapus.');
      setClients(clients.filter(c => c.id !== clientId));
    }
  };

  const handleOpenForm = (client: Client | null = null) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    setIsFormOpen(false);
    fetchClientsAndTransactions();
  };

  // KPI Statistics
  const stats = useMemo(() => {
    const totalCount = clients.length;
    let clientsWithOverdue = 0;
    let clientsWithPaid = 0;
    let totalAllInvoiced = 0;
    let totalAllOverdue = 0;

    clients.forEach(c => {
      const fin = clientFinancials[c.id];
      if (fin) {
        totalAllInvoiced += fin.totalInvoiced;
        totalAllOverdue += fin.totalOverdue;
        if (fin.overdueCount > 0) clientsWithOverdue++;
        if (fin.paidCount > 0) clientsWithPaid++;
      }
    });

    const withEmail = clients.filter(c => Boolean(c.email && c.email.trim())).length;

    return { 
      totalCount, 
      clientsWithOverdue, 
      clientsWithPaid, 
      totalAllInvoiced, 
      totalAllOverdue,
      withEmail 
    };
  }, [clients, clientFinancials]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        client.name.toLowerCase().includes(search) ||
        (client.email && client.email.toLowerCase().includes(search)) ||
        (client.phone && client.phone.toLowerCase().includes(search)) ||
        (client.address && client.address.toLowerCase().includes(search));

      const fin = clientFinancials[client.id];

      let matchesFilter = true;
      if (filterType === 'has_overdue') matchesFilter = Boolean(fin && fin.overdueCount > 0);
      else if (filterType === 'has_paid') matchesFilter = Boolean(fin && fin.paidCount > 0);
      else if (filterType === 'has_pending') matchesFilter = Boolean(fin && fin.pendingCount > 0);
      else if (filterType === 'has_email') matchesFilter = Boolean(client.email && client.email.trim());

      return matchesSearch && matchesFilter;
    });
  }, [clients, clientFinancials, searchTerm, filterType]);

  const capitalizeName = (str: string) => {
    if (!str) return 'Klien Tanpa Nama';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const formatCleanPhone = (phoneStr: string | null) => {
    if (!phoneStr) return null;
    return phoneStr.replace(/[^0-9+]/g, '');
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl">
        {/* Ambient Mesh Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Database Klien & Histori Transaksi
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                {stats.totalCount} Klien Terdaftar
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Daftar Klien Saya
            </h1>
            
            <p className="text-slate-300/90 text-sm leading-relaxed max-w-xl">
              Pantau histori transaksi tiap klien, status faktur lunas vs tunggakan, hubungi via WhatsApp/Email, dan kelola profil pelanggan.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <Button 
              onClick={fetchClientsAndTransactions} 
              variant="outline" 
              size="lg"
              className="h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95"
              title="Refresh Data Klien"
            >
              <RefreshCw className={cn("h-4 w-4 text-indigo-400", loading && "animate-spin")} />
            </Button>

            <CSVImporter 
              type="clients" 
              onSuccess={fetchClientsAndTransactions} 
              triggerButtonText="Impor CSV" 
              className="h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-4"
            />

            <Button 
              onClick={() => handleOpenForm()} 
              size="lg" 
              className="h-11 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:from-indigo-500 hover:to-violet-500 text-white font-bold shadow-lg shadow-indigo-950/50 hover:shadow-indigo-900/60 border border-indigo-400/20 transition-all active:scale-95 px-5"
            >
              <PlusCircle className="mr-2 h-4 w-4 stroke-[2.5]" />
              Tambah Klien Baru
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Stat KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Klien */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Klien</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 group-hover:scale-105 transition-transform shadow-2xs">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-3xl font-extrabold tracking-tight text-foreground">{stats.totalCount}</h3>
            <span className="text-xs font-semibold text-muted-foreground">kontak bisnis</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span>Semua partner & customer</span>
          </div>
        </Card>

        {/* Card 2: Total Akumulasi Transaksi */}
        <Card className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Transaksi Klien</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shadow-2xs">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              {formatCurrency(stats.totalAllInvoiced)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700/80 dark:text-emerald-300 font-medium border-t border-emerald-500/20 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{stats.clientsWithPaid} Klien pernah bayar lunas</span>
          </div>
        </Card>

        {/* Card 3: Klien Menunggak */}
        <Card className={cn(
          "relative overflow-hidden rounded-2xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group",
          stats.clientsWithOverdue > 0 
            ? "border-rose-500/40 bg-rose-500/5" 
            : "border-border/80 bg-card"
        )}>
          <div className="flex items-center justify-between">
            <p className={cn(
              "text-xs font-bold uppercase tracking-wider",
              stats.clientsWithOverdue > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
            )}>
              Klien Nunggak
            </p>
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl shadow-2xs",
              stats.clientsWithOverdue > 0 
                ? "bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse" 
                : "bg-muted text-muted-foreground"
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className={cn(
              "text-3xl font-extrabold tracking-tight",
              stats.clientsWithOverdue > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
            )}>
              {stats.clientsWithOverdue}
            </h3>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
              {formatCurrency(stats.totalAllOverdue)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold border-t border-border/60 pt-2.5">
            {stats.clientsWithOverdue > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                Perlu ditindaklanjuti penagihan
              </span>
            ) : (
              <span className="text-muted-foreground">Tidak ada tagihan jatuh tempo</span>
            )}
          </div>
        </Card>

        {/* Card 4: Email Terdaftar */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Terhubung</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform shadow-2xs">
              <Mail className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-3xl font-extrabold tracking-tight text-foreground">{stats.withEmail}</h3>
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
              {stats.totalCount > 0 ? `${Math.round((stats.withEmail / stats.totalCount) * 100)}% Siap Kirim` : '0%'}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span>Kirim penawaran via email</span>
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                placeholder="Cari nama klien, email, nomor HP, atau alamat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pl-10 pr-9 rounded-xl bg-background border-border/80 focus-visible:ring-primary/20 text-xs sm:text-sm"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs Segmented Control */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 self-start md:self-auto overflow-x-auto max-w-full">
              {[
                { key: 'all', label: 'Semua', count: stats.totalCount },
                { key: 'has_overdue', label: 'Nunggak / Overdue', count: stats.clientsWithOverdue, badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
                { key: 'has_paid', label: 'Pernah Lunas', count: stats.clientsWithPaid, badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
                { key: 'has_email', label: 'Ada Email', count: stats.withEmail, badgeColor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
              ].map(tab => {
                const isActive = filterType === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilterType(tab.key as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap select-none",
                      isActive
                        ? "bg-background text-foreground shadow-xs border border-border/70"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
                      isActive ? "bg-primary/10 text-primary" : (tab.badgeColor || "bg-muted text-muted-foreground")
                    )}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 border border-border/60 shadow-xs">
                <Users className="h-7 w-7 text-muted-foreground/80" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Tidak ada klien ditemukan</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                {clients.length === 0 
                  ? 'Belum ada data klien yang disimpan. Daftarkan klien pertama Anda atau impor melalui file CSV.' 
                  : 'Tidak ada klien yang cocok dengan kata kunci pencarian atau filter yang dipilih.'
                }
              </p>
              {clients.length === 0 ? (
                <Button onClick={() => handleOpenForm()} className="mt-5 rounded-xl bg-primary text-primary-foreground font-semibold px-5" size="lg">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Tambah Klien Pertama
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchTerm(''); setFilterType('all'); }} 
                  className="mt-4 rounded-xl text-xs font-semibold"
                >
                  Reset Filter & Pencarian
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="w-[280px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nama Klien / Perusahaan</TableHead>
                    <TableHead className="w-[200px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Kontak Langsung</TableHead>
                    <TableHead className="w-[180px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Total Transaksi</TableHead>
                    <TableHead className="w-[240px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left pl-6">Status Faktur / Pembayaran</TableHead>
                    <TableHead className="w-[130px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/60">
                  {filteredClients.map((client) => {
                    const clientName = capitalizeName(client.name);
                    const cleanPhone = formatCleanPhone(client.phone);
                    const fin = clientFinancials[client.id] || {
                      totalInvoiced: 0,
                      totalPaid: 0,
                      totalOverdue: 0,
                      totalUnpaid: 0,
                      paidCount: 0,
                      overdueCount: 0,
                      pendingCount: 0,
                      invoicesCount: 0,
                      quotesCount: 0,
                    };

                    return (
                      <TableRow key={client.id} className="hover:bg-muted/30 transition-colors group">
                        {/* Nama Klien & Avatar */}
                        <TableCell className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-sm shrink-0 border border-indigo-500/30 shadow-2xs">
                              {clientName.substring(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <Link 
                                to={`/client/${client.id}`}
                                className="font-bold text-sm text-foreground hover:text-primary transition-colors block truncate max-w-xs"
                              >
                                {clientName}
                              </Link>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span>{fin.invoicesCount} Faktur</span>
                                <span>•</span>
                                <span>{fin.quotesCount} Penawaran</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Kontak Langsung (Email & WA) */}
                        <TableCell className="px-5 py-4">
                          <div className="space-y-1">
                            {client.email ? (
                              <a 
                                href={`mailto:${client.email}`} 
                                className="inline-flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium truncate max-w-[180px] block"
                              >
                                <Mail className="h-3 w-3 shrink-0 opacity-70" />
                                <span className="truncate">{client.email}</span>
                              </a>
                            ) : null}

                            {client.phone ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-foreground whitespace-nowrap">
                                  {client.phone}
                                </span>
                                {cleanPhone && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={`https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                                      >
                                        <MessageSquare className="h-2.5 w-2.5" />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      Chat via WhatsApp
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            ) : null}

                            {!client.email && !client.phone && (
                              <span className="text-muted-foreground/50 text-xs">Belum ada kontak</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Total Transaksi */}
                        <TableCell className="px-5 py-4 text-right">
                          <span className="font-black text-sm text-foreground whitespace-nowrap tabular-nums">
                            {formatCurrency(fin.totalInvoiced)}
                          </span>
                        </TableCell>

                        {/* Status Faktur / Pembayaran */}
                        <TableCell className="px-5 py-4 pl-6">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {fin.overdueCount > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold shadow-2xs">
                                    <AlertTriangle className="h-3 w-3 text-rose-500 animate-pulse" />
                                    {fin.overdueCount} Nunggak ({formatCurrency(fin.totalOverdue)})
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  Tagihan sudah melewati tanggal jatuh tempo
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {fin.paidCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                                <CheckCircle2 className="h-3 w-3" />
                                {fin.paidCount} Lunas
                              </span>
                            )}

                            {fin.pendingCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-xs font-bold">
                                <Clock className="h-3 w-3" />
                                {fin.pendingCount} Pending
                              </span>
                            )}

                            {fin.invoicesCount === 0 && (
                              <span className="text-xs text-muted-foreground/60">Belum ada faktur</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Aksi Group */}
                        <TableCell className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Lihat Detail 360 */}
                            <Button 
                              asChild 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" 
                              title="Lihat Detail Transaksi Klien"
                            >
                              <Link to={`/client/${client.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>

                            {/* Edit Klien */}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenForm(client)}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                              title="Edit Data Klien"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            {/* Hapus Klien */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors" 
                                  title="Hapus Klien"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl border border-border/80 shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-lg font-bold">Hapus Klien?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-sm text-muted-foreground">
                                    Tindakan ini tidak dapat dibatalkan. Klien <span className="font-bold text-foreground">{clientName}</span> akan dihapus permanen dari daftar kontak Anda.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                  <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteClient(client.id)} 
                                    className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
                                  >
                                    Ya, Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Table Bottom Footer Summary */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-border/70 bg-muted/15 text-xs text-muted-foreground font-medium">
                <div>
                  Menampilkan <span className="font-bold text-foreground">{filteredClients.length}</span> dari <span className="font-bold text-foreground">{clients.length}</span> total klien
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {stats.clientsWithPaid} Klien Lunas</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> {stats.clientsWithOverdue} Klien Nunggak</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Form Tambah/Edit Klien */}
      <ClientForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        client={selectedClient}
        onSave={handleFormSave}
      />
    </div>
  );
};

export default ClientList;