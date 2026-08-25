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
import { Calendar as CalendarIcon, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn, safeFormat, formatNumberWithDots, parseDotsToNumber, formatCurrency } from '@/lib/utils';
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
      setNotes('Uang Muka (DP)');
    }
  }, [payment, isOpen]);

  const handleApplyPreset = (percentage: number, label: string) => {
    const calcAmount = Math.round(invoiceTotal * percentage);
    setAmount(String(calcAmount));
    setNotes(label);
  };

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
      <DialogContent className="sm:max-w-[440px] rounded-3xl p-6 border border-border/80 shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-black text-foreground">
            {payment ? 'Edit Pembayaran' : 'Catat Pembayaran / DP'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Total tagihan: <strong className="text-foreground">{formatCurrency(invoiceTotal)}</strong>. Catat uang muka (DP) atau pelunasan.
          </DialogDescription>
        </DialogHeader>

        {/* Quick DP Preset Buttons */}
        {!payment && invoiceTotal > 0 && (
          <div className="pt-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Pilihan Cepat Nominal DP
            </Label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyPreset(0.3, 'Uang Muka (DP 30%)')}
                className="py-1.5 px-2 rounded-xl text-xs font-bold border border-border/80 bg-muted/30 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all text-center"
              >
                DP 30% ({formatCurrency(Math.round(invoiceTotal * 0.3))})
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(0.5, 'Uang Muka (DP 50%)')}
                className="py-1.5 px-2 rounded-xl text-xs font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-all text-center"
              >
                DP 50% ({formatCurrency(Math.round(invoiceTotal * 0.5))})
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(1.0, 'Pelunasan Penuh (100%)')}
                className="py-1.5 px-2 rounded-xl text-xs font-bold border border-border/80 bg-muted/30 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-500 transition-all text-center"
              >
                Lunas 100%
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3.5 py-2">
          {/* Jumlah Pembayaran */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-xs font-bold">Jumlah Pembayaran / DP (IDR)</Label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground select-none">Rp</span>
              <Input 
                id="amount" 
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={formatNumberWithDots(amount)} 
                onChange={(e) => setAmount(String(parseDotsToNumber(e.target.value)))} 
                className="pl-9 font-bold tabular-nums text-foreground border-primary/40 focus-visible:ring-primary h-10 rounded-xl"
              />
            </div>
          </div>

          {/* Tanggal Pembayaran */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Tanggal Pembayaran</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-semibold text-xs h-10 rounded-xl", !paymentDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {paymentDate ? safeFormat(paymentDate.toISOString(), 'd MMMM yyyy') : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl"><Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus /></PopoverContent>
            </Popover>
          </div>

          {/* Keterangan / Catatan */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes" className="text-xs font-bold">Keterangan / Termin</Label>
              <div className="flex gap-1">
                {['Transfer BCA', 'Tunai', 'QRIS'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNotes(prev => prev ? `${prev} via ${tag}` : `Pembayaran via ${tag}`)}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-primary bg-muted/40 px-1.5 py-0.5 rounded-md"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>
            <Input 
              id="notes" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Contoh: Uang Muka (DP 50%) via Transfer BCA"
              className="h-10 rounded-xl text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl text-xs font-semibold">
            Batal
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentForm;