import { useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, UploadCloud } from 'lucide-react';
import { cn, formatCurrency, safeFormat } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSubmissionDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  invoiceId: string;
  totalDue: number;
}

const PaymentSubmissionDialog = ({ isOpen, setIsOpen, invoiceId, totalDue }: PaymentSubmissionDialogProps) => {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!amount || !paymentDate || !proofFile) {
      showError('Jumlah, tanggal, dan bukti pembayaran tidak boleh kosong.');
      return;
    }
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('invoiceId', invoiceId);
    formData.append('amount', amount);
    formData.append('paymentDate', paymentDate.toISOString());
    formData.append('proof', proofFile);
    formData.append('notes', notes);

    try {
      const { error } = await supabase.functions.invoke('submit-payment', {
        body: formData,
      });

      if (error) throw error;

      showSuccess('Bukti pembayaran berhasil dikirim! Menunggu konfirmasi.');
      setIsOpen(false);
    } catch (error: any) {
      showError(error.message || 'Gagal mengirim bukti pembayaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
          <DialogDescription>
            Total tagihan: {formatCurrency(totalDue)}.
            Isi detail dan unggah bukti pembayaran.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Jumlah Dibayar (IDR)</Label>
            <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tanggal Pembayaran</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? safeFormat(paymentDate.toISOString(), 'PPP') : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus /></PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="proof">Unggah Bukti Pembayaran</Label>
            <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 mb-2 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Klik untuk unggah</span> atau seret file</p>
                        <p className="text-xs text-gray-500">PNG, JPG, atau PDF</p>
                    </div>
                    <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg, application/pdf" />
                </label>
            </div> 
            {proofFile && <p className="text-sm text-muted-foreground">File dipilih: {proofFile.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan (Opsional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Mengirim...' : 'Kirim Konfirmasi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentSubmissionDialog;