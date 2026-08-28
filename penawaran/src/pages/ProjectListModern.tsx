import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  client_name?: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  budget: number | null;
  actual_cost: number | null;
  revenue: number | null;
  description: string | null;
  created_at: string;
  quote_count?: number;
  invoice_count?: number;
  task_completed?: number;
  task_total?: number;
}

interface ProjectStats {
  active: number;
  revenue: number;
  costs: number;
  profit: number;
}

export default function ProjectListModern() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    active: 0,
    revenue: 0,
    costs: 0,
    profit: 0
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);

      // Fetch projects with client info
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          *,
          clients (
            company_name
          )
        `)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch related counts
      const projectIds = projectsData?.map(p => p.id) || [];
      
      const [quotesResult, invoicesResult] = await Promise.all([
        supabase
          .from('quotes')
          .select('project_id')
          .in('project_id', projectIds),
        supabase
          .from('invoices')
          .select('project_id')
          .in('project_id', projectIds)
      ]);

      // Count quotes and invoices per project
      const quoteCounts = quotesResult.data?.reduce((acc, q) => {
        acc[q.project_id] = (acc[q.project_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const invoiceCounts = invoicesResult.data?.reduce((acc, i) => {
        acc[i.project_id] = (acc[i.project_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const enrichedProjects = projectsData?.map(project => ({
        ...project,
        client_name: project.clients?.company_name || 'Client Pending',
        quote_count: quoteCounts[project.id] || 0,
        invoice_count: invoiceCounts[project.id] || 0,
        task_completed: Math.floor(Math.random() * 15), // Mock data
        task_total: Math.floor(Math.random() * 15) + 5 // Mock data
      })) || [];

      setProjects(enrichedProjects);

      // Calculate stats
      const activeProjects = enrichedProjects.filter(p => 
        p.status === 'in_progress' || p.status === 'active'
      ).length;
      
      const totalRevenue = enrichedProjects.reduce((sum, p) => 
        sum + (p.revenue || p.budget || 0), 0
      );
      
      const totalCosts = enrichedProjects.reduce((sum, p) => 
        sum + (p.actual_cost || 0), 0
      );

      setStats({
        active: activeProjects,
        revenue: totalRevenue,
        costs: totalCosts,
        profit: totalRevenue - totalCosts
      });

    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'border-l-secondary';
      case 'in_progress':
      case 'active':
        return 'border-l-primary';
      case 'on_hold':
      case 'overdue':
        return 'border-l-error';
      default:
        return 'border-l-outline';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-bold border border-secondary/30 shadow-[0_0_8px_rgba(78,222,163,0.2)]">
            Completed
          </span>
        );
      case 'in_progress':
      case 'active':
        return (
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/30 shadow-[0_0_12px_rgba(216,226,255,0.2)]">
            In Progress
          </span>
        );
      case 'on_hold':
        return (
          <span className="px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary text-xs font-bold border border-tertiary/30">
            On Hold
          </span>
        );
      case 'overdue':
        return (
          <span className="px-2 py-0.5 rounded-full bg-error/10 text-error text-xs font-bold border border-error/30 shadow-[0_0_8px_rgba(255,180,171,0.3)]">
            Overdue
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant text-xs font-bold border border-white/10">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const calculateProgress = (project: Project) => {
    const completed = project.task_completed || 0;
    const total = project.task_total || 1;
    return Math.round((completed / total) * 100);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.6)]';
    if (progress >= 50) return 'bg-primary shadow-[0_0_8px_rgba(216,226,255,0.5)]';
    return 'bg-error shadow-[0_0_8px_rgba(255,180,171,0.5)]';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-on-surface-variant">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] text-on-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-primary text-3xl drop-shadow-[0_0_12px_rgba(216,226,255,0.4)]">
                folder_managed
              </span>
              <h2 className="text-2xl md:text-[32px] font-semibold text-on-surface leading-tight">
                My Projects
              </h2>
            </div>
            <p className="text-on-surface-variant">
              Manage all your ongoing and completed projects.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* View Toggle */}
            <div className="flex bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-1 shadow-md">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded flex items-center justify-center transition-all ${
                  viewMode === 'list'
                    ? 'bg-white/10 text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-sm">list</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded flex items-center justify-center transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white/10 text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
              </button>
            </div>

            <button className="flex-1 sm:flex-none bg-primary text-on-primary px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
              <span className="material-symbols-outlined text-sm">add</span>
              Create Project
            </button>
          </div>
        </div>

        {/* Summary Bento */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Projects */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5 flex flex-col gap-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">
                ACTIVE PROJECTS
              </span>
              <span className="material-symbols-outlined text-outline text-lg">
                monitoring
              </span>
            </div>
            <div className="text-3xl font-bold text-on-surface mt-2 font-['JetBrains_Mono'] drop-shadow-sm">
              {stats.active}
            </div>
            <div className="flex items-center gap-1 mt-auto">
              <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.6)]"></span>
              <span className="text-xs text-secondary">System Online</span>
            </div>
          </div>

          {/* Project Revenue */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5 flex flex-col gap-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">
                PROJECT REVENUE
              </span>
              <span className="material-symbols-outlined text-outline text-lg">
                payments
              </span>
            </div>
            <div className="text-3xl font-bold text-on-surface mt-2 font-['JetBrains_Mono'] drop-shadow-sm">
              {formatCurrency(stats.revenue)}
            </div>
            <div className="flex items-center gap-1 mt-auto text-xs text-secondary">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              +12.5% this month
            </div>
          </div>

          {/* Total Costs */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5 flex flex-col gap-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">
                TOTAL COSTS
              </span>
              <span className="material-symbols-outlined text-outline text-lg">
                account_balance_wallet
              </span>
            </div>
            <div className="text-3xl font-bold text-on-surface mt-2 font-['JetBrains_Mono'] drop-shadow-sm">
              {formatCurrency(stats.costs)}
            </div>
            <div className="flex items-center gap-1 mt-auto text-xs text-error">
              <span className="material-symbols-outlined text-sm">trending_down</span>
              -4.2% this month
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5 flex flex-col gap-2 relative overflow-hidden group shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent pointer-events-none"></div>
            <div className="flex justify-between items-start relative z-10">
              <span className="text-[11px] font-bold tracking-wider uppercase text-primary drop-shadow-sm">
                NET PROFIT
              </span>
              <span className="material-symbols-outlined text-primary text-lg">
                attach_money
              </span>
            </div>
            <div className="text-3xl font-bold text-secondary mt-2 relative z-10 font-['JetBrains_Mono'] drop-shadow-[0_0_10px_rgba(78,222,163,0.3)]">
              {formatCurrency(stats.profit)}
            </div>
            <div className="w-full bg-white/5 shadow-inner rounded-full h-1.5 mt-auto relative z-10">
              <div
                className="bg-secondary h-1.5 rounded-full shadow-[0_0_8px_rgba(78,222,163,0.5)]"
                style={{ width: '62%' }}
              ></div>
            </div>
          </div>
        </div>

        {/* Project List */}
        <div className="flex flex-col gap-4">
          {projects.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]">
              <span className="material-symbols-outlined text-outline text-6xl mb-4 block">
                folder_off
              </span>
              <h3 className="text-xl font-semibold text-on-surface mb-2">No Projects Yet</h3>
              <p className="text-on-surface-variant mb-6">
                Create your first project to get started.
              </p>
              <button className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                Create Project
              </button>
            </div>
          ) : (
            projects.map((project) => {
              const progress = calculateProgress(project);
              const revenue = project.revenue || project.budget || 0;
              const cost = project.actual_cost || 0;
              const profit = revenue - cost;

              return (
                <div
                  key={project.id}
                  className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex flex-col gap-5 hover:bg-white/10 transition-all border-l-4 ${getStatusColor(
                    project.status
                  )} shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)]`}
                >
                  {/* Project Header & Stats */}
                  <div className="flex flex-col lg:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-xl font-semibold text-on-surface drop-shadow-sm">
                          {project.name}
                        </h3>
                        {getStatusBadge(project.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">domain</span>
                          {project.client_name}
                        </span>
                        <span>Created: {formatDate(project.created_at)}</span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">receipt</span>
                          {project.invoice_count} Invoices
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">request_quote</span>
                          {project.quote_count} Quote{project.quote_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Financial Stats */}
                    <div className="flex gap-6 p-4 bg-white/5 backdrop-blur-md border border-white/10 shadow-inner rounded-lg shrink-0">
                      <div>
                        <div className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant mb-1">
                          REVENUE
                        </div>
                        <div className="font-['JetBrains_Mono'] text-on-surface">
                          {formatCurrency(revenue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant mb-1">
                          COST
                        </div>
                        <div className="font-['JetBrains_Mono'] text-on-surface">
                          {formatCurrency(cost)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold tracking-wider uppercase text-secondary mb-1">
                          PROFIT
                        </div>
                        <div className="font-['JetBrains_Mono'] text-secondary drop-shadow-[0_0_8px_rgba(78,222,163,0.3)]">
                          {formatCurrency(profit)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress & Actions */}
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex justify-between text-xs text-on-surface-variant mb-1.5">
                        <span>Task Progress</span>
                        <span>
                          {project.task_completed}/{project.task_total} completed - {progress}%
                        </span>
                      </div>
                      <div className="w-full bg-white/5 shadow-inner h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getProgressColor(progress)}`}
                          style={{ width: `${Math.max(progress, 5)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                      <button className="flex-1 sm:flex-none px-4 py-2 border border-primary/50 text-primary rounded-lg text-sm font-medium hover:bg-primary/10 hover:border-primary hover:shadow-[0_0_12px_rgba(216,226,255,0.2)] transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">analytics</span>
                        Details
                      </button>
                      <button className="flex-1 sm:flex-none px-4 py-2 border border-white/10 text-on-surface rounded-lg text-sm font-medium hover:bg-white/10 hover:shadow-md transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
