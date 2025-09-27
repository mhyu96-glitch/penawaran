import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Pencil, Trash2, FolderKanban } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import ProjectForm, { Project } from '@/components/ProjectForm';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

type ProjectWithClient = Project & {
  clients: { name: string } | null;
};

const ProjectList = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*, clients(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Gagal memuat daftar proyek.');
    } else {
      setProjects(data as ProjectWithClient[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const handleDeleteProject = async (projectId: string) => {
    const { error } = await supabase.from('projects').delete().match({ id: projectId });
    if (error) {
      showError('Gagal menghapus proyek.');
    } else {
      showSuccess('Proyek berhasil dihapus.');
      setProjects(projects.filter(p => p.id !== projectId));
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

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case 'Completed': return 'default';
      case 'Ongoing': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <FolderKanban className="h-7 w-7" />
              <CardTitle className="text-3xl">Proyek Saya</CardTitle>
            </div>
            <CardDescription>Kelola semua proyek Anda di satu tempat.</CardDescription>
          </div>
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Buat Proyek Baru
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Anda belum membuat proyek apa pun.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Proyek</TableHead>
                  <TableHead>Klien</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <Link to={`/project/${project.id}`} className="hover:underline">{project.name}</Link>
                    </TableCell>
                    <TableCell>{project.clients?.name || '-'}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(project.status)}>{project.status}</Badge></TableCell>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ProjectForm isOpen={isFormOpen} setIsOpen={setIsFormOpen} project={selectedProject} onSave={handleFormSave} />
    </div>
  );
};

export default ProjectList;