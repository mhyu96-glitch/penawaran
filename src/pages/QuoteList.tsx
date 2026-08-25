import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PlusCircle, Eye, Pencil, Trash2, Copy, FileText, 
  Search, RefreshCw, TrendingUp, CheckCircle2, 
  Clock, AlertTriangle, X, ChevronDown, Check, Receipt, ChevronRight, XCircle
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { safeFormat, safeFormatDistance, formatCurrency, cn } from '@/lib/utils';

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
  view_count: number;
  last_viewed_at: string | null;
  discount_amount?: number;
  tax_amount?: number;
  quote_items?: QuoteItem[];
};

const QuoteList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchQuotes = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id, 
          quote_number, 
          to_client, 
          created_at, 
          status, 
          view_count, 
          last_viewed_at,
          discount_amount,
          tax_amount,
          quote_items(quantity, unit_price)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotes:', error);
        showError(`Gagal memuat penawaran: ${error.message}`);
        setQuotes([]);
      } else {
        setQuotes((data as Quote[]) || []);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      showError('Terjadi kesalahan saat memuat data penawaran.');
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [user]);

  const calculateQuoteTotal = (quote: Quote): number => {
    const subtotal = quote.quote_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(quote.discount_amount) || 0);
    return Math.max(0, afterDiscount + (Number(quote.tax_amount) || 0));
  };

  const handleStatusChange = async (quoteId: string, status: string) => {
    const { error } = await supabase
      .from('quotes')
      .update({ status })
      .eq('id', quoteId);

    if (error) {
      showError('Gagal memperbarui status.');
    } else {
      showSuccess('Status berhasil diperbarui.');
      setQuotes(quotes.map(q => q.id === quoteId ? { ...q, status } : q));
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    const { error } = await supabase.from('quotes').delete().match({ id: quoteId });

    if (error) {
      showError('Gagal menghapus penawaran.');
    } else {
      showSuccess('Penawaran berhasil dihapus.');
      setQuotes(quotes.filter(q => q.id !== quoteId));
    }
  };

  const handleDuplicateQuote = async (quoteId: string) => {
    if (!user) return;

    const { data: sourceQuote, error: fetchError } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', quoteId)
      .single();

    if (fetchError || !sourceQuote) {
      showError('Gagal menduplikasi penawaran.');
      return;
    }

    const year = new Date().getFullYear();
    const { data: latestQuotes } = await supabase
      .from('quotes')
      .select('quote_number')
      .eq('user_id', user.id)
      .like('quote_number', `PNW-${year}-%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (latestQuotes && latestQuotes.length > 0 && latestQuotes[0].quote_number) {
      const lastNumber = latestQuotes[0].quote_number.split('-').pop();
      if (lastNumber && !Number.isNaN(Number.parseInt(lastNumber, 10))) {
        nextNumber = Number.parseInt(lastNumber, 10) + 1;
      }
    }

    const { id, created_at, quote_items, view_count, last_viewed_at, quote_number, ...quoteData } = sourceQuote;

    const newQuotePayload = {
      ...quoteData,
      quote_number: `PNW-${year}-${String(nextNumber).padStart(3, '0')}`,
      status: 'Draf',
      created_at: new Date().toISOString(),
    };

    const { data: newQuote, error: insertError } = await supabase
      .from('quotes')
      .insert(newQuotePayload)
      .select('id')
      .single();

    if (insertError || !newQuote) {
      showError(`Gagal menduplikasi penawaran: ${insertError?.message}`);
      return;
    }

    if (quote_items && quote_items.length > 0) {
      const newItemsPayload = quote_items.map(({ id, quote_id, ...item }: any) => ({
        ...item,
        quote_id: newQuote.id,
      }));

      await supabase.from('quote_items').insert(newItemsPayload);
    }

    showSuccess('Penawaran berhasil diduplikasi.');
    navigate(`/quote/edit/${newQuote.id}`);
  };

  // Statistics calculation
  const stats = useMemo(() => {
    let grandTotalValue = 0;
    let totalDiterima = 0;
    let totalTerkirim = 0;
    let totalDraft = 0;
    let totalDitolak = 0;

    quotes.forEach(q => {
      const val = calculateQuoteTotal(q);
      grandTotalValue += val;
      const s = (q.status || '').toLowerCase();
      if (s === 'diterima' || s === 'accepted') {
        totalDiterima++;
      } else if (s === 'terkirim' || s === 'sent') {
        totalTerkirim++;
      } else if (s === 'ditolak' || s === 'rejected') {
        totalDitolak++;
      } else {
        totalDraft++;
      }
    });

    return {
      totalCount: quotes.length,
      grandTotalValue,
      totalDiterima,
      totalTerkirim,
      totalDraft,
      totalDitolak,
    };
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = 
        (quote.quote_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (quote.to_client?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      const status = (quote.status || 'draf').toLowerCase();
      let matchesStatus = true;
      if (statusFilter === 'diterima') matchesStatus = status === 'diterima' || status === 'accepted';
      else if (statusFilter === 'terkirim') matchesStatus = status === 'terkirim' || status === 'sent';
      else if (statusFilter === 'draf') matchesStatus = status === 'draf' || status === 'draft';
      else if (statusFilter === 'ditolak') matchesStatus = status === 'ditolak' || status === 'rejected';

      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  const quoteStatuses = ['Draf', 'Terkirim', 'Diterima', 'Ditolak'];

  const renderStatusDropdown = (quote: Quote) => {
    const s = (quote.status || 'draf').toLowerCase();

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="outline-none group">
            {s === 'diterima' || s === 'accepted' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500/20 transition-colors shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Diterima
                <ChevronDown className="h-3 w-3 opacity-60" />
              </span>
            ) : s === 'terkirim' || s === 'sent' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-600 dark:text-sky-400 border border-sky-500/30 group-hover:bg-sky-500/20 transition-colors shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                Terkirim
                <ChevronDown className="h-3 w-3 opacity-60" />
              </span>
            ) : s === 'ditolak' || s === 'rejected' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/30 group-hover:bg-rose-500/20 transition-colors shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Ditolak
                <ChevronDown className="h-3 w-3 opacity-60" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-500/30 group-hover:bg-slate-500/20 transition-colors shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Draf
                <ChevronDown className="h-3 w-3 opacity-60" />
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-40 rounded-xl border border-border/80 p-1 shadow-xl">
          <DropdownMenuLabel className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground px-2 py-1">Ubah Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {quoteStatuses.map(status => (
            <DropdownMenuItem 
              key={status} 
              onClick={() => handleStatusChange(quote.id, status)} 
              className="text-xs font-medium rounded-lg cursor-pointer py-1.5"
            >
              {quote.status === status && <Check className="mr-1.5 h-3.5 w-3.5 text-primary" />}
              {status}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const capitalizeName = (str: string) => {
    if (!str) return 'Klien Umum';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6 px-3 py-3 sm:px-6 lg:px-8 pb-28 sm:pb-8">
      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white p-4 sm:p-7 shadow-xl">
        {/* Ambient Glow Effects */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                Manajemen Penawaran Harga
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-300">
                {stats.totalCount} Penawaran
              </span>
            </div>
            
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              Daftar Penawaran Saya
            </h1>
            
            <p className="text-slate-300/80 text-xs sm:text-sm leading-relaxed max-w-xl font-medium hidden sm:block">
              Buat proposal harga instan, pantau respon klien, ekspor PDF 1 halaman rapi, dan konversi ke faktur dengan mudah.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <Button 
              onClick={fetchQuotes} 
              variant="outline" 
              size="sm"
              className="h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-3 text-xs"
              title="Refresh Data Penawaran"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-sky-400", loading && "animate-spin")} />
            </Button>

            <Button 
              asChild 
              size="sm" 
              className="h-10 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 hover:from-sky-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-sky-950/50 border border-sky-400/20 transition-all active:scale-95 px-4 text-xs grow sm:grow-0"
            >
              <Link to="/quote/new">
                <PlusCircle className="mr-1.5 h-4 w-4 stroke-[2.5]" />
                Buat Penawaran Baru
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Stat KPI Metric Cards - 2 Columns on Mobile, 4 Columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Penawaran */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Penawaran</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 shadow-2xs">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">{stats.totalCount}</h3>
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">dokumen</span>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span>Semua proposal penawaran</span>
          </div>
        </Card>

        {/* Card 2: Nilai Penawaran Total */}
        <Card className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Potensi Omzet</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate tabular-nums">
              {formatCurrency(stats.grandTotalValue)}
            </h3>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-700/80 dark:text-emerald-300 font-medium border-t border-emerald-500/20 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Total akumulasi nilai proposal</span>
          </div>
        </Card>

        {/* Card 3: Deal Diterima */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Deal Diterima</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">{stats.totalDiterima}</h3>
            <span className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
              Disetujui
            </span>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Siap difakturkan / dikerjakan</span>
          </div>
        </Card>

        {/* Card 4: Terkirim / Pending */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Terkirim / Review</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-2xs">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">{stats.totalTerkirim}</h3>
            <span className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
              Proses Review
            </span>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Menunggu konfirmasi klien</span>
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
                placeholder="Cari nomor penawaran atau nama klien..."
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
                { key: 'diterima', label: 'Diterima', count: stats.totalDiterima, badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
                { key: 'terkirim', label: 'Terkirim', count: stats.totalTerkirim, badgeColor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
                { key: 'draf', label: 'Draf', count: stats.totalDraft, badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
                { key: 'ditolak', label: 'Ditolak', count: stats.totalDitolak, badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
              ].map(tab => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
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
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 border border-border/60 shadow-xs">
                <FileText className="h-7 w-7 text-muted-foreground/80" />
              </div>
              <h3 className="text-base font-bold text-foreground">Tidak ada penawaran ditemukan</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                {quotes.length === 0 
                  ? 'Belum ada data penawaran harga. Mulai buat proposal pertama Anda.' 
                  : 'Tidak ada penawaran yang cocok dengan filter atau pencarian.'
                }
              </p>
              {quotes.length === 0 ? (
                <Button asChild className="mt-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs" size="sm">
                  <Link to="/quote/new">
                    <PlusCircle className="mr-1.5 h-4 w-4" />
                    Buat Penawaran Pertama
                  </Link>
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} 
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
              {/* 1. MOBILE RESPONSIVE CARD LIST VIEW (md:hidden) */}
              {/* ========================================================================= */}
              <div className="block md:hidden divide-y divide-border/60">
                {filteredQuotes.map((quote) => {
                  const totalVal = calculateQuoteTotal(quote);
                  const clientName = capitalizeName(quote.to_client);
                  const itemCount = quote.quote_items?.length || 0;

                  return (
                    <div key={quote.id} className="p-3.5 space-y-3 hover:bg-muted/20 transition-colors">
                      {/* Top Row: Nomor & Status */}
                      <div className="flex items-center justify-between">
                        <Link 
                          to={`/quote/${quote.id}`}
                          className="font-mono font-bold text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20"
                        >
                          {quote.quote_number || 'N/A'}
                        </Link>
                        <div>{renderStatusDropdown(quote)}</div>
                      </div>

                      {/* Middle Row: Client Info */}
                      <Link to={`/quote/${quote.id}`} className="flex items-center gap-3 group block">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/15 to-blue-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center font-black text-xs shrink-0 border border-sky-500/30 shadow-2xs">
                          {clientName.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                            {clientName}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span>{itemCount > 0 ? `${itemCount} item barang/jasa` : 'Penawaran harga'}</span>
                            <span>•</span>
                            <span>{safeFormat(quote.created_at, 'd MMM yyyy')}</span>
                          </div>
                        </div>
                      </Link>

                      {/* Bottom Row: Total Nominal & Quick Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Nilai Penawaran</span>
                          <span className="font-black text-sm text-sky-600 dark:text-sky-400 tabular-nums">
                            {formatCurrency(totalVal)}
                          </span>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-1">
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

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDuplicateQuote(quote.id)}
                            className="h-8 w-8 rounded-lg text-muted-foreground"
                            title="Duplikat"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-500">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl border border-border/80 shadow-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-lg font-bold">Hapus Penawaran?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm text-muted-foreground">
                                  Tindakan ini tidak dapat dibatalkan. Penawaran <strong className="text-foreground">{quote.quote_number}</strong> akan dihapus permanen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteQuote(quote.id)}
                                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
                                >
                                  Hapus
                                </AlertDialogAction>
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
              {/* 2. DESKTOP FULL TABLE VIEW (hidden on mobile, block on desktop) */}
              {/* ========================================================================= */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="w-[200px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nomor Penawaran</TableHead>
                      <TableHead className="w-[260px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Klien / Tujuan</TableHead>
                      <TableHead className="w-[180px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Nilai Total</TableHead>
                      <TableHead className="w-[160px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                      <TableHead className="w-[160px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Tanggal</TableHead>
                      <TableHead className="w-[140px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {filteredQuotes.map((quote) => {
                      const totalVal = calculateQuoteTotal(quote);
                      const clientName = capitalizeName(quote.to_client);

                      return (
                        <TableRow key={quote.id} className="hover:bg-muted/30 transition-colors group">
                          {/* Nomor Penawaran */}
                          <TableCell className="px-5 py-4 font-mono font-bold text-xs text-primary">
                            <Link to={`/quote/${quote.id}`} className="hover:underline">
                              {quote.quote_number || 'N/A'}
                            </Link>
                          </TableCell>

                          {/* Klien */}
                          <TableCell className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                                {clientName.substring(0, 1).toUpperCase()}
                              </div>
                              <span className="font-bold text-sm text-foreground truncate max-w-[200px]">
                                {clientName}
                              </span>
                            </div>
                          </TableCell>

                          {/* Total Nilai */}
                          <TableCell className="px-5 py-4 text-right font-black text-sm text-foreground tabular-nums">
                            {formatCurrency(totalVal)}
                          </TableCell>

                          {/* Status */}
                          <TableCell className="px-5 py-4 text-center">
                            {renderStatusDropdown(quote)}
                          </TableCell>

                          {/* Tanggal Dibuat */}
                          <TableCell className="px-5 py-4 text-xs font-semibold text-muted-foreground">
                            {safeFormat(quote.created_at, 'd MMMM yyyy')}
                          </TableCell>

                          {/* Aksi Group */}
                          <TableCell className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
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

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDuplicateQuote(quote.id)}
                                className="h-8 w-8 rounded-lg text-muted-foreground"
                                title="Duplikat"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-500">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl border border-border/80 shadow-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-lg font-bold">Hapus Penawaran?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-sm text-muted-foreground">
                                      Tindakan ini tidak dapat dibatalkan. Penawaran <strong className="text-foreground">{quote.quote_number}</strong> akan dihapus permanen.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteQuote(quote.id)}
                                      className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
                                    >
                                      Hapus
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
                  Menampilkan <span className="font-bold text-foreground">{filteredQuotes.length}</span> dari <span className="font-bold text-foreground">{quotes.length}</span> total penawaran
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {stats.totalDiterima} Deal Diterima</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> {stats.totalTerkirim} Terkirim</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuoteList;
