import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowLeft, Pencil, Trash2, Download, Landmark, Share2, Check, X, ExternalLink, Info, FileText, Send, MoreVertical, History, CreditCard } from 'lucide-react';
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
import { formatCurrency, safeFormat, calculateSubtotal, calculateTotal, calculateItemTotal, getStatusVariant, cn } from '@/lib/utils';
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

        const currentInvoice = invoiceRes.data as InvoiceDetails;
        setInvoice(currentInvoice);

        const [profileRes, paymentsRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', currentInvoice.user_id).single(),
            supabase.from('payments').select('*').eq('invoice_id', id).order('payment_date', { ascending: false })
        ]);

        if (profileRes.data) {
            setProfile(profileRes.data);
        }

        if (paymentsRes.data) {
            setPayments(paymentsRes.data as Payment[]);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchInvoiceData();
    }, [id]);

    const handleSaveAsPDF = async () => {
        if (!invoiceRef.current || !invoice) return;
        setIsGeneratingPDF(true);
        await generatePdf(invoiceRef.current, `Faktur-${invoice.invoice_number || invoice.id}.pdf`, { format: 'a4', continuous: true });
        setIsGeneratingPDF(false);
    };

    const handlePrint = () => {
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
            document.documentElement.classList.remove('dark');
        }

        const handleAfterPrint = () => {
            if (isDark) {
                document.documentElement.classList.add('dark');
            }
            window.removeEventListener('afterprint', handleAfterPrint);
        };

        window.addEventListener('afterprint', handleAfterPrint);
        window.print();
    };

    const handleDeleteInvoice = async () => {
        if (!id) return;
        const { error } = await supabase.from('invoices').delete().match({ id });
        if (error) {
            showError('Gagal menghapus faktur.');
        } else {
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

    const handlePaymentStatusUpdate = async (paymentId: string, status: string) => {
        const { error } = await supabase.from('payments').update({ status }).match({ id: paymentId });
        if (error) {
            showError('Gagal memperbarui status pembayaran.');
        } else {
            showSuccess(`Pembayaran ditandai ${status}.`);
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

    if (loading) {
        return (
            <div className="container mx-auto p-4 sm:p-8 space-y-4 max-w-5xl">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-[600px] w-full rounded-3xl" />
            </div>
        );
    }

    if (!invoice) return null;

    return (
        <div className="min-h-screen bg-background px-3 py-6 text-foreground sm:px-6 lg:px-8 space-y-6 print:min-h-0 print:p-0 print:m-0 print:bg-white print:space-y-0 print:w-full print:max-w-none">
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
                <AlertDialogContent className="rounded-3xl p-6">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base font-bold">Hapus Catatan Pembayaran?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground">Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 pt-2">
                        <AlertDialogCancel className="rounded-xl text-xs font-semibold">Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (paymentToDelete) handleDeletePayment(paymentToDelete.id);
                                setPaymentToDelete(null);
                            }}
                            className="rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ========================================================================= */}
            {/* HEADER ACTION TOOLBAR (EXCLUDED FROM PRINT & PDF) */}
            {/* ========================================================================= */}
            <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden no-pdf">
                <Button asChild variant="outline" className="rounded-xl h-11 px-4 text-xs font-bold self-start sm:self-auto border-border/80 hover:bg-muted">
                    <Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
                </Button>

                <div className="flex w-full sm:w-auto flex-wrap items-center justify-end gap-2">
                    {invoice.status !== 'Lunas' && (
                        <Button 
                            onClick={() => { setSelectedPayment(null); setIsPaymentFormOpen(true); }}
                            className="rounded-xl h-11 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                            <Landmark className="mr-1.5 h-4 w-4" /> Catat Pembayaran
                        </Button>
                    )}

                    <Button onClick={() => setIsSendDialogOpen(true)} className="rounded-xl h-11 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
                        <Send className="mr-1.5 h-4 w-4" /> Kirim
                    </Button>

                    <Button asChild variant="outline" className="rounded-xl h-11 px-3 text-xs font-bold border-border/80 hover:bg-muted">
                        <Link to={`/invoice/edit/${id}`}><Pencil className="mr-1.5 h-4 w-4" /> Edit</Link>
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="rounded-xl h-11 px-3 text-xs font-bold">
                                <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl p-6">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-base font-bold">Hapus Faktur Tagihan?</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-muted-foreground">
                                    Tindakan ini tidak dapat dibatalkan. Faktur #{invoice.invoice_number} akan dihapus secara permanen.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2 pt-2">
                                <AlertDialogCancel className="rounded-xl text-xs font-semibold">Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteInvoice} className="rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Hapus
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF} variant="outline" className="rounded-xl h-11 px-4 text-xs font-bold border-border/80 hover:bg-muted">
                        <Download className="mr-1.5 h-4 w-4 text-primary" />
                        {isGeneratingPDF ? 'Membuat PDF...' : 'PDF 1 Halaman'}
                    </Button>

                    <Button onClick={handlePrint} variant="outline" className="rounded-xl h-11 px-3 text-xs font-bold border-border/80 hover:bg-muted">
                        <Printer className="mr-1.5 h-4 w-4" /> Cetak
                    </Button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* MAIN SINGLE-PAGE INVOICE DOCUMENT CARD (THE ONLY PART PRINTED & EXPORTED) */}
            {/* ========================================================================= */}
            <div className="mx-auto max-w-5xl print:max-w-none print:m-0 print:p-0 print:w-full print:bg-white">
                <Card ref={invoiceRef} className="document-print-root overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm print:shadow-none print:border-none print:rounded-none print:m-0 print:p-0 print:w-full print:bg-white">
                    {/* Letterhead Header */}
                    <CardHeader className="p-5 sm:p-7 border-b border-border/70 bg-muted/20 print:p-0 print:pb-4 print:border-b-2 print:border-slate-800 print:bg-transparent">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="min-w-0 space-y-1.5">
                                {profile?.company_logo_url ? (
                                    <img src={profile.company_logo_url} alt="Company Logo" className="mb-2 max-h-14 object-contain" />
                                ) : (
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black text-base print:hidden">
                                            {invoice.from_company.slice(0, 1) || 'F'}
                                        </div>
                                        <h1 className="text-lg sm:text-xl font-black leading-tight text-foreground tracking-tight print:text-2xl print:text-black">
                                            {invoice.from_company}
                                        </h1>
                                    </div>
                                )}
                                <div className="text-[11px] text-muted-foreground space-y-0.5 print:text-slate-600">
                                    <p>{invoice.from_address}</p>
                                    {invoice.from_website && <p className="text-primary font-medium print:text-slate-800">{invoice.from_website}</p>}
                                </div>
                            </div>

                            <div className="shrink-0 text-left sm:text-right space-y-1.5">
                                <div className="inline-block px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[11px] font-black tracking-wider uppercase print:border-slate-800 print:bg-slate-100 print:text-slate-900">
                                    FAKTUR TAGIHAN
                                </div>
                                <div className="print:hidden">
                                    <Badge variant={getStatusVariant(invoice.status)} className="text-[10px] font-bold">
                                        {invoice.status || 'Draf'}
                                    </Badge>
                                </div>
                                <div className="text-[11px] text-muted-foreground space-y-0.5 pt-0.5 print:text-slate-700">
                                    <p><strong>No:</strong> {invoice.invoice_number}</p>
                                    <p><strong>Tanggal:</strong> {safeFormat(invoice.invoice_date, 'd MMMM yyyy')}</p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4 p-5 sm:p-7 print:p-0 print:pt-4 print:space-y-3">
                        {/* Client & Due Date Banner */}
                        <div className="grid grid-cols-2 gap-4 rounded-2xl bg-muted/30 p-4 border border-border/60 print:bg-transparent print:border-none print:p-0 print:gap-2">
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">Ditagihkan Kepada:</p>
                                <p className="text-sm font-extrabold text-foreground print:text-black">{invoice.to_client}</p>
                                <p className="text-xs text-muted-foreground print:text-slate-600">{invoice.to_address}</p>
                                {invoice.to_phone && <p className="text-xs text-muted-foreground print:text-slate-600">{invoice.to_phone}</p>}
                            </div>
                            <div className="text-right space-y-0.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">Jatuh Tempo:</p>
                                <p className="text-sm font-extrabold text-foreground print:text-black">{safeFormat(invoice.due_date, 'd MMMM yyyy')}</p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <DocumentItemsTable
                            items={invoice.invoice_items}
                            config={{
                                showQuantity: profile?.show_quantity_column,
                                showUnit: profile?.show_unit_column,
                                showUnitPrice: profile?.show_unit_price_column
                            }}
                        />

                        {/* Totals Section */}
                        <div className="flex justify-end pt-1">
                            <div className="w-full space-y-1.5 rounded-2xl bg-muted/30 p-4 text-xs sm:max-w-xs border border-border/60 print:border-none print:bg-transparent print:p-0 print:space-y-1">
                                <div className="flex justify-between font-semibold">
                                    <span className="text-muted-foreground print:text-slate-600">Subtotal</span>
                                    <span className="text-foreground tabular-nums print:text-black">{formatCurrency(subtotal)}</span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold print:text-black">
                                        <span>Diskon</span>
                                        <span>- {formatCurrency(discountAmount)}</span>
                                    </div>
                                )}
                                {taxAmount > 0 && (
                                    <div className="flex justify-between font-semibold">
                                        <span className="text-muted-foreground print:text-slate-600">Pajak</span>
                                        <span className="text-foreground tabular-nums print:text-black">+ {formatCurrency(taxAmount)}</span>
                                    </div>
                                )}
                                <Separator className="my-1 print:border-slate-300" />
                                <div className="flex justify-between text-base font-black text-foreground print:text-black">
                                    <span>Total Tagihan</span>
                                    <span className="text-primary tabular-nums print:text-black">{formatCurrency(total)}</span>
                                </div>
                                {invoice.down_payment_amount > 0 && (
                                    <div className="flex justify-between text-muted-foreground font-semibold print:text-slate-600">
                                        <span>Uang Muka (DP)</span>
                                        <span>- {formatCurrency(invoice.down_payment_amount)}</span>
                                    </div>
                                )}
                                {settledPayments > 0 && (
                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold print:text-black">
                                        <span>Pembayaran Tercatat</span>
                                        <span>- {formatCurrency(settledPayments)}</span>
                                    </div>
                                )}
                                {(settledPayments > 0 || invoice.down_payment_amount > 0) && invoice.status !== 'Lunas' && (
                                    <>
                                        <Separator className="my-1 print:border-slate-300" />
                                        <div className="flex justify-between text-sm font-extrabold">
                                            <span>Sisa Tagihan</span>
                                            <span className={balanceDue > 0 ? "text-rose-600 dark:text-rose-400 font-black tabular-nums print:text-black" : "text-emerald-600 font-black tabular-nums print:text-black"}>
                                                {formatCurrency(balanceDue)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Bottom Info: Payment Instructions, QRIS & Signature */}
                        <div className="print-avoid-break mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-3 print:mt-2">
                            {/* Kolom 1: Instruksi Pembayaran */}
                            {profile?.payment_instructions ? (
                                <div className="rounded-2xl border border-border/80 bg-muted/20 p-3.5 text-xs print:border-slate-300 print:bg-transparent print:p-2">
                                    <div className="flex items-center gap-1.5 font-bold text-foreground mb-1.5 print:text-black">
                                        <Landmark className="h-3.5 w-3.5 text-primary shrink-0 print:hidden" />
                                        <span>Instruksi Pembayaran</span>
                                    </div>
                                    <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed text-[11px] print:text-slate-700">{profile.payment_instructions}</p>
                                </div>
                            ) : (
                                <div className="hidden sm:block print:hidden" />
                            )}

                            {/* Kolom 2: QRIS Toko */}
                            {profile?.qris_url ? (
                                <div className="rounded-2xl border border-border/80 bg-white p-3 flex flex-col items-center justify-center text-center print:border-slate-300 print:p-1">
                                    <p className="font-bold text-[11px] text-slate-800 mb-1">Scan QRIS Toko</p>
                                    <img src={profile.qris_url} alt="QRIS Code" className="h-20 w-20 object-contain" />
                                </div>
                            ) : (
                                <div className="hidden sm:block print:hidden" />
                            )}

                            {/* Kolom 3: Tanda Tangan */}
                            <div className="flex flex-col items-center sm:items-end justify-end text-center sm:text-right print:items-end print:text-right">
                                <p className="text-xs font-semibold text-muted-foreground mb-1 print:text-slate-600">Hormat Kami,</p>
                                {profile?.signature_url ? (
                                    <img src={profile.signature_url} alt="Tanda Tangan" className="h-16 max-h-16 mb-1 object-contain" />
                                ) : (
                                    <div className="h-12" />
                                )}
                                <p className="text-xs font-bold text-foreground print:text-black">{invoice.from_company}</p>
                            </div>
                        </div>

                        {invoice.attachments && invoice.attachments.length > 0 && (
                            <div className="print:hidden">
                                <h3 className="mb-2 font-semibold text-xs text-muted-foreground">Lampiran Dokumen:</h3>
                                <div className="space-y-1.5">
                                    {invoice.attachments.map((attachment, index) => (
                                        <div key={index} className="flex items-center p-2 border border-border/70 rounded-xl bg-muted/20">
                                            <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline font-medium">
                                                <FileText className="h-4 w-4" />
                                                {attachment.name}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {invoice.terms && (
                            <Alert variant="default" className="print-terms print-avoid-break bg-muted/20 border-border/70 rounded-2xl">
                                <Info className="h-4 w-4 text-primary" />
                                <AlertTitle className="text-xs font-bold">Syarat & Ketentuan</AlertTitle>
                                <AlertDescription className="text-xs whitespace-pre-wrap text-muted-foreground leading-relaxed">{invoice.terms}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>

                    {profile?.custom_footer && (
                        <CardFooter className="p-4 sm:p-5 pt-3 border-t border-border/70 bg-muted/20 text-center print:bg-transparent print:border-t print:border-slate-300 print:p-2">
                            <p className="text-[11px] text-muted-foreground text-center w-full whitespace-pre-wrap leading-relaxed print:text-slate-600">{profile.custom_footer}</p>
                        </CardFooter>
                    )}
                </Card>
            </div>

            {/* ========================================================================= */}
            {/* BOTTOM SECTION: PROFIT ANALYSIS, PAYMENTS & DOCUMENT TIMELINE (EXCLUDED FROM PRINT/PDF) */}
            {/* ========================================================================= */}
            <div className="mx-auto max-w-5xl space-y-6 pt-2 print:hidden no-pdf">
                {/* 1. Analisis Keuntungan Full-Width */}
                <ProfitAnalysisCard
                    items={invoice.invoice_items}
                    discountAmount={invoice.discount_amount}
                    taxAmount={invoice.tax_amount}
                    type="Faktur"
                />

                {/* 2. Riwayat Pembayaran Full-Width */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <CreditCard className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-foreground">Riwayat Pembayaran Faktur</h3>
                                <p className="text-xs text-muted-foreground">Catatan pembayaran bertahap maupun pelunasan dari klien.</p>
                            </div>
                        </div>

                        {invoice.status !== 'Lunas' && (
                            <Button 
                                onClick={() => { setSelectedPayment(null); setIsPaymentFormOpen(true); }}
                                size="sm" 
                                className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <Landmark className="mr-1.5 h-3.5 w-3.5" /> Catat Pembayaran Baru
                            </Button>
                        )}
                    </div>

                    {payments.length > 0 ? (
                        <div className="rounded-2xl border border-border/70 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-bold text-xs">Tanggal Pembayaran</TableHead>
                                        <TableHead className="font-bold text-xs">Catatan</TableHead>
                                        <TableHead className="font-bold text-xs text-center">Status</TableHead>
                                        <TableHead className="font-bold text-xs text-right">Nominal</TableHead>
                                        <TableHead className="w-[80px] text-center font-bold text-xs">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.map(p => (
                                        <TableRow key={p.id} className="hover:bg-muted/30">
                                            <TableCell className="text-xs font-semibold">
                                                {safeFormat(p.payment_date, 'd MMMM yyyy')}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                                {p.notes || '-'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge 
                                                    variant="outline" 
                                                    className={cn(
                                                        "text-[10px] font-bold px-2 py-0.5",
                                                        p.status === 'Lunas' ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                                    )}
                                                >
                                                    {p.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-xs text-foreground tabular-nums">
                                                {formatCurrency(p.amount)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted">
                                                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-2xl p-1 w-44">
                                                        <DropdownMenuLabel className="text-xs">Aksi Pembayaran</DropdownMenuLabel>
                                                        {p.status === 'Pending' ? (
                                                            <>
                                                                <DropdownMenuItem onClick={() => handlePaymentStatusUpdate(p.id, 'Lunas')} className="text-xs font-bold text-emerald-600">
                                                                    <Check className="mr-2 h-4 w-4" /> Konfirmasi Lunas
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handlePaymentStatusUpdate(p.id, 'Ditolak')} className="text-xs font-bold text-rose-600">
                                                                    <X className="mr-2 h-4 w-4" /> Tolak
                                                                </DropdownMenuItem>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <DropdownMenuItem onClick={() => { setSelectedPayment(p); setIsPaymentFormOpen(true); }} className="text-xs">
                                                                    <Pencil className="mr-2 h-4 w-4" /> Edit Pembayaran
                                                                </DropdownMenuItem>
                                                                {p.proof_url && (
                                                                    <DropdownMenuItem asChild className="text-xs">
                                                                        <a href={p.proof_url} target="_blank" rel="noopener noreferrer">
                                                                            <ExternalLink className="mr-2 h-4 w-4" /> Lihat Bukti
                                                                        </a>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem className="text-rose-600 text-xs font-bold" onClick={() => setPaymentToDelete(p)}>
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                            Belum ada riwayat pembayaran yang tercatat untuk faktur ini.
                        </div>
                    )}
                </div>

                {/* 3. Riwayat Aktivitas Full-Width */}
                <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-foreground">Riwayat & Jejak Aktivitas Faktur</h3>
                            <p className="text-xs text-muted-foreground">Catatan interaksi pembuatan, pengiriman, dan pembukaan oleh klien.</p>
                        </div>
                    </div>

                    <DocumentTimeline docId={id!} type="invoice" />
                </div>
            </div>

            {/* ========================================================================= */}
            {/* CRISP CORPORATE PRINT STYLES - 1 SINGLE CLEAN PAGE */}
            {/* ========================================================================= */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 6mm;
                    }
                    *, *::before, *::after {
                        background-image: none !important;
                        box-shadow: none !important;
                        text-shadow: none !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body, #root, #root *, .min-h-screen, .min-h-screen * {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        background-image: none !important;
                        color: #0f172a !important;
                    }
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        min-height: auto !important;
                    }
                    .min-h-screen {
                        padding: 0 !important;
                        margin: 0 !important;
                        min-height: auto !important;
                    }
                    .document-print-root {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        background-color: #ffffff !important;
                        color: #0f172a !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .print\\:hidden, .no-pdf {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default InvoiceView;
