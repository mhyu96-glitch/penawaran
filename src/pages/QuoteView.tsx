import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download, Receipt, Share2, FileText, Smartphone } from 'lucide-react';
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
import { formatCurrency, safeFormat, calculateSubtotal, calculateTotal, calculateItemTotal, getStatusVariant } from '@/lib/utils';
import { generatePdf } from '@/utils/pdfGenerator';
import { DocumentItemsTable } from '@/components/DocumentItemsTable';
import ProfitAnalysisCard from '@/components/ProfitAnalysisCard';

interface Attachment {
  name: string;
  url: string;
  path: string;
}

type QuoteDetails = {
  id: string;
  user_id: string;
  from_company: string;
  from_address: string;
  from_website: string;
  to_client: string;
  to_address: string;
  to_phone: string;
  client_id: string;
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
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    cost_price: number;
  }[];
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

const QuoteView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: quoteId, created_at, quote_number, quote_date, valid_until, status, quote_items, attachments, ...invoiceData } = quote;

    const newInvoicePayload = {
      ...invoiceData,
      quote_id: quote.id,
      status: 'Draf',
      invoice_date: new Date().toISOString(),
      attachments: attachments,
    };

    const { data: newInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(newInvoicePayload)
      .select('id')
      .single();

    if (invoiceError || !newInvoice) {
      showError('Gagal membuat faktur dari penawaran.');
      console.error(invoiceError);
      return;
    }

    if (quote.quote_items && quote.quote_items.length > 0) {
      const newInvoiceItemsPayload = quote.quote_items.map(item => ({
        invoice_id: newInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(newInvoiceItemsPayload);

      if (itemsError) {
        showError('Gagal menyalin item ke faktur.');
        await supabase.from('invoices').delete().match({ id: newInvoice.id });
        console.error(itemsError);
        return;
      }
    }

    showSuccess('Faktur berhasil dibuat. Silakan periksa detailnya.');
    navigate(`/invoice/edit/${newInvoice.id}`);
  };

  const handleWhatsAppShare = () => {
    if (!quote) return;

    if (!quote.to_phone) {
        showError("Nomor telepon klien tidak tersedia. Silakan edit penawaran untuk menambahkan nomor telepon.");
        return;
    }

    const phoneNumber = quote.to_phone.replace(/\D/g, '');
    const formattedPhone = phoneNumber.startsWith('0') ? '62' + phoneNumber.slice(1) : phoneNumber;

    const messageTemplate = profile?.whatsapp_quote_template || 'Halo {client_name}, berikut adalah penawaran #{number} perihal {title}. Silakan tinjau detailnya melalui tautan berikut: {link}';
    const publicLink = `${window.location.origin}/quote/public/${quote.id}`;

    const message = messageTemplate
      .replace(/{client_name}/g, quote.to_client)
      .replace(/{number}/g, quote.quote_number)
      .replace(/{title}/g, quote.title || 'Barang & Jasa')
      .replace(/{company_name}/g, quote.from_company)
      .replace(/{link}/g, publicLink);

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
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

  const handleShareLink = () => {
    const link = `${window.location.origin}/quote/public/${id}`;
    navigator.clipboard.writeText(link);
    showSuccess('Tautan publik telah disalin ke clipboard!');
  };

  const subtotal = useMemo(() => calculateSubtotal(quote?.quote_items || []), [quote]);
  const totalCost = useMemo(() => quote?.quote_items.reduce((acc, item) => acc + calculateItemTotal(item.quantity, item.cost_price), 0) || 0, [quote]);
  const discountAmount = useMemo(() => quote?.discount_amount || 0, [quote]);
  const taxAmount = useMemo(() => quote?.tax_amount || 0, [quote]);
  const total = useMemo(() => calculateTotal(subtotal, discountAmount, taxAmount), [subtotal, discountAmount, taxAmount]);
  const profit = useMemo(() => total - totalCost - taxAmount, [total, totalCost, taxAmount]);

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
        <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden">
            <Button asChild variant="outline"><Link to="/quotes"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar</Link></Button>
            <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button onClick={handleWhatsAppShare} className="bg-green-600 hover:bg-green-700 text-white"><Smartphone className="mr-2 h-4 w-4" /> Kirim WA</Button>
                {quote.status === 'Terkirim' && (<Button onClick={handleShareLink} variant="secondary"><Share2 className="mr-2 h-4 w-4" /> Salin Tautan</Button>)}
                {quote.status === 'Diterima' && (<Button onClick={handleCreateInvoice}><Receipt className="mr-2 h-4 w-4" /> Buat Faktur</Button>)}
                <Button asChild variant="outline"><Link to={`/quote/edit/${id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link></Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Hapus</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Ini akan menghapus penawaran secara permanen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteQuote}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> Ekspor PDF</>}</Button>
                <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
            </div>
        </div>
      <Card ref={quoteRef} className="max-w-4xl mx-auto shadow-lg print:shadow-none print:border-none">
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
              <div className="no-pdf">
                <Separator className="print:hidden" />
                <div className="flex justify-between text-sm print:hidden"><span className="text-muted-foreground">Total Modal</span><span>{formatCurrency(totalCost)}</span></div>
                <div className="flex justify-between font-semibold text-green-600 print:hidden"><span >Keuntungan</span><span>{formatCurrency(profit)}</span></div>
              </div>
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

      {/* Profit Analysis Card - Internal Only */}
      <div className="max-w-4xl mx-auto">
        <ProfitAnalysisCard 
            items={quote.quote_items} 
            discountAmount={quote.discount_amount} 
            taxAmount={quote.tax_amount} 
            type="Penawaran"
        />
      </div>

      <style>{`@media print { body { background-color: white; } .print\\:shadow-none { box-shadow: none; } .print\\:border-none { border: none; } .print\\:hidden { display: none; } }`}</style>
    </div>
  );
};

export default QuoteView;