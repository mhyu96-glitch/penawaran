import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Save, FileInput } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  type: string;
  content: any;
}

interface TemplateManagerProps {
  type: 'invoice' | 'quote';
  currentData: any;
  onApplyTemplate: (data: any) => void;
}

const TemplateManager = ({ type, currentData, onApplyTemplate }: TemplateManagerProps) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const fetchTemplates = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching templates:', error);
    else setTemplates(data as Template[]);
  };

  useEffect(() => {
    if (isLoadOpen) fetchTemplates();
  }, [isLoadOpen, user, type]);

  const handleSaveTemplate = async () => {
    if (!user || !newTemplateName) {
      showError('Nama template harus diisi.');
      return;
    }

    const { error } = await supabase.from('document_templates').insert({
      user_id: user.id,
      name: newTemplateName,
      type: type,
      content: currentData,
    });

    if (error) {
      showError('Gagal menyimpan template.');
    } else {
      showSuccess('Template berhasil disimpan.');
      setIsSaveOpen(false);
      setNewTemplateName('');
    }
  };

  const handleLoadTemplate = () => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      onApplyTemplate(template.content);
      showSuccess('Template berhasil diterapkan.');
      setIsLoadOpen(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabase.from('document_templates').delete().eq('id', id);
    if (error) showError('Gagal menghapus template.');
    else {
      setTemplates(templates.filter(t => t.id !== id));
      if (selectedTemplateId === id) setSelectedTemplateId('');
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Save className="mr-2 h-4 w-4" /> Simpan sebagai Template
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simpan Template</DialogTitle>
            <DialogDescription>Simpan isi dokumen ini agar bisa digunakan lagi nanti.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name">Nama Template</Label>
            <Input 
              id="name" 
              value={newTemplateName} 
              onChange={(e) => setNewTemplateName(e.target.value)} 
              placeholder={`Contoh: ${type === 'invoice' ? 'Faktur Bulanan' : 'Penawaran Standar'}`}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveTemplate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLoadOpen} onOpenChange={setIsLoadOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FileInput className="mr-2 h-4 w-4" /> Muat Template
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pilih Template</DialogTitle>
            <DialogDescription>Pilih template untuk mengisi form secara otomatis.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplateId && (
                <div className="flex justify-end">
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteTemplate(selectedTemplateId)}>Hapus Template Ini</Button>
                </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleLoadTemplate} disabled={!selectedTemplateId}>Terapkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateManager;