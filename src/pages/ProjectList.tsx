import { useCallback, useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PlusCircle, Pencil, Trash2, FolderKanban, LayoutGrid, List, Clock, 
  DollarSign, Receipt, TrendingUp, Wallet, CheckCircle2, Search, X, 
  RefreshCw, Building2, Calendar, CheckSquare, Eye
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
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import ProjectForm, { Project } from '@/components/ProjectForm';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import ProjectKanbanBoard from '@/components/ProjectKanbanBoard';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { calculateItemTotal, calculateSubtotal, calculateTotal, cn, formatCurrency, safeFormat } from '@/lib/utils';

type ProjectWithClient = Project & {
  clients: { name: string } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProjectStats = {
  revenue: number;
  cost: number;
  expenses: number;
  profit: number;
  margin: number;
  taskTotal: number;
  taskDone: number;
  progress: number;
  invoiceCount: number;
  quoteCount: number;
};

const EMPTY_PROJECT_STATS: ProjectStats = {
  revenue: 0,
  cost: 0,
  expenses: 0,
  profit: 0,
  margin: 0,
  taskTotal: 0,
  taskDone: 0,
  progress: 0,
  invoiceCount: 0,
  quoteCount: 0,
};

const ProjectList = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({});
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'list' | 'kanban'>('timeline');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Ongoing' | 'Completed' | 'Archived'>('all');

  const getStats = (projectId: string) => projectStats[projectId] || EMPTY_PROJECT_STATS;

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [projectsRes, quotesRes, invoicesRes, expensesRes, tasksRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('quotes')
        .select('id, project_id, status, discount_amount, tax_amount, quote_items(quantity, unit_price, cost_price)')
        .eq('user_id', user.id)
        .not('project_id', 'is', null),
      supabase
        .from('invoices')
        .select('id, project_id, status, discount_amount, tax_amount, invoice_items(quantity, unit_price)')
        .eq('user_id', user.id)
        .not('project_id', 'is', null),
      supabase
        .from('expenses')
        .select('id, project_id, amount')
        .eq('user_id', user.id)
        .not('project_id', 'is', null),
      supabase
        .from('project_tasks')
        .select('id, project_id, is_completed')
        .eq('user_id', user.id),
    ]);

    if (projectsRes.error) {
      showError('Gagal memuat daftar proyek.');
    } else {
      const projectRows = projectsRes.data as ProjectWithClient[];
      const stats = projectRows.reduce<Record<string, ProjectStats>>((acc, project) => {
        acc[project.id] = { ...EMPTY_PROJECT_STATS };
        return acc;
      }, {});

      const ensureStats = (projectId: string | null) => {
        if (!projectId) return null;
        stats[projectId] ||= { ...EMPTY_PROJECT_STATS };
        return stats[projectId];
      };

      if (quotesRes.data) {
        quotesRes.data.forEach((quote) => {
          const current = ensureStats(quote.project_id);
          if (!current) return;
          current.quoteCount += 1;
          current.cost += (quote.quote_items || []).reduce(
            (sum, item) => sum + calculateItemTotal(item.quantity, item.cost_price || 0),
            0
          );
          if (quote.status === 'Diterima' || quote.status === 'accepted') {
            const subtotal = (quote.quote_items || []).reduce(
              (sum, item) => sum + calculateItemTotal(item.quantity, item.unit_price || 0),
              0
            );
            const quoteTotal = calculateTotal(subtotal, quote.discount_amount || 0, quote.tax_amount || 0);
            if (current.revenue === 0) {
              current.revenue += quoteTotal;
            }
          }
        });
      }

      if (invoicesRes.data) {
        invoicesRes.data.forEach((invoice) => {
          const current = ensureStats(invoice.project_id);
          if (!current) return;
          current.invoiceCount += 1;
          const subtotal = calculateSubtotal(invoice.invoice_items || []);
          const invTotal = calculateTotal(subtotal, invoice.discount_amount || 0, invoice.tax_amount || 0);
          if (invoice.status === 'Lunas' || current.revenue === 0) {
            current.revenue = invTotal;
          }
        });
      }

      if (expensesRes.data) {
        expensesRes.data.forEach((expense) => {
          const current = ensureStats(expense.project_id);
          if (!current) return;
          current.expenses += expense.amount || 0;
        });
      }

      if (tasksRes.data) {
        tasksRes.data.forEach((task) => {
          const current = ensureStats(task.project_id);
          if (!current) return;
          current.taskTotal += 1;
          if (task.is_completed) current.taskDone += 1;
        });
      }

      Object.values(stats).forEach((stat) => {
        stat.profit = stat.revenue - stat.cost - stat.expenses;
        stat.margin = stat.revenue > 0 ? (stat.profit / stat.revenue) * 100 : 0;
        stat.progress = stat.taskTotal > 0 ? (stat.taskDone / stat.taskTotal) * 100 : 0;
      });

      setProjects(projectRows);
      setProjectStats(stats);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDeleteProject = async (projectId: string) => {
    const { error } = await supabase.from('projects').delete().match({ id: projectId });
    if (error) {
      showError('Gagal menghapus proyek.');
    } else {
      showSuccess('Proyek berhasil dihapus.');
      setProjects(projects.filter(p => p.id !== projectId));
    }
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
    const { error } = await supabase
      .from('projects')
      .update({ status: newStatus })
      .eq('id', projectId);
    if (error) {
      showError('Gagal memperbarui status proyek.');
      fetchProjects(); 
    } else {
      showSuccess(`Status proyek diperbarui ke: ${newStatus === 'Ongoing' ? 'Sedang Berjalan' : newStatus === 'Completed' ? 'Selesai' : 'Diarsipkan'}`);
    }
  };

  const handleOpenForm = (project: Project | null = null) => {
    setSelectedProject(project);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    setIsFormOpen(false);
    fetchProjects();
  };

  const summary = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        const stats = getStats(project.id);
        acc.revenue += stats.revenue;
        acc.cost += stats.cost + stats.expenses;
        acc.profit += stats.profit;
        if (project.status === 'Ongoing') acc.active += 1;
        if (project.status === 'Completed') acc.completed += 1;
        return acc;
      },
      { active: 0, completed: 0, revenue: 0, cost: 0, profit: 0, total: projects.length }
    );
  }, [projects, projectStats]);

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        project.name.toLowerCase().includes(search) ||
        (project.clients?.name && project.clients.name.toLowerCase().includes(search));
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  const getProjectStatusBadge = (statusStr: string) => {
    if (statusStr === 'Ongoing') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Sedang Berjalan
        </span>
      );
    }
    if (statusStr === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Selesai
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-500/25 shadow-2xs">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Diarsipkan
      </span>
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/80 text-white p-6 sm:p-8 shadow-2xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Manajemen Proyek & Analisis Laba
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                {summary.total} Proyek Terdaftar
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Proyek Saya
            </h1>
            <p className="text-slate-300/90 text-sm leading-relaxed max-w-xl">
              Pantau progres tugas, lacak pendapatan vs biaya pengeluaran, dan optimalkan profitabilitas proyek Anda secara real-time.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <Button 
              onClick={fetchProjects} 
              variant="outline" 
              size="lg"
              className="h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95"
              title="Refresh Data Proyek"
            >
              <RefreshCw className={cn("h-4 w-4 text-amber-400", loading && "animate-spin")} />
            </Button>
            <div className="flex items-center bg-slate-900/80 border border-slate-700/80 rounded-xl p-1 shadow-md">
              <button onClick={() => setViewMode('timeline')} className={cn("p-2 rounded-lg text-xs font-semibold transition-all", viewMode === 'timeline' ? "bg-amber-500/20 text-amber-300 shadow-xs" : "text-slate-400 hover:text-white")}>
                <Clock className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-lg text-xs font-semibold transition-all", viewMode === 'list' ? "bg-amber-500/20 text-amber-300 shadow-xs" : "text-slate-400 hover:text-white")}>
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('kanban')} className={cn("p-2 rounded-lg text-xs font-semibold transition-all", viewMode === 'kanban' ? "bg-amber-500/20 text-amber-300 shadow-xs" : "text-slate-400 hover:text-white")}>
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={() => handleOpenForm()} size="lg" className="h-11 rounded-xl bg-gradient-to-r from-amber-600 via-emerald-600 to-amber-700 hover:from-amber-500 hover:to-emerald-500 text-white font-bold shadow-lg shadow-amber-950/50 hover:shadow-amber-900/60 border border-amber-400/20 transition-all active:scale-95 px-5">
              <PlusCircle className="mr-2 h-4 w-4 stroke-[2.5]" />
              Buat Proyek Baru
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Proyek Aktif</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform shadow-2xs">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-3xl font-extrabold tracking-tight text-foreground">{summary.active}</h3>
            <span className="text-xs font-semibold text-muted-foreground">dari {summary.total} total</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{summary.completed} proyek telah selesai</span>
          </div>
        </Card>
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pendapatan Proyek</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform shadow-2xs">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-foreground truncate">{formatCurrency(summary.revenue)}</h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span>Dari invoice & penawaran diterima</span>
          </div>
        </Card>
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Biaya & HPP</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform shadow-2xs">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-foreground truncate">{formatCurrency(summary.cost)}</h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>Biaya modal + pengeluaran proyek</span>
          </div>
        </Card>
        <Card className={cn("relative overflow-hidden rounded-2xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group", summary.profit >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5")}>
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-bold uppercase tracking-wider", summary.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>Laba Bersih Proyek</p>
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shadow-2xs", summary.profit >= 0 ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400")}>
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={cn("text-2xl font-black tracking-tight truncate", summary.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{formatCurrency(summary.profit)}</h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold border-t border-border/60 pt-2.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", summary.profit >= 0 ? "bg-emerald-500" : "bg-rose-500")} />
            <span className={summary.profit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
              {summary.revenue > 0 ? `${((summary.profit / summary.revenue) * 100).toFixed(1)}% Margin Profit Bersih` : 'Estimasi laba proyek'}
            </span>
          </div>
        </Card>
      </div>
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input placeholder="Cari nama proyek atau klien..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 pl-10 pr-9 rounded-xl bg-background border-border/80 focus-visible:ring-primary/20 text-xs sm:text-sm" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 self-start md:self-auto overflow-x-auto max-w-full">
              {[
                { key: 'all', label: 'Semua', count: summary.total },
                { key: 'Ongoing', label: 'Berjalan', count: summary.active, badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
                { key: 'Completed', label: 'Selesai', count: summary.completed, badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
              ].map(tab => {
                const isActive = statusFilter === tab.key;
                return (
                  <button key={tab.key} onClick={() => setStatusFilter(tab.key as any)} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap select-none", isActive ? "bg-background text-foreground shadow-xs border border-border/70" : "text-muted-foreground hover:text-foreground hover:bg-background/40")}>
                    <span>{tab.label}</span>
                    <span className={cn("px-1.5 py-0.2 rounded-full text-[10px] font-extrabold", isActive ? "bg-primary/10 text-primary" : (tab.badgeColor || "bg-muted text-muted-foreground"))}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 border border-border/60 shadow-xs">
                <FolderKanban className="h-7 w-7 text-muted-foreground/80" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Tidak ada proyek ditemukan</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                {projects.length === 0 ? 'Belum ada proyek yang dibuat. Mulai buat proyek baru untuk mengorganisasi tugas dan memantau laba.' : 'Tidak ada proyek yang sesuai dengan kata kunci pencarian atau filter status yang dipilih.'}
              </p>
              {projects.length === 0 ? (
                <Button onClick={() => handleOpenForm()} className="mt-5 rounded-xl bg-primary text-primary-foreground font-semibold px-5" size="lg">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Buat Proyek Pertama
                </Button>
              ) : (
                <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} className="mt-4 rounded-xl text-xs font-semibold">
                  Reset Filter & Pencarian
                </Button>
              )}
            </div>
          ) : viewMode === 'kanban' ? (
            <ProjectKanbanBoard projects={filteredProjects} onStatusChange={handleStatusChange} onEdit={handleOpenForm} onDelete={handleDeleteProject} />
          ) : viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="w-[280px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Nama Proyek</TableHead>
                    <TableHead className="w-[200px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Klien</TableHead>
                    <TableHead className="w-[140px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                    <TableHead className="w-[200px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-left">Progres Tugas</TableHead>
                    <TableHead className="w-[180px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Laba Bersih</TableHead>
                    <TableHead className="w-[130px] px-5 py-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/60">
                  {filteredProjects.map((project) => {
                    const stats = getStats(project.id);
                    return (
                      <TableRow key={project.id} className="hover:bg-muted/30 transition-colors group">
                        <TableCell className="px-5 py-4">
                          <Link to={`/project/${project.id}`} className="font-bold text-sm text-foreground hover:text-primary transition-colors block truncate max-w-xs">{project.name}</Link>
                          <span className="text-[11px] text-muted-foreground">Dibuat {safeFormat(project.created_at, 'dd MMM yyyy')}</span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-xs font-medium text-muted-foreground">{project.clients?.name || 'Klien Umum'}</TableCell>
                        <TableCell className="px-5 py-4 text-center"><div className="flex justify-center">{getProjectStatusBadge(project.status)}</div></TableCell>
                        <TableCell className="px-5 py-4">
                          <div className="space-y-1.5 max-w-[180px]">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium"><span>{stats.taskDone}/{stats.taskTotal} tugas</span><span>{stats.progress.toFixed(0)}%</span></div>
                            <Progress value={stats.progress} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-right">
                          <span className={cn("font-black text-sm whitespace-nowrap tabular-nums", stats.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{formatCurrency(stats.profit)}</span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"><Link to={`/project/${project.id}`}><Eye className="h-4 w-4" /></Link></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => handleOpenForm(project)}><Pencil className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map((project) => {
                const stats = getStats(project.id);
                const totalCost = stats.cost + stats.expenses;
                return (
                  <div key={project.id} className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs hover:shadow-md hover:border-primary/40 transition-all duration-200 group">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Link to={`/project/${project.id}`} className="font-black text-base sm:text-lg text-foreground hover:text-primary transition-colors truncate">{project.name}</Link>
                          {getProjectStatusBadge(project.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{project.clients?.name || 'Tanpa klien'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Dibuat {safeFormat(project.created_at, 'dd MMM yyyy')}</span>
                          <span>•</span>
                          <span>{stats.invoiceCount} Faktur</span>
                          <span>•</span>
                          <span>{stats.quoteCount} Penawaran</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:w-[460px] shrink-0">
                        <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pendapatan</p>
                          <p className="mt-1 font-black text-sm text-foreground truncate tabular-nums">{formatCurrency(stats.revenue)}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Biaya & HPP</p>
                          <p className="mt-1 font-black text-sm text-rose-600 dark:text-rose-400 truncate tabular-nums">{formatCurrency(totalCost)}</p>
                        </div>
                        <div className={cn("rounded-xl border p-3", stats.profit >= 0 ? "bg-emerald-500/10 border-emerald-500/25" : "bg-rose-500/10 border-rose-500/25")}>
                          <p className={cn("text-[10px] font-bold uppercase tracking-wider", stats.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>Laba Bersih</p>
                          <p className={cn("mt-1 font-black text-sm truncate tabular-nums", stats.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{formatCurrency(stats.profit)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-border/60 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                          <span className="flex items-center gap-1.5 text-foreground"><CheckSquare className="h-3.5 w-3.5 text-primary" />Progres Tugas Proyek</span>
                          <span>{stats.taskDone}/{stats.taskTotal} Selesai ({stats.progress.toFixed(0)}%)</span>
                        </div>
                        <Progress value={stats.progress} className="h-2 rounded-full" />
                      </div>
                      <div className="flex items-center gap-2 self-end lg:self-auto">
                        <Button asChild variant="outline" size="sm" className="rounded-xl font-semibold text-xs h-9"><Link to={`/project/${project.id}`}><TrendingUp className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />Detail & Laba</Link></Button>
                        <Button variant="outline" size="sm" onClick={() => handleOpenForm(project)} className="rounded-xl font-semibold text-xs h-9"><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl border border-border/80 shadow-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-lg font-bold">Hapus Proyek?</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm text-muted-foreground">Tindakan ini akan menghapus proyek <span className="font-bold text-foreground">{project.name}</span> secara permanen. Dokumen penawaran dan faktur terkait tidak akan dihapus.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteProject(project.id)} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold">Ya, Hapus</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <ProjectForm isOpen={isFormOpen} setIsOpen={setIsFormOpen} project={selectedProject} onSave={handleFormSave} />
    </div>
  );
};

export default ProjectList;
