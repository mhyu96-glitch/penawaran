import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Trash2 } from 'lucide-react';
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

  const handleAddTask = async () => {
    if (!user || !newTask.trim()) return;
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
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground mt-2">{completedTasks} dari {tasks.length} tugas selesai ({progress.toFixed(0)}%)</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Tambahkan tugas baru..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
        />
        <Button onClick={handleAddTask}><PlusCircle className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {tasks.map(task => (
          <div key={task.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent">
            <Checkbox
              id={`task-${task.id}`}
              checked={task.is_completed}
              onCheckedChange={(checked) => handleToggleTask(task.id, !!checked)}
            />
            <label
              htmlFor={`task-${task.id}`}
              className={`flex-1 text-sm font-medium leading-none ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}
            >
              {task.description}
            </label>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteTask(task.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectTaskList;