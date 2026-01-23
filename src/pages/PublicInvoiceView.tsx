import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Download, FileText, Smartphone, CreditCard, Copy, Wallet, QrCode, Zap } from 'lucide-react';
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
import useMidtransSnap from '@/hooks/useMidtransSnap';

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
    cost_price: number;
  }[];
  payments: Payment[];
  payment_instructions: string;
  custom_footer: string | null;
  company_phone: string | null;
  whatsapp_invoice_template: string | null;
  show_quantity_column: boolean;
  show_unit_column: boolean;
  show_unit_price_column: boolean;
  qris_url: string | null;
  midtrans_client_key: string | null;
  midtrans_is_production: boolean;
  signature_url: string | null;
};

const PublicInvoiceView = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPaymentInfoOpen, setIsPaymentInfoOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const hasTracked = useRef(false);
  
  const isSnapReady = useMidtransSnap(
    invoice?.midtrans_client_key || null,
    invoice?.midtrans_is_production || false
  );

  const fetchInvoice = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase.functions.invoke('get-public-invoice-details', {
        body: { invoiceId: id },
      });
      if (error) throw error;
      setInvoice(data);

      if (!hasTracked.current) {
          hasTracked.current = true;
          await supabase.rpc('track_document_view', { p_id: id, p_type: 'invoice' });
      }

    } catch (error) {
      console.error('Error fetching invoice:', error);
      setInvoice(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchInvoice();
  }, [id]);

  const handleSaveAsPDF = () => {
    if (!invoiceRef.current || !invoice) return;
    setIsGeneratingPDF(true);
    const input = invoiceRef.current;
    
    // Save original styles
    const originalWidth = input.style.width;
    const originalHeight = input.style.height;
    const originalOverflow = input.style.overflow;
    
    // Force A4 dimensions
    input.style.width = '794px';
    input.style.height = 'auto';
    input.style.overflow = 'visible';

    const elementsToHide = input.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    setTimeout(() => {
        html2canvas(input, { 
            scale: 2, 
            useCORS: true,
            logging: false,
            windowWidth: 794
        })
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
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            
            pdf.save(`Faktur-${invoice.invoice_number || invoice.id}.pdf`);
        })
        .finally(() => {
            elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
            input.style.width = originalWidth;
            input.style.height = originalHeight;
            input.style.overflow = originalOverflow;
            setIsGeneratingPDF(false);
        });
    }, 100);
  };

  const subtotal = useMemo(() => invoice?.invoice_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0) || 0, [invoice]);
  const discountAmount = useMemo(() => invoice?.discount_amount || 0, [invoice]);
  const taxAmount = useMemo(() => invoice?.tax_amount || 0, [invoice]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);
  
  const totalPaid = useMemo(() => {
    const paymentsAmount = invoice?.payments?.filter(p => p.status === 'Lunas').reduce((acc, p) => acc + p.amount, 0) || 0;
    return paymentsAmount + (invoice?.down_payment_amount || 0);
  }, [invoice]);

  const balanceDue = useMemo(() => total - totalPaid, [total, totalPaid]);

  const handleWhatsAppClick = () => {
    if (!invoice) return;
    
    if (!invoice.company_phone) {
        showError("Nomor WhatsApp belum diatur oleh pemilik usaha.");
        return;
    }

    const phoneNumber = invoice.company_phone.replace(/\D/g, '');
    const formattedPhone = phoneNumber.startsWith('0') ? '62' + phoneNumber.slice(1) : phoneNumber;

    let messageTemplate = invoice.whatsapp_invoice_template || 'Halo {client_name}, saya ingin mengonfirmasi pembayaran untuk Faktur #{number} sebesar {amount}. Berikut saya lampirkan bukti transfernya.';
    
    const message = messageTemplate
      .replace(/{client_name}/g, invoice.to_client)
      .replace(/{number}/g, invoice.invoice_number || 'N/A')
      .replace(/{amount}/g, formatCurrency(balanceDue))
      .replace(/{company_name}/g, invoice.from_company)
      .replace(/{link}/g, window.location.href);

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
  };

  const handleCopyInstructions = () => {
    if (!invoice) return;
    navigator.clipboard.writeText(invoice.payment_instructions);
    showSuccess("Instruksi pembayaran disalin ke clipboard!");
  };

  const handlePayNow = async () => {
    if (!invoice || !isSnapReady) {
        if (!invoice?.midtrans_client_key) {
            showError("Konfigurasi pembayaran belum lengkap. Hubungi pemilik usaha.");
        }
        return;
    }
    
    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-midtrans-transaction', {
        body: { invoiceId: invoice.id },
      });

      if (error) throw new Error(error.message);
      if (!data || !data.token) throw new Error("Gagal mendapatkan token pembayaran.");

      window.snap.pay(data.token, {
        onSuccess: function(result: any) {
          showSuccess("Pembayaran berhasil!");
          console.log(result);
          setTimeout(() => fetchInvoice(), 2000);
        },
        onPending: function(result: any) {
          showSuccess("Menunggu pembayaran...");
          console.log(result);
        },
        onError: function(result: any) {
          showError("Pembayaran gagal.");
          console.error(result);
        },
        onClose: function() {
          setIsProcessingPayment(false);
        }
      });

    } catch (err: any) {
      showError(`Terjadi kesalahan: ${err.message}`);
      setIsProcessingPayment(false);
    }
  };

  const visiblePayments = useMemo(() => invoice?.payments?.filter(p => p.status === 'Lunas') || [], [invoice]);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Lunas': return 'default';
      case 'Terkirim': return 'secondary';
      case 'Jatuh Tempo': return 'destructive';
      case 'Draf': return 'outline';
      case 'Pending': return 'secondary';
      case 'Ditolak': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) return <div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div>;
  if (!invoice) return <div className="container mx-auto p-8 text-center"><h1>Faktur tidak ditemukan atau tidak valid.</h1></div>;

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      <Dialog open={isPaymentInfoOpen} onOpenChange={setIsPaymentInfoOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader className="flex flex-col items-center space-y-3 pb-2">
                <div className="bg-green-100 p-3 rounded-full">
                    <Wallet className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                    <DialogTitle className="text-xl font-bold text-gray-900">Instruksi Pembayaran Manual</DialogTitle>
                    <DialogDescription className="text-gray-500 mt-1">
                        Jika Anda tidak dapat menggunakan pembayaran online, silakan transfer manual.
                    </DialogDescription>
                </div>
            </DialogHeader>

            <div className="space-y-6 my-2">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <div className="bg-blue-100 p-1.5 rounded-md">
                            <CreditCard className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-semibold text-sm text-gray-700">Transfer Bank / Manual</span>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group hover:border-blue-300 transition-all duration-300">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-medium font-sans leading-relaxed">
                            {invoice.payment_instructions || "Belum ada instruksi pembayaran."}
                        </pre>
                        <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={handleCopyInstructions} 
                            className="mt-4 w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
                        >
                            <Copy className="mr-2 h-3.5 w-3.5" /> Salin Instruksi
                        </Button>
                    </div>
                </div>
                
                {invoice.qris_url && (
                    <>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-muted-foreground">Atau bayar dengan</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-1 justify-center">
                                <div className="bg-purple-100 p-1.5 rounded-md">
                                    <QrCode className="h-4 w-4 text-purple-600" />
                                </div>
                                <span className="font-semibold text-sm text-gray-700">Scan QRIS</span>
                            </div>
                            
                            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <img src={invoice.qris_url} alt="QRIS" className="w-40 h-40 object-contain" />
                                </div>
                                <p className="text-xs text-muted-foreground mt-3 text-center max-w-[220px]">
                                    Dukungan pembayaran melalui GoPay, OVO, Dana, ShopeePay, dan Mobile Banking.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
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
                        {invoice.midtrans_client_key ? (
                            <Button 
                                size="lg" 
                                onClick={handlePayNow} 
                                disabled={!isSnapReady || isProcessingPayment}
                                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transform transition-transform active:scale-95"
                            >
                                <Zap className="mr-2 h-4 w-4 fill-current" /> 
                                {isProcessingPayment ? 'Memproses...' : 'Bayar Online Sekarang'}
                            </Button>
                        ) : (
                            <div className="text-xs text-muted-foreground p-2 bg-yellow-50 rounded border border-yellow-200">
                                Pembayaran online tidak tersedia (Merchant Key belum diatur).
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button size="sm" variant="outline" onClick={() => setIsPaymentInfoOpen(true)} className="w-full sm:w-auto">
                                <CreditCard className="mr-2 h-4 w-4" /> Transfer Manual
                            </Button>
                            <Button size="sm" onClick={handleWhatsAppClick} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                                <Smartphone className="mr-2 h-4 w-4" /> Konfirmasi WhatsApp
                            </Button>
                        </div>
                        
                        {!invoice.company_phone && (
                            <p className="text-xs text-red-500 mt-1">
                                *Nomor WhatsApp belum diatur oleh pemilik usaha.
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                            Pembayaran online mendukung Transfer Bank (Virtual Account), GoPay, ShopeePay, dan QRIS.
                        </p>
                    </>
                ) : (
                    <Alert variant="default" className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800">Lunas</AlertTitle>
                        <AlertDescription className="text-green-700">
                            Faktur ini telah lunas. Terima kasih atas pembayaran Anda!
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
              <div className="flex justify-between"><span className="text-muted-foreground">Telah Dibayar</span><span>- {formatCurrency(totalPaid)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Sisa Tagihan</span><span>{formatCurrency(balanceDue)}</span></div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {invoice.payment_instructions && (
                 <Alert className="no-pdf h-full">
                    <CreditCard className="h-4 w-4" />
                    <AlertTitle>Instruksi Pembayaran Manual</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap">{invoice.payment_instructions}</AlertDescription>
                </Alert>
            )}

            {invoice.qris_url && (
                 <div className="border rounded-lg p-4 flex flex-col items-center justify-center bg-white text-center h-full">
                    <p className="font-semibold mb-2 text-sm">Scan QRIS Toko</p>
                    <img src={invoice.qris_url} alt="QRIS Code" className="w-32 h-32 object-contain" />
                 </div>
            )}
          </div>

          {/* Signature Section */}
          <div className="flex justify-end mt-8">
            <div className="text-center">
                <p className="text-sm font-medium mb-4">Hormat Kami,</p>
                {invoice.signature_url ? (
                    <img src={invoice.signature_url} alt="Tanda Tangan" className="h-24 mx-auto mb-2 object-contain" />
                ) : (
                    <div className="h-24" />
                )}
                <p className="text-sm font-bold">{invoice.from_company}</p>
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