import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PlusCircle, Eye, Pencil, Trash2, FileText, Search, Receipt, 
  TrendingUp, Send, FileEdit, ArrowUpRight, CheckCircle2, RefreshCw,
  Calendar as CalendarIcon, Clock, Sparkles, X, ChevronRight, Check, FolderKanban
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { safeFormat, formatCurrency, cn } from '@/lib/utils';
import { convertQuoteToInvoice } from '@/utils/quoteToInvoice';

type QuoteItem = {
  quantity: number;
  unit_price: number;
};

type Quote = {
  id: string;
  quote_number: string;
  to_client: string;
  created_at: string;
  status: string;
  title?: string;
  terms?: string;
  client_id?: string;
  discount_amount?: number;
  tax_amount?: number;
  quote_items?: QuoteItem[];
};

const QuoteListSimple = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchQuotes = useCallback(async (showLoadingSpinner = true) => {
    if (!user) return;
    if (showLoadingSpinner) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id, 
          quote_number, 
          to_client, 
          created_at, 
          status,
          title,
          terms,
          client_id,
          discount_amount,
          tax_amount,
          quote_items(quantity, unit_price)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch failed:', error);
        showError(`Error: ${error.message}`);
      } else {
        setQuotes((data as Quote[]) || []);
      }
    } catch (err: any) {
      console.error('Catch error:', err);
      showError('Terjadi kesalahan saat memuat data');
    }
    
    if (showLoadingSpinner) setLoading(false);
  }, [user]);

  const calculateQuoteTotal = (quote: Quote): number => {
    const subtotal = quote.quote_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(quote.discount_amount) || 0);
    return afterDiscount + (Number(quote.tax_amount) || 0);
  };

  const handleAcceptQuote = async (quote: Quote) => {
    if (!user) return;
    try {
      const result = await convertQuoteToInvoice({
        quoteId: quote.id,
        userId: user.id,
        autoUpdateStatus: true,
      });

      if (result.success) {
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'Diterima' } : q));
        if (result.invoiceNumber && !result.alreadyExisted) {
          showSuccess(`Penawaran #${quote.quote_number || ''} diterima & Faktur #${result.invoiceNumber} otomatis dibuat dengan seluruh item!`);
        } else {
          showSuccess(`Penawaran #${quote.quote_number || ''} berhasil diterima!`);
        }
      } else {
        showError(`Gagal memperbarui status: ${result.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      console.error('Accept quote error:', err);
      showError('Terjadi kesalahan saat menandai penawaran diterima.');
    }
  };

  const handleCreateInvoice = async (quote: Quote) => {
    if (!user) return;

    try {
      const result = await convertQuoteToInvoice({
        quoteId: quote.id,
        userId: user.id,
        autoUpdateStatus: true,
      });

      if (result.success && result.invoiceId) {
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'Diterima' } : q));
        if (result.alreadyExisted) {
          showSuccess(`Membuka Faktur #${result.invoiceNumber} untuk penawaran ini.`);
        } else {
          showSuccess(`Faktur #${result.invoiceNumber} berhasil dibuat dengan seluruh rincian penawaran!`);
        }
        navigate(`/invoice/edit/${result.invoiceId}`);
      } else {
        showError(result.error || 'Gagal membuat faktur dari penawaran.');
      }
    } catch (err: any) {
      console.error('Create invoice error:', err);
      showError('Terjadi kesalahan saat membuat faktur.');
    }
  };

  const handleCreateProject = async (quote: Quote) => {
    if (!user) return;

    try {
      const total = calculateQuoteTotal(quote);
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          client_id: quote.client_id || null,
          name: quote.title || `Proyek ${quote.quote_number || 'Penawaran'}`,
          description: `Dibuat dari penawaran ${quote.quote_number || ''}`,
          status: 'Ongoing',
          budget: total
        })
        .select()
        .single();

      if (error) {
        showError(`Gagal membuat proyek: ${error.message}`);
      } else {
        await supabase.from('quotes').update({ project_id: newProject.id }).eq('id', quote.id);
        showSuccess('Proyek berhasil dibuat!');
        navigate(`/project/${newProject.id}`);
      }
    } catch (err: any) {
      console.error('Create project error:', err);
      showError('Terjadi kesalahan saat membuat proyek.');
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    try {
      await supabase.from('quote_items').delete().eq('quote_id', quoteId);
      const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
      if (error) {
        showError(`Gagal menghapus penawaran: ${error.message}`);
      } else {
        showSuccess('Penawaran berhasil dihapus.');
        setQuotes(prev => prev.filter(q => q.id !== quoteId));
      }
    } catch (err: any) {
      console.error('Delete quote error:', err);
      showError('Gagal menghapus penawaran.');
    }
  };

  useEffect(() => {
    fetchQuotes(true);
  }, [fetchQuotes]);

  // Realtime live subscription for quotes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`quotes_realtime_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `user_id=eq.${user.id}` }, () => {
        fetchQuotes(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_items' }, () => {
        fetchQuotes(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchQuotes]);

  const isQuotePartnerService = (quote: Quote): boolean => {
    return Boolean(
      quote.terms?.includes('[CATEGORY:partner_service]')
    );
  };

  // Filtered quotes based on search and status tab
  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = 
        (quote.quote_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (quote.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (quote.to_client || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const s = (quote.status || '').toLowerCase();
      const isPartner = isQuotePartnerService(quote);

      let matchesStatus = true;
      if (statusFilter === 'partner_service') matchesStatus = isPartner;
      else if (statusFilter === 'standard') matchesStatus = !isPartner;
      else if (statusFilter === 'terkirim') matchesStatus = s === 'terkirim' || s === 'sent';
      else if (statusFilter === 'draf') matchesStatus = s === 'draf' || s === 'draft';
      else if (statusFilter === 'diterima') matchesStatus = s === 'diterima' || s === 'accepted';
      else if (statusFilter === 'ditolak') matchesStatus = s === 'ditolak' || s === 'rejected';

      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = quotes.length;
    let totalSent = 0;
    let totalAccepted = 0;
    let totalDraft = 0;
    let totalValue = 0;
    let acceptedValue = 0;
    let partnerCount = 0;
    let standardCount = 0;

    quotes.forEach(quote => {
      const val = calculateQuoteTotal(quote);
      totalValue += val;
      if (isQuotePartnerService(quote)) partnerCount++;
      else standardCount++;

      const s = (quote.status || '').toLowerCase();
      if (s === 'terkirim' || s === 'sent') totalSent++;
      else if (s === 'diterima' || s === 'accepted') {
        totalAccepted++;
        acceptedValue += val;
      } else if (s === 'draf' || s === 'draft') totalDraft++;
    });

    const conversionRate = totalCount > 0 ? (totalAccepted / totalCount) * 100 : 0;

    return {
      totalCount,
      partnerCount,
      standardCount,
      totalSent,
      totalAccepted,
      totalDraft,
      totalValue,
      acceptedValue,
      conversionRate
    };
  }, [quotes]);

  const filteredTotalValue = useMemo(() => {
    return filteredQuotes.reduce((sum, q) => sum + calculateQuoteTotal(q), 0);
  }, [filteredQuotes]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'diterima' || s === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Diterima
        </span>
      );
    }
    if (s === 'terkirim' || s === 'sent') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-600 dark:text-sky-400 border border-sky-500/20">
          <Send className="h-3.5 w-3.5" />
          Terkirim
        </span>
      );
    }
    if (s === 'ditolak' || s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <X className="h-3.5 w-3.5" />
          Ditolak
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-500/20">
        <Clock className="h-3.5 w-3.5" />
        Draf
      </span>
    );
  };

  const capitalizeName = (name: string) => {
    if (!name) return 'Klien Umum';
    return name;
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-3.5 px-2 py-2 sm:px-4 lg:py-3">
      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/80 text-white p-3 sm:p-4 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 px-3 py-1 text-xs font-semibold text-sky-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                Pipeline Penawaran Harga
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                {stats.totalCount} Total Proposal
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Daftar Penawaran
            </h1>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
            <Button 
              onClick={() => fetchQuotes(true)} 
              variant="outline" 
              size="lg"
              className="h-10 sm:h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-3"
              title="Segarkan Data"
            >
              <RefreshCw className={cn("h-4 w-4 text-sky-400", loading && "animate-spin")} />
            </Button>

            <Button 
              asChild 
              size="lg"
              className="h-10 sm:h-11 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/25 border-0 active:scale-95 transition-all px-4 sm:px-5"
            >
              <Link to="/quote/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Buat Penawaran
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Summary KPI Cards (Responsive 2x2 on Mobile, 4 Cols on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Card 1: Total Nilai Pipeline */}
        <Card className="relative overflow-hidden rounded-xl border border-border/80 bg-card p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Pipeline</p>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition-transform shadow-2xs">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(stats.totalValue)}
            </h3>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="truncate">{stats.totalCount} Dokumen Aktif</span>
          </div>
        </Card>

        {/* Card 2: Diterima */}
        <Card className="relative overflow-hidden rounded-xl border border-border/80 bg-card p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Goal Diterima</p>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(stats.acceptedValue)}
            </h3>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-1.5">
            <span className="truncate">{stats.totalAccepted} Goal</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.conversionRate.toFixed(0)}% Konversi</span>
          </div>
        </Card>

        {/* Card 3: Terkirim */}
        <Card className="relative overflow-hidden rounded-xl border border-border/80 bg-card p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Terkirim</p>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform shadow-2xs">
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {stats.totalSent} <span className="text-xs font-normal text-muted-foreground">Proposal</span>
            </h3>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span className="truncate">Menunggu Respon Klien</span>
          </div>
        </Card>

        {/* Card 4: Draf */}
        <Card className="relative overflow-hidden rounded-xl border border-border/80 bg-card p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Draf / Proses</p>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform shadow-2xs">
              <FileEdit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {stats.totalDraft} <span className="text-xs font-normal text-muted-foreground">Draf</span>
            </h3>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="truncate">Perlu difinalisasi</span>
          </div>
        </Card>
      </div>

      {/* Main Content Card */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-3.5 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            {/* Search Input Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                placeholder="Cari nomor penawaran atau nama klien..."
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

            {/* Filter Tabs Segmented Control (Smooth Scrollable) */}
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/70 overflow-x-auto no-scrollbar max-w-full">
              {[
                { key: 'all', label: 'Semua', count: stats.totalCount },
                { key: 'partner_service', label: 'Toko / Jasa', count: stats.partnerCount, badgeColor: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
                { key: 'standard', label: 'Mandiri', count: stats.standardCount, badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
                { key: 'terkirim', label: 'Terkirim', count: stats.totalSent, badgeColor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
                { key: 'draf', label: 'Draf', count: stats.totalDraft, badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
                { key: 'diterima', label: 'Diterima', count: stats.totalAccepted, badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
              ].map(tab => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap select-none border",
                      isActive
                        ? "bg-teal-600 text-white border-teal-500 shadow-xs font-extrabold"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none tabular-nums",
                      isActive ? "bg-black/25 text-white" : (tab.badgeColor || "bg-muted text-muted-foreground")
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
            <div className="p-6 space-y-3">
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 border border-border/60 shadow-xs">
                <FileText className="h-7 w-7 text-muted-foreground/80" />
              </div>
              <h3 className="text-base font-bold text-foreground">Tidak ada penawaran ditemukan</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {quotes.length === 0 
                  ? 'Belum ada data penawaran yang dibuat. Buat dokumen penawaran pertama Anda.' 
                  : 'Tidak ada penawaran yang sesuai dengan kata kunci pencarian atau filter status.'}
              </p>
              {quotes.length === 0 ? (
                <Button asChild className="mt-4 rounded-xl bg-primary text-primary-foreground font-semibold px-4 text-xs" size="sm">
                  <Link to="/quote/new">
                    <PlusCircle className="mr-1.5 h-4 w-4" /> Buat Penawaran Pertama
                  </Link>
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} 
                  className="mt-3 rounded-xl text-xs font-semibold"
                  size="sm"
                >
                  Reset Filter
                </Button>
              )}
            </div>
          ) : (
            <div>
              {/* ========================================================================= */}
              {/* 1. MOBILE RESPONSIVE CARD LIST VIEW (md:hidden) */}
              {/* ========================================================================= */}
              <div className="block md:hidden divide-y divide-border/60">
                {filteredQuotes.map((quote) => {
                  const totalVal = calculateQuoteTotal(quote);
                  const clientName = capitalizeName(quote.to_client);
                  const itemCount = quote.quote_items?.length || 0;
                  const isPartner = isQuotePartnerService(quote);

                  return (
                    <div key={quote.id} className="p-3.5 space-y-3 hover:bg-muted/20 transition-colors">
                      {/* Top Row: Nomor & Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Link 
                            to={`/quote/${quote.id}`}
                            className="font-mono font-bold text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20"
                          >
                            {quote.quote_number || 'N/A'}
                          </Link>
                          {isPartner && (
                            <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border-violet-500/20">
                              🏢 Toko
                            </Badge>
                          )}
                        </div>
                        {getStatusBadge(quote.status)}
                      </div>

                      {/* Middle Row: Client Info & Date */}
                      <Link to={`/quote/${quote.id}`} className="flex items-center gap-3 group block">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border shadow-2xs",
                          isPartner 
                            ? "bg-violet-500/15 text-violet-400 border-violet-500/30" 
                            : "bg-gradient-to-br from-teal-500/15 to-emerald-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30"
                        )}>
                          {isPartner ? '🏢' : clientName.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                            {clientName}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span>{itemCount > 0 ? `${itemCount} item ${isPartner ? 'jasa/akomodasi' : 'barang/jasa'}` : 'Penawaran proyek'}</span>
                            <span>•</span>
                            <span>{safeFormat(quote.created_at, 'd MMM yyyy')}</span>
                          </div>
                        </div>
                      </Link>

                      {/* Bottom Row: Total Nominal & Quick Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Total Nilai</span>
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(totalVal)}
                          </span>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {quote.status?.toLowerCase() !== 'diterima' && quote.status?.toLowerCase() !== 'accepted' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleAcceptQuote(quote)}
                              className="h-8 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold gap-1"
                              title="Tandai Penawaran Diterima"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Terima</span>
                            </Button>
                          )}

                          {(quote.status?.toLowerCase() === 'diterima' || quote.status?.toLowerCase() === 'accepted') && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleCreateInvoice(quote)}
                                className="h-8 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold gap-1"
                                title="Buat Faktur"
                              >
                                <Receipt className="h-3.5 w-3.5" />
                                <span>Faktur</span>
                              </Button>

                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleCreateProject(quote)}
                                className="h-8 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-bold gap-1"
                                title="Buat Proyek"
                              >
                                <FolderKanban className="h-3.5 w-3.5" />
                                <span>Proyek</span>
                              </Button>
                            </>
                          )}

                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                            <Link to={`/quote/${quote.id}`} title="Lihat">
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>

                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground">
                            <Link to={`/quote/edit/${quote.id}`} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-500">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl border border-border/80">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-base font-bold">Hapus Penawaran?</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-muted-foreground">
                                  Hapus permanen penawaran {quote.quote_number} untuk {clientName}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl text-xs">Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteQuote(quote.id)} className="rounded-xl bg-destructive text-xs">Hapus</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ========================================================================= */}
              {/* 2. DESKTOP RICH TABLE VIEW (hidden md:block) */}
              {/* ========================================================================= */}
              <div className="hidden md:block w-full">
                <Table className="w-full table-fixed">
                  <TableHeader className="bg-muted/35">
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="w-[12%] px-3.5 py-3 font-extrabold text-[11px] uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap">
                        Nomor
                      </TableHead>
                      <TableHead className="w-[30%] px-3 py-3 font-extrabold text-[11px] uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap">
                        Nama Klien & Perihal
                      </TableHead>
                      <TableHead className="w-[14%] px-3 py-3 font-extrabold text-[11px] uppercase tracking-wider text-muted-foreground text-right whitespace-nowrap">
                        Nominal Total
                      </TableHead>
                      <TableHead className="w-[11%] px-2 py-3 font-extrabold text-[11px] uppercase tracking-wider text-muted-foreground text-center whitespace-nowrap">
                        Status
                      </TableHead>
                      <TableHead className="w-[11%] px-2 py-3 font-extrabold text-[11px] uppercase tracking-wider text-muted-foreground text-center whitespace-nowrap">
                        Tanggal Buat
                      </TableHead>
                      <TableHead className="w-[22%] px-3.5 py-3 font-extrabold text-[11px] uppercase tracking-wider text-muted-foreground text-right whitespace-nowrap">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {filteredQuotes.map((quote) => {
                      const totalVal = calculateQuoteTotal(quote);
                      const clientName = capitalizeName(quote.to_client);
                      const itemCount = quote.quote_items?.length || 0;
                      const isPartner = isQuotePartnerService(quote);

                      return (
                        <TableRow key={quote.id} className="hover:bg-muted/30 transition-colors group">
                          {/* Nomor */}
                          <TableCell className="px-3.5 py-3 whitespace-nowrap">
                            <Link 
                              to={`/quote/${quote.id}`}
                              className="inline-flex items-center gap-1 font-mono font-bold text-[11.5px] text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-lg border border-primary/20 transition-all whitespace-nowrap"
                            >
                              <span>{quote.quote_number || 'N/A'}</span>
                            </Link>
                          </TableCell>
                          
                          {/* Nama Klien */}
                          <TableCell className="px-3 py-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border shadow-2xs",
                                isPartner 
                                  ? "bg-violet-500/15 text-violet-400 border-violet-500/30" 
                                  : "bg-gradient-to-br from-teal-500/15 to-emerald-500/20 text-teal-600 dark:text-teal-300 border-teal-500/30"
                              )}>
                                {clientName.substring(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Link 
                                    to={`/quote/${quote.id}`}
                                    className="font-extrabold text-[13px] text-foreground hover:text-primary transition-colors truncate"
                                  >
                                    {clientName}
                                  </Link>
                                  {isPartner && (
                                    <Badge variant="outline" className="text-[9.5px] font-bold px-1.5 py-0 rounded-md bg-violet-500/10 text-violet-400 border-violet-500/20 shrink-0">
                                      Jasa Toko
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[11px] text-muted-foreground block truncate">
                                  {quote.title ? `${quote.title} • ` : ''}
                                  {itemCount > 0 ? `${itemCount} item ${isPartner ? 'jasa/akomodasi' : 'barang/jasa'}` : 'Penawaran proyek'}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Nominal Total */}
                          <TableCell className="px-3 py-3 text-right whitespace-nowrap">
                            <span className="font-black text-[13px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums tracking-tight">
                              {formatCurrency(totalVal)}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="px-2 py-3 text-center whitespace-nowrap">
                            <div className="flex justify-center">
                              {getStatusBadge(quote.status)}
                            </div>
                          </TableCell>

                          {/* Tanggal */}
                          <TableCell className="px-2 py-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground font-medium whitespace-nowrap">
                              <CalendarIcon className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                              <span>{safeFormat(quote.created_at, 'd MMM yyyy')}</span>
                            </div>
                          </TableCell>

                          {/* Aksi (100% Utuh di Dalam Kartu Tanpa Terpotong) */}
                          <TableCell className="px-3.5 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1 flex-nowrap whitespace-nowrap">
                              {/* Tombol Terima Penawaran jika belum diterima */}
                              {quote.status?.toLowerCase() !== 'diterima' && quote.status?.toLowerCase() !== 'accepted' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleAcceptQuote(quote)}
                                  className="h-7 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] gap-1 transition-all whitespace-nowrap shrink-0"
                                  title="Tandai Penawaran Diterima"
                                >
                                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                                  <span>Terima</span>
                                </Button>
                              )}

                              {/* Tombol Buat Faktur & Buat Proyek jika penawaran DITERIMA */}
                              {(quote.status?.toLowerCase() === 'diterima' || quote.status?.toLowerCase() === 'accepted') && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleCreateInvoice(quote)} 
                                    className="h-7 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] gap-1 transition-all whitespace-nowrap shrink-0" 
                                    title="Buat Faktur Tagihan"
                                  >
                                    <Receipt className="h-3 w-3 shrink-0" />
                                    <span>Faktur</span>
                                  </Button>

                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleCreateProject(quote)} 
                                    className="h-7 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-[11px] gap-1 transition-all whitespace-nowrap shrink-0" 
                                    title="Buat Proyek Baru"
                                  >
                                    <FolderKanban className="h-3 w-3 shrink-0" />
                                    <span>Proyek</span>
                                  </Button>
                                </>
                              )}

                              {/* Grup Tombol Ikon (Lihat, Edit, Hapus) */}
                              <div className="inline-flex items-center rounded-lg border border-border/70 bg-muted/25 p-0.5 shrink-0">
                                <Button asChild variant="ghost" size="icon" className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-background" title="Lihat Detail Penawaran">
                                  <Link to={`/quote/${quote.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                                </Button>
                                <Button asChild variant="ghost" size="icon" className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-background" title="Edit Penawaran">
                                  <Link to={`/quote/edit/${quote.id}`}><Pencil className="h-3.5 w-3.5" /></Link>
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md text-rose-500 hover:bg-rose-500/15 hover:text-rose-400" title="Hapus Penawaran">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-2xl border border-border/80 shadow-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-lg font-bold">Hapus Penawaran?</AlertDialogTitle>
                                      <AlertDialogDescription className="text-sm text-muted-foreground">
                                        Penawaran {quote.quote_number} untuk {clientName} akan dihapus permanen.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2">
                                      <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteQuote(quote.id)} className="rounded-xl bg-destructive text-destructive-foreground">Ya, Hapus</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Table Bottom Footer Summary */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 border-t border-border/70 bg-muted/15 text-xs text-muted-foreground font-medium">
                <div>
                  Menampilkan <span className="font-bold text-foreground">{filteredQuotes.length}</span> dari <span className="font-bold text-foreground">{quotes.length}</span> penawaran
                </div>
                <div className="flex items-center gap-2">
                  <span>Subtotal Terfilter:</span>
                  <span className="font-black text-foreground text-sm tabular-nums">{formatCurrency(filteredTotalValue)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuoteListSimple;