import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Settings as SettingsIcon, Download, Upload, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  // Existing states
  const [defaultTerms, setDefaultTerms] = useState('');
  const [defaultTaxAmount, setDefaultTaxAmount] = useState(0);
  const [defaultDiscountAmount, setDefaultDiscountAmount] = useState(0);
  const [paymentInstructions, setPaymentInstructions] = useState('');

  // New states for document customization
  const [customFooter, setCustomFooter] = useState('');
  const [showQuantity, setShowQuantity] = useState(true);
  const [showUnit, setShowUnit] = useState(true);
  const [showUnitPrice, setShowUnitPrice] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('default_terms, default_tax_amount, default_discount_amount, payment_instructions, custom_footer, show_quantity_column, show_unit_column, show_unit_price_column')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error);
        showError('Gagal memuat pengaturan.');
      } else if (data) {
        setDefaultTerms(data.default_terms || '');
        setDefaultTaxAmount(data.default_tax_amount || 0);
        setDefaultDiscountAmount(data.default_discount_amount || 0);
        setPaymentInstructions(data.payment_instructions || '');
        setCustomFooter(data.custom_footer || '');
        setShowQuantity(data.show_quantity_column ?? true);
        setShowUnit(data.show_unit_column ?? true);
        setShowUnitPrice(data.show_unit_price_column ?? true);
      }
      setLoading(false);
    };

    fetchSettings();
  }, [user]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        default_terms: defaultTerms,
        default_tax_amount: defaultTaxAmount,
        default_discount_amount: defaultDiscountAmount,
        payment_instructions: paymentInstructions,
        custom_footer: customFooter,
        show_quantity_column: showQuantity,
        show_unit_column: showUnit,
        show_unit_price_column: showUnitPrice,
      })
      .eq('id', user.id);

    if (error) {
      showError('Gagal menyimpan pengaturan.');
      console.error('Settings update error:', error);
    } else {
      showSuccess('Pengaturan berhasil disimpan!');
    }
    setIsSubmitting(false);
  };

  const handleExportData = async () => {
    if (!user) return;
    const toastId = showLoading('Mempersiapkan data ekspor...');
    setIsExporting(true);
    try {
      const tablesToExport = [
        'profiles', 'clients', 'items', 'projects', 'project_tasks', 
        'time_entries', 'expenses', 'quotes', 'quote_items', 
        'invoices', 'invoice_items', 'payments'
      ];
      
      const dataPromises = tablesToExport.map(async (table) => {
        // The 'profiles' table is special, it doesn't have a user_id column but uses the user's id as its primary key.
        const query = supabase.from(table).select('*');
        if (table === 'profiles') {
          return query.eq('id', user.id);
        }
        // For other tables, we need to check if they have a user_id column.
        // This is a simplification; a more robust solution would inspect table metadata.
        // For this app, all other relevant tables have user_id.
        return query.eq('user_id', user.id);
      });
      
      const results = await Promise.all(dataPromises);
      
      const exportData: { [key: string]: any } = {};
      results.forEach((res, index) => {
        if (res.error) throw new Error(`Gagal mengambil data dari tabel ${tablesToExport[index]}: ${res.error.message}`);
        exportData[tablesToExport[index]] = res.data;
      });

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.download = `quoteapp_backup_${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      dismissToast(toastId);
      showSuccess('Data berhasil diekspor!');

    } catch (error: any) {
      dismissToast(toastId);
      showError(`Ekspor gagal: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        setRestoreFile(event.target.files[0]);
    } else {
        setRestoreFile(null);
    }
  };

  const handleRestoreData = async () => {
    if (!user || !restoreFile) return;

    const toastId = showLoading('Memulihkan data, jangan tutup halaman ini...');
    setIsRestoring(true);

    try {
        const fileContent = await restoreFile.text();
        const data = JSON.parse(fileContent);

        const tablesToRestore = [
            'profiles', 'clients', 'items', 'projects', 'expenses', 'quotes', 'invoices',
            'quote_items', 'invoice_items', 'payments', 'project_tasks', 'time_entries'
        ];

        for (const table of tablesToRestore) {
            if (data[table] && Array.isArray(data[table]) && data[table].length > 0) {
                const records = data[table].map((record: any) => ({
                    ...record,
                    user_id: user.id,
                    ...(table === 'profiles' && { id: user.id }),
                }));

                const { error } = await supabase.from(table).upsert(records);
                if (error) {
                    throw new Error(`Gagal memulihkan tabel ${table}: ${error.message}`);
                }
            }
        }

        dismissToast(toastId);
        showSuccess('Data berhasil dipulihkan! Halaman akan dimuat ulang.');
        setTimeout(() => window.location.reload(), 2000);

    } catch (error: any) {
        dismissToast(toastId);
        showError(`Pemulihan gagal: ${error.message}`);
        console.error("Restore error:", error);
    } finally {
        setIsRestoring(false);
        setRestoreFile(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-7 w-7" />
            <CardTitle className="text-3xl">Pengaturan</CardTitle>
          </div>
          <CardDescription>
            Atur nilai default dan informasi penting lainnya untuk menghemat waktu.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateSettings}>
          <CardContent className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Default Penawaran & Faktur</h3>
                <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label htmlFor="defaultTerms">Syarat & Ketentuan Default</Label>
                        <Textarea
                            id="defaultTerms"
                            placeholder="Contoh: Pembayaran 50% di muka..."
                            value={defaultTerms}
                            onChange={(e) => setDefaultTerms(e.target.value)}
                            rows={5}
                        />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="defaultTax">Pajak Default (Rp)</Label>
                            <Input
                            id="defaultTax"
                            type="number"
                            value={defaultTaxAmount}
                            onChange={(e) => setDefaultTaxAmount(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="defaultDiscount">Diskon Default (Rp)</Label>
                            <Input
                            id="defaultDiscount"
                            type="number"
                            value={defaultDiscountAmount}
                            onChange={(e) => setDefaultDiscountAmount(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                </div>
            </div>
            <Separator />
            <div>
                <h3 className="text-lg font-medium">Pengaturan Pembayaran</h3>
                <div className="space-y-2 mt-2">
                    <Label htmlFor="paymentInstructions">Instruksi Pembayaran</Label>
                    <Textarea
                        id="paymentInstructions"
                        placeholder="Contoh: Mohon transfer ke Bank ABC, No. Rek: 123456789 a/n Perusahaan Anda..."
                        value={paymentInstructions}
                        onChange={(e) => setPaymentInstructions(e.target.value)}
                        rows={5}
                    />
                    <p className="text-sm text-muted-foreground">
                        Informasi ini akan ditampilkan kepada klien ketika mereka mengklik tombol "Bayar Sekarang" di portal faktur.
                    </p>
                </div>
            </div>
            <Separator />
            <div>
                <h3 className="text-lg font-medium">Kustomisasi Dokumen</h3>
                <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label htmlFor="customFooter">Catatan Kaki (Footer) Kustom</Label>
                        <Textarea
                            id="customFooter"
                            placeholder="Contoh: Terima kasih atas kepercayaan Anda."
                            value={customFooter}
                            onChange={(e) => setCustomFooter(e.target.value)}
                            rows={3}
                        />
                        <p className="text-sm text-muted-foreground">Teks ini akan muncul di bagian bawah setiap penawaran dan faktur.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Tampilkan Kolom Tabel</Label>
                        <div className="space-y-2 rounded-md border p-4">
                            <div className="flex items-center justify-between"><Label htmlFor="show-qty">Kolom "Jumlah"</Label><Switch id="show-qty" checked={showQuantity} onCheckedChange={setShowQuantity} /></div>
                            <div className="flex items-center justify-between"><Label htmlFor="show-unit">Kolom "Satuan"</Label><Switch id="show-unit" checked={showUnit} onCheckedChange={setShowUnit} /></div>
                            <div className="flex items-center justify-between"><Label htmlFor="show-price">Kolom "Harga Satuan"</Label><Switch id="show-price" checked={showUnitPrice} onCheckedChange={setShowUnitPrice} /></div>
                        </div>
                    </div>
                </div>
            </div>
            <Separator />
            <div>
                <h3 className="text-lg font-medium">Cadangkan & Pulihkan Data</h3>
                <div className="space-y-6 mt-2">
                    <div>
                        <Label>Cadangkan Data</Label>
                        <p className="text-sm text-muted-foreground mb-2">
                            Unduh salinan lengkap data Anda dalam format JSON.
                        </p>
                        <Button type="button" variant="outline" onClick={handleExportData} disabled={isExporting}>
                            <Download className="mr-2 h-4 w-4" />
                            {isExporting ? 'Mengekspor...' : 'Ekspor Semua Data'}
                        </Button>
                    </div>
                    <div>
                        <Label>Pulihkan Data</Label>
                        <Alert variant="destructive" className="my-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Peringatan</AlertTitle>
                            <AlertDescription>
                                Memulihkan data akan menimpa entri yang ada dengan ID yang sama. Ini TIDAK akan menghapus data yang dibuat setelah pencadangan. Lanjutkan dengan hati-hati.
                            </AlertDescription>
                        </Alert>
                        <div className="flex items-center gap-4">
                            <Input type="file" accept=".json" onChange={handleFileChange} disabled={isRestoring} className="flex-1" />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" variant="secondary" disabled={!restoreFile || isRestoring}>
                                        <Upload className="mr-2 h-4 w-4" />
                                        {isRestoring ? 'Memulihkan...' : 'Pulihkan'}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Apakah Anda benar-benar yakin?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Tindakan ini akan menimpa data yang cocok dari file cadangan Anda. Pastikan Anda telah memilih file yang benar.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleRestoreData}>Ya, Lanjutkan</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Settings;