import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

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
  quote_items: {
    description: string;
    quantity: number;
    unit_price: number;
  }[];
};

const QuoteView = () => {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [loading, setLoading] = useState(true);

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
      } else {
        setQuote(data as QuoteDetails);
      }
      setLoading(false);
    };

    fetchQuote();
  }, [id]);

  const subtotal = useMemo(() => {
    if (!quote) return 0;
    return quote.quote_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  }, [quote]);

  const discountAmount = useMemo(() => subtotal * ((quote?.discount_percentage || 0) / 100), [subtotal, quote]);
  const taxAmount = useMemo(() => (subtotal - discountAmount) * ((quote?.tax_percentage || 0) / 100), [subtotal, discountAmount, quote]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!quote) {
    return <div className="text-center p-8">Penawaran tidak ditemukan.</div>;
  }

  const formatCurrency = (amount: number) => amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
        <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden">
            <Button asChild variant="outline">
                <Link to="/quotes"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar</Link>
            </Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
        </div>
      <Card className="max-w-4xl mx-auto shadow-lg print:shadow-none print:border-none">
        <CardHeader className="bg-gray-50 p-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{quote.from_company}</h1>
              <p className="text-muted-foreground">{quote.from_address}</p>
              <p className="text-muted-foreground">{quote.from_website}</p>
            </div>
            <div className="text-right">
              <h2 className="text-4xl font-bold uppercase text-gray-400">Penawaran</h2>
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

          <div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left font-semibold text-gray-600">Deskripsi</th>
                  <th className="p-3 text-right font-semibold text-gray-600">Jumlah</th>
                  <th className="p-3 text-right font-semibold text-gray-600">Harga Satuan</th>
                  <th className="p-3 text-right font-semibold text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.quote_items.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-3">{item.description}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="p-3 text-right">{formatCurrency(item.quantity * item.unit_price)}</td>
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
              <div className="flex justify-between font-bold text-xl"><span >Total</span><span>{formatCurrency(total)}</span></div>
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