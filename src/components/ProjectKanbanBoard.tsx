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
import { Eye, FolderKanban } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils';

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
  { id: 'Ongoing', title: 'Sedang Berjalan', color: 'bg-blue-50 border-blue-200' },
  { id: 'Completed', title: 'Selesai', color: 'bg-green-50 border-green-200' },
  { id: 'Archived', title: 'Diarsipkan', color: 'bg-gray-50 border-gray-200' },
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
      className={`touch-none mb-3 ${isDragging ? 'opacity-50 z-50' : ''}`}
    >
      <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {project.name}
          </CardTitle>
          <CardDescription className="text-xs truncate">
            {project.clients?.name || 'Tanpa Klien'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 py-2">
          {project.budget && project.budget > 0 ? (
            <p className="text-xs text-muted-foreground">
              Anggaran: {formatCurrency(project.budget)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Belum ada anggaran</p>
          )}
        </CardContent>
        <CardFooter className="p-2 flex justify-end gap-1 bg-secondary/10">
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link to={`/project/${project.id}`}><Eye className="h-3.5 w-3.5" /></Link>
          </Button>
          {/* Tombol edit/delete bisa ditambahkan di sini jika perlu, tapi fokus ke DnD dulu */}
        </CardFooter>
      </Card>
    </div>
  );
};

// Komponen Kolom (Droppable)
const KanbanColumn = ({ id, title, color, projects, onEdit, onDelete }: any) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="flex flex-col h-full rounded-lg border bg-slate-50/50">
      <div className={`p-3 border-b ${color} rounded-t-lg font-medium flex justify-between items-center`}>
        <span>{title}</span>
        <Badge variant="secondary" className="bg-white/80">{projects.length}</Badge>
      </div>
      <div ref={setNodeRef} className="p-3 flex-1 min-h-[500px]">
        {projects.length === 0 ? (
          <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-sm">
            Kosong
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-start">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            projects={projects.filter(p => p.status === col.id)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
      
      {/* Overlay saat sedang drag */}
      <DragOverlay>
        {activeProject ? (
          <div className="opacity-80 rotate-3 cursor-grabbing">
             <Card className="w-[300px] shadow-xl">
                <CardHeader className="p-4">
                  <CardTitle className="text-base">{activeProject.name}</CardTitle>
                </CardHeader>
             </Card>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ProjectKanbanBoard;