import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Pencil, Trash2, FolderKanban, LayoutGrid, List, Clock, DollarSign, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import ProjectForm, { Project } from '@/components/ProjectForm';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import ProjectKanbanBoard from '@/components/ProjectKanbanBoard';
import { Progress } from '@/components/ui/progress';
import { calculateItemTotal, calculateSubtotal, calculateTotal, cn, formatCurrency, getStatusVariant, safeFormat } from '@/lib/utils';

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
        .select('id, project_id, status, quote_items(quantity, cost_price)')
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
          if (quote.status !== 'Diterima') return;
          current.cost += (quote.quote_items || []).reduce(
            (sum, item) => sum + calculateItemTotal(item.quantity, item.cost_price || 0),
            0
          );
        });
      }

      if (invoicesRes.data) {
        invoicesRes.data.forEach((invoice) => {
          const current = ensureStats(invoice.project_id);
          if (!current) return;
          current.invoiceCount += 1;
          if (invoice.status !== 'Lunas') return;
          const subtotal = calculateSubtotal(invoice.invoice_items || []);
          current.revenue += calculateTotal(subtotal, invoice.discount_amount || 0, invoice.tax_amount || 0);
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

  // Fungsi baru untuk menangani perubahan status dari Kanban
  const handleStatusChange = async (projectId: string, newStatus: string) => {
    // Optimistic update (update UI dulu biar cepat)
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));

    const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId);

    if (error) {
        showError('Gagal memperbarui status proyek.');
        // Revert changes if failed
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

  const summary = projects.reduce(
    (acc, project) => {
      const stats = getStats(project.id);
      acc.revenue += stats.revenue;
      acc.cost += stats.cost + stats.expenses;
      acc.profit += stats.profit;
      if (project.status === 'Ongoing') acc.active += 1;
      return acc;
    },
    { active: 0, revenue: 0, cost: 0, profit: 0 }
  );

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="min-h-[85vh]">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <FolderKanban className="h-7 w-7" />
              <CardTitle className="text-3xl">Proyek Saya</CardTitle>
            </div>
            <CardDescription>Kelola semua proyek Anda di satu tempat.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle View Buttons */}
            <div className="bg-muted p-1 rounded-md flex">
                <Button
                    variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('timeline')}
                    className="h-8 w-8 p-0"
                    title="Timeline proyek"
                >
                    <Clock className="h-4 w-4" />
                </Button>
                <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setViewMode('list')}
                    className="h-8 w-8 p-0"
                    title="Tampilan Daftar"
                >
                    <List className="h-4 w-4" />
                </Button>
                <Button 
                    variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setViewMode('kanban')}
                    className="h-8 w-8 p-0"
                    title="Tampilan Kanban"
                >
                    <LayoutGrid className="h-4 w-4" />
                </Button>
            </div>
            <Button onClick={() => handleOpenForm()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Buat Proyek
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Anda belum membuat proyek apa pun.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Proyek aktif</p>
                    <FolderKanban className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold">{summary.active}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Pendapatan proyek</p>
                    <Receipt className="h-4 w-4 text-sky-700" />
                  </div>
                  <p className="mt-2 truncate text-2xl font-semibold">{formatCurrency(summary.revenue)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Total biaya</p>
                    <Wallet className="h-4 w-4 text-rose-700" />
                  </div>
                  <p className="mt-2 truncate text-2xl font-semibold">{formatCurrency(summary.cost)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">Laba bersih</p>
                    <DollarSign className={cn("h-4 w-4", summary.profit >= 0 ? "text-emerald-700" : "text-rose-700")} />
                  </div>
                  <p className={cn("mt-2 truncate text-2xl font-semibold", summary.profit >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(summary.profit)}</p>
                </div>
              </div>

              {viewMode === 'list' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Proyek</TableHead>
                      <TableHead>Klien</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progres</TableHead>
                      <TableHead className="text-right">Laba</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => {
                      const stats = getStats(project.id);
                      return (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">
                            <Link to={`/project/${project.id}`} className="hover:underline">{project.name}</Link>
                          </TableCell>
                          <TableCell>{project.clients?.name || '-'}</TableCell>
                          <TableCell><Badge variant={getStatusVariant(project.status)}>{project.status}</Badge></TableCell>
                          <TableCell>
                            <div className="min-w-36 space-y-1">
                              <Progress value={stats.progress} className="h-2" />
                              <p className="text-xs text-muted-foreground">{stats.taskDone}/{stats.taskTotal} tugas</p>
                            </div>
                          </TableCell>
                          <TableCell className={cn("text-right font-medium", stats.profit >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(stats.profit)}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenForm(project)}><Pencil className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus proyek secara permanen. Ini tidak akan menghapus penawaran/faktur terkait.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteProject(project.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : viewMode === 'kanban' ? (
                <ProjectKanbanBoard 
                    projects={projects} 
                    onStatusChange={handleStatusChange} 
                    onEdit={handleOpenForm}
                    onDelete={handleDeleteProject}
                />
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => {
                    const stats = getStats(project.id);
                    const totalCost = stats.cost + stats.expenses;
                    return (
                      <div key={project.id} className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/35">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link to={`/project/${project.id}`} className="truncate text-base font-semibold hover:underline">
                                {project.name}
                              </Link>
                              <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                              <span>{project.clients?.name || 'Tanpa klien'}</span>
                              <span>Dibuat {safeFormat(project.created_at, 'dd MMM yyyy')}</span>
                              <span>{stats.invoiceCount} faktur</span>
                              <span>{stats.quoteCount} penawaran</span>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
                            <div className="rounded-md bg-muted/45 p-3">
                              <p className="text-xs font-medium text-muted-foreground">Pendapatan</p>
                              <p className="mt-1 truncate font-semibold">{formatCurrency(stats.revenue)}</p>
                            </div>
                            <div className="rounded-md bg-muted/45 p-3">
                              <p className="text-xs font-medium text-muted-foreground">Biaya</p>
                              <p className="mt-1 truncate font-semibold">{formatCurrency(totalCost)}</p>
                            </div>
                            <div className="rounded-md bg-muted/45 p-3">
                              <p className="text-xs font-medium text-muted-foreground">Laba</p>
                              <p className={cn("mt-1 truncate font-semibold", stats.profit >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(stats.profit)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                          <div>
                            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>Progress tugas</span>
                              <span>{stats.taskDone}/{stats.taskTotal} selesai - {stats.progress.toFixed(0)}%</span>
                            </div>
                            <Progress value={stats.progress} className="h-2" />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/project/${project.id}`}>
                                <TrendingUp className="mr-2 h-4 w-4" />
                                Detail laba
                              </Link>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleOpenForm(project)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <ProjectForm isOpen={isFormOpen} setIsOpen={setIsFormOpen} project={selectedProject} onSave={handleFormSave} />
    </div>
  );
};

export default ProjectList;
