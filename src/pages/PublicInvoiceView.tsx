import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Download, FileText, Smartphone, CreditCard, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  attachments: Attachment[];
  invoice_items: {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }[];
  payments: Payment[];
  payment_instructions: string;
  custom_footer: string | null;
  company_phone: string | null;
  show_quantity_column: boolean;
  show_unit_column: boolean;
  show_unit_price_column: boolean;
};

const PublicInvoiceView = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPaymentInfoOpen, setIsPaymentInfoOpen] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

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

  const handleWhatsAppClick = () => {
    if (!invoice) return;
    
    if (!invoice.company_phone) {
        showError("Nomor WhatsApp belum diatur oleh pemilik usaha.");
        return;
    }

    const phoneNumber = invoice.company_phone.replace(/\D/g, ''); // Remove non-digits
    // Ensure starts with 62 or country code if needed, assuming user enters correctly for now or adding basic check
    const formattedPhone = phoneNumber.startsWith('0') ? '62' + phoneNumber.slice(1) : phoneNumber;

    const message = `Halo ${invoice.from_company}, saya ingin mengonfirmasi pembayaran untuk Faktur #${invoice.invoice_number} sebesar ${formatCurrency(balanceDue)}. Berikut saya lampirkan bukti transfernya.`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
  };

  const handleCopyInstructions = () => {
    if (!invoice) return;
    navigator.clipboard.writeText(invoice.payment_instructions);
    showSuccess("Instruksi pembayaran disalin ke clipboard!");
  };

  const subtotal = useMemo(() => invoice?.invoice_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0) || 0, [invoice]);
  const discountAmount = useMemo(() => invoice?.discount_amount || 0, [invoice]);
  const taxAmount = useMemo(() => invoice?.tax_amount || 0, [invoice]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);
  
  // Hanya hitung pembayaran yang sudah LUNAS untuk tampilan publik
  const totalPaid = useMemo(() => {
    const paymentsAmount = invoice?.payments?.filter(p => p.status === 'Lunas').reduce((acc, p) => acc + p.amount, 0) || 0;
    return paymentsAmount + (invoice?.down_payment_amount || 0);
  }, [invoice]);

  const balanceDue = useMemo(() => total - totalPaid, [total, totalPaid]);

  // Hanya tampilkan pembayaran yang LUNAS
  const visiblePayments = useMemo(() => invoice?.payments?.filter(p => p.status === 'Lunas') || [], [invoice]);

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
      {/* Payment Info Dialog */}
      <Dialog open={isPaymentInfoOpen} onOpenChange={setIsPaymentInfoOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Instruksi Pembayaran</DialogTitle>
                <DialogDescription>Silakan lakukan pembayaran melalui rekening berikut:</DialogDescription>
            </DialogHeader>
            <div className="bg-slate-50 p-4 rounded-md border text-sm whitespace-pre-wrap font-mono">
                {invoice.payment_instructions || "Belum ada instruksi pembayaran."}
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyInstructions} className="w-full">
                <Copy className="mr-2 h-4 w-4" /> Salin Instruksi
            </Button>
        </DialogContent>
      </Dialog>

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
                        <Button size="lg" variant="outline" onClick={() => setIsPaymentInfoOpen(true)} className="w-full md:w-auto">
                            <CreditCard className="mr-2 h-4 w-4" /> Lihat Pembayaran melalui no Rekening
                        </Button>
                        <Button size="lg" onClick={handleWhatsAppClick} className="w-full md:w-auto bg-green-600 hover:bg-green-700">
                            <Smartphone className="mr-2 h-4 w-4" /> Kirim Konfirmasi via WhatsApp
                        </Button>
                        {!invoice.company_phone && (
                            <p className="text-xs text-red-500 mt-1">
                                *Nomor WhatsApp belum diatur oleh pemilik usaha. Hubungi mereka secara manual.
                            </p>
                        )}
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
          {/* Riwayat Pembayaran section - Hanya menampilkan yang LUNAS */}
          {visiblePayments.length > 0 && (
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
                      <TableHead>Metode/Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePayments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{format(new Date(p.payment_date), 'PPP', { locale: localeId })}</TableCell>
                        <TableCell>{formatCurrency(p.amount)}</TableCell>
                        <TableCell>{p.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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