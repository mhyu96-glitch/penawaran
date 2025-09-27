import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Landmark } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import PaymentSubmissionDialog from '@/components/PaymentSubmissionDialog';

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
};

const PublicInvoiceView = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const response = await fetch(`https://xukpisovkcflcwuhrzkx.supabase.co/functions/v1/get-public-invoice-details`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0'
            },
            body: JSON.stringify({ invoiceId: id }),
        });
        if (!response.ok) throw new Error('Failed to fetch invoice details');
        const data = await response.json();
        setInvoice(data);
      } catch (error) {
        console.error('Error fetching invoice:', error);
        setInvoice(null);
      }
      setLoading(false);
    };

    fetchInvoice();
  }, [id]);

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

  const formatCurrency = (amount: number) => amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      {invoice && <PaymentSubmissionDialog isOpen={isPaymentDialogOpen} setIsOpen={setIsPaymentDialogOpen} invoiceId={invoice.id} totalDue={total} />}
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader className="bg-gray-50 p-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{invoice.from_company}</h1>
              <p className="text-muted-foreground">{invoice.from_address}</p>
              <p className="text-muted-foreground">{invoice.from_website}</p>
            </div>
            <div className="text-right space-y-1">
              <h2 className="text-4xl font-bold uppercase text-gray-400">Faktur</h2>
              <Badge variant={getStatusVariant(invoice.status)} className="text-sm">{invoice.status || 'Draf'}</Badge>
              <p className="text-muted-foreground">No: {invoice.invoice_number}</p>
              <p className="text-muted-foreground">Tanggal: {format(new Date(invoice.invoice_date), 'PPP', { locale: localeId })}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-500 mb-2">Ditagihkan Kepada:</h3>
              <p className="font-bold">{invoice.to_client}</p><p>{invoice.to_address}</p><p>{invoice.to_phone}</p>
            </div>
            <div className="text-right">
                <h3 className="font-semibold text-gray-500 mb-2">Jatuh Tempo:</h3>
                <p>{invoice.due_date ? format(new Date(invoice.due_date), 'PPP', { locale: localeId }) : 'N/A'}</p>
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
                {invoice.invoice_items.map((item, index) => (
                  <tr key={index} className="border-b last:border-none">
                    <td className="p-3 text-center align-top">{index + 1}</td><td className="p-3 align-top">{item.description}</td>
                    <td className="p-3 text-center align-top">{item.quantity}</td><td className="p-3 text-center align-top">{item.unit || '-'}</td>
                    <td className="p-3 text-right align-top">{formatCurrency(item.unit_price)}</td><td className="p-3 text-right align-top">{formatCurrency(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div className="w-full md:w-auto">
                {invoice.status !== 'Lunas' && (
                    <Button size="lg" onClick={() => setIsPaymentDialogOpen(true)}><Landmark className="mr-2 h-4 w-4" /> Konfirmasi Pembayaran</Button>
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
      </Card>
    </div>
  );
};

export default PublicInvoiceView;