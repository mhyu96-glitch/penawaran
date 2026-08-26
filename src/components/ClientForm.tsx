import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Client } from '@/pages/ClientList';
import { Building2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  client: Client | null;
  onSave: () => void;
}

export function parseClientType(notes: string | null | undefined): 'end_user' | 'partner_store' {
  if (!notes) return 'end_user';
  if (notes.includes('[TYPE:partner_store]')) return 'partner_store';
  if (notes.includes('[TYPE:end_user]')) return 'end_user';
  return 'end_user';
}

export function cleanClientNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes.replace(/\[TYPE:[a-zA-Z0-9_-]+\]/g, '').trim();
}

const ClientForm = ({ isOpen, setIsOpen, client, onSave }: ClientFormProps) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [clientType, setClientType] = useState<'end_user' | 'partner_store'>('end_user');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setAddress(client.address || '');
      setNotes(cleanClientNotes(client.notes));
      setClientType(parseClientType(client.notes));
    } else {
      // Reset form for new client
      setName('');
      setClientType('end_user');
      setEmail('');
      setPhone('');
      setAddress('');
      setNotes('');
    }
  }, [client, isOpen]);

  const handleSubmit = async () => {
    if (!user || !name) {
      showError('Nama klien tidak boleh kosong.');
      return;
    }
    setIsSubmitting(true);

    const packedNotes = `[TYPE:${clientType}] ${notes}`.trim();

    const clientPayload: Record<string, any> = {
      user_id: user.id,
      name,
      email,
      phone,
      address,
      notes: packedNotes,
    };

    let error;
    if (client) {
      // Update existing client
      ({ error } = await supabase.from('clients').update(clientPayload).match({ id: client.id }));
    } else {
      // Create new client
      ({ error } = await supabase.from('clients').insert(clientPayload));
    }

    if (error) {
      showError(`Gagal menyimpan klien: ${error.message}`);
    } else {
      showSuccess(`Klien berhasil ${client ? 'diperbarui' : 'ditambahkan'}!`);
      onSave();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit Klien' : 'Tambah Klien Baru'}</DialogTitle>
          <DialogDescription>
            Isi detail profil pelanggan atau partner toko di bawah ini.
          </DialogDescription>
        </DialogHeader>

        {/* Client Type Selector */}
        <div className="space-y-2 pt-1">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kategori / Tipe Klien</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setClientType('end_user')}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all",
                clientType === 'end_user'
                  ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40 font-bold"
                  : "border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/40 font-medium"
              )}
            >
              <User className="h-4 w-4 shrink-0" />
              <div className="text-xs">Klien Langsung</div>
              <div className="text-[10px] text-muted-foreground line-clamp-1">End-user / Pembeli</div>
            </button>

            <button
              type="button"
              onClick={() => setClientType('partner_store')}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all",
                clientType === 'partner_store'
                  ? "border-violet-500 bg-violet-500/10 text-violet-500 shadow-xs ring-1 ring-violet-500/40 font-bold"
                  : "border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/40 font-medium"
              )}
            >
              <Building2 className="h-4 w-4 shrink-0 text-violet-500" />
              <div className="text-xs">Toko / Partner</div>
              <div className="text-[10px] text-muted-foreground line-clamp-1">Subkon Jasa & Akomodasi</div>
            </button>
          </div>
        </div>

        <div className="grid gap-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold">Nama {clientType === 'partner_store' ? 'Toko / Partner' : 'Klien'} *</Label>
            <Input 
              id="name" 
              placeholder={clientType === 'partner_store' ? 'Contoh: Toko CCTV Berkah / PT Mitra Utama' : 'Contoh: Bpk. Hendra / Dinas Kominfo'}
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold">No. WhatsApp / HP</Label>
              <Input 
                id="phone" 
                placeholder="08123456789"
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="email@domain.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs font-semibold">Alamat Kantor / Toko</Label>
            <Textarea 
              id="address" 
              placeholder="Alamat lengkap lokasi..."
              value={address} 
              onChange={(e) => setAddress(e.target.value)} 
              rows={2}
              className="rounded-xl resize-none text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold">Catatan Tambahan / PIC</Label>
            <Input 
              id="notes" 
              placeholder="Nama PIC toko, kesepakatan komisi, dll."
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              className="rounded-xl text-xs"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button 
            type="submit" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="w-full sm:w-auto rounded-xl font-bold"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Klien'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientForm;