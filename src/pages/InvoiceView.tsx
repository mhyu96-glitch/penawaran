import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download, Landmark, Share2, Check, X, ExternalLink, Info } from 'lucide-react';
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
import PaymentForm from '@/components/PaymentForm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Payment = {
    id: string;
    amount: number;
    payment_date: string;
    notes: string;
    proof_url: string | null;
    status: string;
};

type InvoiceDetails = {
  id: string;
  user_id: string;
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
};

const InvoiceView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentInstructions, setPaymentInstructions] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const fetchInvoiceData = async () => {
    if (!id) return;
    setLoading(true);
    const invoiceRes = await supabase.from('invoices').select('*, invoice_items(*)').eq('id', id).single();
    if (invoiceRes.error) {
      showError('Faktur tidak ditemukan.');
      navigate('/invoices');
      return;
    }
    const invoiceData = invoiceRes.data as InvoiceDetails;
    setInvoice(invoiceData);

    if (invoiceData.user_id) {
        const { data: profileData } = await supabase
            .from('profiles')
            .select('payment_instructions')
            .eq('id', invoiceData.user_id)
            .single();
        if (profileData) {
            setPaymentInstructions(profileData.payment_instructions || '');
        }
    }

    const paymentsRes = await supabase.from('payments').select('*').eq('invoice_id', id).order('payment_date', { ascending: false });
    if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [id, navigate]);

  const handleSaveAsPDF = () => {
    if (!invoiceRef.current || !invoice) return;
    setIsGeneratingPDF(true);
    html2canvas(invoiceRef.current, { scale: 2, useCORS: true })
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
        pdf.save(`Faktur-${invoice.invoice_number || invoice.id}.pdf`);
      })
      .catch(err => {
        console.error("Error generating PDF", err);
        showError("Gagal membuat PDF.");
      })
      .finally(() => setIsGeneratingPDF(false));
  };

  const handleDeleteInvoice = async () => {
    if (!id) return;
    const { error } = await supabase.from('invoices').delete().match({ id });
    if (error) showError('Gagal menghapus faktur.');
    else {
      showSuccess('Faktur berhasil dihapus.');
      navigate('/invoices');
    }
  };

  const handleShareLink = () => {
    const link = `${window.location.origin}/invoice/public/${id}`;
    navigator.clipboard.writeText(link);
    showSuccess('Tautan publik faktur telah disalin!');
  };

  const handlePaymentStatusUpdate = async (paymentId: string, newStatus: 'Lunas' | 'Ditolak') => {
    const { error } = await supabase.from('payments').update({ status: newStatus }).eq('id', paymentId);
    if (error) {
        showError(`Gagal ${newStatus === 'Lunas' ? 'mengonfirmasi' : 'menolak'} pembayaran.`);
    } else {
        showSuccess(`Pembayaran berhasil ${newStatus === 'Lunas' ? 'dikonfirmasi' : 'ditolak'}.`);
        fetchInvoiceData(); // Refresh data
    }
  };

  const subtotal = useMemo(() => invoice?.invoice_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0) || 0, [invoice]);
  const discountAmount = useMemo(() => invoice?.discount_amount || 0, [invoice]);
  const taxAmount = useMemo(() => invoice?.tax_amount || 0, [invoice]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);
  const totalPaid = useMemo(() => payments.filter(p => p.status === 'Lunas').reduce((acc, p) => acc + p.amount, 0), [payments]);
  const balanceDue = useMemo(() => total - totalPaid, [total, totalPaid]);

  useEffect(() => {
    if (invoice && balanceDue <= 0 && invoice.status !== 'Lunas') {
        supabase.from('invoices').update({ status: 'Lunas' }).eq('id', invoice.id).then(() => fetchInvoiceData());
    }
  }, [balanceDue, invoice]);

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
  if (!invoice) return null;

  const formatCurrency = (amount: number) => amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
        <PaymentForm isOpen={isPaymentFormOpen} setIsOpen={setIsPaymentFormOpen} invoiceId={invoice.id} invoiceTotal={total} onSave={() => { setIsPaymentFormOpen(false); fetchInvoiceData(); }} />
        <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden">
            <Button asChild variant="outline"><Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link></Button>
            <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button onClick={handleShareLink} variant="secondary"><Share2 className="mr-2 h-4 w-4" /> Bagikan Tautan</Button>
                {invoice.status !== 'Lunas' && <Button onClick={() => setIsPaymentFormOpen(true)}><Landmark className="mr-2 h-4 w-4" /> Catat Pembayaran</Button>}
                <Button asChild variant="outline"><Link to={`/invoice/edit/${id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link></Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Hapus</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus faktur secara permanen.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteInvoice}>Hapus</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> PDF</>}</Button>
                <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
            </div>
        </div>
      <Card ref={invoiceRef} className="max-w-4xl mx-auto shadow-lg print:shadow-none print:border-none">
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
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>- {formatCurrency(discountAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>+ {formatCurrency(taxAmount)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Total Tagihan</span><span>{formatCurrency(total)}</span></div>
              {invoice.down_payment_amount > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Uang Muka (DP)</span><span>{formatCurrency(invoice.down_payment_amount)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Telah Dibayar</span><span>- {formatCurrency(totalPaid)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Sisa Tagihan</span><span>{formatCurrency(balanceDue)}</span></div>
            </div>
          </div>
          
          {paymentInstructions ? (
            <Alert>
                <Landmark className="h-4 w-4" />
                <AlertTitle>Instruksi Pembayaran</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">
                    {paymentInstructions}
                </AlertDescription>
            </Alert>
            ) : (
            <div className="print:hidden">
                <p className="text-sm text-muted-foreground">
                    Instruksi pembayaran belum diatur. Anda bisa menambahkannya di halaman <Link to="/settings" className="underline">Pengaturan</Link>.
                </p>
            </div>
          )}

          {payments.length > 0 && (
            <Card className="print:hidden">
                <CardHeader>
                    <CardTitle>Riwayat Pembayaran</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Jumlah</TableHead><TableHead>Status</TableHead><TableHead>Bukti</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {payments.map(p => (<TableRow key={p.id}>
                                <TableCell>{format(new Date(p.payment_date), 'PPP', { locale: localeId })}</TableCell>
                                <TableCell>{formatCurrency(p.amount)}</TableCell>
                                <TableCell><Badge variant={getStatusVariant(p.status)}>{p.status}</Badge></TableCell>
                                <TableCell>
                                    {p.proof_url ? <Button asChild variant="outline" size="sm"><a href={p.proof_url} target="_blank" rel="noopener noreferrer">Lihat <ExternalLink className="ml-2 h-3 w-3" /></a></Button> : '-'}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    {p.status === 'Pending' && (
                                        <>
                                            <Button size="sm" onClick={() => handlePaymentStatusUpdate(p.id, 'Lunas')}><Check className="mr-2 h-4 w-4" /> Konfirmasi</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handlePaymentStatusUpdate(p.id, 'Ditolak')}><X className="mr-2 h-4 w-4" /> Tolak</Button>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          )}
          {invoice.terms && (
            <Alert variant="default" className="bg-gray-50">
                <Info className="h-4 w-4" />
                <AlertTitle>Syarat & Ketentuan</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">
                    {invoice.terms}
                </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <style>{`@media print { body { background-color: white; } .print\\:shadow-none { box-shadow: none; } .print\\:border-none { border: none; } .print\\:hidden { display: none; } }`}</style>
    </div>
  );
};

export default InvoiceView;