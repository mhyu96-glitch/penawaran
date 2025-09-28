import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Landmark, CreditCard, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import PaymentSubmissionDialog from '@/components/PaymentSubmissionDialog';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { loadStripe } from '@stripe/stripe-js';
import { showError, showSuccess } from '@/utils/toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

type InvoiceDetails = {
  id: string;
  from_company: string;
  from_address: string;
  from_website: string;
  to_client: string;
  to_address: string;
  to_phone: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  discount_amount: number;
  tax_amount: number;
  down_payment_amount: number;
  terms: string;
  status: string;
  invoice_items: {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }[];
  payment_instructions: string;
  custom_footer: string | null;
  show_quantity_column: boolean;
  show_unit_column: boolean;
  show_unit_price_column: boolean;
};

const PublicInvoiceView = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      showSuccess('Pembayaran berhasil! Terima kasih.');
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-public-invoice-details', {
          body: { invoiceId: id },
        });
        if (error) throw error;
        setInvoice(data);
      } catch (error) {
        console.error('Error fetching invoice:', error);
        setInvoice(null);
      }
      setLoading(false);
    };

    fetchInvoice();
  }, [id]);

  const handleCheckout = async () => {
    if (!id) return;

    if (!stripePromise) {
      showError("Konfigurasi pembayaran Stripe tidak ditemukan.");
      console.error("VITE_STRIPE_PUBLISHABLE_KEY is not set in your .env file.");
      return;
    }

    setIsRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: { invoiceId: id },
      });
      if (error) throw error;

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js has not loaded yet.');

      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (stripeError) {
        showError(stripeError.message || 'Gagal memulai pembayaran.');
      }
    } catch (error: any) {
      showError(error.message || 'Terjadi kesalahan.');
    } finally {
      setIsRedirecting(false);
    }
  };

  const subtotal = useMemo(() => invoice?.invoice_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0) || 0, [invoice]);
  const discountAmount = useMemo(() => invoice?.discount_amount || 0, [invoice]);
  const taxAmount = useMemo(() => invoice?.tax_amount || 0, [invoice]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Lunas': return 'default';
      case 'Terkirim': return 'secondary';
      case 'Jatuh Tempo': return 'destructive';
      case 'Draf': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) return <div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div>;
  if (!invoice) return <div className="container mx-auto p-8 text-center"><h1>Faktur tidak ditemukan atau tidak valid.</h1></div>;

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      {invoice && <PaymentSubmissionDialog isOpen={isPaymentDialogOpen} setIsOpen={setIsPaymentDialogOpen} invoiceId={invoice.id} totalDue={total} />}
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader className="bg-gray-50 p-8 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{invoice.from_company}</h1>
              <p className="text-sm text-muted-foreground">{invoice.from_address}</p>
              <p className="text-sm text-muted-foreground">{invoice.from_website}</p>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold uppercase text-gray-400 tracking-widest">Faktur</h2>
              <div className="mt-1">
                <Badge variant={getStatusVariant(invoice.status)} className="text-xs">{invoice.status || 'Draf'}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">No: {invoice.invoice_number}</p>
              <p className="text-sm text-muted-foreground">Tanggal: {format(new Date(invoice.invoice_date), 'PPP', { locale: localeId })}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-500 mb-2 text-sm">Ditagihkan Kepada:</h3>
              <p className="font-bold">{invoice.to_client}</p>
              <p className="text-sm">{invoice.to_address}</p>
              <p className="text-sm">{invoice.to_phone}</p>
            </div>
            <div className="text-right">
                <h3 className="font-semibold text-gray-500 mb-2 text-sm">Jatuh Tempo:</h3>
                <p className="text-sm">{invoice.due_date ? format(new Date(invoice.due_date), 'PPP', { locale: localeId }) : 'N/A'}</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr className="border-b">
                  <th className="p-3 text-center font-medium text-gray-700 w-[40px]">No.</th>
                  <th className="p-3 text-left font-medium text-gray-700">Deskripsi</th>
                  {invoice.show_quantity_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Jumlah</th>}
                  {invoice.show_unit_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Satuan</th>}
                  {invoice.show_unit_price_column && <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Harga Satuan</th>}
                  <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.invoice_items.map((item, index) => (
                  <tr key={index} className="border-b last:border-none">
                    <td className="p-3 text-center align-top">{index + 1}</td><td className="p-3 align-top">{item.description}</td>
                    {invoice.show_quantity_column && <td className="p-3 text-center align-top">{item.quantity}</td>}
                    {invoice.show_unit_column && <td className="p-3 text-center align-top">{item.unit || '-'}</td>}
                    {invoice.show_unit_price_column && <td className="p-3 text-right align-top">{formatCurrency(item.unit_price)}</td>}
                    <td className="p-3 text-right align-top">{formatCurrency(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div className="w-full md:w-auto space-y-2">
                {invoice.status !== 'Lunas' ? (
                    <>
                        <Button size="lg" onClick={handleCheckout} disabled={isRedirecting || !stripePromise}>
                            <CreditCard className="mr-2 h-4 w-4" /> {isRedirecting ? 'Mengarahkan...' : 'Bayar dengan Kartu'}
                        </Button>
                        <Button size="lg" variant="outline" onClick={() => setIsPaymentDialogOpen(true)}>
                            <Landmark className="mr-2 h-4 w-4" /> Konfirmasi Transfer Bank
                        </Button>
                    </>
                ) : (
                    <Alert variant="default" className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800">Lunas</AlertTitle>
                        <AlertDescription className="text-green-700">
                            Faktur ini telah lunas. Terima kasih!
                        </AlertDescription>
                    </Alert>
                )}
            </div>
            <div className="w-full max-w-xs space-y-2 self-end">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>- {formatCurrency(discountAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>+ {formatCurrency(taxAmount)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Total Tagihan</span><span>{formatCurrency(total)}</span></div>
              {invoice.down_payment_amount > 0 && (
                <div className="flex justify-between text-muted-foreground mt-1"><span>Uang Muka (DP) yang harus dibayar</span><span>{formatCurrency(invoice.down_payment_amount)}</span></div>
              )}
            </div>
          </div>
          {invoice.terms && (
            <div>
                <h3 className="font-semibold text-gray-500 mb-2">Syarat & Ketentuan:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
            </div>
          )}
        </CardContent>
        {invoice.custom_footer && (
            <CardFooter className="p-8 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center w-full whitespace-pre-wrap">{invoice.custom_footer}</p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default PublicInvoiceView;