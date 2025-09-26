import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';
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

type QuoteDetails = {
  id: string;
  from_company: string;
  from_address: string;
  from_website: string;
  to_client: string;
  to_address: string;
  to_phone: string;
  quote_number: string;
  quote_date: string;
  valid_until: string;
  discount_percentage: number;
  tax_percentage: number;
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

  const handleSaveAsPDF = () => {
    if (!quoteRef.current || !quote) return;
    setIsGeneratingPDF(true);

    // Temporarily hide elements not intended for the PDF
    const elementsToHide = quoteRef.current.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    html2canvas(quoteRef.current, { scale: 2, useCORS: true })
      .then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [595, 935] });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        let imgWidth = pdfWidth;
        let imgHeight = pdfWidth / ratio;

        if (imgHeight > pdfHeight) {
          imgHeight = pdfHeight;
          imgWidth = imgHeight * ratio;
        }

        const x = (pdfWidth - imgWidth) / 2;
        const y = 0;

        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        pdf.save(`Penawaran-${quote.quote_number || quote.id}.pdf`);
      })
      .catch(err => {
        console.error("Error generating PDF", err);
        showError("Gagal membuat PDF.");
      })
      .finally(() => {
        // Show the elements again
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

  const subtotal = useMemo(() => {
    if (!quote) return 0;
    return quote.quote_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  }, [quote]);

  const totalCost = useMemo(() => {
    if (!quote) return 0;
    return quote.quote_items.reduce((acc, item) => acc + item.quantity * (item.cost_price || 0), 0);
  }, [quote]);

  const discountAmount = useMemo(() => subtotal * ((quote?.discount_percentage || 0) / 100), [subtotal, quote]);
  const taxAmount = useMemo(() => (subtotal - discountAmount) * ((quote?.tax_percentage || 0) / 100), [subtotal, discountAmount, quote]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);
  const profit = useMemo(() => total - totalCost - (total - subtotal + discountAmount), [total, totalCost, subtotal, discountAmount]);


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
        <CardHeader className="bg-gray-50 p-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{quote.from_company}</h1>
              <p className="text-muted-foreground">{quote.from_address}</p>
              <p className="text-muted-foreground">{quote.from_website}</p>
            </div>
            <div className="text-right space-y-1">
              <h2 className="text-4xl font-bold uppercase text-gray-400">Penawaran</h2>
              <Badge variant={getStatusVariant(quote.status)} className="text-sm">{quote.status || 'Draf'}</Badge>
              <p className="text-muted-foreground">No: {quote.quote_number}</p>
              <p className="text-muted-foreground">Tanggal: {format(new Date(quote.quote_date), 'PPP')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-500 mb-2">Ditujukan Kepada:</h3>
              <p className="font-bold">{quote.to_client}</p>
              <p>{quote.to_address}</p>
              <p>{quote.to_phone}</p>
            </div>
            <div className="text-right">
                <h3 className="font-semibold text-gray-500 mb-2">Berlaku Hingga:</h3>
                <p>{quote.valid_until ? format(new Date(quote.valid_until), 'PPP') : 'N/A'}</p>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Diskon ({quote.discount_percentage}%)</span><span>- {formatCurrency(discountAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pajak ({quote.tax_percentage}%)</span><span>+ {formatCurrency(taxAmount)}</span></div>
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