import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download, Landmark, Share2, Check, X, ExternalLink, Info, FileText, Send } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import PaymentForm from '@/components/PaymentForm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency, safeFormat, calculateSubtotal, calculateTotal, calculateItemTotal, getStatusVariant } from '@/lib/utils';
import { generatePdf } from '@/utils/pdfGenerator';
import { DocumentItemsTable } from '@/components/DocumentItemsTable';
import ProfitAnalysisCard from '@/components/ProfitAnalysisCard';
import DocumentTimeline from '@/components/DocumentTimeline';
import SendDocumentDialog from '@/components/SendDocumentDialog';

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
  client_id: string | null;
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
  clients?: { email: string; phone: string } | null;
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
    signature_url: string | null;
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
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const fetchInvoiceData = async () => {
    if (!id) return;
    setLoading(true);
    // Fetch invoice with client details (email/phone) for sending
    const invoiceRes = await supabase
        .from('invoices')
        .select('*, invoice_items(*), clients(email, phone)')
        .eq('id', id)
        .single();
    
    if (invoiceRes.error) {
      showError('Faktur tidak ditemukan.');
      navigate('/invoices');
      return;
    }
    const invoiceData = invoiceRes.data as InvoiceDetails;
    setInvoice(invoiceData);

    if (invoiceData.user_id) {
        const { data: profileData } = await supabase.from('profiles').select('company_logo_url, brand_color, payment_instructions, custom_footer, show_quantity_column, show_unit_column, show_unit_price_column, qris_url, signature_url').eq('id', invoiceData.user_id).single();
        setProfile(profileData);
    }

    const paymentsRes = await supabase.from('payments').select('*').eq('invoice_id', id).order('payment_date', { ascending: false });
    if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [id, navigate]);

  const handleSaveAsPDF = async () => {
    if (!invoiceRef.current || !invoice) return;
    setIsGeneratingPDF(true);
    await generatePdf(invoiceRef.current, `Faktur-${invoice.invoice_number || invoice.id}.pdf`);
    setIsGeneratingPDF(false);
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

  const handlePaymentStatusUpdate = async (paymentId: string, newStatus: 'Lunas' | 'Ditolak') => {
    const { error } = await supabase.from('payments').update({ status: newStatus }).eq('id', paymentId);
    if (error) {
        showError(`Gagal ${newStatus === 'Lunas' ? 'mengonfirmasi' : 'menolak'} pembayaran.`);
    } else {
        showSuccess(`Pembayaran berhasil ${newStatus === 'Lunas' ? 'dikonfirmasi' : 'ditolak'}.`);
        fetchInvoiceData();
    }
  };

  const subtotal = useMemo(() => calculateSubtotal(invoice?.invoice_items || []), [invoice]);
  const discountAmount = useMemo(() => invoice?.discount_amount || 0, [invoice]);
  const taxAmount = useMemo(() => invoice?.tax_amount || 0, [invoice]);
  const total = useMemo(() => calculateTotal(subtotal, discountAmount, taxAmount), [subtotal, discountAmount, taxAmount]);
  const totalPaid = useMemo(() => payments.filter(p => p.status === 'Lunas').reduce((acc, p) => acc + p.amount, 0), [payments]);
  const balanceDue = useMemo(() => total - totalPaid, [total, totalPaid]);

  useEffect(() => {
    if (invoice && balanceDue <= 0 && invoice.status !== 'Lunas') {
        supabase.from('invoices').update({ status: 'Lunas' }).eq('id', invoice.id).then(() => fetchInvoiceData());
    }
  }, [balanceDue, invoice]);

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

        <SendDocumentDialog
            isOpen={isSendDialogOpen}
            setIsOpen={setIsSendDialogOpen}
            docType="invoice"
            docId={invoice.id}
            docNumber={invoice.invoice_number}
            clientName={invoice.to_client}
            clientEmail={invoice.clients?.email}
            clientPhone={invoice.clients?.phone || invoice.to_phone}
            publicLink={`${window.location.origin}/invoice/public/${invoice.id}`}
            onSend={fetchInvoiceData}
        />
        
        {/* Header Actions */}
        <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
            <Button asChild variant="outline" className="self-start md:self-auto"><Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link></Button>
            <div className="flex items-center gap-2 flex-wrap justify-end w-full md:w-auto">
                <Button onClick={() => setIsSendDialogOpen(true)} variant="default" className="bg-blue-600 hover:bg-blue-700">
                    <Send className="mr-2 h-4 w-4" /> Kirim
                </Button>
                {invoice.status !== 'Lunas' && <Button variant="outline" onClick={() => { setSelectedPayment(null); setIsPaymentFormOpen(true); }}><Landmark className="mr-2 h-4 w-4" /> Catat Pembayaran</Button>}
                <Button asChild variant="outline"><Link to={`/invoice/edit/${id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link></Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Hapus</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus faktur secara permanen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteInvoice}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> PDF</>}</Button>
                <Button onClick={() => window.print()} variant="outline"><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
            </div>
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">
            {/* Main Content: Invoice Preview */}
            <div className="lg:col-span-2 space-y-8">
                <Card ref={invoiceRef} className="shadow-lg print:shadow-none print:border-none">
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
                        <p className="text-sm text-muted-foreground">Tanggal: {safeFormat(invoice.invoice_date, 'PPP')}</p>
                        </div>
                    </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        <div><h3 className="font-semibold text-gray-500 mb-2 text-sm">Ditagihkan Kepada:</h3><p className="font-bold">{invoice.to_client}</p><p className="text-sm">{invoice.to_address}</p><p className="text-sm">{invoice.to_phone}</p></div>
                        <div className="text-right"><h3 className="font-semibold text-gray-500 mb-2 text-sm">Jatuh Tempo:</h3><p className="text-sm">{safeFormat(invoice.due_date, 'PPP')}</p></div>
                    </div>
                    
                    <DocumentItemsTable 
                        items={invoice.invoice_items} 
                        config={{
                            showQuantity: profile?.show_quantity_column,
                            showUnit: profile?.show_unit_column,
                            showUnitPrice: profile?.show_unit_price_column
                        }}
                    />

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
                                <p className="font-semibold mb-2 text-sm">Scan QRIS Toko</p>
                                <img src={profile.qris_url} alt="QRIS Code" className="w-32 h-32 object-contain" />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end mt-8">
                        <div className="text-center">
                            <p className="text-sm font-medium mb-4">Hormat Kami,</p>
                            {profile?.signature_url ? (
                                <img src={profile.signature_url} alt="Tanda Tangan" className="h-24 mx-auto mb-2 object-contain" />
                            ) : (
                                <div className="h-24" />
                            )}
                            <p className="text-sm font-bold">{invoice.from_company}</p>
                        </div>
                    </div>

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
            </div>

            {/* Sidebar: Analysis, History, Payments */}
            <div className="space-y-6 print:hidden">
                <ProfitAnalysisCard 
                    items={invoice.invoice_items} 
                    discountAmount={invoice.discount_amount} 
                    taxAmount={invoice.tax_amount} 
                    type="Faktur"
                />

                <DocumentTimeline docId={id!} type="invoice" />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Riwayat Pembayaran</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {payments.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead className="text-right">Jumlah</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>{safeFormat(p.payment_date, 'dd/MM/yyyy')}</span>
                                                    <span className="text-xs text-muted-foreground">{p.status}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                        {p.status === 'Pending' ? (
                                                            <>
                                                                <DropdownMenuItem onClick={() => handlePaymentStatusUpdate(p.id, 'Lunas')}><Check className="mr-2 h-4 w-4" /> Konfirmasi</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handlePaymentStatusUpdate(p.id, 'Ditolak')} className="text-red-600"><X className="mr-2 h-4 w-4" /> Tolak</DropdownMenuItem>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <DropdownMenuItem onClick={() => { setSelectedPayment(p); setIsPaymentFormOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                                {p.proof_url && <DropdownMenuItem asChild><a href={p.proof_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Bukti</a></DropdownMenuItem>}
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Hapus Pembayaran?</AlertDialogTitle><AlertDialogDescription>Data tidak bisa dikembalikan.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePayment(p.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Belum ada pembayaran.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
        <style>{`@media print { body { background-color: white; } .print\\:shadow-none { box-shadow: none; } .print\\:border-none { border: none; } .print\\:hidden { display: none; } }`}</style>
    </div>
  );
};

export default InvoiceView;