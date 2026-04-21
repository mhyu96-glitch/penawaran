import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download, Receipt, Share2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/SessionContext';
import { cn, getStatusVariant } from '@/lib/utils';

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
  quote_date: string;
  valid_until: string;
  discount_amount: number;
  tax_amount: number;
  terms: string;
  status: string;
  template_style?: 'modern' | 'professional' | 'minimalist';
  attachments: Attachment[]; // New field for attachments
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
        const { data: profileData } = await supabase.from('profiles').select('company_logo_url, brand_color, custom_footer, show_quantity_column, show_unit_column, show_unit_price_column').eq('id', data.user_id).single();
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
      attachments: attachments, // Copy attachments to new invoice
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

  const handleSaveAsPDF = () => {
    if (!quoteRef.current || !quote) return;
    setIsGeneratingPDF(true);

    const input = quoteRef.current;
    const originalWidth = input.style.width;
    input.style.width = '1024px'; // Force width for consistent PDF rendering

    const elementsToHide = input.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    html2canvas(input, { scale: 1.5, useCORS: true })
      .then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = 210; // A4 width in mm
        const ratio = canvas.width / pdfWidth;
        const pdfHeight = canvas.height / ratio;

        const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Penawaran-${quote.quote_number || quote.id}.pdf`);
      })
      .catch(err => {
        console.error("Error generating PDF", err);
        showError("Gagal membuat PDF.");
      })
      .finally(() => {
        elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
        input.style.width = originalWidth; // Restore original width
        setIsGeneratingPDF(false);
      });
  };

  const handleDuplicateQuote = async () => {
    if (!quote || !user) return;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: origId, created_at, updated_at, quote_number, quote_items, ...newData } = quote;
    
    const { data: newQuote, error: insertError } = await supabase
      .from('quotes')
      .insert({ 
        ...newData, 
        status: 'Draf', 
        quote_date: new Date().toISOString(), 
        valid_until: null, 
        quote_number: null 
      })
      .select()
      .single();

    if (insertError || !newQuote) {
      showError('Gagal menduplikasi penawaran.');
      console.error('Duplicate quote error:', insertError);
      return;
    }

    if (quote.quote_items && quote.quote_items.length > 0) {
      const newItems = quote.quote_items.map(item => ({
        quote_id: newQuote.id,
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unit: item.unit || '',
        unit_price: Number(item.unit_price) || 0,
        cost_price: Number(item.cost_price) || 0,
      }));

      const { error: itemsError } = await supabase.from('quote_items').insert(newItems);
      if (itemsError) {
        console.error('Duplicate items error:', itemsError);
      }
    }

    showSuccess('Penawaran berhasil diduplikasi ke draf.');
    navigate(`/quote/edit/${newQuote.id}`);
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

  const renderHeader = () => {
    switch (quote.template_style) {
      case 'professional':
        return (
          <CardHeader className="bg-white border-b-2 border-gray-100 p-8">
            <div className="flex justify-between items-center">
              <div>
                {profile?.company_logo_url ? <img src={profile.company_logo_url} alt="Logo" className="max-h-16 mb-4" /> : <h1 className="text-xl font-bold tracking-tight uppercase" style={{ color: profile?.brand_color || '#1e293b' }}>{quote.from_company}</h1>}
                <p className="max-w-xs text-xs text-muted-foreground uppercase tracking-widest">{quote.from_address}</p>
              </div>
              <div className="text-right">
                <h2 className="text-4xl font-light text-gray-300 uppercase tracking-[0.5em] mb-4">Quota</h2>
                <Badge variant={getStatusVariant(quote.status)}>{quote.status}</Badge>
                <div className="mt-4 space-y-1 text-sm font-medium">
                  <p>NO: <span className="text-muted-foreground">{quote.quote_number}</span></p>
                  <p>DATE: <span className="text-muted-foreground">{format(new Date(quote.quote_date), 'dd/MM/yyyy')}</span></p>
                </div>
              </div>
            </div>
          </CardHeader>
        );
      case 'minimalist':
        return (
          <CardHeader className="p-8 pb-0">
            <div className="flex flex-col gap-4">
                <div className="flex justify-between border-b pb-4">
                    <h1 className="text-lg font-bold">{quote.from_company}</h1>
                    <div className="text-right text-xs text-muted-foreground">{quote.from_website}</div>
                </div>
                <div className="flex justify-between items-end">
                    <h2 className="text-2xl font-mono uppercase">Quote.</h2>
                    <div className="text-right text-sm">
                        <p className="font-mono">#{quote.quote_number}</p>
                        <p className="text-muted-foreground text-xs">{format(new Date(quote.quote_date), 'PPP', { locale: localeId })}</p>
                    </div>
                </div>
            </div>
          </CardHeader>
        );
      case 'modern':
      default:
        return (
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
                <p className="text-sm text-muted-foreground">Tanggal: {format(new Date(quote.quote_date), 'PPP', { locale: localeId })}</p>
              </div>
            </div>
          </CardHeader>
        );
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
        <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden">
            <Button asChild variant="outline"><Link to="/quotes"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar</Link></Button>
            <div className="flex items-center gap-2 flex-wrap justify-end">
                {quote.status === 'Terkirim' && (<Button onClick={handleShareLink} variant="secondary"><Share2 className="mr-2 h-4 w-4" /> Bagikan Tautan</Button>)}
                {quote.status === 'Diterima' && (<Button onClick={handleCreateInvoice}><Receipt className="mr-2 h-4 w-4" /> Buat Faktur</Button>)}
                <Button asChild variant="outline"><Link to={`/quote/edit/${id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link></Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Hapus</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Ini akan menghapus penawaran secara permanen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteQuote}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleDuplicateQuote} variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                    <Download className="mr-2 h-4 w-4 rotate-180" /> Duplikat
                </Button>
                <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> Ekspor PDF</>}</Button>
                <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
            </div>
        </div>
      <Card ref={quoteRef} className={cn("max-w-4xl mx-auto shadow-lg print:shadow-none print:border-none", 
        quote.template_style === 'minimalist' ? 'font-mono' : '',
        quote.template_style === 'professional' ? 'rounded-none' : ''
      )}>
        {renderHeader()}
        <CardContent className={cn("p-8 space-y-8", quote.template_style === 'professional' ? 'bg-[#fafafa]' : '')}>
          <div className="grid grid-cols-2 gap-8">
            <div><h3 className="font-semibold text-gray-500 mb-2 text-sm">Ditujukan Kepada:</h3><p className="font-bold">{quote.to_client}</p><p className="text-sm">{quote.to_address}</p><p className="text-sm">{quote.to_phone}</p></div>
            <div className="text-right"><h3 className="font-semibold text-gray-500 mb-2 text-sm">Berlaku Hingga:</h3><p className="text-sm">{quote.valid_until ? format(new Date(quote.valid_until), 'PPP', { locale: localeId }) : 'N/A'}</p></div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100"><tr className="border-b"><th className="p-3 text-center font-medium text-gray-700 w-[40px]">No.</th><th className="p-3 text-left font-medium text-gray-700">Deskripsi</th>{profile?.show_quantity_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Jumlah</th>}{profile?.show_unit_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Satuan</th>}{profile?.show_unit_price_column && <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Harga Satuan</th>}<th className="p-3 text-right font-medium text-gray-700 w-[150px]">Total</th></tr></thead>
              <tbody>{quote.quote_items.map((item, index) => (<tr key={index} className="border-b last:border-none"><td className="p-3 text-center align-top">{index + 1}</td><td className="p-3 align-top">{item.description}</td>{profile?.show_quantity_column && <td className="p-3 text-center align-top">{item.quantity}</td>}{profile?.show_unit_column && <td className="p-3 text-center align-top">{item.unit || '-'}</td>}{profile?.show_unit_price_column && <td className="p-3 text-right align-top">{formatCurrency(item.unit_price)}</td>}<td className="p-3 text-right align-top">{formatCurrency(item.quantity * item.unit_price)}</td></tr>))}</tbody>
            </table>
          </div>
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
      <style>{`@media print { body { background-color: white; } .print\\:shadow-none { box-shadow: none; } .print\\:border-none { border: none; } .print\\:hidden { display: none; } }`}</style>
    </div>
  );
};

export default QuoteView;