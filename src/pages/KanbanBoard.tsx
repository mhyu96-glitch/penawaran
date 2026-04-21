import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { showError, showSuccess } from '@/utils/toast';
import { Columns3, GripVertical, Calendar, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

type Project = {
    id: string;
    name: string;
    description: string;
    status: string;
    client_name: string;
    deadline: string;
    created_at: string;
};

const columns = [
    { id: 'Perencanaan', label: 'Perencanaan', color: 'bg-blue-500' },
    { id: 'Berjalan', label: 'Berjalan', color: 'bg-yellow-500' },
    { id: 'Review', label: 'Review', color: 'bg-purple-500' },
    { id: 'Selesai', label: 'Selesai', color: 'bg-green-500' },
];

const KanbanBoard = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    useEffect(() => {
        const fetchProjects = async () => {
            if (!user) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                showError('Gagal memuat proyek.');
            } else {
                setProjects(data || []);
            }
            setLoading(false);
        };
        fetchProjects();
    }, [user]);

    const handleDragStart = (projectId: string) => {
        setDraggingId(projectId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        if (!draggingId) return;

        const { error } = await supabase
            .from('projects')
            .update({ status: targetStatus })
            .eq('id', draggingId);

        if (error) {
            showError('Gagal memperbarui status proyek.');
        } else {
            setProjects(projects.map(p => p.id === draggingId ? { ...p, status: targetStatus } : p));
            showSuccess(`Proyek dipindahkan ke ${targetStatus}.`);
        }
        setDraggingId(null);
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <Skeleton className="h-10 w-1/3 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {columns.map(col => (
                        <div key={col.id} className="space-y-3">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Columns3 className="h-7 w-7 text-cyber-lime glow-lime" />
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Project Matrix</h1>
                </div>
                <div className="px-4 py-1.5 bg-white/5 border border-white/5 rounded-full flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-cyber-lime animate-pulse"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational Stream Ready</span>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {columns.map(column => {
                    const columnProjects = projects.filter(p => (p.status || 'Perencanaan') === column.id);
                    return (
                        <div
                            key={column.id}
                            className="glass-panel border-white/5 p-4 min-h-[500px] rounded-2xl flex flex-col gap-4"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.id)}
                        >
                            <div className="flex items-center gap-3 mb-2 px-1">
                                <div className={`w-1.5 h-6 rounded-full ${column.color} shadow-lg shadow-${column.id}-500/20`} />
                                <h3 className="font-bold text-[11px] text-white uppercase tracking-widest">{column.label}</h3>
                                <div className="ml-auto size-5 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-white/5">{columnProjects.length}</div>
                            </div>
                            <div className="flex-1 space-y-3">
                                {columnProjects.map(project => (
                                    <Card
                                        key={project.id}
                                        draggable
                                        onDragStart={() => handleDragStart(project.id)}
                                        className={`glass-card bg-background-dark/80 border-white/5 hover:border-cyber-lime/30 cursor-grab active:cursor-grabbing transition-all rounded-xl overflow-hidden ${draggingId === project.id ? 'opacity-50 scale-95' : ''}`}
                                    >
                                        <CardContent className="p-4">
                                            <Link to={`/project/${project.id}`} className="font-bold text-sm text-white hover:text-cyber-lime transition-colors block truncate tracking-tight">
                                                {project.name}
                                            </Link>
                                            {project.description && (
                                                <p className="text-[10px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{project.description}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-white/5">
                                                {project.client_name && (
                                                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full"><User className="h-2.5 w-2.5" />{project.client_name}</span>
                                                )}
                                                {project.deadline && (
                                                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-cyber-lime/70 uppercase tracking-wider bg-cyber-lime/5 px-2 py-0.5 rounded-full"><Calendar className="h-2.5 w-2.5" />{format(new Date(project.deadline), 'dd MMM', { locale: localeId })}</span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {columnProjects.length === 0 && (
                                    <div className="text-center py-8 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                                        Seret proyek ke sini
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default KanbanBoard;
