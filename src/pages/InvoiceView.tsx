import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download, Landmark, Share2, Check, X, ExternalLink, Info, FileText } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';

interface Attachment {
  name: string;
  url: string;
  path: string;
}

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
  attachments: Attachment[]; // New field for attachments
  invoice_items: {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    cost_price: number;
  }[];
};

type ProfileInfo = {
    company_logo_url: string | null;
    brand_color: string | null;
    payment_instructions: string | null;
    custom_footer: string | null;
    show_quantity_column: boolean;
    show_unit_column: boolean;
    show_unit_price_column: boolean;
    qris_url: string | null;
};

const InvoiceView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
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
        const { data: profileData } = await supabase.from('profiles').select('company_logo_url, brand_color, payment_instructions, custom_footer, show_quantity_column, show_unit_column, show_unit_price_column, qris_url').eq('id', invoiceData.user_id).single();
        setProfile(profileData);
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

    const input = invoiceRef.current;
    const originalWidth = input.style.width;
    input.style.width = '1024px'; // Force width for consistent PDF rendering

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
      .catch(err => {
        console.error("Error generating PDF", err);
        showError("Gagal membuat PDF.");
      })
      .finally(() => {
        elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
        input.style.width = originalWidth; // Restore original width
        setIsGeneratingPDF(false);
      });
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

  const handleDeletePayment = async (paymentId: string) => {
    const { error } = await supabase.from('payments').delete().match({ id: paymentId });
    if (error) {
      showError('Gagal menghapus pembayaran.');
    } else {
      showSuccess('Pembayaran berhasil dihapus.');
      fetchInvoiceData();
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
  const totalCost = useMemo(() => invoice?.invoice_items.reduce((acc, item) => acc + item.quantity * (item.cost_price || 0), 0) || 0, [invoice]);
  const discountAmount = useMemo(() => invoice?.discount_amount || 0, [invoice]);
  const taxAmount = useMemo(() => invoice?.tax_amount || 0, [invoice]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);
  const profit = useMemo(() => total - totalCost - taxAmount, [total, totalCost, taxAmount]);
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

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
        <PaymentForm
            isOpen={isPaymentFormOpen}
            setIsOpen={setIsPaymentFormOpen}
            invoiceId={invoice.id}
            invoiceTotal={total}
            payment={selectedPayment}
            onSave={() => {
                setIsPaymentFormOpen(false);
                setSelectedPayment(null);
                fetchInvoiceData();
            }}
        />
        <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden">
            <Button asChild variant="outline"><Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link></Button>
            <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button onClick={handleShareLink} variant="secondary"><Share2 className="mr-2 h-4 w-4" /> Bagikan Tautan</Button>
                {invoice.status !== 'Lunas' && <Button onClick={() => { setSelectedPayment(null); setIsPaymentFormOpen(true); }}><Landmark className="mr-2 h-4 w-4" /> Catat Pembayaran</Button>}
                <Button asChild variant="outline"><Link to={`/invoice/edit/${id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link></Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Hapus</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus faktur secara permanen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteInvoice}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> Ekspor PDF</>}</Button>
                <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
            </div>
        </div>
      <Card ref={invoiceRef} className="max-w-4xl mx-auto shadow-lg print:shadow-none print:border-none">
        <CardHeader className="bg-gray-50 p-8 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              {profile?.company_logo_url ? <img src={profile.company_logo_url} alt="Company Logo" className="max-h-20 mb-4" /> : <h1 className="text-2xl font-bold text-gray-800">{invoice.from_company}</h1>}
              <p className="text-sm text-muted-foreground">{invoice.from_address}</p>
              <p className="text-sm text-muted-foreground">{invoice.from_website}</p>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold uppercase text-gray-400 tracking-widest" style={{ color: profile?.brand_color || undefined }}>Faktur</h2>
              <div className="mt-1"><Badge variant={getStatusVariant(invoice.status)} className="text-xs">{invoice.status || 'Draf'}</Badge></div>
              <p className="text-sm text-muted-foreground mt-2">No: {invoice.invoice_number}</p>
              <p className="text-sm text-muted-foreground">Tanggal: {format(new Date(invoice.invoice_date), 'PPP', { locale: localeId })}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div><h3 className="font-semibold text-gray-500 mb-2 text-sm">Ditagihkan Kepada:</h3><p className="font-bold">{invoice.to_client}</p><p className="text-sm">{invoice.to_address}</p><p className="text-sm">{invoice.to_phone}</p></div>
            <div className="text-right"><h3 className="font-semibold text-gray-500 mb-2 text-sm">Jatuh Tempo:</h3><p className="text-sm">{invoice.due_date ? format(new Date(invoice.due_date), 'PPP', { locale: localeId }) : 'N/A'}</p></div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100"><tr className="border-b"><th className="p-3 text-center font-medium text-gray-700 w-[40px]">No.</th><th className="p-3 text-left font-medium text-gray-700">Deskripsi</th>{profile?.show_quantity_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Jumlah</th>}{profile?.show_unit_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Satuan</th>}{profile?.show_unit_price_column && <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Harga Satuan</th>}<th className="p-3 text-right font-medium text-gray-700 w-[150px]">Total</th></tr></thead>
              <tbody>{invoice.invoice_items.map((item, index) => (<tr key={index} className="border-b last:border-none"><td className="p-3 text-center align-top">{index + 1}</td><td className="p-3 align-top">{item.description}</td>{profile?.show_quantity_column && <td className="p-3 text-center align-top">{item.quantity}</td>}{profile?.show_unit_column && <td className="p-3 text-center align-top">{item.unit || '-'}</td>}{profile?.show_unit_price_column && <td className="p-3 text-right align-top">{formatCurrency(item.unit_price)}</td>}<td className="p-3 text-right align-top">{formatCurrency(item.quantity * item.unit_price)}</td></tr>))}</tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>- {formatCurrency(discountAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>+ {formatCurrency(taxAmount)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Total Tagihan</span><span>{formatCurrency(total)}</span></div>
              {invoice.down_payment_amount > 0 && (<div className="flex justify-between"><span className="text-muted-foreground">Uang Muka (DP)</span><span>{formatCurrency(invoice.down_payment_amount)}</span></div>)}
              <div className="flex justify-between"><span className="text-muted-foreground">Telah Dibayar</span><span>- {formatCurrency(totalPaid)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Sisa Tagihan</span><span>{formatCurrency(balanceDue)}</span></div>
              <div className="no-pdf">
                <Separator className="print:hidden" />
                <div className="flex justify-between text-sm print:hidden"><span className="text-muted-foreground">Total Modal</span><span>{formatCurrency(totalCost)}</span></div>
                <div className="flex justify-between font-semibold text-green-600 print:hidden"><span >Keuntungan</span><span>{formatCurrency(profit)}</span></div>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {profile?.payment_instructions ? (
                <Alert className="no-pdf h-full">
                    <Landmark className="h-4 w-4" />
                    <AlertTitle>Instruksi Pembayaran</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap">{profile.payment_instructions}</AlertDescription>
                </Alert>
            ) : (
                <div className="print:hidden no-pdf"><p className="text-sm text-muted-foreground">Instruksi pembayaran belum diatur. Anda bisa menambahkannya di halaman <Link to="/settings" className="underline">Pengaturan</Link>.</p></div>
            )}
            
            {profile?.qris_url && (
                 <div className="border rounded-lg p-4 flex flex-col items-center justify-center bg-white text-center h-full">
                    <p className="font-semibold mb-2 text-sm">Scan QRIS untuk Bayar</p>
                    <img src={profile.qris_url} alt="QRIS Code" className="w-32 h-32 object-contain" />
                 </div>
            )}
          </div>

          {payments.length > 0 && (<Card className="print:hidden no-pdf"><CardHeader><CardTitle>Riwayat Pembayaran</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Jumlah</TableHead><TableHead>Status</TableHead><TableHead>Bukti</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{payments.map(p => (<TableRow key={p.id}><TableCell>{format(new Date(p.payment_date), 'PPP', { locale: localeId })}</TableCell><TableCell>{formatCurrency(p.amount)}</TableCell><TableCell><Badge variant={getStatusVariant(p.status)}>{p.status}</Badge></TableCell><TableCell>{p.proof_url ? <Button asChild variant="outline" size="sm"><a href={p.proof_url} target="_blank" rel="noopener noreferrer">Lihat <ExternalLink className="ml-2 h-3 w-3" /></a></Button> : '-'}</TableCell><TableCell className="text-right space-x-2">{p.status === 'Pending' ? (<><Button size="sm" onClick={() => handlePaymentStatusUpdate(p.id, 'Lunas')}><Check className="mr-2 h-4 w-4" /> Konfirmasi</Button><Button size="sm" variant="destructive" onClick={() => handlePaymentStatusUpdate(p.id, 'Ditolak')}><X className="mr-2 h-4 w-4" /> Tolak</Button></>) : (<><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setSelectedPayment(p); setIsPaymentFormOpen(true); }}><Pencil className="h-4 w-4" /></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus catatan pembayaran secara permanen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePayment(p.id)}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>)}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>)}
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
          {invoice.terms && (<Alert variant="default" className="bg-gray-50"><Info className="h-4 w-4" /><AlertTitle>Syarat & Ketentuan</AlertTitle><AlertDescription className="whitespace-pre-wrap">{invoice.terms}</AlertDescription></Alert>)}
        </CardContent>
        {profile?.custom_footer && (
            <CardFooter className="p-8 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center w-full whitespace-pre-wrap">{profile.custom_footer}</p>
            </CardFooter>
        )}
      </Card>
      <style>{`@media print { body { background-color: white; } .print\\:shadow-none { box-shadow: none; } .print\\:border-none { border: none; } .print\\:hidden { display: none; } }`}</style>
    </div>
  );
};

export default InvoiceView;