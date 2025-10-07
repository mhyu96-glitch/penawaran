import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Workflow } from '@/pages/Automation';

interface WorkflowFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  workflow: Workflow | null;
  onSave: () => void;
}

const triggers = [
  { value: 'quote_accepted', label: 'Penawaran Diterima' },
];

const actions = [
  { value: 'create_project', label: 'Buat Proyek Baru' },
];

const WorkflowForm = ({ isOpen, setIsOpen, workflow, onSave }: WorkflowFormProps) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [actionType, setActionType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setTriggerType(workflow.trigger_type);
      setActionType(workflow.action_type);
    } else {
      setName('');
      setTriggerType('');
      setActionType('');
    }
  }, [workflow, isOpen]);

  const handleSubmit = async () => {
    if (!user || !name || !triggerType || !actionType) {
      showError('Semua field harus diisi.');
      return;
    }
    setIsSubmitting(true);

    const workflowPayload = {
      user_id: user.id,
      name,
      trigger_type: triggerType,
      action_type: actionType,
    };

    let error;
    if (workflow) {
      ({ error } = await supabase.from('workflows').update(workflowPayload).match({ id: workflow.id }));
    } else {
      ({ error } = await supabase.from('workflows').insert(workflowPayload));
    }

    if (error) {
      showError(`Gagal menyimpan alur kerja: ${error.message}`);
    } else {
      showSuccess(`Alur kerja berhasil ${workflow ? 'diperbarui' : 'dibuat'}!`);
      onSave();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{workflow ? 'Edit Alur Kerja' : 'Buat Alur Kerja Baru'}</DialogTitle>
          <DialogDescription>Atur otomatisasi untuk tugas-tugas rutin Anda.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Alur Kerja</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Buat Proyek dari Penawaran" />
          </div>
          <div className="space-y-2">
            <Label>Pemicu (JIKA...)</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger><SelectValue placeholder="Pilih pemicu" /></SelectTrigger>
              <SelectContent>
                {triggers.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Aksi (MAKA...)</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger><SelectValue placeholder="Pilih aksi" /></SelectTrigger>
              <SelectContent>
                {actions.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan Alur Kerja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowForm;