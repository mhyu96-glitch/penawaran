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
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';

interface PaymentFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  invoiceId: string;
  invoiceTotal: number;
  onSave: () => void;
}

const PaymentForm = ({ isOpen, setIsOpen, invoiceId, invoiceTotal, onSave }: PaymentFormProps) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !amount || !paymentDate) {
      showError('Jumlah dan tanggal pembayaran tidak boleh kosong.');
      return;
    }
    setIsSubmitting(true);

    const paymentPayload = {
      invoice_id: invoiceId,
      user_id: user.id,
      amount: parseFloat(amount),
      payment_date: paymentDate.toISOString(),
      notes,
      status: 'Lunas', // Pembayaran yang dicatat manual oleh admin langsung dianggap lunas
    };

    const { error } = await supabase.from('payments').insert(paymentPayload);

    if (error) {
      showError(`Gagal menyimpan pembayaran: ${error.message}`);
    } else {
      const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId).eq('status', 'Lunas');
      const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      if (totalPaid >= invoiceTotal) {
        await supabase.from('invoices').update({ status: 'Lunas' }).eq('id', invoiceId);
      }
      
      showSuccess('Pembayaran berhasil dicatat!');
      onSave();
      setAmount('');
      setNotes('');
      setPaymentDate(new Date());
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
          <DialogDescription>
            Masukkan detail pembayaran yang diterima untuk faktur ini.
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