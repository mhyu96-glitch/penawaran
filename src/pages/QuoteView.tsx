import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Printer, ArrowLeft, Pencil, Trash2, Download, Receipt, 
  FileText, Send, FolderKanban, MoreVertical, CheckCircle2,
  Building2, MapPin, Phone, Globe, ShieldCheck, History, TrendingUp, Sparkles
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
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/SessionContext';
import { formatCurrency, safeFormat, calculateSubtotal, calculateTotal, getStatusVariant } from '@/lib/utils';
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

  const handleCreateInvoice = async () => {
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
        status: 'Draf',
        invoice_number: `INV-${year}-${String(nextNumber).padStart(3, '0')}`,
        invoice_date: new Date().toISOString(),
        due_date: quote.valid_until || null,
        down_payment_amount: 0,
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

      showSuccess('Faktur berhasil dibuat. Silakan periksa detailnya.');
      navigate(`/invoice/edit/${newInvoice.id}`);
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
    await generatePdf(quoteRef.current, `Penawaran-${quote.quote_number || quote.id}.pdf`);
    setIsGeneratingPDF(false);
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
    <div className="min-h-screen bg-background px-3 py-6 text-foreground sm:px-6 lg:px-8 space-y-6">
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

      {/* ========================================================================= */}
      {/* HEADER ACTION TOOLBAR */}
      {/* ========================================================================= */}
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" className="rounded-xl h-11 px-4 text-xs font-bold self-start sm:self-auto border-border/80 hover:bg-muted">
          <Link to="/quotes"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
        </Button>

        <div className="flex w-full sm:w-auto flex-wrap items-center justify-end gap-2">
          {!isAccepted ? (
            <Button onClick={handleAcceptQuote} className="rounded-xl h-11 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Tandai Diterima
            </Button>
          ) : (
            <>
              <Button onClick={handleCreateInvoice} disabled={isCreatingInvoice} className="rounded-xl h-11 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
                <Receipt className="mr-1.5 h-4 w-4" /> {isCreatingInvoice ? 'Membuat Faktur...' : 'Buat Faktur'}
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

          <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF} variant="outline" className="rounded-xl h-11 px-3 text-xs font-bold border-border/80 hover:bg-muted">
            <Download className="mr-1.5 h-4 w-4 text-primary" />
            {isGeneratingPDF ? 'Membuat...' : 'PDF'}
          </Button>

          <Button onClick={() => window.print()} variant="outline" className="rounded-xl h-11 px-3 text-xs font-bold border-border/80 hover:bg-muted">
            <Printer className="mr-1.5 h-4 w-4" /> Cetak
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN FULL-WIDTH QUOTATION DOCUMENT CARD */}
      {/* ========================================================================= */}
      <div className="mx-auto max-w-5xl">
        <Card ref={quoteRef} className="document-print-root overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm print:shadow-none print:border-none">
          {/* Letterhead Header */}
          <CardHeader className="p-6 sm:p-8 border-b border-border/70 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div className="min-w-0 space-y-2">
                {profile?.company_logo_url ? (
                  <img src={profile.company_logo_url} alt="Company Logo" className="mb-3 max-h-16 object-contain" />
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black text-lg">
                      {quote.from_company.slice(0, 1) || 'P'}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black leading-tight text-foreground tracking-tight">
                      {quote.from_company}
                    </h1>
                  </div>
                )}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>{quote.from_address}</p>
                  {quote.from_website && <p className="text-primary font-medium">{quote.from_website}</p>}
                </div>
              </div>

              <div className="shrink-0 text-left sm:text-right space-y-2">
                <div className="inline-block px-3 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-black tracking-wider uppercase">
                  SURAT PENAWARAN
                </div>
                <div>
                  <Badge variant={getStatusVariant(quote.status)} className="text-xs font-bold">
                    {quote.status || 'Draf'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                  <p><strong>No:</strong> {quote.quote_number}</p>
                  <p><strong>Tanggal:</strong> {safeFormat(quote.quote_date, 'PPP')}</p>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Bill To & Subject Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 rounded-2xl bg-muted/20 border border-border/70">
              <div className="space-y-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ditujukan Kepada:</h3>
                <p className="font-black text-base text-foreground">{quote.to_client}</p>
                <p className="text-xs text-muted-foreground">{quote.to_address}</p>
                {quote.to_phone && <p className="text-xs text-muted-foreground">{quote.to_phone}</p>}
              </div>

              <div className="sm:text-right space-y-1 sm:border-l sm:border-border/70 sm:pl-6">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Perihal / Proyek:</h3>
                <p className="font-extrabold text-base text-foreground">{quote.title || '-'}</p>
                <div className="pt-2 text-xs text-muted-foreground">
                  <span>Berlaku Hingga: </span>
                  <strong className="text-foreground">{safeFormat(quote.valid_until, 'PPP')}</strong>
                </div>
              </div>
            </div>
            
            {/* Document Items Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Rincian Barang & Jasa
              </h4>
              <div className="rounded-2xl border border-border/80 overflow-hidden">
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
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-80 rounded-2xl bg-muted/20 p-5 border border-border/80 space-y-2.5 text-xs">
                <div className="flex justify-between font-medium text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-bold text-foreground tabular-nums">{formatCurrency(subtotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                    <span>Diskon:</span>
                    <span className="font-bold tabular-nums">- {formatCurrency(discountAmount)}</span>
                  </div>
                )}

                {taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground font-medium">
                    <span>Pajak (PPN):</span>
                    <span className="font-bold text-foreground tabular-nums">+ {formatCurrency(taxAmount)}</span>
                  </div>
                )}

                <Separator className="my-2 border-border/60" />

                <div className="flex justify-between text-sm sm:text-base font-black text-foreground">
                  <span>Total Penawaran:</span>
                  <span className="text-primary tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            {quote.terms && (
              <div className="p-5 rounded-2xl bg-muted/20 border border-border/80 space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Syarat & Ketentuan:
                </h3>
                <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed font-sans">{quote.terms}</p>
              </div>
            )}

            {/* Attachments */}
            {quote.attachments && quote.attachments.length > 0 && (
              <div className="space-y-3 no-pdf">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lampiran Berkas:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quote.attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-border/80 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors">
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-primary hover:underline truncate">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{attachment.name}</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>

          {profile?.custom_footer && (
            <CardFooter className="p-6 sm:p-8 pt-4 border-t border-border/70 bg-muted/20 text-center">
              <p className="text-xs text-muted-foreground text-center w-full whitespace-pre-wrap leading-relaxed">{profile.custom_footer}</p>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SECTION: FULL-WIDTH PROFIT ANALYSIS & DOCUMENT TIMELINE */}
      {/* ========================================================================= */}
      <div className="mx-auto max-w-5xl space-y-6 pt-2 print:hidden">
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
    </div>
  );
};

export default QuoteView;
