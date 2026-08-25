import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Trash2, Edit3, Check, X } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

export type Task = {
  id: string;
  description: string;
  is_completed: boolean;
};

interface ProjectTaskListProps {
  projectId: string;
  initialTasks: Task[];
  onTaskUpdate: () => void;
}

const ProjectTaskList = ({ projectId, initialTasks, onTaskUpdate }: ProjectTaskListProps) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Edit task state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskDesc, setEditingTaskDesc] = useState('');
  const [isSavingTask, setIsSavingTask] = useState(false);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const handleAddTask = async () => {
    if (!user || !newTask.trim()) return;
    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('project_tasks')
        .insert({ project_id: projectId, user_id: user.id, description: newTask.trim() })
        .select()
        .single();
      
      if (error) {
        showError('Gagal menambahkan tugas.');
      } else {
        setTasks([...tasks, data as Task]);
        setNewTask('');
        onTaskUpdate();
      }
    } catch {
      showError('Terjadi kesalahan.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTaskDesc(task.description);
  };

  const handleSaveEditTask = async (taskId: string) => {
    if (!editingTaskDesc.trim()) {
      showError('Deskripsi tugas tidak boleh kosong.');
      return;
    }

    setIsSavingTask(true);
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ description: editingTaskDesc.trim() })
        .eq('id', taskId);

      if (error) {
        showError(`Gagal memperbarui: ${error.message}`);
      } else {
        showSuccess('Tugas berhasil diperbarui.');
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, description: editingTaskDesc.trim() } : t));
        setEditingTaskId(null);
        onTaskUpdate();
      }
    } catch {
      showError('Terjadi kesalahan.');
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleToggleTask = async (taskId: string, isCompleted: boolean) => {
    const { error } = await supabase
      .from('project_tasks')
      .update({ is_completed: isCompleted })
      .match({ id: taskId });

    if (error) {
      showError('Gagal memperbarui tugas.');
    } else {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: isCompleted } : t));
      onTaskUpdate();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Hapus tugas ini?')) return;
    const { error } = await supabase.from('project_tasks').delete().match({ id: taskId });
    if (error) {
      showError('Gagal menghapus tugas.');
    } else {
      setTasks(tasks.filter(t => t.id !== taskId));
      onTaskUpdate();
    }
  };

  const completedTasks = tasks.filter(t => t.is_completed).length;
  const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="w-full">
          <Progress value={progress} className="h-2 rounded-full" />
          <p className="text-xs text-muted-foreground mt-2 font-medium">{completedTasks} dari {tasks.length} tugas selesai ({progress.toFixed(0)}%)</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Tambahkan tugas baru..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          className="rounded-xl h-10 text-xs"
        />
        <Button onClick={handleAddTask} disabled={isAdding} className="rounded-xl h-10 px-4 font-bold gap-1.5">
          <PlusCircle className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {tasks.length === 0 ? (
          <p className="text-center py-6 text-xs text-muted-foreground">Belum ada tugas untuk proyek ini.</p>
        ) : (
          tasks.map(task => {
            const isEditing = editingTaskId === task.id;

            return (
              <div 
                key={task.id} 
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors group"
              >
                {!isEditing && (
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={task.is_completed}
                    onCheckedChange={(checked) => handleToggleTask(task.id, !!checked)}
                    className="h-4 w-4 rounded-md"
                  />
                )}

                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={editingTaskDesc}
                      onChange={(e) => setEditingTaskDesc(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEditTask(task.id);
                        if (e.key === 'Escape') setEditingTaskId(null);
                      }}
                      className="h-8 text-xs rounded-lg"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSaveEditTask(task.id)}
                      disabled={isSavingTask}
                      className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                      title="Simpan"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingTaskId(null)}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted"
                      title="Batal"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <label
                      htmlFor={`task-${task.id}`}
                      className={`flex-1 text-xs sm:text-sm font-semibold cursor-pointer select-none ${task.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                    >
                      {task.description}
                    </label>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10" 
                        onClick={() => handleStartEdit(task)}
                        title="Edit Tugas"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => handleDeleteTask(task.id)}
                        title="Hapus Tugas"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProjectTaskList;