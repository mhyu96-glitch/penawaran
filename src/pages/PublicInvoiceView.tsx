import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Landmark, CreditCard, CheckCircle, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import PaymentSubmissionDialog from '@/components/PaymentSubmissionDialog';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import useMidtransSnap from '@/hooks/useMidtransSnap';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

declare global {
    interface Window {
        snap: any;
    }
}

interface Attachment {
  name: string;
  url: string;
  path: string;
}

type Payment = {
    id: string;
    amount: number;
    payment_date: string;
    notes: string | null;
    proof_url: string | null;
    status: string;
};

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
  attachments: Attachment[]; // New field for attachments
  invoice_items: {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }[];
  payments: Payment[]; // Tambahkan tipe pembayaran di sini
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
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const isSnapReady = useMidtransSnap();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

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

  const handleSaveAsPDF = () => {
    if (!invoiceRef.current || !invoice) return;
    setIsGeneratingPDF(true);
    const input = invoiceRef.current;
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
        
        pdf.save(`Faktur-${invoice.invoice_number || invoice.id}.pdf`);
      })
      .finally(() => {
        elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
        input.style.width = originalWidth;
        setIsGeneratingPDF(false);
      });
  };

  const handlePayment = async () => {
    if (!id || !isSnapReady) return;
    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-midtrans-transaction', {
        body: { invoiceId: id },
      });
      if (error) throw error;

      window.snap.pay(data.token, {
        onSuccess: function(result: any){
          showSuccess("Pembayaran berhasil!");
          console.log(result);
        },
        onPending: function(result: any){
          showSuccess("Pembayaran Anda sedang diproses.");
          console.log(result);
        },
        onError: function(result: any){
          showError("Pembayaran gagal.");
          console.log(result);
        },
        onClose: function(){
          console.log('customer closed the popup without finishing the payment');
        }
      });
    } catch (error: any) {
      showError(error.message || 'Terjadi kesalahan saat memproses pembayaran.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const subtotal = useMemo(() => invoice?.invoice_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0) || 0, [invoice]);
  const discountAmount = useMemo(() => invoice?.discount_amount || 0, [invoice]);
  const taxAmount = useMemo(() => invoice?.tax_amount || 0, [invoice]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);
  
  // Hitung total yang sudah dibayar (termasuk DP)
  const totalPaid = useMemo(() => {
    const paymentsAmount = invoice?.payments?.filter(p => p.status === 'Lunas').reduce((acc, p) => acc + p.amount, 0) || 0;
    return paymentsAmount + (invoice?.down_payment_amount || 0);
  }, [invoice]);

  // Hitung sisa tagihan
  const balanceDue = useMemo(() => total - totalPaid, [total, totalPaid]);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Lunas': return 'default';
      case 'Terkirim': return 'secondary';
      case 'Jatuh Tempo': return 'destructive';
      case 'Draf': return 'outline';
      case 'Pending': return 'secondary'; // Added for payment status
      case 'Ditolak': return 'destructive'; // Added for payment status
      default: return 'outline';
    }
  };

  if (loading) return <div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div>;
  if (!invoice) return <div className="container mx-auto p-8 text-center"><h1>Faktur tidak ditemukan atau tidak valid.</h1></div>;

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      {invoice && <PaymentSubmissionDialog isOpen={isPaymentDialogOpen} setIsOpen={setIsPaymentDialogOpen} invoiceId={invoice.id} totalDue={balanceDue} />}
      <div className="max-w-4xl mx-auto mb-4 flex justify-end no-pdf">
        <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>
          {isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> Unduh PDF</>}
        </Button>
      </div>
      <Card ref={invoiceRef} className="max-w-4xl mx-auto shadow-lg">
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
            <div className="w-full md:w-auto space-y-2 no-pdf">
                {invoice.status !== 'Lunas' && balanceDue > 0 ? (
                    <>
                        <Button size="lg" onClick={handlePayment} disabled={isProcessingPayment || !isSnapReady}>
                            <CreditCard className="mr-2 h-4 w-4" /> {isProcessingPayment ? 'Memproses...' : 'Bayar Sekarang'}
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
              {/* Explicitly show "Telah Dibayar" */}
              <div className="flex justify-between"><span className="text-muted-foreground">Telah Dibayar</span><span>- {formatCurrency(totalPaid)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Sisa Tagihan</span><span>{formatCurrency(balanceDue)}</span></div>
            </div>
          </div>
          {invoice.terms && (
            <div>
                <h3 className="font-semibold text-gray-500 mb-2">Syarat & Ketentuan:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
            </div>
          )}
          {invoice.attachments && invoice.attachments.length > 0 && (
            <div className="no-pdf">
              <h3 className="font-semibold text-gray-500 mb-2">Lampiran:</h3>
              <div className="space-y-2">
                {invoice.attachments.map((attachment, index) => (
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
          {/* Riwayat Pembayaran section */}
          {(invoice.payments && invoice.payments.length > 0) ? (
            <Card className="no-pdf">
              <CardHeader>
                <CardTitle>Riwayat Pembayaran</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{format(new Date(p.payment_date), 'PPP', { locale: localeId })}</TableCell>
                        <TableCell>{formatCurrency(p.amount)}</TableCell>
                        <TableCell><Badge variant={getStatusVariant(p.status)}>{p.status}</Badge></TableCell>
                        <TableCell>{p.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 no-pdf">Belum ada riwayat pembayaran untuk faktur ini.</p>
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