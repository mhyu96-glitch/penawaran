import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Plus, Trash2, Clock, Calendar, Receipt, Pause, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type RecurringConfig = {
    id: string;
    source_invoice_id: string;
    source_invoice_number: string;
    to_client: string;
    frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    next_run: string;
    is_active: boolean;
    created_at: string;
};

const frequencyLabels: Record<string, string> = {
    weekly: 'Mingguan',
    monthly: 'Bulanan',
    quarterly: 'Per 3 Bulan',
    yearly: 'Tahunan',
};

const RecurringInvoices = () => {
    const { user } = useAuth();
    const [configs, setConfigs] = useState<RecurringConfig[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
    const [frequency, setFrequency] = useState<string>('monthly');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        fetchData();
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        // Fetch invoices for dropdown
        const { data: invoiceData } = await supabase
            .from('invoices')
            .select('id, invoice_number, to_client')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (invoiceData) setInvoices(invoiceData);

        // Fetch recurring configs (stored in a JSON field on user profile or a dedicated table)
        // For now, we use localStorage as a simple store
        const stored = localStorage.getItem(`recurring_invoices_${user.id}`);
        if (stored) {
            setConfigs(JSON.parse(stored));
        }
        setLoading(false);
    };

    const saveConfigs = (newConfigs: RecurringConfig[]) => {
        if (!user) return;
        setConfigs(newConfigs);
        localStorage.setItem(`recurring_invoices_${user.id}`, JSON.stringify(newConfigs));
    };

    const handleCreate = () => {
        if (!selectedInvoiceId) { showError('Pilih faktur terlebih dahulu.'); return; }
        const sourceInvoice = invoices.find(i => i.id === selectedInvoiceId);
        if (!sourceInvoice) return;

        const nextRun = new Date();
        if (frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
        else if (frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
        else if (frequency === 'quarterly') nextRun.setMonth(nextRun.getMonth() + 3);
        else if (frequency === 'yearly') nextRun.setFullYear(nextRun.getFullYear() + 1);

        const newConfig: RecurringConfig = {
            id: crypto.randomUUID(),
            source_invoice_id: sourceInvoice.id,
            source_invoice_number: sourceInvoice.invoice_number || 'N/A',
            to_client: sourceInvoice.to_client,
            frequency: frequency as any,
            next_run: nextRun.toISOString(),
            is_active: true,
            created_at: new Date().toISOString(),
        };

        saveConfigs([...configs, newConfig]);
        showSuccess('Jadwal faktur berulang berhasil dibuat.');
        setIsDialogOpen(false);
        setSelectedInvoiceId('');
    };

    const toggleActive = (id: string) => {
        const updated = configs.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c);
        saveConfigs(updated);
        showSuccess('Status diperbarui.');
    };

    const deleteConfig = (id: string) => {
        saveConfigs(configs.filter(c => c.id !== id));
        showSuccess('Jadwal dihapus.');
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-8 space-y-4">
                <Skeleton className="h-10 w-1/3" />
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <RefreshCw className="h-7 w-7" />
                            <CardTitle className="text-3xl">Faktur Berulang</CardTitle>
                        </div>
                        <CardDescription>Otomatiskan pembuatan faktur untuk klien tetap.</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" /> Buat Jadwal Baru</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Jadwal Faktur Berulang</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Faktur Sumber</Label>
                                    <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                                        <SelectTrigger><SelectValue placeholder="Pilih faktur yang akan diduplikasi" /></SelectTrigger>
                                        <SelectContent>
                                            {invoices.map(inv => (
                                                <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.to_client}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Frekuensi</Label>
                                    <Select value={frequency} onValueChange={setFrequency}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(frequencyLabels).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
                                <Button onClick={handleCreate}>Buat Jadwal</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    {configs.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">Belum ada jadwal faktur berulang.</p>
                            <p className="text-sm text-muted-foreground mt-1">Buat jadwal untuk mengotomatiskan penagihan rutin.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {configs.map(config => (
                                <Card key={config.id} className={!config.is_active ? 'opacity-60' : ''}>
                                    <CardContent className="py-4">
                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                    <Receipt className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">{config.source_invoice_number} — {config.to_client}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                        <Clock className="h-3 w-3" />{frequencyLabels[config.frequency]}
                                                        <Separator orientation="vertical" className="h-3" />
                                                        <Calendar className="h-3 w-3" />Berikutnya: {format(new Date(config.next_run), 'dd MMM yyyy', { locale: localeId })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={config.is_active ? 'default' : 'secondary'}>{config.is_active ? 'Aktif' : 'Dijeda'}</Badge>
                                                <Button variant="ghost" size="icon" onClick={() => toggleActive(config.id)}>
                                                    {config.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Hapus jadwal?</AlertDialogTitle><AlertDialogDescription>Jadwal faktur berulang ini akan dihapus.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => deleteConfig(config.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default RecurringInvoices;
