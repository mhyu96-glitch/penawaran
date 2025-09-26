import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  }[];
};

const PublicQuoteView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionTaken, setActionTaken] = useState('');

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
        setQuote(data as QuoteDetails);
        if (data.status === 'Diterima' || data.status === 'Ditolak') {
            setActionTaken(data.status);
        }
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

  const subtotal = useMemo(() => {
    if (!quote) return 0;
    return quote.quote_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  }, [quote]);

  const discountAmount = useMemo(() => subtotal * ((quote?.discount_percentage || 0) / 100), [subtotal, quote]);
  const taxAmount = useMemo(() => (subtotal - discountAmount) * ((quote?.tax_percentage || 0) / 100), [subtotal, discountAmount, quote]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);

  if (loading) {
    return <div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div>;
  }

  if (!quote) {
    return <div className="container mx-auto p-8 text-center"><h1>Penawaran tidak ditemukan atau tidak valid.</h1></div>;
  }

  const formatCurrency = (amount: number) => amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      <Card className="max-w-4xl mx-auto shadow-lg">
        {actionTaken === '' && quote.status === 'Terkirim' && (
            <div className="p-6 bg-blue-50 border-b border-blue-200">
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
            <Alert variant={actionTaken === 'Diterima' ? 'default' : 'destructive'} className="m-4 border-2">
                <AlertTitle className="font-bold flex items-center gap-2">
                    {actionTaken === 'Diterima' ? <><CheckCircle className="text-green-600"/>Anda Telah Menerima Penawaran Ini</> : <><XCircle className="text-red-600"/>Anda Telah Menolak Penawaran Ini</>}
                </AlertTitle>
                <AlertDescription>
                    Terima kasih atas tanggapan Anda. {quote.from_company} telah diberitahu.
                </AlertDescription>
            </Alert>
        )}
        <CardHeader className="bg-gray-50 p-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{quote.from_company}</h1>
              <p className="text-muted-foreground">{quote.from_address}</p>
              <p className="text-muted-foreground">{quote.from_website}</p>
            </div>
            <div className="text-right space-y-1">
              <h2 className="text-4xl font-bold uppercase text-gray-400">Penawaran</h2>
              <p className="text-muted-foreground">No: {quote.quote_number}</p>
              <p className="text-muted-foreground">Tanggal: {format(new Date(quote.quote_date), 'PPP', { locale: localeId })}</p>
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
                <p>{quote.valid_until ? format(new Date(quote.valid_until), 'PPP', { locale: localeId }) : 'N/A'}</p>
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
    </div>
  );
};

export default PublicQuoteView;