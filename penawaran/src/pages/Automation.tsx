import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PlusCircle, Pencil, Trash2, Wand2, Zap, 
  CheckCircle2, AlertCircle, FileText, Receipt, RefreshCw, FolderPlus, BellRing
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import WorkflowForm from '@/components/WorkflowForm';
import { cn } from '@/lib/utils';

export type Workflow = {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  is_active: boolean;
};

const triggerLabels: { [key: string]: { label: string; icon: any; color: string } } = {
  'quote_accepted': { label: 'Penawaran Diterima', icon: FileText, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  'quote_expiring_3_days': { label: 'Penawaran Akan Kedaluwarsa (3 Hari)', icon: AlertCircle, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  'invoice_overdue': { label: 'Faktur Jatuh Tempo', icon: AlertCircle, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  'payment_received': { label: 'Pembayaran Diterima', icon: CheckCircle2, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20' },
};

const actionLabels: { [key: string]: { label: string; icon: any; color: string } } = {
  'create_project': { label: 'Buat Proyek Baru Otomatis', icon: FolderPlus, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  'send_internal_notification': { label: 'Kirim Notifikasi Internal', icon: BellRing, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
};

const Automation = () => {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const fetchWorkflows = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Gagal memuat alur kerja.');
    } else {
      setWorkflows(data as Workflow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkflows();
  }, [user]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = workflows.length;
    const active = workflows.filter(w => w.is_active).length;
    const quoteTriggers = workflows.filter(w => (w.trigger_type || '').startsWith('quote')).length;
    const invoiceTriggers = workflows.filter(w => (w.trigger_type || '').startsWith('invoice') || (w.trigger_type || '').startsWith('payment')).length;

    return { total, active, quoteTriggers, invoiceTriggers };
  }, [workflows]);

  const handleToggleActive = async (workflow: Workflow) => {
    const newStatus = !workflow.is_active;
    
    // Optimistic UI update
    setWorkflows(prev => prev.map(w => w.id === workflow.id ? { ...w, is_active: newStatus } : w));

    const { error } = await supabase
      .from('workflows')
      .update({ is_active: newStatus })
      .match({ id: workflow.id });

    if (error) {
      showError('Gagal mengubah status.');
      fetchWorkflows(); // revert
    } else {
      showSuccess(`Alur kerja ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    const { error } = await supabase.from('workflows').delete().match({ id: workflowId });
    if (error) {
      showError('Gagal menghapus alur kerja.');
    } else {
      showSuccess('Alur kerja berhasil dihapus.');
      setWorkflows(workflows.filter(w => w.id !== workflowId));
    }
  };

  const handleOpenForm = (workflow: Workflow | null = null) => {
    setSelectedWorkflow(workflow);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    setIsFormOpen(false);
    fetchWorkflows();
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6 px-3 py-3 sm:px-6 lg:px-8 pb-28 sm:pb-8">
      {/* ========================================================================= */}
      {/* HERO COMMAND BANNER */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/70 text-white p-4 sm:p-7 shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 border border-teal-500/30 px-2.5 py-0.5 text-[11px] font-bold text-teal-400 backdrop-blur-md">
                <Zap className="h-3.5 w-3.5 animate-pulse" />
                Otomatisasi & Webhook Alur Kerja
              </div>
              <span className="rounded-full bg-slate-800/90 border border-border/70 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-300">
                {stats.active} Aktif dari {stats.total} Aturan
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Otomatisasi Alur Kerja
            </h1>

            <p className="text-slate-300/80 text-xs sm:text-sm leading-relaxed hidden sm:block">
              Biarkan sistem cerdas bekerja untuk Anda. Atur pemicu (trigger) otomatis saat penawaran disetujui, faktur jatuh tempo, atau pembayaran diterima.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button 
              onClick={fetchWorkflows} 
              variant="outline" 
              size="icon"
              className="h-10 w-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-border/80 shadow-xs active:scale-95 shrink-0"
              title="Perbarui Data"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-teal-400", loading && "animate-spin")} />
            </Button>

            <Button 
              size="sm"
              onClick={() => handleOpenForm()}
              className="h-10 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-4 text-xs shadow-md active:scale-95 gap-1.5 grow sm:grow-0"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Buat Alur Kerja
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 STAT KPI METRIC CARDS - 2 COLUMNS ON MOBILE */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Alur Kerja */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Aturan</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400">
              <Wand2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {stats.total} <span className="text-xs font-normal text-muted-foreground">Alur Kerja</span>
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 hidden sm:flex items-center justify-between">
            <span>Daftar otomasi tersimpan</span>
          </div>
        </Card>

        {/* Card 2: Alur Kerja Aktif */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Status Aktif</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {stats.active} <span className="text-xs font-normal text-muted-foreground">Siap Eksekusi</span>
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 hidden sm:flex items-center justify-between">
            <span>Berjalan di latar belakang</span>
          </div>
        </Card>

        {/* Card 3: Pemicu Penawaran */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Pemicu Surat</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {stats.quoteTriggers} <span className="text-xs font-normal text-muted-foreground">Pemicu</span>
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 hidden sm:flex items-center justify-between">
            <span>Terkait penawaran harga</span>
          </div>
        </Card>

        {/* Card 4: Pemicu Faktur & Kas */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Pemicu Faktur</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {stats.invoiceTriggers} <span className="text-xs font-normal text-muted-foreground">Pemicu</span>
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 hidden sm:flex items-center justify-between">
            <span>Terkait invoice & kas</span>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* MAIN WORKFLOW LIST & TABLE */}
      {/* ========================================================================= */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-teal-500" />
                Daftar Aturan Otomatisasi
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Konfigurasi pemicu logika kondisional dan aksi instan yang dijalankan secara otomatis.
              </CardDescription>
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
          ) : workflows.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500 mb-3">
                <Wand2 className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-base text-foreground">Belum Ada Alur Kerja</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                Buat alur kerja otomatis pertama Anda untuk menghemat waktu operasional saat penawaran atau invoice terbit.
              </p>
              <Button onClick={() => handleOpenForm()} className="rounded-xl font-bold text-xs h-10 px-4 gap-1.5 bg-teal-600 hover:bg-teal-500 text-white">
                <PlusCircle className="h-4 w-4" /> Buat Alur Kerja Sekarang
              </Button>
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (block on mobile, hidden on desktop) */}
              <div className="block sm:hidden divide-y divide-border/60">
                {workflows.map((workflow) => {
                  const triggerInfo = triggerLabels[workflow.trigger_type] || { label: workflow.trigger_type, icon: AlertCircle, color: 'text-muted-foreground bg-muted border-border' };
                  const actionInfo = actionLabels[workflow.action_type] || { label: workflow.action_type, icon: Wand2, color: 'text-muted-foreground bg-muted border-border' };
                  const TriggerIcon = triggerInfo.icon;
                  const ActionIcon = actionInfo.icon;

                  return (
                    <div key={workflow.id} className="p-4 space-y-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-foreground truncate">
                          {workflow.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            workflow.is_active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"
                          )}>
                            {workflow.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                          <Switch
                            checked={workflow.is_active}
                            onCheckedChange={() => handleToggleActive(workflow)}
                          />
                        </div>
                      </div>

                      {/* Trigger & Action Flow */}
                      <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border/60 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase w-10 shrink-0">JIKA:</span>
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold truncate", triggerInfo.color)}>
                            <TriggerIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{triggerInfo.label}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase w-10 shrink-0">MAKA:</span>
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold truncate", actionInfo.color)}>
                            <ActionIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{actionInfo.label}</span>
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleOpenForm(workflow)}
                          className="h-8 rounded-lg text-xs font-semibold gap-1 px-3 border-border/80"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs text-rose-600 hover:bg-rose-500/10 px-2.5">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl max-w-sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Alur Kerja?</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs">
                                Aturan otomatisasi ini akan dihapus secara permanen.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl text-xs">Batal</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteWorkflow(workflow.id)} 
                                className="rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (hidden on mobile, table on desktop) */}
              <div className="hidden sm:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <Table className="w-full min-w-[640px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border/80">
                      <TableHead className="font-bold text-xs uppercase text-muted-foreground pl-6">Nama Alur Kerja</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-muted-foreground">Pemicu (JIKA)</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-muted-foreground">Aksi (MAKA)</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-muted-foreground text-center">Status</TableHead>
                      <TableHead className="text-right font-bold text-xs uppercase text-muted-foreground pr-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {workflows.map((workflow) => {
                      const triggerInfo = triggerLabels[workflow.trigger_type] || { label: workflow.trigger_type, icon: AlertCircle, color: 'text-muted-foreground bg-muted border-border' };
                      const actionInfo = actionLabels[workflow.action_type] || { label: workflow.action_type, icon: Wand2, color: 'text-muted-foreground bg-muted border-border' };
                      const TriggerIcon = triggerInfo.icon;
                      const ActionIcon = actionInfo.icon;

                      return (
                        <TableRow key={workflow.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-bold text-sm text-foreground pl-6 py-4">
                            {workflow.name}
                          </TableCell>
                          
                          <TableCell className="py-4">
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold", triggerInfo.color)}>
                              <TriggerIcon className="h-3.5 w-3.5 shrink-0" />
                              <span>{triggerInfo.label}</span>
                            </span>
                          </TableCell>

                          <TableCell className="py-4">
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold", actionInfo.color)}>
                              <ActionIcon className="h-3.5 w-3.5 shrink-0" />
                              <span>{actionInfo.label}</span>
                            </span>
                          </TableCell>

                          <TableCell className="py-4 text-center">
                            <div className="inline-flex items-center gap-2">
                              <Switch
                                checked={workflow.is_active}
                                onCheckedChange={() => handleToggleActive(workflow)}
                              />
                              <span className={cn(
                                "text-[11px] font-bold",
                                workflow.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                              )}>
                                {workflow.is_active ? 'Aktif' : 'Off'}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-right pr-6 py-4 space-x-1.5">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleOpenForm(workflow)}
                              className="h-8 rounded-lg text-xs font-semibold border-border/80"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs text-rose-600 hover:bg-rose-500/10">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl max-w-sm">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Alur Kerja?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs">
                                    Aturan otomatisasi ini akan dihapus secara permanen.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl text-xs">Batal</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteWorkflow(workflow.id)} 
                                    className="rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <WorkflowForm isOpen={isFormOpen} setIsOpen={setIsFormOpen} workflow={selectedWorkflow} onSave={handleFormSave} />
    </div>
  );
};

export default Automation;