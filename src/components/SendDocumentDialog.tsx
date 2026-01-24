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
import { Mail, Copy, Smartphone, Check, Send } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';

interface SendDocumentDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  docType: 'invoice' | 'quote';
  docId: string;
  docNumber: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  publicLink: string;
  onSend: () => void;
}

const SendDocumentDialog = ({
  isOpen,
  setIsOpen,
  docType,
  docId,
  docNumber,
  clientName,
  clientEmail,
  clientPhone,
  publicLink,
  onSend
}: SendDocumentDialogProps) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Set default values when dialog opens
  useEffect(() => {
    if (isOpen) {
      setEmail(clientEmail || '');
      const typeLabel = docType === 'invoice' ? 'Faktur' : 'Penawaran';
      setSubject(`${typeLabel} #${docNumber} dari ${user?.email?.split('@')[0] || 'Kami'}`); // Fallback name
      setMessage(`Halo ${clientName},\n\nTerlampir adalah ${typeLabel.toLowerCase()} #${docNumber} untuk Anda tinjau.\n\nSilakan klik tautan berikut untuk melihat detailnya:\n${publicLink}\n\nTerima kasih.`);
    }
  }, [isOpen, clientEmail, docNumber, docType, clientName, publicLink, user]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showSuccess('Tautan berhasil disalin!');
  };

  const handleSendEmail = async () => {
    if (!email) {
      showError('Alamat email penerima wajib diisi.');
      return;
    }
    
    setIsSending(true);

    // 1. Simulate Sending Email (In a real app, call an Edge Function here)
    // For now, we just log it and update status
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Update Document Status & Log Activity
    const table = docType === 'invoice' ? 'invoices' : 'quotes';
    
    // Update status only if it's currently 'Draf'
    const { error: updateError } = await supabase
        .from(table)
        .update({ status: 'Terkirim' })
        .eq('id', docId)
        .eq('status', 'Draf');

    if (updateError) console.error("Error updating status:", updateError);

    // Log Activity
    await supabase.from('document_activities').insert({
        user_id: user?.id,
        [docType === 'invoice' ? 'invoice_id' : 'quote_id']: docId,
        activity_type: 'email_sent',
        description: `Mengirim ${docType === 'invoice' ? 'faktur' : 'penawaran'} via email ke ${email}.`
    });

    showSuccess(`Email berhasil dikirim ke ${email}`);
    setIsSending(false);
    setIsOpen(false);
    onSend();
  };

  const handleWhatsApp = () => {
    if (!clientPhone) {
        showError("Nomor telepon klien tidak tersedia.");
        return;
    }
    
    // Clean phone number
    let phone = clientPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);

    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
    
    // Log activity for WA too
    supabase.from('document_activities').insert({
        user_id: user?.id,
        [docType === 'invoice' ? 'invoice_id' : 'quote_id']: docId,
        activity_type: 'email_sent', // Reusing this type or add 'message_sent'
        description: `Mengirim ${docType === 'invoice' ? 'faktur' : 'penawaran'} via WhatsApp.`
    }).then(() => onSend());
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Kirim {docType === 'invoice' ? 'Faktur' : 'Penawaran'}</DialogTitle>
          <DialogDescription>
            Bagikan dokumen ini kepada klien Anda melalui metode berikut.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
            {/* Direct Link Section */}
            <div className="space-y-2">
                <Label>Tautan Publik</Label>
                <div className="flex gap-2">
                    <Input value={publicLink} readOnly className="bg-muted" />
                    <Button size="icon" variant="outline" onClick={handleCopyLink}>
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Atau kirim pesan</span></div>
            </div>

            {/* Email Form */}
            <div className="space-y-3">
                <div className="space-y-1">
                    <Label htmlFor="email">Email Penerima</Label>
                    <Input id="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@klien.com" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="subject">Subjek</Label>
                    <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="message">Pesan</Label>
                    <Textarea id="message" value={message} onChange={e => setMessage(e.target.value)} rows={4} />
                </div>
            </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
            {clientPhone && (
                <Button variant="outline" onClick={handleWhatsApp} className="w-full sm:w-auto">
                    <Smartphone className="mr-2 h-4 w-4" /> WhatsApp
                </Button>
            )}
            <Button onClick={handleSendEmail} disabled={isSending} className="w-full sm:w-auto">
                {isSending ? 'Mengirim...' : <><Mail className="mr-2 h-4 w-4" /> Kirim Email</>}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendDocumentDialog;