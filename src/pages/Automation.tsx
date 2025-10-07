import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Pencil, Trash2, Wand2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import WorkflowForm from '@/components/WorkflowForm';

export type Workflow = {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  is_active: boolean;
};

const triggerLabels: { [key: string]: string } = {
  'quote_accepted': 'Penawaran Diterima',
  'quote_expiring_3_days': 'Penawaran Akan Kedaluwarsa (3 Hari)',
  'invoice_overdue': 'Faktur Jatuh Tempo',
  'payment_received': 'Pembayaran Diterima',
};

const actionLabels: { [key: string]: string } = {
  'create_project': 'Buat Proyek Baru',
  'send_internal_notification': 'Kirim Notifikasi Internal',
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

  const handleToggleActive = async (workflow: Workflow) => {
    const { error } = await supabase
      .from('workflows')
      .update({ is_active: !workflow.is_active })
      .match({ id: workflow.id });

    if (error) {
      showError('Gagal mengubah status.');
    } else {
      showSuccess('Status alur kerja diperbarui.');
      fetchWorkflows();
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
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Wand2 className="h-7 w-7" />
              <CardTitle className="text-3xl">Otomatisasi Alur Kerja</CardTitle>
            </div>
            <CardDescription>Biarkan aplikasi bekerja untuk Anda. Atur pemicu dan aksi otomatis.</CardDescription>
          </div>
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Buat Alur Kerja
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Anda belum membuat alur kerja otomatis.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Pemicu (JIKA)</TableHead>
                  <TableHead>Aksi (MAKA)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">{workflow.name}</TableCell>
                    <TableCell>{triggerLabels[workflow.trigger_type] || workflow.trigger_type}</TableCell>
                    <TableCell>{actionLabels[workflow.action_type] || workflow.action_type}</TableCell>
                    <TableCell>
                      <Switch
                        checked={workflow.is_active}
                        onCheckedChange={() => handleToggleActive(workflow)}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenForm(workflow)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus alur kerja secara permanen.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteWorkflow(workflow.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
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
      <WorkflowForm isOpen={isFormOpen} setIsOpen={setIsFormOpen} workflow={selectedWorkflow} onSave={handleFormSave} />
    </div>
  );
};

export default Automation;