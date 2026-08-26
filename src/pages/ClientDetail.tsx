import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Mail, Phone, MapPin, UserCircle, DollarSign, Save, Share2, 
  Receipt, FileText, CheckCircle2, Clock, AlertTriangle, TrendingUp, 
  ExternalLink, PlusCircle, MessageSquare, Eye, Pencil, RefreshCw,
  CreditCard, Calendar, ArrowUpRight
} from 'lucide-react';
import { Client } from './ClientList';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { showError, showSuccess } from '@/utils/toast';
import { formatCurrency, safeFormat, getStatusVariant, cn, isDateBeforeToday } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type QuoteItem = {
  quantity: number;
  unit_price: number;
};

type Quote = {
  id: string;
  quote_number: string;
  created_at: string;
  status: string;
  discount_amount?: number;
  tax_amount?: number;
  quote_items?: QuoteItem[];
};

type InvoiceItem = {
  quantity: number;
  unit_price: number;
};

type Invoice = {
  id: string;
  invoice_number: string;
  created_at: string;
  due_date: string;
  status: string;
  discount_amount?: number;
  tax_amount?: number;
  down_payment_amount?: number;
  invoice_items?: InvoiceItem[];
};

type Payment = {
  id: string;
  invoice_id: string;
  amount_paid?: number;
  amount?: number;
  payment_date: string;
  payment_method: string;
  status: string;
  notes: string;
};

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [client, setClient] = useState<(Client & { access_key?: string }) | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotes' | 'payments' | 'notes'>('invoices');

  const fetchClientFullDetails = useCallback(async (showLoadingSpinner = true) => {
    if (!id || !user) return;
    if (showLoadingSpinner) setLoading(true);

    try {
      // 1. Fetch Client Profile
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (clientError || !clientData) {
        console.error('Error fetching client:', clientError);
        setLoading(false);
        return;
      }

      setClient(clientData);
      setNotes(clientData.notes || '');

      const clientName = clientData.name;

      // 2. Fetch Quotes (match by client_id or to_client name)
      const { data: quotesData } = await supabase
        .from('quotes')
        .select(`
          id, 
          quote_number, 
          created_at, 
          status, 
          discount_amount, 
          tax_amount, 
          quote_items(quantity, unit_price)
        `)
        .eq('user_id', user.id)
        .or(`client_id.eq.${id},to_client.ilike.${clientName}`)
        .order('created_at', { ascending: false });

      setQuotes((quotesData as Quote[]) || []);

      // 3. Fetch Invoices (match by client_id or to_client name)
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
          id, 
          invoice_number, 
          created_at, 
          due_date, 
          status, 
          discount_amount, 
          tax_amount, 
          down_payment_amount, 
          invoice_items(quantity, unit_price)
        `)
        .eq('user_id', user.id)
        .or(`client_id.eq.${id},to_client.ilike.${clientName}`)
        .order('created_at', { ascending: false });

      const fetchedInvoices = (invoicesData as Invoice[]) || [];
      setInvoices(fetchedInvoices);

      // 4. Fetch Payments related to invoices
      if (fetchedInvoices.length > 0) {
        const invIds = fetchedInvoices.map(inv => inv.id);
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .in('invoice_id', invIds)
          .order('payment_date', { ascending: false });

        setPayments((paymentsData as Payment[]) || []);
      } else {
        setPayments([]);
      }
    } catch (err) {
      console.error('Error fetching full client details:', err);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchClientFullDetails(true);
  }, [fetchClientFullDetails]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!user || !id) return;

    const channel = supabase
      .channel(`client_detail_realtime_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        fetchClientFullDetails(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_items' }, () => {
        fetchClientFullDetails(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchClientFullDetails(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_items' }, () => {
        fetchClientFullDetails(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchClientFullDetails(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, fetchClientFullDetails]);

  const calculateQuoteTotal = (quote: Quote): number => {
    const subtotal = quote.quote_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(quote.discount_amount) || 0);
    return afterDiscount + (Number(quote.tax_amount) || 0);
  };

  const calculateInvoiceTotal = (invoice: Invoice): number => {
    const subtotal = invoice.invoice_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(invoice.discount_amount) || 0);
    return afterDiscount + (Number(invoice.tax_amount) || 0);
  };

  // 360 Financial Metrics Calculation
  const financials = useMemo(() => {
    let totalInvoicedValue = 0;
    let totalPaidValue = 0;
    let totalUnpaidValue = 0;
    let totalOverdueValue = 0;

    let countPaid = 0;
    let countUnpaid = 0;
    let countOverdue = 0;

    invoices.forEach(inv => {
      const val = calculateInvoiceTotal(inv);
      totalInvoicedValue += val;
      const s = (inv.status || '').toLowerCase();

      if (s === 'lunas') {
        totalPaidValue += val;
        countPaid++;
      } else if (s === 'terkirim' || s === 'draf') {
        const isOverdue = inv.due_date && isDateBeforeToday(inv.due_date);
        if (isOverdue) {
          totalOverdueValue += val;
          countOverdue++;
        } else {
          totalUnpaidValue += val;
          countUnpaid++;
        }
      }
    });

    // If payments recorded separately, check total paid
    const directPaymentsSum = payments.reduce((sum, p) => 
      sum + (Number(p.amount_paid || p.amount) || 0), 0
    );
    const finalPaid = Math.max(totalPaidValue, directPaymentsSum);

    const totalQuotesValue = quotes.reduce((sum, q) => sum + calculateQuoteTotal(q), 0);

    return {
      totalInvoicedValue,
      totalPaidValue: finalPaid,
      totalUnpaidValue,
      totalOverdueValue,
      countPaid,
      countUnpaid,
      countOverdue,
      totalQuotesCount: quotes.length,
      totalInvoicesCount: invoices.length,
      totalQuotesValue,
    };
  }, [invoices, quotes, payments]);

  const handleSaveNotes = async () => {
    if (!id) return;
    setIsSavingNotes(true);
    const { error } = await supabase.from('clients').update({ notes }).eq('id', id);
    if (error) {
      showError('Gagal menyimpan catatan.');
    } else {
      showSuccess('Catatan klien berhasil diperbarui.');
    }
    setIsSavingNotes(false);
  };

  const handleCopyPortalLink = () => {
    if (!client) return;
    const link = `${window.location.origin}/portal/${client.access_key || client.id}`;
    navigator.clipboard.writeText(link);
    showSuccess('Tautan portal klien telah disalin!');
  };

  const cleanPhone = client?.phone ? client.phone.replace(/[^0-9+]/g, '') : null;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto w-full max-w-2xl py-20 text-center space-y-4">
        <h2 className="text-xl font-bold">Klien Tidak Ditemukan</h2>
        <p className="text-muted-foreground text-sm">Data klien mungkin telah dihapus atau tidak tersedia.</p>
        <Button asChild variant="outline">
          <Link to="/clients"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Klien</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* Top Bar Navigation & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs font-semibold hover:bg-muted">
          <Link to="/clients">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Klien
          </Link>
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={fetchClientFullDetails} 
            variant="outline" 
            size="sm" 
            className="rounded-xl text-xs font-semibold"
            title="Refresh Data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          <Button onClick={handleCopyPortalLink} variant="outline" size="sm" className="rounded-xl text-xs font-semibold">
            <Share2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Salin Tautan Portal
          </Button>

          <Button asChild variant="outline" size="sm" className="rounded-xl text-xs font-bold border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10">
            <Link to={`/reports/partner-statement/${client.id}`}>
              <Building2 className="mr-1.5 h-3.5 w-3.5 text-violet-500" /> Rekap Tagihan (Statement)
            </Link>
          </Button>

          <Button asChild size="sm" className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-sm">
            <Link to="/quote/new">
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Buat Penawaran
            </Link>
          </Button>

          <Button asChild size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm">
            <Link to="/invoice/new">
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Buat Faktur
            </Link>
          </Button>
        </div>
      </div>

      {/* Executive Client Profile Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl">
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 -bottom-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-500/30 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-black text-2xl sm:text-3xl shrink-0 shadow-lg shadow-indigo-950/50">
              {client.name.substring(0, 1).toUpperCase()}
            </div>
            
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-0.5 text-xs font-semibold text-indigo-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Profil Klien Bisnis
                </span>
                {financials.countOverdue > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                    <AlertTriangle className="h-3 w-3 text-rose-400" /> {financials.countOverdue} Tagihan Nunggak
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white truncate">
                {client.name}
              </h1>

              {/* Quick Contact Chips */}
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-300">
                {client.email && (
                  <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors hover:underline">
                    <Mail className="h-3.5 w-3.5 text-sky-400" />
                    <span>{client.email}</span>
                  </a>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-300">
                      <Phone className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{client.phone}</span>
                    </span>
                    {cleanPhone && (
                      <a 
                        href={`https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" /> WhatsApp
                      </a>
                    )}
                  </div>
                )}
                {client.address && (
                  <span className="inline-flex items-center gap-1.5 text-slate-300/80">
                    <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="truncate max-w-xs">{client.address}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 360° Financial & Invoice Health KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Nilai Transaksi */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Nilai Tagihan</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-foreground truncate">
              {formatCurrency(financials.totalInvoicedValue)}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span>{financials.totalInvoicesCount} Total Faktur</span>
            <span>{financials.totalQuotesCount} Penawaran</span>
          </div>
        </Card>

        {/* Card 2: Sudah Terbayar (LUNAS) */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sudah Lunas</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-foreground truncate">
              {formatCurrency(financials.totalPaidValue)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{financials.countPaid} Faktur Terbayar Lunas</span>
          </div>
        </Card>

        {/* Card 3: Tagihan Berjalan (PENDING) */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending / Berjalan</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 shadow-2xs">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-foreground truncate">
              {formatCurrency(financials.totalUnpaidValue)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span>{financials.countUnpaid} Menunggu Pembayaran</span>
          </div>
        </Card>

        {/* Card 4: Tagihan NUNGGAK (OVERDUE) */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Tunggakan (Jatuh Tempo)
            </p>
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl shadow-2xs",
              financials.totalOverdueValue > 0 
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400" 
                : "bg-muted/50 border border-border/60 text-muted-foreground"
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-foreground truncate">
              {formatCurrency(financials.totalOverdueValue)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground border-t border-border/60 pt-2.5">
            {financials.totalOverdueValue > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                {financials.countOverdue} Faktur Lewat Jatuh Tempo
              </span>
            ) : (
              <span className="text-muted-foreground">Tidak ada tagihan tertunggak</span>
            )}
          </div>
        </Card>
      </div>

      {/* Main Tabbed Transactions & History Container */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        {/* Navigation Tabs Header */}
        <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 overflow-x-auto max-w-full">
              {[
                { key: 'invoices', label: 'Riwayat Faktur', count: invoices.length, icon: Receipt },
                { key: 'quotes', label: 'Penawaran Harga', count: quotes.length, icon: FileText },
                { key: 'payments', label: 'Catatan Pembayaran', count: payments.length, icon: CreditCard },
                { key: 'notes', label: 'Catatan Klien', icon: Pencil },
              ].map(tab => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap select-none",
                      isActive
                        ? "bg-background text-foreground shadow-xs border border-border/70"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
                        isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-muted-foreground font-medium self-end sm:self-auto">
              Total Interaksi: <strong className="text-foreground">{invoices.length + quotes.length} Dokumen</strong>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* TAB 1: DAFTAR FAKTUR */}
          {activeTab === 'invoices' && (
            invoices.length === 0 ? (
              <div className="text-center py-20 px-4 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto border border-border/60">
                  <Receipt className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-bold text-foreground">Belum ada faktur untuk klien ini</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Buat tagihan resmi untuk mencatat transaksi dan memantau status pelunasan klien.
                </p>
                <Button asChild className="rounded-xl mt-2" size="sm">
                  <Link to="/invoice/new">
                    <PlusCircle className="mr-1.5 h-4 w-4" /> Buat Faktur Sekarang
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nomor Faktur</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Tanggal Buat</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Jatuh Tempo</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Nilai Tagihan</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Status Pembayaran</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {invoices.map(inv => {
                      const totalVal = calculateInvoiceTotal(inv);
                      const s = (inv.status || 'draf').toLowerCase();
                      const isOverdue = s !== 'lunas' && inv.due_date && isDateBeforeToday(inv.due_date);

                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="px-5 py-4">
                            <Link 
                              to={`/invoice/${inv.id}`}
                              className="inline-flex items-center gap-1.5 font-mono font-bold text-xs text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/20 transition-all hover:scale-105"
                            >
                              <span>{inv.invoice_number || 'N/A'}</span>
                            </Link>
                          </TableCell>

                          <TableCell className="px-5 py-4 text-xs text-muted-foreground font-medium whitespace-nowrap">
                            {safeFormat(inv.created_at, 'd MMM yyyy')}
                          </TableCell>

                          <TableCell className="px-5 py-4 whitespace-nowrap">
                            <div className={cn(
                              "inline-flex items-center gap-1 text-xs font-medium",
                              isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground"
                            )}>
                              {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 animate-pulse" />}
                              <span>{safeFormat(inv.due_date, 'd MMM yyyy')}</span>
                            </div>
                          </TableCell>

                          <TableCell className="px-5 py-4 text-right font-black text-sm text-foreground whitespace-nowrap tabular-nums">
                            {formatCurrency(totalVal)}
                          </TableCell>

                          <TableCell className="px-5 py-4 text-center">
                            {s === 'lunas' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Lunas Terbayar
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                                Nunggak (Jatuh Tempo)
                              </span>
                            ) : s === 'terkirim' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-600 dark:text-sky-400 border border-sky-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                                Belum Lunas (Terkirim)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Draf Tagihan
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Lihat Faktur">
                                <Link to={`/invoice/${inv.id}`}>
                                  <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </Link>
                              </Button>
                              <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Edit Faktur">
                                <Link to={`/invoice/edit/${inv.id}`}>
                                  <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          )}

          {/* TAB 2: DAFTAR PENAWARAN */}
          {activeTab === 'quotes' && (
            quotes.length === 0 ? (
              <div className="text-center py-20 px-4 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto border border-border/60">
                  <FileText className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-bold text-foreground">Belum ada penawaran harga</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Kirim penawaran estimasi biaya proyek baru untuk klien ini.
                </p>
                <Button asChild className="rounded-xl mt-2" size="sm">
                  <Link to="/quote/new">
                    <PlusCircle className="mr-1.5 h-4 w-4" /> Buat Penawaran
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nomor Penawaran</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Tanggal Dibuat</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Nilai Penawaran</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {quotes.map(q => {
                      const totalVal = calculateQuoteTotal(q);
                      return (
                        <TableRow key={q.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="px-5 py-4">
                            <Link 
                              to={`/quote/${q.id}`}
                              className="inline-flex items-center gap-1.5 font-mono font-bold text-xs text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 px-2.5 py-1 rounded-lg border border-teal-500/20 transition-all hover:scale-105"
                            >
                              <span>{q.quote_number || 'N/A'}</span>
                            </Link>
                          </TableCell>

                          <TableCell className="px-5 py-4 text-xs text-muted-foreground font-medium whitespace-nowrap">
                            {safeFormat(q.created_at, 'd MMM yyyy')}
                          </TableCell>

                          <TableCell className="px-5 py-4 text-right font-black text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                            {formatCurrency(totalVal)}
                          </TableCell>

                          <TableCell className="px-5 py-4 text-center">
                            <Badge variant={getStatusVariant(q.status)} className="font-bold px-2.5 py-0.5">
                              {q.status || 'Draf'}
                            </Badge>
                          </TableCell>

                          <TableCell className="px-5 py-4 text-right">
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Lihat Penawaran">
                              <Link to={`/quote/${q.id}`}>
                                <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          )}

          {/* TAB 3: RIWAYAT PEMBAYARAN */}
          {activeTab === 'payments' && (
            payments.length === 0 ? (
              <div className="text-center py-20 px-4 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto border border-border/60">
                  <CreditCard className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-bold text-foreground">Belum ada riwayat pembayaran tercatat</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Pembayaran akan otomatis muncul di sini saat Anda menandai faktur sebagai lunas atau mencatat pembayaran invoice.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Tanggal Bayar</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Metode Pembayaran</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Catatan</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Jumlah Dibayar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {payments.map(p => (
                      <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="px-5 py-4 text-xs font-medium text-foreground whitespace-nowrap">
                          {safeFormat(p.payment_date, 'd MMM yyyy • HH:mm')}
                        </TableCell>

                        <TableCell className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                            <CreditCard className="h-3.5 w-3.5" />
                            {p.payment_method || 'Transfer Bank'}
                          </span>
                        </TableCell>

                        <TableCell className="px-5 py-4 text-xs text-muted-foreground">
                          {p.notes || 'Pelunasan faktur'}
                        </TableCell>

                        <TableCell className="px-5 py-4 text-right font-black text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                          {formatCurrency(Number(p.amount_paid || p.amount) || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}

          {/* TAB 4: CATATAN KHUSUS */}
          {activeTab === 'notes' && (
            <div className="p-6 space-y-4 max-w-3xl">
              <div>
                <h3 className="text-base font-bold text-foreground">Catatan Khusus & Preferensi Klien</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tuliskan catatan penting mengenai negosiasi, ketentuan khusus, atau riwayat kontak dengan klien ini.
                </p>
              </div>

              <Textarea 
                placeholder="Contoh: Klien meminta termin pembayaran 14 hari, PIC Bapak Rudi bagian keuangan..."
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-2xl border-border/80 focus-visible:ring-primary/20 text-sm leading-relaxed p-4"
              />

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveNotes} 
                  disabled={isSavingNotes}
                  className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs px-5 shadow-sm"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingNotes ? 'Menyimpan...' : 'Simpan Catatan Klien'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDetail;