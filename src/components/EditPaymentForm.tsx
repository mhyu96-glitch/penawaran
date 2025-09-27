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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Payment } from '@/pages/InvoiceView';

interface EditPaymentFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  payment: Payment | null;
  onSave: () => void;
}

const EditPaymentForm = ({ isOpen, setIsOpen, payment, onSave }: EditPaymentFormProps) => {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (payment) {
      setAmount(String(payment.amount));
      setPaymentDate(parseISO(payment.payment_date));
      setNotes(payment.notes || '');
    }
  }, [payment, isOpen]);

  const handleSubmit = async () => {
    if (!payment || !amount || !paymentDate) {
      showError('Jumlah dan tanggal pembayaran tidak boleh kosong.');
      return;
    }
    setIsSubmitting(true);

    const paymentPayload = {
      amount: parseFloat(amount),
      payment_date: paymentDate.toISOString(),
      notes,
    };

    const { error } = await supabase
      .from('payments')
      .update(paymentPayload)
      .match({ id: payment.id });

    if (error) {
      showError(`Gagal memperbarui pembayaran: ${error.message}`);
    } else {
      showSuccess('Pembayaran berhasil diperbarui!');
      onSave();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Pembayaran</DialogTitle>
          <DialogDescription>
            Perbarui detail pembayaran di bawah ini.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Jumlah (IDR)</Label>
            <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tanggal Pembayaran</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP", { locale: localeId }) : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus /></PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan (Opsional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPaymentForm;