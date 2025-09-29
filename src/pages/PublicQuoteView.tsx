import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type QuoteDetails = {
  id: string;
  user_id: string;
  from_company: string;
  from_address: string;
  from_website: string;
  to_client: string;
  to_address: string;
  to_phone: string;
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
  }[];
};

type ProfileInfo = {
    custom_footer: string | null;
    show_quantity_column: boolean;
    show_unit_column: boolean;
    show_unit_price_column: boolean;
};

const PublicQuoteView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionTaken, setActionTaken] = useState('');
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
        setQuote(null);
      } else {
        const quoteData = data as QuoteDetails;
        setQuote(quoteData);
        if (data.status === 'Diterima' || data.status === 'Ditolak') {
            setActionTaken(data.status);
        }
        // Fetch profile settings
        const { data: profileData } = await supabase.from('profiles').select('custom_footer, show_quantity_column, show_unit_column, show_unit_price_column').eq('id', quoteData.user_id).single();
        setProfile(profileData);
      }
      setLoading(false);
    };

    fetchQuote();
  }, [id, navigate]);

  const handleStatusUpdate = async (newStatus: 'Diterima' | 'Ditolak') => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`https://xukpisovkcflcwuhrzkx.supabase.co/functions/v1/update-quote-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0'
        },
        body: JSON.stringify({ quoteId: id, status: newStatus }),
      });
      if (!response.ok) throw new Error('Gagal memperbarui status.');
      setActionTaken(newStatus);
      if (quote) setQuote({ ...quote, status: newStatus });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAsPDF = () => {
    if (!quoteRef.current || !quote) return;
    setIsGeneratingPDF(true);
    const input = quoteRef.current;
    const originalWidth = input.style.width;
    input.style.width = '1024px';

    const elementsToHide = input.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    html2canvas(input, { scale: 1.5, useCORS: true })
      .then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / pdfWidth;
        const imgHeight = canvasHeight / ratio;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position -= pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
        }
        
        pdf.save(`Penawaran-${quote.quote_number || quote.id}.pdf`);
      })
      .finally(() => {
        elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
        input.style.width = originalWidth;
        setIsGeneratingPDF(false);
      });
  };

  const subtotal = useMemo(() => {
    if (!quote) return 0;
    return quote.quote_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  }, [quote]);

  const discountAmount = useMemo(() => quote?.discount_amount || 0, [quote]);
  const taxAmount = useMemo(() => quote?.tax_amount || 0, [quote]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);

  if (loading) {
    return <div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div>;
  }

  if (!quote) {
    return <div className="container mx-auto p-8 text-center"><h1>Penawaran tidak ditemukan atau tidak valid.</h1></div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto mb-4 flex justify-end no-pdf">
        <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>
          {isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> Unduh PDF</>}
        </Button>
      </div>
      <Card ref={quoteRef} className="max-w-4xl mx-auto shadow-lg">
        {actionTaken === '' && quote.status === 'Terkirim' && (
            <div className="p-6 bg-blue-50 border-b border-blue-200 no-pdf">
                <h3 className="font-semibold text-lg text-blue-800">Tinjau dan Konfirmasi Penawaran</h3>
                <p className="text-sm text-blue-700 mt-1">Silakan tinjau detail di bawah ini. Jika Anda setuju dengan persyaratan, klik "Terima Penawaran".</p>
                <div className="mt-4 flex gap-4">
                    <Button onClick={() => handleStatusUpdate('Diterima')} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="mr-2 h-4 w-4" /> {isSubmitting ? 'Memproses...' : 'Terima Penawaran'}
                    </Button>
                    <Button onClick={() => handleStatusUpdate('Ditolak')} disabled={isSubmitting} variant="destructive">
                        <XCircle className="mr-2 h-4 w-4" /> {isSubmitting ? 'Memproses...' : 'Tolak Penawaran'}
                    </Button>
                </div>
            </div>
        )}
        {actionTaken && (
            <Alert variant={actionTaken === 'Diterima' ? 'default' : 'destructive'} className="m-4 border-2 no-pdf">
                <AlertTitle className="font-bold flex items-center gap-2">
                    {actionTaken === 'Diterima' ? <><CheckCircle className="text-green-600"/>Anda Telah Menerima Penawaran Ini</> : <><XCircle className="text-red-600"/>Anda Telah Menolak Penawaran Ini</>}
                </AlertTitle>
                <AlertDescription>
                    Terima kasih atas tanggapan Anda. {quote.from_company} telah diberitahu.
                </AlertDescription>
            </Alert>
        )}
        <CardHeader className="bg-gray-50 p-8 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{quote.from_company}</h1>
              <p className="text-sm text-muted-foreground">{quote.from_address}</p>
              <p className="text-sm text-muted-foreground">{quote.from_website}</p>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold uppercase text-gray-400 tracking-widest">Penawaran</h2>
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
                  {profile?.show_quantity_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Jumlah</th>}
                  {profile?.show_unit_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Satuan</th>}
                  {profile?.show_unit_price_column && <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Harga Satuan</th>}
                  <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.quote_items.map((item, index) => (
                  <tr key={index} className="border-b last:border-none">
                    <td className="p-3 text-center align-top">{index + 1}</td>
                    <td className="p-3 align-top">{item.description}</td>
                    {profile?.show_quantity_column && <td className="p-3 text-center align-top">{item.quantity}</td>}
                    {profile?.show_unit_column && <td className="p-3 text-center align-top">{item.unit || '-'}</td>}
                    {profile?.show_unit_price_column && <td className="p-3 text-right align-top">{formatCurrency(item.unit_price)}</td>}
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
            </div>
          </div>
          {quote.terms && (
            <div>
                <h3 className="font-semibold text-gray-500 mb-2">Syarat & Ketentuan:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.terms}</p>
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
  );
};

export default PublicQuoteView;