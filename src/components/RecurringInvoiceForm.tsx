import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Client } from '@/pages/ClientList';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { cn, safeFormat } from '@/lib/utils';

interface RecurringInvoiceFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: () => void;
}

const RecurringInvoiceForm = ({ isOpen, setIsOpen, onSave }: RecurringInvoiceFormProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  
  // Schedule State
  const [clientId, setClientId] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [title, setTitle] = useState('');
  
  // Template Data State (Simplified for MVP, usually would mirror full Invoice Form)
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;
      const { data } = await supabase.from('clients').select('*').eq('user_id', user.id);
      if (data) setClients(data);
    };
    if (isOpen) fetchClients();
  }, [user, isOpen]);

  const handleSubmit = async () => {
    if (!user || !clientId || !startDate || !amount || !description) {
      showError('Mohon lengkapi semua field.');
      return;
    }
    setLoading(true);

    // 1. Get Client Details for Template
    const client = clients.find(c => c.id === clientId);
    // 2. Get User Profile for Template
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    const templateData = {
      from_company: profile?.company_name || '',
      from_address: profile?.company_address || '',
      from_website: profile?.company_website || '',
      to_client: client?.name || '',
      to_address: client?.address || '',
      to_phone: client?.phone || '',
      title: title || description,
      items: [
        {
          description: description,
          quantity: 1,
          unit: 'Paket',
          unit_price: parseFloat(amount),
          cost_price: 0
        }
      ],
      terms: profile?.default_terms || '',
    };

    const payload = {
      user_id: user.id,
      client_id: clientId,
      frequency,
      start_date: startDate.toISOString(),
      next_run_date: startDate.toISOString(), // Start immediately or on date
      status: 'active',
      template_data: templateData
    };

    const { error } = await supabase.from('recurring_invoices').insert(payload);

    if (error) {
      showError(`Gagal membuat jadwal: ${error.message}`);
    } else {
      showSuccess('Jadwal faktur rutin berhasil dibuat!');
      onSave();
      setIsOpen(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Buat Jadwal Faktur Rutin</DialogTitle>
          <DialogDescription>
            Sistem akan otomatis membuat faktur Draf sesuai jadwal ini.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Klien</Label>
            <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Pilih Klien" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Frekuensi</Label>
            <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="weekly">Mingguan (7 Hari)</SelectItem>
                    <SelectItem value="monthly">Bulanan</SelectItem>
                    <SelectItem value="yearly">Tahunan</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Mulai Tanggal</Label>
            <div className="col-span-3">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />{startDate ? safeFormat(startDate.toISOString(), 'PPP') : <span>Pilih tanggal</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                </Popover>
            </div>
          </div>
          
          <div className="border-t my-2"></div>
          <p className="text-sm font-semibold text-muted-foreground mb-2">Detail Faktur Otomatis</p>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Judul/Perihal</Label>
            <Input className="col-span-3" value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: Maintenance Bulanan" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Deskripsi Item</Label>
            <Input className="col-span-3" value={description} onChange={e => setDescription(e.target.value)} placeholder="Jasa/Barang" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Nominal (Rp)</Label>
            <Input className="col-span-3" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Jadwal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringInvoiceForm;