import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  DragStartEvent,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { Project } from '@/components/ProjectForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, FolderKanban, Clock, CheckCircle2, Archive, Building2, DollarSign, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatCurrency } from '@/lib/utils';

// Tipe proyek dengan data klien (sama seperti di ProjectList)
type ProjectWithClient = Project & {
  clients: { name: string } | null;
};

interface ProjectKanbanBoardProps {
  projects: ProjectWithClient[];
  onStatusChange: (projectId: string, newStatus: string) => void;
  onEdit: (project: ProjectWithClient) => void;
  onDelete: (projectId: string) => void;
}

const COLUMNS = [
  { 
    id: 'Ongoing', 
    title: 'Sedang Berjalan', 
    headerStyle: 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-b border-amber-500/20',
    badgeStyle: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30',
    icon: Clock
  },
  { 
    id: 'Completed', 
    title: 'Selesai', 
    headerStyle: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/20',
    badgeStyle: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    icon: CheckCircle2
  },
  { 
    id: 'Archived', 
    title: 'Diarsipkan', 
    headerStyle: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-b border-slate-500/20',
    badgeStyle: 'bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-500/30',
    icon: Archive
  },
];

// Komponen Kartu Proyek (Draggable)
const ProjectCard = ({ project, onEdit, onDelete }: { project: ProjectWithClient; onEdit: any; onDelete: any }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { project },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none mb-3 select-none transition-all duration-150",
        isDragging ? 'opacity-40 z-50 scale-105' : ''
      )}
    >
      <div className="rounded-2xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 p-4 shadow-xs hover:shadow-md transition-all group relative cursor-grab active:cursor-grabbing">
        {/* Top: Project Title & Drag Icon */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
            {project.name}
          </h4>
          <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-muted-foreground transition-colors" />
        </div>

        {/* Client Name */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mt-1.5">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
          <span className="truncate">{project.clients?.name || 'Tanpa Klien'}</span>
        </div>

        {/* Budget & View Action Button */}
        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between gap-2">
          {project.budget && project.budget > 0 ? (
            <div className="flex items-center gap-1 text-xs font-bold text-foreground tabular-nums">
              <span className="text-[10px] text-muted-foreground font-semibold">Anggaran:</span>
              <span>{formatCurrency(project.budget)}</span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground/60 italic font-medium">Tanpa anggaran</span>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60" 
            asChild
            title="Buka Detail Proyek"
          >
            <Link to={`/project/${project.id}`}>
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

// Komponen Kolom (Droppable)
const KanbanColumn = ({ id, title, headerStyle, badgeStyle, icon: Icon, projects, onEdit, onDelete }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className={cn(
      "flex flex-col h-full rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-xs overflow-hidden transition-colors",
      isOver && "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
    )}>
      {/* Column Header */}
      <div className={cn("p-4 font-bold flex justify-between items-center text-sm", headerStyle)}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="font-extrabold">{title}</span>
        </div>
        <Badge variant="outline" className={cn("font-black text-xs px-2.5 py-0.5 rounded-full", badgeStyle)}>
          {projects.length}
        </Badge>
      </div>

      {/* Column Body Droppable Area */}
      <div ref={setNodeRef} className="p-3.5 flex-1 min-h-[480px] bg-muted/10 space-y-3">
        {projects.length === 0 ? (
          <div className="h-32 border-2 border-dashed border-border/70 rounded-2xl flex flex-col items-center justify-center text-muted-foreground gap-1.5 p-4 text-center">
            <FolderKanban className="h-5 w-5 text-muted-foreground/50" />
            <span className="text-xs font-semibold">Tidak ada proyek</span>
            <span className="text-[10px] text-muted-foreground/60">Tarik kartu proyek ke sini</span>
          </div>
        ) : (
          projects.map((p: ProjectWithClient) => (
            <ProjectCard key={p.id} project={p} onEdit={onEdit} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
};

const ProjectKanbanBoard = ({ projects, onStatusChange, onEdit, onDelete }: ProjectKanbanBoardProps) => {
  const [activeProject, setActiveProject] = useState<ProjectWithClient | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveProject(event.active.data.current?.project);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const projectId = active.id as string;
      const newStatus = over.id as string;
      
      // Update status hanya jika kolom tujuan berbeda dengan status saat ini
      const currentProject = projects.find(p => p.id === projectId);
      if (currentProject && currentProject.status !== newStatus) {
        onStatusChange(projectId, newStatus);
      }
    }
    setActiveProject(null);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 h-full items-start">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            headerStyle={col.headerStyle}
            badgeStyle={col.badgeStyle}
            icon={col.icon}
            projects={projects.filter(p => p.status === col.id)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
      
      {/* Overlay saat sedang drag */}
      <DragOverlay>
        {activeProject ? (
          <div className="opacity-90 rotate-2 cursor-grabbing shadow-2xl">
            <div className="w-[300px] rounded-2xl border-2 border-primary bg-card p-4 shadow-2xl ring-4 ring-primary/20">
              <h4 className="text-sm font-bold text-foreground">{activeProject.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">{activeProject.clients?.name || 'Tanpa Klien'}</p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ProjectKanbanBoard;