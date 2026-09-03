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
  remainingBalance?: number;
  downPaymentAmount?: number;
  payment: PaymentForForm | null;
  onSave: () => void;
}

const PaymentForm = ({ 
  isOpen, 
  setIsOpen, 
  invoiceId, 
  invoiceTotal, 
  remainingBalance,
  downPaymentAmount,
  payment, 
  onSave 
}: PaymentFormProps) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (payment && isOpen) {
      setAmount(String(payment.amount));
      if (invoiceTotal > 0) {
        const p = ((payment.amount / invoiceTotal) * 100).toFixed(1);
        setPercent(p.endsWith('.0') ? p.slice(0, -2) : p);
      } else {
        setPercent('');
      }
      setPaymentDate(new Date(payment.payment_date));
      setNotes(payment.notes || '');
    } else if (!payment && isOpen) {
      if (typeof remainingBalance === 'number' && remainingBalance < invoiceTotal && remainingBalance > 0) {
        // Sudah ada pembayaran sebelumnya -> default ke sisa pelunasan
        setAmount(String(remainingBalance));
        const p = ((remainingBalance / invoiceTotal) * 100).toFixed(1);
        setPercent(p.endsWith('.0') ? p.slice(0, -2) : p);
        setNotes('Pelunasan (Sisa Tagihan)');
      } else if (downPaymentAmount && downPaymentAmount > 0 && downPaymentAmount <= invoiceTotal) {
        // Pembayaran awal dengan ketentuan DP
        setAmount(String(downPaymentAmount));
        const p = ((downPaymentAmount / invoiceTotal) * 100).toFixed(1);
        const cleanP = p.endsWith('.0') ? p.slice(0, -2) : p;
        setPercent(cleanP);
        setNotes(`Uang Muka (DP ${cleanP}%)`);
      } else if (invoiceTotal > 0) {
        const defaultAmt = Math.round(invoiceTotal * 0.5);
        setAmount(String(defaultAmt));
        setPercent('50');
        setNotes('Uang Muka (DP 50%)');
      } else {
        setAmount('');
        setPercent('');
        setNotes('Uang Muka (DP)');
      }
      setPaymentDate(new Date());
    }
  }, [payment, isOpen, invoiceTotal, remainingBalance, downPaymentAmount]);

  const handleApplyPreset = (percentage: number) => {
    const pVal = percentage * 100;
    const calcAmount = Math.round(invoiceTotal * percentage);
    setAmount(String(calcAmount));
    setPercent(String(pVal));
    if (pVal === 100) {
      setNotes('Pelunasan Penuh (100%)');
    } else {
      setNotes(`Uang Muka (DP ${pVal}%)`);
    }
  };

  const handlePercentChange = (valStr: string) => {
    setPercent(valStr);
    const p = parseFloat(valStr);
    if (!isNaN(p) && p >= 0 && p <= 100 && invoiceTotal > 0) {
      const calcAmount = Math.round((invoiceTotal * p) / 100);
      setAmount(String(calcAmount));
      if (p === 100) {
        setNotes('Pelunasan Penuh (100%)');
      } else {
        setNotes(`Uang Muka (DP ${p}%)`);
      }
    } else if (valStr === '') {
      setAmount('');
    }
  };

  const handleAmountChange = (valStr: string) => {
    const num = parseDotsToNumber(valStr);
    setAmount(String(num));
    if (invoiceTotal > 0 && num > 0) {
      const p = ((num / invoiceTotal) * 100).toFixed(1);
      const cleanP = p.endsWith('.0') ? p.slice(0, -2) : p;
      setPercent(cleanP);
      if (num >= invoiceTotal) {
        setNotes('Pelunasan Penuh (100%)');
      } else {
        setNotes(`Uang Muka (DP ${cleanP}%)`);
      }
    } else {
      setPercent('');
    }
  };

  const numAmount = parseFloat(amount) || 0;
  const remainingDue = Math.max(0, invoiceTotal - numAmount);

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
      } else {
        await supabase.from('invoices').update({ status: 'Terkirim' }).eq('id', invoiceId);
      }
      
      showSuccess(`Pembayaran berhasil ${payment ? 'diperbarui' : 'dicatat'}!`);
      onSave();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[460px] rounded-3xl p-6 border border-border/80 shadow-2xl">
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
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'DP 30%', val: 0.3 },
                { label: 'DP 50%', val: 0.5 },
                { label: 'DP 70%', val: 0.7 },
                { label: 'Lunas 100%', val: 1.0 },
              ].map(btn => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleApplyPreset(btn.val)}
                  className={cn(
                    "py-1.5 px-1 rounded-xl text-xs font-bold border transition-all text-center",
                    percent === String(btn.val * 100)
                      ? "border-primary/50 bg-primary/15 text-primary shadow-2xs"
                      : "border-border/80 bg-muted/30 hover:bg-muted text-muted-foreground"
                  )}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3.5 py-2">
          {/* Dual Input: Persentase (%) dan Nominal (IDR) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Input DP Manual (% atau Nominal Rp)
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {/* Kolom Persentase (%) */}
              <div className="col-span-2 relative flex items-center">
                <Input 
                  type="number"
                  placeholder="0"
                  min="0"
                  max="100"
                  value={percent}
                  onChange={(e) => handlePercentChange(e.target.value)}
                  className="pr-7 font-bold tabular-nums text-foreground border-primary/40 focus-visible:ring-primary h-10 rounded-xl text-right text-xs"
                />
                <span className="pointer-events-none absolute right-2.5 text-xs font-bold text-muted-foreground select-none">%</span>
              </div>

              {/* Kolom Nominal (IDR) */}
              <div className="col-span-3 relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground select-none">Rp</span>
                <Input 
                  id="amount" 
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatNumberWithDots(amount)} 
                  onChange={(e) => handleAmountChange(e.target.value)} 
                  className="pl-9 font-bold tabular-nums text-foreground border-primary/40 focus-visible:ring-primary h-10 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          {/* Sisa Pelunasan Live Breakdown */}
          {invoiceTotal > 0 && numAmount > 0 && (
            <div className="rounded-2xl bg-muted/30 border border-border/80 p-3 space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span>DP Diterima{percent ? ` (${percent}%)` : ''}:</span>
                <span className="tabular-nums font-black">{formatCurrency(numAmount)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-foreground">
                <span className="text-muted-foreground">Sisa Pelunasan:</span>
                <span className={cn("tabular-nums font-black", remainingDue > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600")}>
                  {formatCurrency(remainingDue)}
                </span>
              </div>
            </div>
          )}

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