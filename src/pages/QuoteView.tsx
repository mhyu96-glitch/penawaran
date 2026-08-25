import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Printer, ArrowLeft, Pencil, Trash2, Download, Receipt, 
  FileText, Send, FolderKanban, MoreVertical, CheckCircle2,
  Building2, MapPin, Phone, Globe, ShieldCheck, History, TrendingUp, Sparkles,
  Landmark, CreditCard, Clock
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/SessionContext';
import { formatCurrency, safeFormat, calculateSubtotal, calculateTotal, getStatusVariant, cn, formatNumberWithDots, parseDotsToNumber } from '@/lib/utils';
import { generatePdf } from '@/utils/pdfGenerator';
import { DocumentItemsTable } from '@/components/DocumentItemsTable';
import ProfitAnalysisCard from '@/components/ProfitAnalysisCard';
import DocumentTimeline from '@/components/DocumentTimeline';
import SendDocumentDialog from '@/components/SendDocumentDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Attachment {
  name: string;
  url: string;
  path: string;
}

type QuoteDetails = {
  id: string;
  user_id: string;
  project_id?: string | null;
  from_company: string;
  from_address: string;
  from_website: string;
  to_client: string;
  to_address: string;
  to_phone: string;
  client_id: string | null;
  quote_number: string;
  title: string;
  quote_date: string;
  valid_until: string;
  discount_amount: number;
  tax_amount: number;
  terms: string;
  status: string;
  attachments: Attachment[];
  quote_items: {
    item_id?: string | null;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    cost_price: number;
  }[];
  clients?: { email: string; phone: string } | null;
};

type ProfileInfo = {
  company_logo_url: string | null;
  brand_color: string | null;
  custom_footer: string | null;
  show_quantity_column: boolean;
  show_unit_column: boolean;
  show_unit_price_column: boolean;
  whatsapp_quote_template: string | null;
};

const isMissingColumnError = (error: { message?: string } | null | undefined) =>
  Boolean(error?.message?.toLowerCase().includes('schema cache') && error.message.toLowerCase().includes('column'));

const QuoteView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  
  // Dialog Buat Faktur & DP States
  const [isCreateInvoiceDialogOpen, setIsCreateInvoiceDialogOpen] = useState(false);
  const [invoiceDpPercent, setInvoiceDpPercent] = useState<string>('50');
  const [invoiceDpAmount, setInvoiceDpAmount] = useState<number>(0);
  const [recordAsPayment, setRecordAsPayment] = useState<boolean>(true);
  
  const quoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*), clients(email, phone)')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching quote:', error);
        showError('Penawaran tidak ditemukan.');
        navigate('/quotes');
      } else {
        setQuote(data as QuoteDetails);
        const { data: profileData } = await supabase.from('profiles')
          .select('company_logo_url, brand_color, custom_footer, show_quantity_column, show_unit_column, show_unit_price_column, whatsapp_quote_template')
          .eq('id', data.user_id)
          .single();
        setProfile(profileData);
      }
      setLoading(false);
    };

    fetchQuote();
  }, [id, navigate]);

  const subtotal = useMemo(() => calculateSubtotal(quote?.quote_items || []), [quote]);
  const discountAmount = useMemo(() => quote?.discount_amount || 0, [quote]);
  const taxAmount = useMemo(() => quote?.tax_amount || 0, [quote]);
  const total = useMemo(() => calculateTotal(subtotal, discountAmount, taxAmount), [subtotal, discountAmount, taxAmount]);

  const handleOpenCreateInvoiceDialog = () => {
    const defaultDp = Math.round(total * 0.5);
    setInvoiceDpPercent('50');
    setInvoiceDpAmount(defaultDp);
    setRecordAsPayment(true);
    setIsCreateInvoiceDialogOpen(true);
  };

  const handleDialogDpPreset = (percent: number) => {
    if (percent === 0) {
      setInvoiceDpPercent('');
      setInvoiceDpAmount(0);
    } else {
      setInvoiceDpPercent(String(percent));
      setInvoiceDpAmount(Math.round((total * percent) / 100));
    }
  };

  const handleDialogDpPercentChange = (valStr: string) => {
    setInvoiceDpPercent(valStr);
    const p = parseFloat(valStr);
    if (!isNaN(p) && p >= 0 && p <= 100) {
      setInvoiceDpAmount(Math.round((total * p) / 100));
    } else if (valStr === '') {
      setInvoiceDpAmount(0);
    }
  };

  const handleDialogDpAmountChange = (amountNum: number) => {
    setInvoiceDpAmount(amountNum);
    if (total > 0 && amountNum > 0) {
      const p = ((amountNum / total) * 100).toFixed(1);
      setInvoiceDpPercent(p.endsWith('.0') ? p.slice(0, -2) : p);
    } else {
      setInvoiceDpPercent('');
    }
  };

  const handleCreateInvoiceSubmit = async () => {
    if (!quote || !user) return;
    setIsCreatingInvoice(true);

    try {
      const year = new Date().getFullYear();
      const { data: latestInvoices, error: numberError } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('user_id', user.id)
        .like('invoice_number', `INV-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (!numberError && latestInvoices && latestInvoices.length > 0 && latestInvoices[0].invoice_number) {
        const lastNumber = latestInvoices[0].invoice_number.split('-').pop();
        if (lastNumber && !Number.isNaN(Number.parseInt(lastNumber, 10))) {
          nextNumber = Number.parseInt(lastNumber, 10) + 1;
        }
      }

      const newInvoicePayload = {
        user_id: user.id,
        quote_id: quote.id,
        client_id: quote.client_id,
        project_id: quote.project_id || null,
        from_company: quote.from_company,
        from_address: quote.from_address,
        from_website: quote.from_website,
        to_client: quote.to_client,
        to_address: quote.to_address,
        to_phone: quote.to_phone,
        title: quote.title,
        discount_amount: quote.discount_amount,
        tax_amount: quote.tax_amount,
        terms: quote.terms,
        status: invoiceDpAmount >= total && total > 0 ? 'Lunas' : 'Draf',
        invoice_number: `INV-${year}-${String(nextNumber).padStart(3, '0')}`,
        invoice_date: new Date().toISOString(),
        due_date: quote.valid_until || null,
        down_payment_amount: invoiceDpAmount,
        attachments: quote.attachments || [],
      };

      let invoiceResult = await supabase
        .from('invoices')
        .insert(newInvoicePayload)
        .select('id')
        .single();

      if (isMissingColumnError(invoiceResult.error)) {
        const { project_id, down_payment_amount, ...compatiblePayload } = newInvoicePayload;
        invoiceResult = await supabase
          .from('invoices')
          .insert(compatiblePayload)
          .select('id')
          .single();
      }

      if (invoiceResult.error || !invoiceResult.data) {
        showError(`Gagal membuat faktur dari penawaran: ${invoiceResult.error?.message || 'data faktur kosong'}`);
        console.error(invoiceResult.error);
        return;
      }

      const newInvoice = invoiceResult.data;

      if (quote.quote_items && quote.quote_items.length > 0) {
        const newInvoiceItemsPayload = quote.quote_items.map(({ description, quantity, unit, unit_price, cost_price, item_id }) => ({
          invoice_id: newInvoice.id,
          item_id,
          description,
          quantity,
          unit,
          unit_price,
          cost_price,
        }));

        let itemsResult = await supabase.from('invoice_items').insert(newInvoiceItemsPayload);

        if (isMissingColumnError(itemsResult.error)) {
          const compatibleItemsPayload = newInvoiceItemsPayload.map(({ item_id, ...item }) => item);
          itemsResult = await supabase.from('invoice_items').insert(compatibleItemsPayload);
        }

        if (itemsResult.error) {
          showError(`Gagal menyalin item ke faktur: ${itemsResult.error.message}`);
          await supabase.from('invoices').delete().match({ id: newInvoice.id });
          console.error(itemsResult.error);
          return;
        }
      }

      // Catat DP di tabel pembayaran jika dipilih
      if (invoiceDpAmount > 0 && recordAsPayment) {
        const pDesc = invoiceDpPercent 
          ? `Uang Muka (DP ${invoiceDpPercent}%) dari Penawaran #${quote.quote_number}`
          : `Uang Muka (DP) dari Penawaran #${quote.quote_number}`;
        
        await supabase.from('payments').insert({
          invoice_id: newInvoice.id,
          user_id: user.id,
          amount: invoiceDpAmount,
          payment_date: new Date().toISOString(),
          notes: pDesc,
          status: 'Lunas',
        });
      }

      // Tandai status penawaran Diterima
      if (quote.status !== 'Diterima' && quote.status !== 'accepted') {
        await supabase.from('quotes').update({ status: 'Diterima' }).eq('id', quote.id);
        setQuote({ ...quote, status: 'Diterima' });
      }

      showSuccess('Faktur berhasil dibuat dengan rincian DP!');
      setIsCreateInvoiceDialogOpen(false);
      navigate(`/invoice/${newInvoice.id}`);
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleCreateProject = async () => {
    if (!quote || !user) return;

    const subtotal = calculateSubtotal(quote.quote_items);
    const total = calculateTotal(subtotal, quote.discount_amount, quote.tax_amount);

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        client_id: quote.client_id,
        name: quote.title || `Proyek ${quote.quote_number}`,
        description: `Dibuat dari penawaran ${quote.quote_number}`,
        status: 'Ongoing',
        budget: total
      })
      .select()
      .single();

    if (error) {
      showError(`Gagal membuat proyek: ${error.message}`);
    } else {
      await supabase.from('quotes').update({ project_id: newProject.id }).eq('id', quote.id);
      showSuccess('Proyek berhasil dibuat!');
      navigate(`/project/${newProject.id}`);
    }
  };

  const handleAcceptQuote = async () => {
    if (!id || !quote) return;
    try {
      const { error } = await supabase.from('quotes').update({ status: 'Diterima' }).eq('id', id);
      if (error) {
        showError(`Gagal memperbarui status: ${error.message}`);
      } else {
        showSuccess('Penawaran berhasil ditandai Diterima!');
        setQuote({ ...quote, status: 'Diterima' });
      }
    } catch (err: any) {
      console.error(err);
      showError('Terjadi kesalahan saat memperbarui status.');
    }
  };

  const handleSaveAsPDF = async () => {
    if (!quoteRef.current || !quote) return;
    setIsGeneratingPDF(true);
    await generatePdf(quoteRef.current, `Penawaran-${quote.quote_number || quote.id}.pdf`, { format: 'a4', continuous: true });
    setIsGeneratingPDF(false);
  };

  const handlePrint = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
    }

    const handleAfterPrint = () => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
      window.removeEventListener('afterprint', handleAfterPrint);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    window.print();
  };

  const handleDeleteQuote = async () => {
    if (!id) return;
    const { error } = await supabase.from('quotes').delete().match({ id });
    if (error) {
      showError('Gagal menghapus penawaran.');
    } else {
      showSuccess('Penawaran berhasil dihapus.');
      navigate('/quotes');
    }
  };

  const subtotal = useMemo(() => calculateSubtotal(quote?.quote_items || []), [quote]);
  const discountAmount = useMemo(() => quote?.discount_amount || 0, [quote]);
  const taxAmount = useMemo(() => quote?.tax_amount || 0, [quote]);
  const total = useMemo(() => calculateTotal(subtotal, discountAmount, taxAmount), [subtotal, discountAmount, taxAmount]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-8 space-y-4 max-w-5xl">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-[600px] w-full rounded-3xl" />
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  const isAccepted = quote.status === 'Diterima' || quote.status === 'accepted';

  return (
    <div className="min-h-screen bg-background px-3 py-6 text-foreground sm:px-6 lg:px-8 space-y-6 print:min-h-0 print:p-0 print:m-0 print:bg-white print:space-y-0 print:w-full print:max-w-none">
      <SendDocumentDialog
        isOpen={isSendDialogOpen}
        setIsOpen={setIsSendDialogOpen}
        docType="quote"
        docId={quote.id}
        docNumber={quote.quote_number}
        clientName={quote.to_client}
        clientEmail={quote.clients?.email}
        clientPhone={quote.clients?.phone || quote.to_phone}
        publicLink={`${window.location.origin}/quote/public/${quote.id}`}
        onSend={() => {}}
      />

      {/* Dialog Konversi Penawaran ke Faktur & Hitung DP Otomatis */}
      <Dialog open={isCreateInvoiceDialogOpen} onOpenChange={setIsCreateInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl p-6 border border-border/80 shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-500" />
              Buat Faktur Tagihan dari Penawaran
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Penawaran #{quote.quote_number} • Klien: <strong className="text-foreground">{quote.to_client}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Total Nilai Penawaran Card */}
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Nilai Penawaran</span>
                <h3 className="text-xl font-black text-foreground tabular-nums">{formatCurrency(total)}</h3>
              </div>
              <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/30">
                {quote.quote_items?.length || 0} Item
              </Badge>
            </div>

            {/* Pilihan Uang Muka (DP) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Tentukan Uang Muka (DP)
                </Label>
                {/* Preset Pills */}
                <div className="flex items-center gap-1">
                  {[
                    { label: '0%', val: 0 },
                    { label: '30%', val: 30 },
                    { label: '50%', val: 50 },
                    { label: '70%', val: 70 },
                    { label: '100%', val: 100 },
                  ].map(btn => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => handleDialogDpPreset(btn.val)}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all",
                        (btn.val === 0 && invoiceDpAmount === 0) || (invoiceDpPercent === String(btn.val))
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/80"
                      )}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dual Input: Percentage and Nominal */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative flex items-center">
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={invoiceDpPercent}
                    onChange={e => handleDialogDpPercentChange(e.target.value)}
                    className="h-10 rounded-xl pr-8 text-xs font-bold text-right tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 text-xs font-bold text-muted-foreground select-none">%</span>
                </div>

                <div className="relative flex items-center">
                  <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground select-none">Rp</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    className="h-10 rounded-xl pl-9 text-right text-xs font-bold tabular-nums"
                    value={formatNumberWithDots(invoiceDpAmount)}
                    onChange={e => handleDialogDpAmountChange(parseDotsToNumber(e.target.value))}
                  />
                </div>
              </div>

              {/* Breakdown Preview */}
              <div className="rounded-2xl bg-muted/30 border border-border/80 p-3.5 space-y-2">
                <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Uang Muka (DP){invoiceDpPercent ? ` ${invoiceDpPercent}%` : ''}:</span>
                  <span className="tabular-nums font-black">{formatCurrency(invoiceDpAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-foreground">
                  <span className="text-muted-foreground">Sisa Tagihan / Pelunasan:</span>
                  <span className="tabular-nums font-black text-rose-600 dark:text-rose-400">
                    {formatCurrency(Math.max(0, total - invoiceDpAmount))}
                  </span>
                </div>
              </div>

              {/* Checkbox: Record directly to payments */}
              {invoiceDpAmount > 0 && (
                <div className="flex items-start space-x-2 pt-1">
                  <Checkbox
                    id="recordPayment"
                    checked={recordAsPayment}
                    onCheckedChange={(checked) => setRecordAsPayment(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="recordPayment"
                    className="text-xs text-muted-foreground leading-tight cursor-pointer font-medium select-none"
                  >
                    Catat langsung penerimaan DP ini sebagai <strong className="text-foreground">Kas Masuk & Pembayaran Lunas</strong> di riwayat faktur dan keuangan proyek.
                  </label>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateInvoiceDialogOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              onClick={handleCreateInvoiceSubmit}
              disabled={isCreatingInvoice}
              className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Receipt className="mr-1.5 h-4 w-4" />
              {isCreatingInvoice ? 'Membuat Faktur...' : 'Buat Faktur Tagihan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* HEADER ACTION TOOLBAR (EXCLUDED FROM PRINT & PDF) */}
      {/* ========================================================================= */}
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden no-pdf">
        <Button asChild variant="outline" className="rounded-xl h-11 px-4 text-xs font-bold self-start sm:self-auto border-border/80 hover:bg-muted">
          <Link to="/quotes"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
        </Button>

        <div className="flex w-full sm:w-auto flex-wrap items-center justify-end gap-2">
          {!isAccepted ? (
            <>
              <Button onClick={handleAcceptQuote} className="rounded-xl h-11 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Tandai Diterima
              </Button>
              <Button onClick={handleOpenCreateInvoiceDialog} className="rounded-xl h-11 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
                <Receipt className="mr-1.5 h-4 w-4" /> Buat Faktur (DP)
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleOpenCreateInvoiceDialog} disabled={isCreatingInvoice} className="rounded-xl h-11 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
                <Receipt className="mr-1.5 h-4 w-4" /> Buat Faktur (DP)
              </Button>
              <Button onClick={handleCreateProject} className="rounded-xl h-11 px-4 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs">
                <FolderKanban className="mr-1.5 h-4 w-4" /> Buat Proyek
              </Button>
            </>
          )}

          <Button onClick={() => setIsSendDialogOpen(true)} className="rounded-xl h-11 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
            <Send className="mr-1.5 h-4 w-4" /> Kirim
          </Button>

          <Button asChild variant="outline" className="rounded-xl h-11 px-3 text-xs font-bold border-border/80 hover:bg-muted">
            <Link to={`/quote/edit/${id}`}><Pencil className="mr-1.5 h-4 w-4" /> Edit</Link>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="rounded-xl h-11 px-3 text-xs font-bold">
                <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl p-6">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base font-bold">Hapus Surat Penawaran?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  Tindakan ini tidak dapat dibatalkan. Surat penawaran #{quote.quote_number} akan dihapus secara permanen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 pt-2">
                <AlertDialogCancel className="rounded-xl text-xs font-semibold">Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteQuote} className="rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF} variant="outline" className="rounded-xl h-11 px-4 text-xs font-bold border-border/80 hover:bg-muted">
            <Download className="mr-1.5 h-4 w-4 text-primary" />
            {isGeneratingPDF ? 'Membuat PDF...' : 'PDF 1 Halaman'}
          </Button>

          <Button onClick={handlePrint} variant="outline" className="rounded-xl h-11 px-3 text-xs font-bold border-border/80 hover:bg-muted">
            <Printer className="mr-1.5 h-4 w-4" /> Cetak
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN SINGLE-PAGE QUOTATION DOCUMENT CARD (THE ONLY PART PRINTED & EXPORTED) */}
      {/* ========================================================================= */}
      <div className="mx-auto max-w-5xl print:max-w-none print:m-0 print:p-0 print:w-full print:bg-white">
        <Card ref={quoteRef} className="document-print-root overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm print:shadow-none print:border-none print:rounded-none print:m-0 print:p-0 print:w-full print:bg-white">
          {/* Letterhead Header */}
          <CardHeader className="p-5 sm:p-7 border-b border-border/70 bg-muted/20 print:p-0 print:pb-4 print:border-b-2 print:border-slate-800 print:bg-transparent">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                {profile?.company_logo_url ? (
                  <img src={profile.company_logo_url} alt="Company Logo" className="mb-2 max-h-14 object-contain" />
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black text-base print:hidden">
                      {quote.from_company.slice(0, 1) || 'P'}
                    </div>
                    <h1 className="text-lg sm:text-xl font-black leading-tight text-foreground tracking-tight print:text-2xl print:text-black">
                      {quote.from_company}
                    </h1>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground space-y-0.5 print:text-slate-600">
                  <p>{quote.from_address}</p>
                  {quote.from_website && <p className="text-primary font-medium print:text-slate-800">{quote.from_website}</p>}
                </div>
              </div>

              <div className="shrink-0 text-left sm:text-right space-y-1.5">
                <div className="inline-block px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[11px] font-black tracking-wider uppercase print:border-slate-800 print:bg-slate-100 print:text-slate-900">
                  SURAT PENAWARAN
                </div>
                <div className="print:hidden">
                  <Badge variant={getStatusVariant(quote.status)} className="text-[10px] font-bold">
                    {quote.status || 'Draf'}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-0.5 pt-0.5 print:text-slate-700">
                  <p><strong>No:</strong> {quote.quote_number}</p>
                  <p><strong>Tanggal:</strong> {safeFormat(quote.quote_date, 'd MMMM yyyy')}</p>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-7 space-y-4 print:p-0 print:pt-4 print:space-y-4">
            {/* Bill To & Subject Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/70 text-xs print:bg-slate-50 print:border-slate-300 print:rounded-xl">
              <div className="space-y-0.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">Ditujukan Kepada:</h3>
                <p className="font-black text-sm text-foreground print:text-black">{quote.to_client}</p>
                <p className="text-[11px] text-muted-foreground print:text-slate-600">{quote.to_address}</p>
                {quote.to_phone && <p className="text-[11px] text-muted-foreground print:text-slate-600">{quote.to_phone}</p>}
              </div>

              <div className="sm:text-right space-y-0.5 sm:border-l sm:border-border/70 sm:pl-4 print:border-slate-300">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">Perihal / Proyek:</h3>
                <p className="font-extrabold text-sm text-foreground print:text-black">{quote.title || '-'}</p>
                <div className="pt-1 text-[11px] text-muted-foreground print:text-slate-600">
                  <span>Berlaku Hingga: </span>
                  <strong className="text-foreground print:text-black">{safeFormat(quote.valid_until, 'd MMMM yyyy')}</strong>
                </div>
              </div>
            </div>
            
            {/* Document Items Table */}
            <div className="space-y-1">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-700">
                Rincian Barang & Jasa
              </h4>
              <div className="rounded-2xl border border-border/80 overflow-hidden text-xs print:border-slate-300 print:rounded-xl">
                <DocumentItemsTable 
                  items={quote.quote_items} 
                  config={{
                    showQuantity: profile?.show_quantity_column,
                    showUnit: profile?.show_unit_column,
                    showUnitPrice: profile?.show_unit_price_column
                  }}
                />
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="flex justify-end pt-1">
              <div className="w-full sm:w-72 rounded-2xl bg-muted/20 p-4 border border-border/80 space-y-1.5 text-xs print:bg-slate-50 print:border-slate-300 print:rounded-xl">
                <div className="flex justify-between font-medium text-muted-foreground print:text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-bold text-foreground tabular-nums print:text-black">{formatCurrency(subtotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium print:text-rose-700">
                    <span>Diskon:</span>
                    <span className="font-bold tabular-nums">- {formatCurrency(discountAmount)}</span>
                  </div>
                )}

                {taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground font-medium print:text-slate-600">
                    <span>Pajak (PPN):</span>
                    <span className="font-bold text-foreground tabular-nums print:text-black">+ {formatCurrency(taxAmount)}</span>
                  </div>
                )}

                <Separator className="my-1.5 border-border/60 print:border-slate-300" />

                <div className="flex justify-between text-xs sm:text-sm font-black text-foreground print:text-black">
                  <span>Total Penawaran:</span>
                  <span className="text-primary tabular-nums print:text-slate-900 font-black">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            {quote.terms && (
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-1 print:bg-slate-50 print:border-slate-300 print:rounded-xl">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 print:text-slate-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary print:text-slate-800" /> Syarat & Ketentuan:
                </h3>
                <p className="whitespace-pre-wrap text-[11px] text-muted-foreground leading-relaxed font-sans print:text-slate-700">{quote.terms}</p>
              </div>
            )}

            {/* Attachments (Screen only) */}
            {quote.attachments && quote.attachments.length > 0 && (
              <div className="space-y-2 no-pdf print:hidden">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lampiran Berkas:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quote.attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center justify-between p-2.5 border border-border/80 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-primary hover:underline truncate">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{attachment.name}</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>

          {profile?.custom_footer && (
            <CardFooter className="p-4 sm:p-5 pt-3 border-t border-border/70 bg-muted/20 text-center print:bg-transparent print:border-t print:border-slate-300 print:p-2">
              <p className="text-[11px] text-muted-foreground text-center w-full whitespace-pre-wrap leading-relaxed print:text-slate-600">{profile.custom_footer}</p>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SECTION: PROFIT ANALYSIS & DOCUMENT TIMELINE (EXCLUDED FROM PRINT/PDF) */}
      {/* ========================================================================= */}
      <div className="mx-auto max-w-5xl space-y-6 pt-2 print:hidden no-pdf">
        {/* 1. Analisis Keuntungan Full-Width */}
        <ProfitAnalysisCard 
          items={quote.quote_items} 
          discountAmount={quote.discount_amount} 
          taxAmount={quote.tax_amount} 
          type="Penawaran"
        />
        
        {/* 2. Riwayat Dokumen Full-Width */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Riwayat & Jejak Aktivitas Dokumen</h3>
              <p className="text-xs text-muted-foreground">Catatan interaksi pembuatan, pengiriman, dan pembukaan oleh klien.</p>
            </div>
          </div>

          <DocumentTimeline docId={id!} type="quote" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CRISP CORPORATE PRINT STYLES - 1 SINGLE CLEAN PAGE */}
      {/* ========================================================================= */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          *, *::before, *::after {
            background-image: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body, #root, #root *, .min-h-screen, .min-h-screen * {
            background-color: #ffffff !important;
            background: #ffffff !important;
            background-image: none !important;
            color: #0f172a !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
          .min-h-screen {
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
          }
          .document-print-root {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print\\:hidden, .no-pdf {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default QuoteView;
