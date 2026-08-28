import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PlusCircle, Repeat, PlayCircle, PauseCircle, Trash2, 
  Search, Calendar, Clock, Building2, Sparkles, CheckCircle2, 
  AlertCircle, ArrowUpRight, Play, Pause, Layers
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import RecurringInvoiceForm from '@/components/RecurringInvoiceForm';
import { formatCurrency, safeFormat, cn } from '@/lib/utils';
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

type RecurringProfile = {
  id: string;
  frequency: string;
  next_run_date: string;
  start_date?: string;
  status: string;
  template_data: any;
  clients: { name: string; phone?: string; email?: string } | null;
};

const RecurringInvoiceList = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<RecurringProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  const fetchProfiles = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('recurring_invoices')
      .select('*, clients(name, phone, email)')
      .eq('user_id', user.id)
      .order('next_run_date', { ascending: true });

    if (error) {
      console.error(error);
      showError('Gagal memuat daftar faktur berulang.');
    } else {
      setProfiles((data || []) as RecurringProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, [user]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('recurring_invoices').update({ status: newStatus }).eq('id', id);
    if (error) {
      showError('Gagal mengubah status');
    } else {
      showSuccess(`Jadwal berhasil ${newStatus === 'active' ? 'diaktifkan' : 'dijeda'}`);
      fetchProfiles();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('recurring_invoices').delete().eq('id', id);
    if (error) {
      showError('Gagal menghapus jadwal');
    } else {
      showSuccess('Jadwal faktur berulang berhasil dihapus');
      fetchProfiles();
    }
  };

  const handleTriggerNow = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('process-recurring-invoices');
      if (error) {
        showError('Gagal memproses: ' + error.message);
      } else {
        showSuccess('Proses faktur berulang selesai dijalankan!');
        fetchProfiles();
      }
    } catch (err: any) {
      showError('Gagal menjalankan proses otomatis: ' + (err.message || 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const totalCount = profiles.length;
    const activeCount = profiles.filter(p => p.status === 'active').length;
    const pausedCount = profiles.filter(p => p.status === 'paused').length;
    
    // Monthly estimated recurring value
    const estimatedMonthly = profiles
      .filter(p => p.status === 'active')
      .reduce((sum, p) => {
        const itemPrice = p.template_data?.items?.[0]?.unit_price || 0;
        const qty = p.template_data?.items?.[0]?.quantity || 1;
        const total = itemPrice * qty;
        if (p.frequency === 'weekly') return sum + total * 4;
        if (p.frequency === 'yearly') return sum + Math.round(total / 12);
        return sum + total; // default monthly
      }, 0);

    return { totalCount, activeCount, pausedCount, estimatedMonthly };
  }, [profiles]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = 
        (p.clients?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.template_data?.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.template_data?.items?.[0]?.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'active' && p.status === 'active') ||
        (statusFilter === 'paused' && p.status === 'paused');

      return matchesSearch && matchesStatus;
    });
  }, [profiles, searchQuery, statusFilter]);

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'weekly': return 'Mingguan';
      case 'monthly': return 'Bulanan';
      case 'yearly': return 'Tahunan';
      default: return freq;
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-6xl space-y-6">
      
      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card/90 to-card/60 p-6 sm:p-8 backdrop-blur-md shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold shadow-2xs">
              <Repeat className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Otomatisasi Tagihan Rutin</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Faktur Berulang <span className="text-primary">(Langganan)</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl font-medium">
              Jadwalkan pembuatan invoice otomatis untuk klien langganan, kontrak berkala, dan maintenance rutin tanpa perlu input berulang.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button 
              variant="outline" 
              onClick={handleTriggerNow} 
              disabled={isProcessing || profiles.length === 0}
              className="rounded-xl h-11 px-4 text-xs font-bold border-border/80 hover:bg-muted shadow-2xs"
              title="Jalankan pengecekan dan terbitkan invoice sekarang"
            >
              <Play className={cn("mr-1.5 h-4 w-4 text-primary", isProcessing && "animate-spin")} />
              {isProcessing ? 'Memproses...' : 'Proses Sekarang'}
            </Button>
            <Button 
              onClick={() => setIsFormOpen(true)}
              className="rounded-xl h-11 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
            >
              <PlusCircle className="mr-1.5 h-4 w-4" />
              Buat Jadwal Baru
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-3xl border-border/70 bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Jadwal</span>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-foreground tabular-nums">{stats.totalCount}</h3>
            <span className="text-[11px] font-semibold text-muted-foreground">profil</span>
          </div>
        </Card>

        <Card className="rounded-3xl border-border/70 bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Jadwal Aktif</span>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{stats.activeCount}</h3>
            <span className="text-[11px] font-semibold text-muted-foreground">berjalan</span>
          </div>
        </Card>

        <Card className="rounded-3xl border-border/70 bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Jadwal Dijeda</span>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{stats.pausedCount}</h3>
            <span className="text-[11px] font-semibold text-muted-foreground">nonaktif</span>
          </div>
        </Card>

        <Card className="rounded-3xl border-border/70 bg-card/60 backdrop-blur-md p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Estimasi Rutin / Bln</span>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-lg sm:text-xl font-black text-primary tabular-nums">{formatCurrency(stats.estimatedMonthly)}</h3>
          </div>
        </Card>
      </div>

      {/* Toolbar Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Cari klien atau judul jadwal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 rounded-2xl text-xs bg-card/60 border-border/80 focus-visible:ring-primary font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Semua Status' },
            { id: 'active', label: 'Aktif' },
            { id: 'paused', label: 'Dijeda' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border",
                statusFilter === tab.id
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/30 hover:bg-muted text-muted-foreground border-border/70"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : filteredProfiles.length === 0 ? (
        /* Styled Empty State */
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/40 backdrop-blur-md p-10 sm:p-14 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-inner">
            <Repeat className="h-8 w-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-black text-foreground">
              {searchQuery || statusFilter !== 'all' ? 'Tidak ada jadwal yang sesuai filter' : 'Belum Ada Jadwal Faktur Berulang'}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              {searchQuery || statusFilter !== 'all'
                ? 'Coba ubah kata kunci pencarian atau ganti status filter.'
                : 'Buat tagihan berkala otomatis bulanan, mingguan, atau tahunan untuk klien kontrak tetap Anda.'}
            </p>
          </div>
          {!searchQuery && statusFilter === 'all' && (
            <Button 
              onClick={() => setIsFormOpen(true)}
              className="rounded-2xl h-11 px-6 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-md mt-2"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Buat Jadwal Pertama
            </Button>
          )}
        </div>
      ) : (
        /* Profiles Cards List */
        <div className="space-y-3">
          {filteredProfiles.map((p) => {
            const item = p.template_data?.items?.[0];
            const amount = (item?.unit_price || 0) * (item?.quantity || 1);
            const isActive = p.status === 'active';

            return (
              <div
                key={p.id}
                className={cn(
                  "group relative rounded-2xl border p-4 sm:p-5 backdrop-blur-md transition-all duration-200 hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4",
                  isActive 
                    ? "bg-card/70 border-border/80 hover:border-primary/40" 
                    : "bg-muted/15 border-border/50 opacity-80 hover:opacity-100"
                )}
              >
                {/* Left Info: Client & Title */}
                <div className="flex items-start gap-3.5">
                  <div className={cn(
                    "h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-2xs",
                    isActive ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/50 border-border text-muted-foreground"
                  )}>
                    <Repeat className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm sm:text-base font-black text-foreground group-hover:text-primary transition-colors">
                        {p.clients?.name || 'Klien Tidak Diketahui'}
                      </h4>
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-bold uppercase tracking-wider rounded-lg px-2",
                        isActive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      )}>
                        {isActive ? 'Aktif' : 'Dijeda'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-border/60 rounded-lg">
                        {getFrequencyLabel(p.frequency)}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {p.template_data?.title || item?.description || 'Tagihan Berulang'}
                    </p>
                  </div>
                </div>

                {/* Right Info: Financial & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-4 sm:gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-border/60">
                  {/* Next Execution */}
                  <div className="text-left md:text-right space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center md:justify-end gap-1">
                      <Calendar className="h-3 w-3 text-primary" />
                      Eksekusi Berikutnya
                    </span>
                    <p className="text-xs font-bold text-foreground tabular-nums">
                      {safeFormat(p.next_run_date, 'd MMMM yyyy')}
                    </p>
                  </div>

                  {/* Nominal */}
                  <div className="text-right space-y-0.5 min-w-28">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Nominal / Tagihan
                    </span>
                    <h5 className="text-sm sm:text-base font-black text-primary tabular-nums">
                      {formatCurrency(amount)}
                    </h5>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleStatus(p.id, p.status)}
                      className={cn(
                        "h-9 px-3 rounded-xl text-xs font-bold border-border/80 transition-all",
                        isActive ? "hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30" : "hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30"
                      )}
                      title={isActive ? "Jeda Jadwal" : "Aktifkan Jadwal"}
                    >
                      {isActive ? (
                        <>
                          <Pause className="mr-1 h-3.5 w-3.5 text-amber-500" /> Jeda
                        </>
                      ) : (
                        <>
                          <Play className="mr-1 h-3.5 w-3.5 text-emerald-500" /> Aktifkan
                        </>
                      )}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Hapus Jadwal"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl p-6">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-base font-bold">Hapus Jadwal Faktur Berulang?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs text-muted-foreground">
                            Jadwal tagihan otomatis untuk <strong>{p.clients?.name}</strong> akan dihentikan dan dihapus secara permanen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2 pt-2">
                          <AlertDialogCancel className="rounded-xl text-xs font-semibold">Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(p.id)}
                            className="rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Hapus Jadwal
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
      )}

      {/* Form Dialog Modal */}
      <RecurringInvoiceForm 
        isOpen={isFormOpen} 
        setIsOpen={setIsFormOpen} 
        onSave={fetchProfiles} 
      />
    </div>
  );
};

export default RecurringInvoiceList;