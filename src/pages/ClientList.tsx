import { useEffect, useState, useMemo, useCallback } from 'react';
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
  Receipt, ArrowUpRight, ChevronRight, PhoneCall
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
import { Badge } from '@/components/ui/badge';

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

  const fetchClientsAndTransactions = useCallback(async (showLoadingSpinner = true) => {
    if (!user) return;
    if (showLoadingSpinner) setLoading(true);

    try {
      // 1. Fetch all quotes and invoices for transaction calculation and auto-harvesting
      const { data: quotesData } = await supabase
        .from('quotes')
        .select(`
          id,
          client_id,
          to_client,
          to_address,
          to_phone,
          status,
          discount_amount,
          tax_amount,
          quote_items(quantity, unit_price)
        `)
        .eq('user_id', user.id);

      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
          id,
          client_id,
          to_client,
          to_address,
          to_phone,
          status,
          due_date,
          discount_amount,
          tax_amount,
          invoice_items(quantity, unit_price)
        `)
        .eq('user_id', user.id);

      // 2. Fetch existing registered clients
      const { data: initialClients } = await supabase
        .from('clients')
        .select('id, name, address, phone, email, notes')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      // 3. Auto-sync: Find any client names from quotes/invoices not yet registered in clients table
      const existingNames = new Set((initialClients || []).map(c => (c.name || '').trim().toLowerCase()));
      const candidatesToInsert = new Map<string, { name: string; address: string; phone: string }>();

      [...(quotesData || []), ...(invoicesData || [])].forEach((doc: any) => {
        const name = (doc.to_client || '').trim();
        const lower = name.toLowerCase();
        if (name && !existingNames.has(lower) && !candidatesToInsert.has(lower)) {
          candidatesToInsert.set(lower, {
            name: name,
            address: doc.to_address || '',
            phone: doc.to_phone || '',
          });
        }
      });

      if (candidatesToInsert.size > 0) {
        const newClientsPayload = Array.from(candidatesToInsert.values()).map(c => ({
          user_id: user.id,
          name: c.name,
          address: c.address,
          phone: c.phone,
        }));

        const { data: inserted } = await supabase
          .from('clients')
          .insert(newClientsPayload)
          .select('id, name');

        if (inserted && inserted.length > 0) {
          for (const newClient of inserted) {
            await supabase
              .from('quotes')
              .update({ client_id: newClient.id })
              .eq('user_id', user.id)
              .ilike('to_client', newClient.name.trim())
              .is('client_id', null);

            await supabase
              .from('invoices')
              .update({ client_id: newClient.id })
              .eq('user_id', user.id)
              .ilike('to_client', newClient.name.trim())
              .is('client_id', null);
          }
        }
      }

      // 4. Fetch final complete clients list
      const { data: finalClients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, address, phone, email, notes')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (clientsError) {
        showError('Gagal memuat daftar klien.');
        console.error(clientsError);
      } else {
        setClients(finalClients || []);
      }

      // 5. Compute real-time financial stats per client
      const financials: Record<string, ClientFinancialSummary> = {};

      (finalClients || []).forEach(c => {
        financials[c.id] = {
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
      });

      (quotesData || []).forEach((q: any) => {
        let matchedClientId = q.client_id;
        if (!matchedClientId && q.to_client) {
          const match = (finalClients || []).find(c => c.name.trim().toLowerCase() === q.to_client.trim().toLowerCase());
          if (match) matchedClientId = match.id;
        }

        if (matchedClientId && financials[matchedClientId]) {
          financials[matchedClientId].quotesCount++;
        }
      });

      (invoicesData || []).forEach((inv: any) => {
        let matchedClientId = inv.client_id;
        if (!matchedClientId && inv.to_client) {
          const match = (finalClients || []).find(c => c.name.trim().toLowerCase() === inv.to_client.trim().toLowerCase());
          if (match) matchedClientId = match.id;
        }

        if (matchedClientId && financials[matchedClientId]) {
          const subtotal = (inv.invoice_items || []).reduce((sum: number, item: any) => 
            sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0);
          const afterDiscount = subtotal - (Number(inv.discount_amount) || 0);
          const totalVal = Math.max(0, afterDiscount + (Number(inv.tax_amount) || 0));

          financials[matchedClientId].invoicesCount++;
          financials[matchedClientId].totalInvoiced += totalVal;

          const s = (inv.status || '').toLowerCase();
          if (s === 'lunas' || s === 'paid') {
            financials[matchedClientId].paidCount++;
            financials[matchedClientId].totalPaid += totalVal;
          } else {
            financials[matchedClientId].totalUnpaid += totalVal;
            const isOverdue = inv.due_date && isDateBeforeToday(inv.due_date);
            if (isOverdue) {
              financials[matchedClientId].overdueCount++;
              financials[matchedClientId].totalOverdue += totalVal;
            } else {
              financials[matchedClientId].pendingCount++;
            }
          }
        }
      });

      setClientFinancials(financials);

    } catch (err) {
      console.error('Error fetching clients & transactions:', err);
      showError('Terjadi kesalahan saat memuat data transaksi klien.');
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClientsAndTransactions(true);
  }, [fetchClientsAndTransactions]);

  // Realtime subscription for live updates in ClientList
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`client_list_realtime_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `user_id=eq.${user.id}` }, () => {
        fetchClientsAndTransactions(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_items' }, () => {
        fetchClientsAndTransactions(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.id}` }, () => {
        fetchClientsAndTransactions(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_items' }, () => {
        fetchClientsAndTransactions(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `user_id=eq.${user.id}` }, () => {
        fetchClientsAndTransactions(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchClientsAndTransactions]);

  const handleOpenForm = (client: Client | null = null) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    fetchClientsAndTransactions();
    setIsFormOpen(false);
    setSelectedClient(null);
  };

  const handleDeleteClient = async (id: string) => {
    const { error } = await supabase.from('clients').delete().match({ id });
    if (error) {
      showError('Gagal menghapus klien.');
      console.error(error);
    } else {
      showSuccess('Klien berhasil dihapus.');
      fetchClientsAndTransactions();
    }
  };

  // Overall KPI statistics
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
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6 px-3 py-3 sm:px-6 lg:px-8 pb-28 sm:pb-8">
      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-7 shadow-xl">
        {/* Ambient Mesh Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Database Klien
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-300">
                {stats.totalCount} Klien
              </span>
            </div>
            
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              Daftar Klien Saya
            </h1>
            
            <p className="text-slate-300/80 text-xs sm:text-sm leading-relaxed max-w-xl font-medium hidden sm:block">
              Pantau histori transaksi tiap klien, status faktur lunas vs tunggakan, hubungi via WhatsApp/Email, dan kelola profil pelanggan.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <Button 
              onClick={fetchClientsAndTransactions} 
              variant="outline" 
              size="sm"
              className="h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-3 text-xs"
              title="Refresh Data Klien"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-indigo-400", loading && "animate-spin")} />
            </Button>

            <CSVImporter 
              type="clients" 
              onSuccess={fetchClientsAndTransactions} 
              triggerButtonText="Impor" 
              className="h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-3 text-xs font-semibold"
            />

            <Button 
              onClick={() => handleOpenForm()} 
              size="sm" 
              className="h-10 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:from-indigo-500 hover:to-violet-500 text-white font-bold shadow-lg shadow-indigo-950/50 border border-indigo-400/20 transition-all active:scale-95 px-4 text-xs grow sm:grow-0"
            >
              <PlusCircle className="mr-1.5 h-4 w-4 stroke-[2.5]" />
              Tambah Klien
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Stat KPI Metric Cards - 2 Columns on Mobile, 4 Columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Klien */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Klien</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 shadow-2xs">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">{stats.totalCount}</h3>
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">kontak</span>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span>Semua partner & klien</span>
          </div>
        </Card>

        {/* Card 2: Total Akumulasi Transaksi */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Omzet</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(stats.totalAllInvoiced)}
            </h3>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{stats.clientsWithPaid} Pernah lunas</span>
          </div>
        </Card>

        {/* Card 3: Klien Menunggak */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Nunggak / Overdue
            </p>
            <div className={cn(
              "flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl shadow-2xs",
              stats.clientsWithOverdue > 0 
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400" 
                : "bg-muted/50 border border-border/60 text-muted-foreground"
            )}>
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {stats.clientsWithOverdue}
            </h3>
            {stats.totalAllOverdue > 0 && (
              <span className="text-[10px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20 truncate max-w-[120px]">
                {formatCurrency(stats.totalAllOverdue)}
              </span>
            )}
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground border-t border-border/60 pt-2 truncate">
            {stats.clientsWithOverdue > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 truncate font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                Perlu ditindaklanjuti
              </span>
            ) : (
              <span className="text-muted-foreground">Tidak ada tagihan lewat tempo</span>
            )}
          </div>
        </Card>

        {/* Card 4: Email Terdaftar */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Kontak</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 shadow-2xs">
              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">{stats.withEmail}</h3>
            <span className="text-[10px] sm:text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-md border border-sky-500/20">
              {stats.totalCount > 0 ? `${Math.round((stats.withEmail / stats.totalCount) * 100)}% Siap` : '0%'}
            </span>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span>Kirim via email</span>
          </div>
        </Card>
      </div>

      {/* Main Container Card */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-3.5 sm:p-6 border-b border-border/70 bg-muted/20 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                placeholder="Cari nama klien, email, HP, atau alamat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pl-10 pr-9 rounded-xl bg-background border-border/80 focus-visible:ring-primary/20 text-xs sm:text-sm font-medium"
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

            {/* Filter Tabs Segmented Control with Smooth Swiping */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap select-none border shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/30 hover:bg-muted text-muted-foreground border-border/70"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                      isActive ? "bg-white/20 text-white" : (tab.badgeColor || "bg-muted text-muted-foreground")
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
            <div className="p-4 sm:p-8 space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 border border-border/60 shadow-xs">
                <Users className="h-7 w-7 text-muted-foreground/80" />
              </div>
              <h3 className="text-base font-bold text-foreground">Tidak ada klien ditemukan</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                {clients.length === 0 
                  ? 'Belum ada data klien yang disimpan. Daftarkan klien pertama Anda.' 
                  : 'Tidak ada klien yang cocok dengan filter atau pencarian.'
                }
              </p>
              {clients.length === 0 ? (
                <Button onClick={() => handleOpenForm()} className="mt-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs" size="sm">
                  <PlusCircle className="mr-1.5 h-4 w-4" />
                  Tambah Klien Pertama
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchTerm(''); setFilterType('all'); }} 
                  className="mt-3 rounded-xl text-xs font-semibold"
                  size="sm"
                >
                  Reset Pencarian
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* 1. MOBILE RESPONSIVE CARDS VIEW (block on mobile, hidden on desktop) */}
              {/* ========================================================================= */}
              <div className="block md:hidden divide-y divide-border/60">
                {filteredClients.map((client) => {
                  const clientName = capitalizeName(client.name);
                  const cleanPhone = formatCleanPhone(client.phone);
                  const fin = clientFinancials[client.id] || {
                    totalInvoiced: 0, totalPaid: 0, totalOverdue: 0, totalUnpaid: 0,
                    paidCount: 0, overdueCount: 0, pendingCount: 0, invoicesCount: 0, quotesCount: 0,
                  };

                  return (
                    <div key={client.id} className="p-3.5 space-y-2.5 hover:bg-muted/20 transition-colors">
                      {/* Top Row: Avatar + Name + Invoiced & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/client/${client.id}`} className="flex items-center gap-2.5 min-w-0 grow">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-black text-sm shrink-0 border border-indigo-500/30">
                            {clientName.substring(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-foreground truncate">
                              {clientName}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                              <span>{fin.invoicesCount} Faktur</span>
                              <span>•</span>
                              <span>{fin.quotesCount} Penawaran</span>
                            </div>
                          </div>
                        </Link>

                        {/* Status Badge */}
                        <div className="shrink-0 text-right">
                          {fin.overdueCount > 0 ? (
                            <Badge variant="destructive" className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-500 border-rose-500/30">
                              Nunggak {formatCurrency(fin.totalOverdue)}
                            </Badge>
                          ) : fin.paidCount > 0 ? (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                              Lunas ({fin.paidCount})
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              {fin.totalInvoiced > 0 ? formatCurrency(fin.totalInvoiced) : 'Belum Transaksi'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle Row: Contact & Address */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2 pt-0.5">
                        <div className="flex items-center gap-2 truncate max-w-full">
                          {client.phone ? (
                            <span className="font-semibold text-foreground text-[11px]">{client.phone}</span>
                          ) : client.email ? (
                            <span className="text-[11px] truncate text-sky-400">{client.email}</span>
                          ) : (
                            <span className="text-[11px] italic text-muted-foreground/60">Tidak ada kontak</span>
                          )}
                        </div>

                        <div className="font-black text-xs text-primary tabular-nums">
                          Total: {formatCurrency(fin.totalInvoiced)}
                        </div>
                      </div>

                      {/* Bottom Action Bar */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 px-2.5 items-center gap-1 text-[11px] font-bold rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 active:scale-95"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>WA</span>
                            </a>
                          )}

                          {cleanPhone && (
                            <a
                              href={`tel:${cleanPhone}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground active:scale-95"
                              title="Telepon Langsung"
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                            </a>
                          )}

                          {client.email && (
                            <a
                              href={`mailto:${client.email}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 hover:bg-muted text-sky-400 active:scale-95"
                              title="Kirim Email"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenForm(client)}
                            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>

                          <Button
                            asChild
                            variant="default"
                            size="sm"
                            className="h-8 px-3 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs"
                          >
                            <Link to={`/client/${client.id}`}>
                              Detail <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ========================================================================= */}
              {/* 2. DESKTOP FULL TABLE VIEW (hidden on mobile, block on desktop) */}
              {/* ========================================================================= */}
              <div className="hidden md:block overflow-x-auto">
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
                        totalInvoiced: 0, totalPaid: 0, totalOverdue: 0, totalUnpaid: 0,
                        paidCount: 0, overdueCount: 0, pendingCount: 0, invoicesCount: 0, quotesCount: 0,
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
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
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
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold shadow-2xs">
                                  <AlertTriangle className="h-3 w-3 text-rose-500 animate-pulse" />
                                  {fin.overdueCount} Nunggak ({formatCurrency(fin.totalOverdue)})
                                </span>
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
              </div>

              {/* Table Bottom Footer Summary */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-t border-border/70 bg-muted/15 text-xs text-muted-foreground font-medium">
                <div>
                  Menampilkan <span className="font-bold text-foreground">{filteredClients.length}</span> dari <span className="font-bold text-foreground">{clients.length}</span> total klien
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {stats.clientsWithPaid} Lunas</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> {stats.clientsWithOverdue} Nunggak</span>
                </div>
              </div>
            </>
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