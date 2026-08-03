import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download, Receipt, FileText, Send, FolderKanban } from 'lucide-react';
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
        // Link quote to new project
        await supabase.from('quotes').update({ project_id: newProject.id }).eq('id', quote.id);
        
        showSuccess('Proyek berhasil dibuat!');
        navigate(`/project/${newProject.id}`);
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
      <div className="container mx-auto p-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
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
            onSend={() => {}} // No refresh needed for quote status usually, but can reload if needed
        />

        {/* Header Actions */}
        <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
            <Button asChild variant="outline" className="self-start md:self-auto"><Link to="/quotes"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link></Button>
            <div className="flex items-center gap-2 flex-wrap justify-end w-full md:w-auto">
                <Button onClick={() => setIsSendDialogOpen(true)} variant="default" className="bg-blue-600 hover:bg-blue-700">
                    <Send className="mr-2 h-4 w-4" /> Kirim
                </Button>
                {quote.status === 'Diterima' && (
                    <>
                        <Button onClick={handleCreateInvoice} disabled={isCreatingInvoice} variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                            <Receipt className="mr-2 h-4 w-4" /> {isCreatingInvoice ? 'Membuat...' : 'Buat Faktur'}
                        </Button>
                        <Button onClick={handleCreateProject} variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50"><FolderKanban className="mr-2 h-4 w-4" /> Buat Proyek</Button>
                    </>
                )}
                <Button asChild variant="outline"><Link to={`/quote/edit/${id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link></Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Hapus</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Ini akan menghapus penawaran secara permanen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteQuote}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> PDF</>}</Button>
                <Button onClick={() => window.print()} variant="outline"><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
            </div>
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">
            {/* Main Content: Quote Preview */}
            <div className="lg:col-span-2 space-y-8">
                <Card ref={quoteRef} className="shadow-lg print:shadow-none print:border-none">
                    <CardHeader className="bg-gray-50 p-8 rounded-t-lg">
                    <div className="flex justify-between items-start">
                        <div>
                        {profile?.company_logo_url ? <img src={profile.company_logo_url} alt="Company Logo" className="max-h-20 mb-4" /> : <h1 className="text-2xl font-bold text-gray-800">{quote.from_company}</h1>}
                        <p className="text-sm text-muted-foreground">{quote.from_address}</p>
                        <p className="text-sm text-muted-foreground">{quote.from_website}</p>
                        </div>
                        <div className="text-right">
                        <h2 className="text-3xl font-bold uppercase text-gray-400 tracking-widest" style={{ color: profile?.brand_color || undefined }}>Penawaran</h2>
                        <div className="mt-1"><Badge variant={getStatusVariant(quote.status)} className="text-xs">{quote.status || 'Draf'}</Badge></div>
                        <p className="text-sm text-muted-foreground mt-2">No: {quote.quote_number}</p>
                        <p className="text-sm text-muted-foreground">Tanggal: {safeFormat(quote.quote_date, 'PPP')}</p>
                        </div>
                    </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        <div><h3 className="font-semibold text-gray-500 mb-2 text-sm">Ditujukan Kepada:</h3><p className="font-bold">{quote.to_client}</p><p className="text-sm">{quote.to_address}</p><p className="text-sm">{quote.to_phone}</p></div>
                        <div className="text-right">
                            <h3 className="font-semibold text-gray-500 mb-2 text-sm">Perihal:</h3>
                            <p className="font-bold text-lg">{quote.title || '-'}</p>
                            <h3 className="font-semibold text-gray-500 mb-2 text-sm mt-4">Berlaku Hingga:</h3>
                            <p className="text-sm">{safeFormat(quote.valid_until, 'PPP')}</p>
                        </div>
                    </div>
                    
                    <DocumentItemsTable 
                        items={quote.quote_items} 
                        config={{
                            showQuantity: profile?.show_quantity_column,
                            showUnit: profile?.show_unit_column,
                            showUnitPrice: profile?.show_unit_price_column
                        }}
                    />

                    <div className="flex justify-end">
                        <div className="w-full max-w-xs space-y-2">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>- {formatCurrency(discountAmount)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>+ {formatCurrency(taxAmount)}</span></div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg"><span >Total</span><span>{formatCurrency(total)}</span></div>
                        </div>
                    </div>
                    {quote.terms && (<div><h3 className="font-semibold text-gray-500 mb-2">Syarat & Ketentuan:</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.terms}</p></div>)}
                    {quote.attachments && quote.attachments.length > 0 && (
                        <div className="no-pdf">
                        <h3 className="font-semibold text-gray-500 mb-2">Lampiran:</h3>
                        <div className="space-y-2">
                            {quote.attachments.map((attachment, index) => (
                            <div key={index} className="flex items-center p-2 border rounded-md">
                                <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                <FileText className="h-4 w-4" />
                                {attachment.name}
                                </a>
                            </div>
                            ))}
                        </div>
                        </div>
                    )}
                    </CardContent>
                    {profile?.custom_footer && (
                        <CardFooter className="p-8 pt-4 border-t">
                            <p className="text-xs text-muted-foreground text-center w-full whitespace-pre-wrap">{profile.custom_footer}</p>
                        </CardFooter>
                    )}
                </Card>
            </div>

            {/* Sidebar: Analysis & History */}
            <div className="space-y-6 print:hidden">
                <ProfitAnalysisCard 
                    items={quote.quote_items} 
                    discountAmount={quote.discount_amount} 
                    taxAmount={quote.tax_amount} 
                    type="Penawaran"
                />
                
                <DocumentTimeline docId={id!} type="quote" />
            </div>
        </div>
        <style>{`@media print { body { background-color: white; } .print\\:shadow-none { box-shadow: none; } .print\\:border-none { border: none; } .print\\:hidden { display: none; } }`}</style>
    </div>
  );
};

export default QuoteView;
