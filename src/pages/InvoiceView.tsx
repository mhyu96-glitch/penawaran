import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download, Landmark, Share2, Check, X, ExternalLink, Info, FileText, Send, MoreVertical } from 'lucide-react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
    const invoiceRef = useRef<HTMLDivElement>(null);

    const fetchInvoiceData = async () => {
        if (!id) return;
        setLoading(true);
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
    const settledPayments = useMemo(
        () => payments.filter(p => p.status === 'Lunas').reduce((acc, p) => acc + p.amount, 0),
        [payments]
    );
    const totalPaid = useMemo(() => settledPayments + (invoice?.down_payment_amount || 0), [settledPayments, invoice?.down_payment_amount]);
    const balanceDue = useMemo(() => Math.max(0, total - totalPaid), [total, totalPaid]);

    useEffect(() => {
        if (invoice && balanceDue <= 0 && invoice.status !== 'Lunas') {
            supabase.from('invoices').update({ status: 'Lunas' }).eq('id', invoice.id).then(() => fetchInvoiceData());
        }
    }, [balanceDue, invoice]);

    if (loading) return <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-8"><Skeleton className="h-96 w-full" /></div>;
    if (!invoice) return null;

    return (
        <div className="min-h-screen bg-background px-2 py-3 text-foreground sm:p-8">
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

            <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Pembayaran?</AlertDialogTitle>
                        <AlertDialogDescription>Data tidak bisa dikembalikan.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (paymentToDelete) handleDeletePayment(paymentToDelete.id);
                                setPaymentToDelete(null);
                            }}
                        >
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Header Actions */}
            <div className="mx-auto mb-4 flex max-w-7xl items-center justify-between gap-2 print:hidden md:hidden">
                <Button asChild variant="outline" size="sm" className="h-10">
                    <Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
                </Button>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setIsSendDialogOpen(true)} size="sm" className="h-10">
                        <Send className="mr-2 h-4 w-4" /> Kirim
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-10 w-10">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Aksi lain</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {invoice.status !== 'Lunas' && (
                                <DropdownMenuItem onClick={() => { setSelectedPayment(null); setIsPaymentFormOpen(true); }}>
                                    <Landmark className="mr-2 h-4 w-4" /> Catat Pembayaran
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild><Link to={`/invoice/edit/${id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={handleSaveAsPDF} disabled={isGeneratingPDF}><Download className="mr-2 h-4 w-4" /> {isGeneratingPDF ? 'Membuat...' : 'PDF'}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="mx-auto mb-6 hidden max-w-7xl flex-col items-center justify-between gap-4 print:hidden md:flex md:flex-row">
                <Button asChild variant="outline" className="self-start md:self-auto"><Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link></Button>
                <div className="flex items-center gap-2 flex-wrap justify-end w-full md:w-auto">
                    <Button onClick={() => setIsSendDialogOpen(true)} variant="default">
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

            <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3 lg:gap-8">
                {/* Main Content: Invoice Preview */}
                <div className="lg:col-span-2 space-y-8">
                    <Card ref={invoiceRef} className="document-print-root overflow-hidden rounded-md shadow-sm print:shadow-none print:border-none sm:rounded-lg">
                        <CardHeader className="rounded-t-md bg-muted/35 p-4 sm:rounded-t-lg sm:p-8">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    {profile?.company_logo_url ? <img src={profile.company_logo_url} alt="Company Logo" className="mb-3 max-h-16 sm:max-h-20" /> : <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">{invoice.from_company}</h1>}
                                    <p className="mt-1 text-sm text-muted-foreground">{invoice.from_address}</p>
                                    {invoice.from_website && <p className="text-sm text-muted-foreground">{invoice.from_website}</p>}
                                </div>
                                <div className="shrink-0 text-left sm:text-right">
                                    <h2 className="text-2xl font-bold uppercase tracking-wide text-muted-foreground sm:text-3xl sm:tracking-widest" style={{ color: profile?.brand_color || undefined }}>Faktur</h2>
                                    <div className="mt-1"><Badge variant={getStatusVariant(invoice.status)} className="text-xs">{invoice.status || 'Draf'}</Badge></div>
                                    <p className="mt-2 text-sm text-muted-foreground">No: {invoice.invoice_number}</p>
                                    <p className="text-sm text-muted-foreground">Tanggal: {safeFormat(invoice.invoice_date, 'PPP')}</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5 p-4 sm:space-y-8 sm:p-8">
                            <div className="grid grid-cols-2 gap-4 sm:gap-8">
                                <div><h3 className="mb-2 text-sm font-semibold text-muted-foreground">Ditagihkan Kepada:</h3><p className="font-bold text-foreground">{invoice.to_client}</p><p className="text-sm text-muted-foreground">{invoice.to_address}</p>{invoice.to_phone && <p className="text-sm text-muted-foreground">{invoice.to_phone}</p>}</div>
                                <div className="text-right"><h3 className="mb-2 text-sm font-semibold text-muted-foreground">Jatuh Tempo:</h3><p className="text-sm font-bold text-foreground">{safeFormat(invoice.due_date, 'PPP')}</p></div>
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
                                <div className="w-full space-y-1.5 rounded-xl bg-muted/35 p-3 text-xs sm:max-w-xs sm:bg-transparent sm:p-0">
                                    <div className="flex justify-between font-medium">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                                            <span>Diskon</span>
                                            <span>- {formatCurrency(discountAmount)}</span>
                                        </div>
                                    )}
                                    {taxAmount > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Pajak</span>
                                            <span>+ {formatCurrency(taxAmount)}</span>
                                        </div>
                                    )}
                                    <Separator className="my-1" />
                                    <div className="flex justify-between text-sm sm:text-base font-extrabold text-foreground">
                                        <span>Total Tagihan</span>
                                        <span className="text-primary">{formatCurrency(total)}</span>
                                    </div>
                                    {invoice.down_payment_amount > 0 && (
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Uang Muka (DP)</span>
                                            <span>- {formatCurrency(invoice.down_payment_amount)}</span>
                                        </div>
                                    )}
                                    {settledPayments > 0 && (
                                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                            <span>Pembayaran Tercatat</span>
                                            <span>- {formatCurrency(settledPayments)}</span>
                                        </div>
                                    )}
                                    {(settledPayments > 0 || invoice.down_payment_amount > 0) && invoice.status !== 'Lunas' && (
                                        <>
                                            <Separator className="my-1" />
                                            <div className="flex justify-between text-sm font-extrabold">
                                                <span>Sisa Tagihan</span>
                                                <span className={balanceDue > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}>
                                                    {formatCurrency(balanceDue)}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            {/* Bottom Info & Signature Section (Compact & Fits A4) */}
                            <div className="print-avoid-break mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-3 print:mt-3">
                                {/* Kolom 1: Instruksi Pembayaran */}
                                {profile?.payment_instructions ? (
                                    <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs">
                                        <div className="flex items-center gap-1.5 font-bold text-foreground mb-1.5">
                                            <Landmark className="h-3.5 w-3.5 text-primary shrink-0" />
                                            <span>Instruksi Pembayaran</span>
                                        </div>
                                        <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed text-[11px]">{profile.payment_instructions}</p>
                                    </div>
                                ) : (
                                    <div className="hidden sm:block print:hidden" />
                                )}

                                {/* Kolom 2: QRIS Toko */}
                                {profile?.qris_url ? (
                                    <div className="rounded-xl border border-border/80 bg-white p-2.5 flex flex-col items-center justify-center text-center">
                                        <p className="font-bold text-[11px] text-slate-800 mb-1">Scan QRIS Toko</p>
                                        <img src={profile.qris_url} alt="QRIS Code" className="h-20 w-20 object-contain" />
                                    </div>
                                ) : (
                                    <div className="hidden sm:block print:hidden" />
                                )}

                                {/* Kolom 3: Tanda Tangan */}
                                <div className="flex flex-col items-center sm:items-end justify-end text-center sm:text-right print:items-end print:text-right">
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Hormat Kami,</p>
                                    {profile?.signature_url ? (
                                        <img src={profile.signature_url} alt="Tanda Tangan" className="h-16 max-h-16 mb-1 object-contain" />
                                    ) : (
                                        <div className="h-12" />
                                    )}
                                    <p className="text-xs font-bold text-foreground">{invoice.from_company}</p>
                                </div>
                            </div>

                            {invoice.attachments && invoice.attachments.length > 0 && (
                                <div>
                                    <h3 className="mb-2 font-semibold text-muted-foreground">Lampiran:</h3>
                                    <div className="space-y-2">
                                        {invoice.attachments.map((attachment, index) => (
                                            <div key={index} className="flex items-center p-2 border rounded-md">
                                                <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                                                    <FileText className="h-4 w-4" />
                                                    {attachment.name}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {invoice.terms && (<Alert variant="default" className="print-terms print-avoid-break bg-muted/35"><Info className="h-4 w-4" /><AlertTitle>Syarat & Ketentuan</AlertTitle><AlertDescription className="whitespace-pre-wrap">{invoice.terms}</AlertDescription></Alert>)}
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
                                                                    <DropdownMenuItem className="text-red-600" onClick={() => setPaymentToDelete(p)}><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
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
        </div>
    );
};

export default InvoiceView;
