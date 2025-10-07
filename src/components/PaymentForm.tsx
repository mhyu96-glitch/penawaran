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
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';

type PaymentForForm = {
  id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
};

interface PaymentFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  invoiceId: string;
  invoiceTotal: number;
  payment: PaymentForForm | null;
  onSave: () => void;
}

const PaymentForm = ({ isOpen, setIsOpen, invoiceId, invoiceTotal, payment, onSave }: PaymentFormProps) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (payment && isOpen) {
      setAmount(String(payment.amount));
      setPaymentDate(new Date(payment.payment_date));
      setNotes(payment.notes || '');
    } else if (!payment && isOpen) {
      setAmount('');
      setPaymentDate(new Date());
      setNotes('');
    }
  }, [payment, isOpen]);

  const handleSubmit = async () => {
    if (!user || !amount || !paymentDate) {
      showError('Jumlah dan tanggal pembayaran tidak boleh kosong.');
      return;
    }
    setIsSubmitting(true);

    const paymentPayload = {
      amount: parseFloat(amount),
      payment_date: paymentDate.toISOString(),
      notes,
    };

    let error;

    if (payment) {
      ({ error } = await supabase.from('payments').update(paymentPayload).match({ id: payment.id }));
    } else {
      const insertPayload = {
        ...paymentPayload,
        invoice_id: invoiceId,
        user_id: user.id,
        status: 'Lunas',
      };
      ({ error } = await supabase.from('payments').insert(insertPayload));
    }

    if (error) {
      showError(`Gagal menyimpan pembayaran: ${error.message}`);
    } else {
      const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId).eq('status', 'Lunas');
      const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      if (totalPaid >= invoiceTotal) {
        await supabase.from('invoices').update({ status: 'Lunas' }).eq('id', invoiceId);
      }
      
      showSuccess(`Pembayaran berhasil ${payment ? 'diperbarui' : 'dicatat'}!`);
      onSave();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{payment ? 'Edit Pembayaran' : 'Catat Pembayaran'}</DialogTitle>
          <DialogDescription>
            {payment ? 'Perbarui detail pembayaran di bawah ini.' : 'Masukkan detail pembayaran yang diterima untuk faktur ini.'}
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
            {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentForm;