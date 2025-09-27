import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download, Receipt, Share2 } from 'lucide-react';
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
  quote_items: {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    cost_price: number;
  }[];
};

const QuoteView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetails | null>(null);
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
      }
      setLoading(false);
    };

    fetchQuote();
  }, [id, navigate]);

  const handleCreateInvoice = async () => {
    if (!quote || !user) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: quoteId, created_at, quote_number, quote_date, valid_until, status, quote_items, ...invoiceData } = quote;

    const newInvoicePayload = {
      ...invoiceData,
      quote_id: quote.id,
      status: 'Draf',
      invoice_date: new Date().toISOString(),
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

    const elementsToHide = quoteRef.current.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    html2canvas(quoteRef.current, { scale: 2, useCORS: true })
      .then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = 595; // A4 width in points
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: [pdfWidth, pdfHeight]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Penawaran-${quote.quote_number || quote.id}.pdf`);
      })
      .catch(err => {
        console.error("Error generating PDF", err);
        showError("Gagal membuat PDF.");
      })
      .finally(() => {
        elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
        setIsGeneratingPDF(false);
      });
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

  const subtotal = useMemo(() => {
    if (!quote) return 0;
    return quote.quote_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  }, [quote]);

  const totalCost = useMemo(() => {
    if (!quote) return 0;
    return quote.quote_items.reduce((acc, item) => acc + item.quantity * (item.cost_price || 0), 0);
  }, [quote]);

  const discountAmount = useMemo(() => quote?.discount_amount || 0, [quote]);
  const taxAmount = useMemo(() => quote?.tax_amount || 0, [quote]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);
  const profit = useMemo(() => total - totalCost - taxAmount, [total, totalCost, taxAmount]);


  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Diterima': return 'default';
      case 'Terkirim': return 'secondary';
      case 'Ditolak': return 'destructive';
      case 'Draf': return 'outline';
      default: return 'outline';
    }
  };

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

  const formatCurrency = (amount: number) => amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
        <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden">
            <Button asChild variant="outline">
                <Link to="/quotes"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar</Link>
            </Button>
            <div className="flex items-center gap-2 flex-wrap justify-end">
                {quote.status === 'Terkirim' && (
                  <Button onClick={handleShareLink} variant="secondary">
                    <Share2 className="mr-2 h-4 w-4" /> Bagikan Tautan
                  </Button>
                )}
                {quote.status === 'Diterima' && (
                  <Button onClick={handleCreateInvoice}>
                    <Receipt className="mr-2 h-4 w-4" /> Buat Faktur
                  </Button>
                )}
                <Button asChild variant="outline">
                    <Link to={`/quote/edit/${id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link>
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Hapus</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Ini akan menghapus penawaran secara permanen.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteQuote}>Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>
                    {isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> PDF</>}
                </Button>
                <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
            </div>
        </div>
      <Card ref={quoteRef} className="max-w-4xl mx-auto shadow-lg print:shadow-none print:border-none">
        <CardHeader className="bg-gray-50 p-8 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{quote.from_company}</h1>
              <p className="text-sm text-muted-foreground">{quote.from_address}</p>
              <p className="text-sm text-muted-foreground">{quote.from_website}</p>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold uppercase text-gray-400 tracking-widest">Penawaran</h2>
              <div className="mt-1">
                <Badge variant={getStatusVariant(quote.status)} className="text-xs">{quote.status || 'Draf'}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">No: {quote.quote_number}</p>
              <p className="text-sm text-muted-foreground">Tanggal: {format(new Date(quote.quote_date), 'PPP', { locale: localeId })}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-500 mb-2 text-sm">Ditujukan Kepada:</h3>
              <p className="font-bold">{quote.to_client}</p>
              <p className="text-sm">{quote.to_address}</p>
              <p className="text-sm">{quote.to_phone}</p>
            </div>
            <div className="text-right">
                <h3 className="font-semibold text-gray-500 mb-2 text-sm">Berlaku Hingga:</h3>
                <p className="text-sm">{quote.valid_until ? format(new Date(quote.valid_until), 'PPP', { locale: localeId }) : 'N/A'}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr className="border-b">
                  <th className="p-3 text-center font-medium text-gray-700 w-[40px]">No.</th>
                  <th className="p-3 text-left font-medium text-gray-700">Deskripsi</th>
                  <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Jumlah</th>
                  <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Satuan</th>
                  <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Harga Satuan</th>
                  <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.quote_items.map((item, index) => (
                  <tr key={index} className="border-b last:border-none">
                    <td className="p-3 text-center align-top">{index + 1}</td>
                    <td className="p-3 align-top">{item.description}</td>
                    <td className="p-3 text-center align-top">{item.quantity}</td>
                    <td className="p-3 text-center align-top">{item.unit || '-'}</td>
                    <td className="p-3 text-right align-top">{formatCurrency(item.unit_price)}</td>
                    <td className="p-3 text-right align-top">{formatCurrency(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>- {formatCurrency(discountAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>+ {formatCurrency(taxAmount)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span >Total</span><span>{formatCurrency(total)}</span></div>
              <Separator className="print:hidden no-pdf" />
              <div className="flex justify-between text-sm print:hidden no-pdf"><span className="text-muted-foreground">Total Modal</span><span>{formatCurrency(totalCost)}</span></div>
              <div className="flex justify-between font-semibold text-green-600 print:hidden no-pdf"><span >Keuntungan</span><span>{formatCurrency(profit)}</span></div>
            </div>
          </div>
          
          {quote.terms && (
            <div>
                <h3 className="font-semibold text-gray-500 mb-2">Syarat & Ketentuan:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.terms}</p>
            </div>
          )}

        </CardContent>
      </Card>
      <style>{`
        @media print {
          body {
            background-color: white;
          }
          .print\\:shadow-none { box-shadow: none; }
          .print\\:border-none { border: none; }
          .print\\:hidden { display: none; }
        }
      `}</style>
    </div>
  );
};

export default QuoteView;