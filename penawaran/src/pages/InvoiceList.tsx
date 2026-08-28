import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PlusCircle, Eye, Pencil, Trash2, Receipt, Download, Copy, Search, 
  CheckCircle, RefreshCw, TrendingUp, Clock, CheckCircle2, AlertTriangle, FileEdit,
  Calendar as CalendarIcon, X, ArrowUpRight, Sparkles, ChevronDown, Check
} from 'lucide-react';
import { format } from 'date-fns';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { safeFormat, safeFormatDistance, formatCurrency, cn, isDateBeforeToday } from '@/lib/utils';

type InvoiceItem = {
  quantity: number;
  unit_price: number;
};

type Invoice = {
  id: string;
  invoice_number: string;
  to_client: string;
  created_at: string;
  status: string;
  due_date: string;
  view_count: number;
  last_viewed_at: string | null;
  tax_amount: number;
  discount_amount: number;
  down_payment_amount: number;
  invoice_items?: InvoiceItem[];
};

const InvoiceList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; invoice: Invoice | null }>({ 
    open: false, 
    invoice: null 
  });

  const fetchInvoices = useCallback(async (showLoadingSpinner = true) => {
    if (!user) return;
    if (showLoadingSpinner) setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id, 
        invoice_number, 
        to_client, 
        created_at, 
        status, 
        due_date, 
        view_count, 
        last_viewed_at, 
        tax_amount, 
        discount_amount, 
        down_payment_amount,
        invoice_items(quantity, unit_price)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      showError('Gagal memuat daftar faktur.');
    } else {
      setInvoices((data as Invoice[]) || []);
    }
    if (showLoadingSpinner) setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchInvoices(true);
  }, [fetchInvoices]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`invoice_list_realtime_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.id}` }, () => {
        fetchInvoices(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_items' }, () => {
        fetchInvoices(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` }, () => {
        fetchInvoices(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchInvoices]);

  const calculateInvoiceTotal = (invoice: Invoice): number => {
    const subtotal = invoice.invoice_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(invoice.discount_amount) || 0);
    return afterDiscount + (Number(invoice.tax_amount) || 0);
  };

  const handleStatusChange = async (invoiceId: string, status: string) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status })
      .eq('id', invoiceId);

    if (error) {
      showError('Gagal memperbarui status faktur.');
    } else {
      showSuccess('Status faktur berhasil diperbarui.');
      setInvoices(invoices.map(i => i.id === invoiceId ? { ...i, status } : i));
    }
  };

  const showPaymentDialog = (invoice: Invoice) => {
    setPaymentDialog({ open: true, invoice });
  };

  const closePaymentDialog = () => {
    setPaymentDialog({ open: false, invoice: null });
  };

  const confirmPayment = async () => {
    if (!paymentDialog.invoice) return;
    await handlePaymentComplete(paymentDialog.invoice);
    closePaymentDialog();
  };

  const handlePaymentComplete = async (invoice: Invoice) => {
    try {
      const { error: statusError } = await supabase
        .from('invoices')
        .update({ status: 'Lunas' })
        .eq('id', invoice.id);

      if (statusError) {
        showError('Gagal mengubah status faktur.');
        return;
      }

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoice.id,
          user_id: user?.id,
          payment_date: new Date().toISOString(),
          payment_method: 'Pelunasan Manual',
          amount_paid: calculateInvoiceTotal(invoice),
          status: 'Completed',
          notes: 'Pembayaran pelunasan manual'
        });

      if (paymentError) {
        console.error('Payment record error:', paymentError);
      }

      setInvoices(invoices.map(inv => 
        inv.id === invoice.id ? { ...inv, status: 'Lunas' } : inv
      ));

      showSuccess('Faktur berhasil ditandai sebagai lunas!');
    } catch (error) {
      console.error('Payment completion error:', error);
      showError('Terjadi kesalahan saat memproses pelunasan.');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
      await supabase.from('payments').delete().eq('invoice_id', invoiceId);
      const { error } = await supabase.from('invoices').delete().match({ id: invoiceId });

      if (error) {
        showError('Gagal menghapus faktur: ' + error.message);
      } else {
        showSuccess('Faktur berhasil dihapus.');
        setInvoices(prev => prev.filter(i => i.id !== invoiceId));
      }
    } catch (err: any) {
      console.error('Delete invoice error:', err);
      showError('Gagal menghapus faktur.');
    }
  };

  const handleDuplicateInvoice = async (invoiceId: string) => {
    const { data: originalInvoice, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .single();

    if (error || !originalInvoice) {
      showError('Gagal memuat data untuk duplikasi.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, invoice_number, view_count, last_viewed_at, payments, ...newInvoiceData } = originalInvoice;

    const payload = {
      ...newInvoiceData,
      status: 'Draf',
      invoice_date: new Date().toISOString(),
      due_date: null,
      invoice_number: null,
      view_count: 0,
      last_viewed_at: null,
    };

    const { data: newInvoice, error: insertError } = await supabase
      .from('invoices')
      .insert(payload)
      .select()
      .single();

    if (insertError || !newInvoice) {
      showError('Gagal membuat duplikat faktur.');
      return;
    }

    if (originalInvoice.invoice_items && originalInvoice.invoice_items.length > 0) {
      const newItems = originalInvoice.invoice_items.map(({ id: itemId, invoice_id, ...item }: any) => ({
        ...item,
        invoice_id: newInvoice.id,
      }));
      const { error: itemsError } = await supabase.from('invoice_items').insert(newItems);
      if (itemsError) {
        showError('Gagal menduplikasi item faktur.');
        return;
      }
    }

    showSuccess('Faktur berhasil diduplikasi.');
    navigate(`/invoice/edit/${newInvoice.id}`);
  };

  // Statistics calculation
  const stats = useMemo(() => {
    let grandTotalValue = 0;
    let totalLunas = 0;
    let totalTerkirim = 0;
    let totalDraft = 0;
    let totalOverdue = 0;

    invoices.forEach(inv => {
      const val = calculateInvoiceTotal(inv);
      grandTotalValue += val;
      const s = (inv.status || '').toLowerCase();
      if (s === 'lunas') {
        totalLunas++;
      } else if (s === 'terkirim') {
        totalTerkirim++;
        if (inv.due_date && isDateBeforeToday(inv.due_date)) {
          totalOverdue++;
        }
      } else {
        totalDraft++;
      }
    });

    return {
      totalCount: invoices.length,
      grandTotalValue,
      totalLunas,
      totalTerkirim,
      totalDraft,
      totalOverdue
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesSearch = 
        (invoice.invoice_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (invoice.to_client?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      const status = (invoice.status || 'draf').toLowerCase();
      let matchesStatus = true;
      if (statusFilter === 'lunas') matchesStatus = status === 'lunas';
      else if (statusFilter === 'terkirim') matchesStatus = status === 'terkirim';
      else if (statusFilter === 'draf') matchesStatus = status === 'draf' || status === 'draft';
      else if (statusFilter === 'overdue') matchesStatus = status === 'terkirim' && Boolean(invoice.due_date && isDateBeforeToday(invoice.due_date));

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  const filteredTotalValue = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
  }, [filteredInvoices]);

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) return;

    const headers = ["Nomor Faktur", "Klien", "Total Nominal", "Tanggal Dibuat", "Jatuh Tempo", "Status"];
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number || 'N/A',
      `"${inv.to_client}"`,
      calculateInvoiceTotal(inv),
      safeFormat(inv.created_at, 'yyyy-MM-dd'),
      safeFormat(inv.due_date, 'yyyy-MM-dd'),
      inv.status
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Faktur_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const invoiceStatuses = ['Draf', 'Terkirim', 'Lunas', 'Jatuh Tempo'];

  const renderStatusDropdown = (invoice: Invoice) => {
    const s = (invoice.status || 'draf').toLowerCase();
    const isOverdue = s === 'terkirim' && invoice.due_date && isDateBeforeToday(invoice.due_date);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="outline-none group">
            {s === 'lunas' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500/20 transition-colors shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Lunas
                <ChevronDown className="h-3 w-3 opacity-60" />
              </span>
            ) : isOverdue ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/30 group-hover:bg-rose-500/20 transition-colors shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                Jatuh Tempo
                <ChevronDown className="h-3 w-3 opacity-60" />
              </span>
            ) : s === 'terkirim' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-600 dark:text-sky-400 border border-sky-500/30 group-hover:bg-sky-500/20 transition-colors shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                Terkirim
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
          {invoiceStatuses.map(status => (
            <DropdownMenuItem 
              key={status} 
              onClick={() => handleStatusChange(invoice.id, status)} 
              className="text-xs font-medium rounded-lg cursor-pointer py-1.5"
            >
              {invoice.status === status && <Check className="mr-1.5 h-3.5 w-3.5 text-primary" />}
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
      {/* Payment Confirmation Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={closePaymentDialog}>
        <DialogContent className="rounded-2xl border border-border/80 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Konfirmasi Pelunasan Faktur</DialogTitle>
            <DialogDescription className="space-y-1 mt-2 text-sm text-muted-foreground">
              Apakah Anda yakin ingin menandai faktur <strong className="text-foreground font-mono">{paymentDialog.invoice?.invoice_number}</strong> sebagai lunas?
              <br />
              Klien: <strong className="text-foreground">{paymentDialog.invoice?.to_client}</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closePaymentDialog} className="rounded-xl">
              Batal
            </Button>
            <Button onClick={confirmPayment} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-700/30">
              <CheckCircle className="mr-2 h-4 w-4" />
              Tandai Lunas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white p-4 sm:p-7 shadow-xl">
        {/* Ambient Glow Effects */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Manajemen Faktur & Penagihan
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-300">
                {stats.totalCount} Faktur Terbit
              </span>
            </div>
            
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              Daftar Faktur Saya
            </h1>
            
            <p className="text-slate-300/80 text-xs sm:text-sm leading-relaxed max-w-xl font-medium hidden sm:block">
              Kelola penagihan pembayaran, pantau status pelunasan, lacak riwayat lihat klien, dan cetak faktur resmi dengan mudah.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <Button 
              onClick={fetchInvoices} 
              variant="outline" 
              size="sm"
              className="h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-3 text-xs"
              title="Refresh Data Faktur"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-emerald-400", loading && "animate-spin")} />
            </Button>

            {filteredInvoices.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCSV} 
                className="h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95 px-3 text-xs font-semibold"
              >
                <Download className="mr-1.5 h-3.5 w-3.5 text-slate-300" /> Ekspor CSV
              </Button>
            )}

            <Button 
              asChild 
              size="sm" 
              className="h-10 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-950/50 border border-emerald-400/20 transition-all active:scale-95 px-4 text-xs grow sm:grow-0"
            >
              <Link to="/invoice/new">
                <PlusCircle className="mr-1.5 h-4 w-4 stroke-[2.5]" />
                Buat Faktur Baru
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Stat KPI Metric Cards - 2 Columns on Mobile, 4 Columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Faktur */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Faktur</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shadow-2xs">
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">{stats.totalCount}</h3>
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">dokumen</span>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span>Semua histori faktur</span>
          </div>
        </Card>

        {/* Card 2: Nilai Tagihan Total */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Nilai Tagihan</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(stats.grandTotalValue)}
            </h3>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Piutang & lunas</span>
          </div>
        </Card>

        {/* Card 3: Faktur Lunas */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Faktur Lunas</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">{stats.totalLunas}</h3>
            <span className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
              Lunas
            </span>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Kas telah diterima</span>
          </div>
        </Card>

        {/* Card 4: Terkirim / Pending */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending / Tempo</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-2xs">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">{stats.totalTerkirim}</h3>
            <span className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
              {stats.totalOverdue > 0 ? `${stats.totalOverdue} Tempo` : 'Pending'}
            </span>
          </div>
          <div className="mt-2 hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{stats.totalOverdue > 0 ? `${stats.totalOverdue} jatuh tempo` : 'Belum tempo'}</span>
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
                placeholder="Cari nomor faktur atau nama klien..."
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
                { key: 'terkirim', label: 'Terkirim', count: stats.totalTerkirim, badgeColor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
                { key: 'lunas', label: 'Lunas', count: stats.totalLunas, badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
                { key: 'draf', label: 'Draf', count: stats.totalDraft, badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
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
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 border border-border/60 shadow-xs">
                <Receipt className="h-7 w-7 text-muted-foreground/80" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Tidak ada faktur ditemukan</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                {invoices.length === 0 
                  ? 'Belum ada data faktur yang dibuat. Mulai buat tagihan resmi pertama Anda dengan mudah.' 
                  : 'Tidak ada faktur yang sesuai dengan kata kunci pencarian atau filter status yang dipilih.'
                }
              </p>
              {invoices.length === 0 ? (
                <Button asChild className="mt-5 rounded-xl bg-primary text-primary-foreground font-semibold px-5" size="lg">
                  <Link to="/invoice/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Buat Faktur Pertama
                  </Link>
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} 
                  className="mt-4 rounded-xl text-xs font-semibold"
                >
                  Reset Filter & Pencarian
                </Button>
              )}
            </div>
          ) : (
            <div>
              {/* ========================================================================= */}
              {/* 1. MOBILE RESPONSIVE CARD LIST VIEW (md:hidden) */}
              {/* ========================================================================= */}
              <div className="block md:hidden divide-y divide-border/60">
                {filteredInvoices.map((invoice) => {
                  const totalVal = calculateInvoiceTotal(invoice);
                  const clientName = capitalizeName(invoice.to_client);
                  const itemCount = invoice.invoice_items?.length || 0;
                  const isOverdue = invoice.status !== 'Lunas' && invoice.due_date && isDateBeforeToday(invoice.due_date);

                  return (
                    <div key={invoice.id} className="p-3.5 space-y-3 hover:bg-muted/20 transition-colors">
                      {/* Top Row: Nomor & Status */}
                      <div className="flex items-center justify-between">
                        <Link 
                          to={`/invoice/${invoice.id}`}
                          className="font-mono font-bold text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20"
                        >
                          {invoice.invoice_number || 'N/A'}
                        </Link>
                        <div>{renderStatusDropdown(invoice)}</div>
                      </div>

                      {/* Middle Row: Client Info */}
                      <Link to={`/invoice/${invoice.id}`} className="flex items-center gap-3 group block">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-xs shrink-0 border border-emerald-500/30 shadow-2xs">
                          {clientName.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                            {clientName}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span>{itemCount > 0 ? `${itemCount} item tagihan` : 'Faktur tagihan'}</span>
                            <span>•</span>
                            <span className={cn(isOverdue && "text-rose-600 dark:text-rose-400 font-bold")}>
                              {isOverdue ? 'Jatuh Tempo: ' : 'Tempo: '}{safeFormat(invoice.due_date, 'd MMM')}
                            </span>
                          </div>
                        </div>
                      </Link>

                      {/* Bottom Row: Total Nominal & Quick Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Total Tagihan</span>
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(totalVal)}
                          </span>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-1">
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                            <Link to={`/invoice/${invoice.id}`} title="Lihat">
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>

                          {invoice.status !== 'Lunas' ? (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => showPaymentDialog(invoice)}
                              className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              title="Tandai Lunas"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          ) : (
                            <div className="w-8 h-8 flex items-center justify-center text-emerald-500/40">
                              <Check className="h-4 w-4" />
                            </div>
                          )}

                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground">
                            <Link to={`/invoice/edit/${invoice.id}`} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDuplicateInvoice(invoice.id)}
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
                            <AlertDialogContent className="rounded-2xl border border-border/80">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-base font-bold">Hapus Faktur?</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-muted-foreground">
                                  Hapus permanen faktur {invoice.invoice_number} untuk {clientName}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl text-xs">Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteInvoice(invoice.id)} className="rounded-xl bg-destructive text-xs">Hapus</AlertDialogAction>
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
                      <TableHead className="w-[140px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nomor Faktur</TableHead>
                      <TableHead className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nama Klien</TableHead>
                      <TableHead className="w-[190px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Nominal Total</TableHead>
                      <TableHead className="w-[140px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                      <TableHead className="w-[110px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Dilihat</TableHead>
                      <TableHead className="w-[150px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Jatuh Tempo</TableHead>
                      <TableHead className="w-[190px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {filteredInvoices.map((invoice) => {
                      const totalVal = calculateInvoiceTotal(invoice);
                      const clientName = capitalizeName(invoice.to_client);
                      const itemCount = invoice.invoice_items?.length || 0;
                      const isOverdue = invoice.status !== 'Lunas' && invoice.due_date && isDateBeforeToday(invoice.due_date);

                      return (
                        <TableRow key={invoice.id} className="hover:bg-muted/30 transition-colors group">
                          {/* Nomor Faktur */}
                          <TableCell className="px-5 py-4">
                            <Link 
                              to={`/invoice/${invoice.id}`}
                              className="inline-flex items-center gap-1.5 font-mono font-bold text-xs text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/20 transition-all hover:scale-105"
                            >
                              <span>{invoice.invoice_number || 'N/A'}</span>
                            </Link>
                          </TableCell>
                          
                          {/* Nama Klien */}
                          <TableCell className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-xs shrink-0 border border-emerald-500/30 shadow-2xs">
                                {clientName.substring(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <Link 
                                  to={`/invoice/${invoice.id}`}
                                  className="font-bold text-sm text-foreground hover:text-primary transition-colors block truncate max-w-xs"
                                >
                                  {clientName}
                                </Link>
                                <span className="text-[11px] text-muted-foreground block truncate">
                                  {itemCount > 0 ? `${itemCount} item tagihan` : 'Faktur operasional'}
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

                          {/* Status Dropdown / Badge */}
                          <TableCell className="px-5 py-4 text-center">
                            <div className="flex justify-center">
                              {renderStatusDropdown(invoice)}
                            </div>
                          </TableCell>

                          {/* Dilihat Klien Badge */}
                          <TableCell className="px-5 py-4 text-center">
                            {invoice.view_count > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 cursor-default">
                                    <Eye className="h-3 w-3" /> {invoice.view_count}x
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="rounded-xl text-xs">
                                  Terakhir dilihat: {safeFormatDistance(invoice.last_viewed_at)}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground/60 text-xs font-medium">-</span>
                            )}
                          </TableCell>

                          {/* Jatuh Tempo */}
                          <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                            <div className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-medium",
                              isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground"
                            )}>
                              {isOverdue ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0 animate-pulse" />
                              ) : (
                                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                              )}
                              <span>{safeFormat(invoice.due_date, 'd MMM yyyy')}</span>
                            </div>
                          </TableCell>

                          {/* Action Buttons Group */}
                          <TableCell className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Button */}
                              <Button 
                                asChild 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" 
                                title="Lihat Detail Faktur"
                              >
                                <Link to={`/invoice/${invoice.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>

                              {/* Mark Paid Button (if not Lunas) */}
                              {invoice.status !== 'Lunas' ? (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => showPaymentDialog(invoice)}
                                  className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                                  title="Tandai Sebagai Lunas"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              ) : (
                                <div className="w-8 h-8 shrink-0 flex items-center justify-center text-emerald-500/40" title="Sudah Lunas">
                                  <Check className="h-4 w-4" />
                                </div>
                              )}

                              {/* Edit Button */}
                              <Button 
                                asChild 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" 
                                title="Edit Faktur"
                              >
                                <Link to={`/invoice/edit/${invoice.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>

                              {/* Duplicate Button */}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDuplicateInvoice(invoice.id)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                title="Duplikat Faktur Ini"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>

                              {/* Delete Alert Dialog */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors" 
                                    title="Hapus Faktur"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl border border-border/80 shadow-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-lg font-bold">Hapus Faktur?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-sm text-muted-foreground">
                                      Tindakan ini tidak dapat dibatalkan. Faktur <span className="font-bold text-foreground">{invoice.invoice_number}</span> untuk klien <span className="font-bold text-foreground">{clientName}</span> akan dihapus permanen.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteInvoice(invoice.id)} 
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-border/70 bg-muted/15 text-xs text-muted-foreground font-medium">
                <div>
                  Menampilkan <span className="font-bold text-foreground">{filteredInvoices.length}</span> dari <span className="font-bold text-foreground">{invoices.length}</span> total faktur
                </div>
                <div className="flex items-center gap-2">
                  <span>Subtotal Terfilter:</span>
                  <span className="font-black text-foreground text-sm">{formatCurrency(filteredTotalValue)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceList;