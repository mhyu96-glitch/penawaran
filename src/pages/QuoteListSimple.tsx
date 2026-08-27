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
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'Diterima' })
        .eq('id', quote.id);

      if (error) {
        showError(`Gagal memperbarui status: ${error.message}`);
      } else {
        showSuccess(`Penawaran ${quote.quote_number || ''} berhasil diterima!`);
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'Diterima' } : q));
      }
    } catch (err: any) {
      console.error('Accept quote error:', err);
      showError('Terjadi kesalahan saat menandai penawaran diterima.');
    }
  };

  const handleCreateInvoice = async (quote: Quote) => {
    if (!user) return;

    try {
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quote.id)
        .single();

      if (quoteError) {
        showError('Gagal memuat data penawaran.');
        return;
      }

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          quote_id: quote.id,
          from_company: quoteData.from_company,
          from_address: quoteData.from_address,
          to_client: quoteData.to_client,
          to_address: quoteData.to_address,
          title: quoteData.title,
          status: 'Draf',
          invoice_number: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
          invoice_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (invoiceError) {
        showError('Gagal membuat faktur.');
        console.error(invoiceError);
      } else {
        showSuccess('Faktur berhasil dibuat!');
        navigate(`/invoice/edit/${newInvoice.id}`);
      }
    } catch (err) {
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
      quote.terms?.includes('[CATEGORY:partner_service]') ||
      quote.title?.toLowerCase().includes('jasa') ||
      quote.title?.toLowerCase().includes('subkon') ||
      quote.title?.toLowerCase().includes('toko')
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
    <div className="mx-auto w-full max-w-7xl space-y-3 sm:space-y-4 px-3 py-2 sm:px-6 lg:px-8 lg:py-4">
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
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 overflow-x-auto no-scrollbar max-w-full">
              {[
                { key: 'all', label: 'Semua', count: stats.totalCount },
                { key: 'partner_service', label: '🏢 Toko / Jasa', count: stats.partnerCount, badgeColor: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
                { key: 'standard', label: '👤 Mandiri', count: stats.standardCount, badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
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
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap select-none",
                      isActive
                        ? "bg-background text-foreground shadow-xs border border-border/70 font-black"
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
              <div className="hidden md:block overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="w-[140px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nomor</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nama Klien</TableHead>
                      <TableHead className="w-[200px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Nominal Total</TableHead>
                      <TableHead className="w-[140px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                      <TableHead className="w-[150px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Tanggal Buat</TableHead>
                      <TableHead className="w-[220px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Aksi</TableHead>
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
                          <TableCell className="px-5 py-4">
                            <Link 
                              to={`/quote/${quote.id}`}
                              className="inline-flex items-center gap-1.5 font-mono font-bold text-xs text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/20 transition-all hover:scale-105"
                            >
                              <span>{quote.quote_number || 'N/A'}</span>
                            </Link>
                          </TableCell>
                          
                          {/* Nama Klien */}
                          <TableCell className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border shadow-2xs",
                                isPartner 
                                  ? "bg-violet-500/15 text-violet-400 border-violet-500/30" 
                                  : "bg-gradient-to-br from-teal-500/15 to-emerald-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30"
                              )}>
                                {isPartner ? '🏢' : clientName.substring(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link 
                                    to={`/quote/${quote.id}`}
                                    className="font-bold text-sm text-foreground hover:text-primary transition-colors block truncate max-w-xs"
                                  >
                                    {clientName}
                                  </Link>
                                  {isPartner && (
                                    <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 rounded-md bg-violet-500/10 text-violet-400 border-violet-500/20 shrink-0">
                                      🏢 Jasa Toko
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[11px] text-muted-foreground block truncate">
                                  {itemCount > 0 ? `${itemCount} item ${isPartner ? 'jasa/akomodasi' : 'barang/jasa'}` : 'Penawaran proyek'}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Nominal Total */}
                          <TableCell className="px-5 py-4 text-right">
                            <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums tracking-tight">
                              {formatCurrency(totalVal)}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="px-5 py-4 text-center">
                            <div className="flex justify-center">
                              {getStatusBadge(quote.status)}
                            </div>
                          </TableCell>

                          {/* Tanggal */}
                          <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
                              <span>{safeFormat(quote.created_at, 'd MMM yyyy')}</span>
                            </div>
                          </TableCell>

                          {/* Aksi */}
                          <TableCell className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Tombol Terima Penawaran jika belum diterima */}
                              {quote.status?.toLowerCase() !== 'diterima' && quote.status?.toLowerCase() !== 'accepted' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleAcceptQuote(quote)}
                                  className="h-8 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold text-xs gap-1 transition-all"
                                  title="Tandai Penawaran Diterima"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
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
                                    className="h-8 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold text-xs gap-1 transition-all" 
                                    title="Buat Faktur Tagihan"
                                  >
                                    <Receipt className="h-3.5 w-3.5" />
                                    <span>Faktur</span>
                                  </Button>

                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleCreateProject(quote)} 
                                    className="h-8 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 font-bold text-xs gap-1 transition-all" 
                                    title="Buat Proyek Baru"
                                  >
                                    <FolderKanban className="h-3.5 w-3.5" />
                                    <span>Proyek</span>
                                  </Button>
                                </>
                              )}

                              <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground" title="Lihat">
                                <Link to={`/quote/${quote.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                              <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground" title="Edit">
                                <Link to={`/quote/edit/${quote.id}`}><Pencil className="h-4 w-4" /></Link>
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10" title="Hapus">
                                    <Trash2 className="h-4 w-4" />
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