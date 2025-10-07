import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Client } from '@/pages/ClientList';

export type Project = {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  status: string;
};

interface ProjectFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  project: Project | null;
  onSave: () => void;
}

const ProjectForm = ({ isOpen, setIsOpen, project, onSave }: ProjectFormProps) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState('Ongoing');
  const [clients, setClients] = useState<Client[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;
      const { data } = await supabase.from('clients').select('*').eq('user_id', user.id);
      if (data) setClients(data);
    };
    fetchClients();
  }, [user]);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setClientId(project.client_id || undefined);
      setStatus(project.status);
    } else {
      setName('');
      setDescription('');
      setClientId(undefined);
      setStatus('Ongoing');
    }
  }, [project, isOpen]);

  const handleSubmit = async () => {
    if (!user || !name) {
      showError('Nama proyek tidak boleh kosong.');
      return;
    }
    setIsSubmitting(true);

    const projectPayload = {
      user_id: user.id,
      name,
      description,
      client_id: clientId,
      status,
    };

    let error;
    if (project) {
      ({ error } = await supabase.from('projects').update(projectPayload).match({ id: project.id }));
    } else {
      ({ error } = await supabase.from('projects').insert(projectPayload));
    }

    if (error) {
      showError(`Gagal menyimpan proyek: ${error.message}`);
    } else {
      showSuccess(`Proyek berhasil ${project ? 'diperbarui' : 'dibuat'}!`);
      onSave();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Proyek' : 'Buat Proyek Baru'}</DialogTitle>
          <DialogDescription>Isi detail proyek di bawah ini. Klik simpan jika sudah selesai.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Proyek</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client">Klien (Opsional)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Pilih klien" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ongoing">Sedang Berjalan</SelectItem>
                <SelectItem value="Completed">Selesai</SelectItem>
                <SelectItem value="Archived">Diarsipkan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi (Opsional)</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectForm;