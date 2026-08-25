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
import { 
  Settings as SettingsIcon, Download, Upload, AlertTriangle, 
  MessageSquare, CreditCard, Key, QrCode, Save, FileText, 
  Sliders, Shield, RefreshCw, CheckCircle2, Sparkles, SlidersHorizontal,
  Database, Landmark
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isUploadingQris, setIsUploadingQris] = useState(false);

  // General & Template Settings
  const [defaultTerms, setDefaultTerms] = useState('');
  const [defaultTaxAmount, setDefaultTaxAmount] = useState(0);
  const [defaultDiscountAmount, setDefaultDiscountAmount] = useState(0);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);

  // Document customization
  const [customFooter, setCustomFooter] = useState('');
  const [showQuantity, setShowQuantity] = useState(true);
  const [showUnit, setShowUnit] = useState(true);
  const [showUnitPrice, setShowUnitPrice] = useState(true);

  // WhatsApp Templates
  const [waInvoiceTemplate, setWaInvoiceTemplate] = useState('');
  const [waQuoteTemplate, setWaQuoteTemplate] = useState('');

  // Midtrans Settings
  const [midtransClientKey, setMidtransClientKey] = useState('');
  const [midtransServerKey, setMidtransServerKey] = useState('');
  const [midtransIsProduction, setMidtransIsProduction] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
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
          setQrisUrl(data.qris_url || null);
          setCustomFooter(data.custom_footer || '');
          setShowQuantity(data.show_quantity_column ?? true);
          setShowUnit(data.show_unit_column ?? true);
          setShowUnitPrice(data.show_unit_price_column ?? true);
          setWaInvoiceTemplate(data.whatsapp_invoice_template || 'Halo {client_name}, saya ingin mengonfirmasi pembayaran untuk Faktur #{number} sebesar {amount}. Berikut saya lampirkan bukti transfernya.');
          setWaQuoteTemplate(data.whatsapp_quote_template || 'Halo {client_name}, berikut adalah penawaran #{number} perihal {title}. Silakan tinjau detailnya melalui tautan berikut: {link}');
          setMidtransClientKey(data.midtrans_client_key || '');
          setMidtransServerKey(data.midtrans_server_key || '');
          setMidtransIsProduction(data.midtrans_is_production || false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  const handleUploadQris = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/qris.${fileExt}`;

    setIsUploadingQris(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('company_assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        showError('Gagal mengunggah QRIS.');
        setIsUploadingQris(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('company_assets').getPublicUrl(filePath);
      const newQrisUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ qris_url: newQrisUrl })
        .eq('id', user.id);

      if (updateError) {
        showError('Gagal menyimpan URL QRIS.');
      } else {
        setQrisUrl(newQrisUrl);
        showSuccess('Gambar QRIS berhasil diperbarui!');
      }
    } catch {
      showError('Terjadi kesalahan saat unggah.');
    } finally {
      setIsUploadingQris(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
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
          whatsapp_invoice_template: waInvoiceTemplate,
          whatsapp_quote_template: waQuoteTemplate,
          midtrans_client_key: midtransClientKey,
          midtrans_server_key: midtransServerKey,
          midtrans_is_production: midtransIsProduction,
        })
        .eq('id', user.id);

      if (error) {
        showError('Gagal menyimpan pengaturan.');
        console.error('Settings update error:', error);
      } else {
        showSuccess('Semua pengaturan berhasil disimpan!');
      }
    } catch {
      showError('Terjadi kesalahan saat menyimpan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    const toastId = showLoading('Mempersiapkan data cadangan...');
    setIsExporting(true);
    try {
      const tablesToExport = [
        'profiles', 'clients', 'items', 'projects', 'project_tasks', 
        'time_entries', 'expenses', 'quotes', 'quote_items', 
        'invoices', 'invoice_items', 'payments'
      ];
      
      const dataPromises = tablesToExport.map(async (table) => {
        const query = supabase.from(table).select('*');
        if (table === 'profiles') {
          return query.eq('id', user.id);
        }
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
      showSuccess('Cadangan data berhasil diunduh!');
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

    const toastId = showLoading('Memulihkan data, mohon tunggu...');
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
      <div className="container mx-auto p-3 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
      <form onSubmit={handleUpdateSettings} className="space-y-6">
        {/* ========================================================================= */}
        {/* HERO COMMAND HEADER */}
        {/* ========================================================================= */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5" /> Pusat Pengaturan Sistem
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Pengaturan Aplikasi
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Sesuaikan template penawaran & faktur, metode pembayaran, template pesan WhatsApp, dan cadangan data.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="rounded-xl font-bold h-11 px-6 text-xs gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </Button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FULL WIDTH TABS NAVIGATION */}
        {/* ========================================================================= */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1.5 rounded-2xl bg-card border border-border/80 shadow-2xs gap-1.5">
            <TabsTrigger 
              value="general" 
              className="rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold gap-2 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>Umum & Dokumen</span>
            </TabsTrigger>

            <TabsTrigger 
              value="payment" 
              className="rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold gap-2 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>Pembayaran & QRIS</span>
            </TabsTrigger>

            <TabsTrigger 
              value="whatsapp" 
              className="rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold gap-2 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span>Pesan WhatsApp</span>
            </TabsTrigger>

            <TabsTrigger 
              value="backup" 
              className="rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold gap-2 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
            >
              <Database className="h-4 w-4 shrink-0" />
              <span>Cadangkan Data</span>
            </TabsTrigger>
          </TabsList>

          {/* ========================================================================= */}
          {/* TAB 1: UMUM & DOKUMEN */}
          {/* ========================================================================= */}
          <TabsContent value="general" className="space-y-6">
            {/* Card 1: Default Nilai & Syarat Ketentuan */}
            <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Default Penawaran & Faktur Tagihan
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Ketentuan dan nilai default yang otomatis terisi saat membuat dokumen penawaran atau faktur baru.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 space-y-5">
                {/* Syarat & Ketentuan */}
                <div className="space-y-2">
                  <Label htmlFor="defaultTerms" className="text-xs font-bold text-foreground">
                    Syarat & Ketentuan Default
                  </Label>
                  <Textarea
                    id="defaultTerms"
                    placeholder="Contoh: 1. Pembayaran DP 50% saat PO disetujui.&#10;2. Pelunasan maksimal 7 hari setelah serah terima barang.&#10;3. Garansi perangkat 1 tahun."
                    value={defaultTerms}
                    onChange={(e) => setDefaultTerms(e.target.value)}
                    rows={4}
                    className="rounded-xl text-xs bg-background leading-relaxed"
                  />
                  <p className="text-[11px] text-muted-foreground">Teks ini akan otomatis disalin ke setiap surat penawaran baru.</p>
                </div>

                {/* Pajak & Diskon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="defaultTax" className="text-xs font-bold text-foreground">
                      Pajak Default (Rp)
                    </Label>
                    <Input
                      id="defaultTax"
                      type="number"
                      placeholder="0"
                      value={defaultTaxAmount}
                      onChange={(e) => setDefaultTaxAmount(parseFloat(e.target.value) || 0)}
                      className="rounded-xl h-10 text-xs font-bold bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultDiscount" className="text-xs font-bold text-foreground">
                      Diskon Default (Rp)
                    </Label>
                    <Input
                      id="defaultDiscount"
                      type="number"
                      placeholder="0"
                      value={defaultDiscountAmount}
                      onChange={(e) => setDefaultDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="rounded-xl h-10 text-xs font-bold bg-background"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Kustomisasi Tampilan Dokumen */}
            <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
                  Kustomisasi Tampilan Dokumen & PDF
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Atur teks footer dan visibilitas kolom pada tabel dokumen cetak / PDF.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 space-y-5">
                {/* Footer Dokumen */}
                <div className="space-y-2">
                  <Label htmlFor="customFooter" className="text-xs font-bold text-foreground">
                    Footer Dokumen (Catatan Kaki)
                  </Label>
                  <Textarea
                    id="customFooter"
                    placeholder="Contoh: Terima kasih atas kepercayaan Anda bermitra dengan kami."
                    value={customFooter}
                    onChange={(e) => setCustomFooter(e.target.value)}
                    rows={2}
                    className="rounded-xl text-xs bg-background"
                  />
                </div>

                {/* Switch Kolom */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Opsi Visibilitas Kolom Tabel</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-muted/20">
                      <div>
                        <span className="text-xs font-bold text-foreground block">Kolom Jumlah (Qty)</span>
                        <span className="text-[10px] text-muted-foreground">Tampilkan kolom Qty</span>
                      </div>
                      <Switch id="show-qty" checked={showQuantity} onCheckedChange={setShowQuantity} />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-muted/20">
                      <div>
                        <span className="text-xs font-bold text-foreground block">Kolom Satuan</span>
                        <span className="text-[10px] text-muted-foreground">Unit, Pcs, Titik, Set</span>
                      </div>
                      <Switch id="show-unit" checked={showUnit} onCheckedChange={setShowUnit} />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-muted/20">
                      <div>
                        <span className="text-xs font-bold text-foreground block">Harga Satuan</span>
                        <span className="text-[10px] text-muted-foreground">Tampilkan harga per unit</span>
                      </div>
                      <Switch id="show-price" checked={showUnitPrice} onCheckedChange={setShowUnitPrice} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: PEMBAYARAN & QRIS */}
          {/* ========================================================================= */}
          <TabsContent value="payment" className="space-y-6">
            {/* Card 1: Instruksi Transfer Bank & QRIS */}
            <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-emerald-500" />
                  Metode Pembayaran Manual & QRIS
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Informasi rekening bank dan barcode QRIS yang tampil di halaman faktur klien.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 space-y-6">
                {/* Instruksi Transfer Bank */}
                <div className="space-y-2">
                  <Label htmlFor="paymentInstructions" className="text-xs font-bold text-foreground">
                    Instruksi Pembayaran & Rekening Bank
                  </Label>
                  <Textarea
                    id="paymentInstructions"
                    placeholder="Contoh:&#10;Bank BCA: 123-456-7890 a/n PT Borneo Etam&#10;Bank Mandiri: 987-654-3210 a/n PT Borneo Etam"
                    value={paymentInstructions}
                    onChange={(e) => setPaymentInstructions(e.target.value)}
                    rows={4}
                    className="rounded-xl text-xs bg-background leading-relaxed font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">Teks ini akan muncul saat klien membuka faktur dan memilih opsi Transfer Bank.</p>
                </div>

                <Separator className="border-border/60" />

                {/* Upload QRIS */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Barcode QRIS Perusahaan (Statis)</Label>
                  <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-2xl border border-border/80 bg-muted/20">
                    <div className="h-28 w-28 rounded-2xl bg-background border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      {qrisUrl ? (
                        <img src={qrisUrl} alt="QRIS" className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="text-center p-2 text-muted-foreground">
                          <QrCode className="h-10 w-10 mx-auto opacity-40 mb-1" />
                          <span className="text-[10px] font-bold">Belum Ada</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 w-full">
                      <span className="text-xs font-bold text-foreground block">Unggah Gambar Barcode QRIS</span>
                      <p className="text-[11px] text-muted-foreground">
                        Unggah gambar barcode QRIS (BCA QRIS, GoPay, OVO, ShopeePay, DANA) format PNG/JPG agar klien bisa langsung scan dan bayar dari HP.
                      </p>
                      <div className="pt-1">
                        <Input 
                          id="qris-upload" 
                          type="file" 
                          accept="image/png, image/jpeg" 
                          onChange={handleUploadQris} 
                          disabled={isUploadingQris}
                          className="rounded-xl text-xs bg-background h-10 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                      </div>
                      {isUploadingQris && <p className="text-xs text-primary font-bold animate-pulse">Sedang mengunggah gambar QRIS...</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Midtrans Payment Gateway */}
            <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-500" />
                  Integrasi Midtrans (Pembayaran Otomatis Online)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Aktifkan fitur Virtual Account (VA), Kartu Kredit, GoPay, dan QRIS otomatis melalui Midtrans.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-muted/20">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground block">Mode Produksi (Live)</span>
                    <span className="text-[11px] text-muted-foreground">
                      {midtransIsProduction ? '🟢 Aktif: Menerima pembayaran uang riil.' : '🟡 Sandbox: Mode simulasi / uji coba.'}
                    </span>
                  </div>
                  <Switch 
                    id="midtrans-mode" 
                    checked={midtransIsProduction} 
                    onCheckedChange={setMidtransIsProduction} 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientKey" className="text-xs font-bold text-foreground">Client Key</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="clientKey" 
                        value={midtransClientKey} 
                        onChange={(e) => setMidtransClientKey(e.target.value)} 
                        placeholder={midtransIsProduction ? "Mid-client-..." : "SB-Mid-client-..."}
                        className="pl-9 rounded-xl h-10 text-xs bg-background font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="serverKey" className="text-xs font-bold text-foreground">Server Key</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="serverKey" 
                        type="password"
                        value={midtransServerKey} 
                        onChange={(e) => setMidtransServerKey(e.target.value)} 
                        placeholder={midtransIsProduction ? "Mid-server-..." : "SB-Mid-server-..."}
                        className="pl-9 rounded-xl h-10 text-xs bg-background font-mono"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: PESAN WHATSAPP */}
          {/* ========================================================================= */}
          <TabsContent value="whatsapp" className="space-y-6">
            <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-emerald-500" />
                  Template Pesan WhatsApp Otomatis
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Gunakan format variabel otomatis untuk membuat teks pesan WhatsApp yang rapi saat dibagikan ke klien.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 space-y-6">
                {/* Variabel Guide Badge Chips */}
                <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">
                    Variabel yang dapat disisipkan:
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-background border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">{`{client_name}`}</span>
                    <span className="px-2 py-0.5 rounded-md bg-background border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">{`{number}`}</span>
                    <span className="px-2 py-0.5 rounded-md bg-background border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">{`{title}`}</span>
                    <span className="px-2 py-0.5 rounded-md bg-background border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">{`{amount}`}</span>
                    <span className="px-2 py-0.5 rounded-md bg-background border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">{`{company_name}`}</span>
                    <span className="px-2 py-0.5 rounded-md bg-background border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">{`{link}`}</span>
                  </div>
                </div>

                {/* Template Penawaran */}
                <div className="space-y-2">
                  <Label htmlFor="waQuote" className="text-xs font-bold text-foreground">
                    1. Template Kirim Surat Penawaran (ke Klien)
                  </Label>
                  <Textarea
                    id="waQuote"
                    value={waQuoteTemplate}
                    onChange={(e) => setWaQuoteTemplate(e.target.value)}
                    rows={4}
                    className="rounded-xl text-xs bg-background font-mono"
                    placeholder="Halo {client_name}, berikut kami lampirkan penawaran #{number} perihal {title}. Silakan cek di tautan berikut: {link}"
                  />
                </div>

                <Separator className="border-border/60" />

                {/* Template Faktur Tagihan */}
                <div className="space-y-2">
                  <Label htmlFor="waInvoice" className="text-xs font-bold text-foreground">
                    2. Template Konfirmasi Faktur Tagihan
                  </Label>
                  <Textarea
                    id="waInvoice"
                    value={waInvoiceTemplate}
                    onChange={(e) => setWaInvoiceTemplate(e.target.value)}
                    rows={4}
                    className="rounded-xl text-xs bg-background font-mono"
                    placeholder="Halo {client_name}, terima kasih. Berikut kami konfirmasikan faktur #{number} sebesar {amount}."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 4: CADANGKAN & RESTORE DATA */}
          {/* ========================================================================= */}
          <TabsContent value="backup" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Backup / Export */}
              <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col justify-between">
                <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Ekspor / Cadangkan Semua Data
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Unduh salinan arsip lengkap seluruh data penawaran, faktur, klien, proyek, dan pengeluaran ke format file JSON.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground">Tabel yang dicadangkan:</p>
                    <p className="text-[11px] leading-relaxed">
                      Profil Perusahaan, Klien, Master Barang, Proyek, Tugas, Jam Kerja, Pengeluaran/Akomodasi, Surat Penawaran, Faktur Tagihan, dan Riwayat Pembayaran.
                    </p>
                  </div>

                  <Button 
                    type="button" 
                    onClick={handleExportData} 
                    disabled={isExporting}
                    className="w-full rounded-xl font-bold h-11 text-xs gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                  >
                    <Download className="h-4 w-4" />
                    {isExporting ? 'Sedang Mengekspor Data...' : 'Unduh Cadangan Lengkap (.JSON)'}
                  </Button>
                </CardContent>
              </Card>

              {/* Card 2: Restore */}
              <Card className="rounded-3xl border border-rose-500/30 bg-card shadow-sm overflow-hidden flex flex-col justify-between">
                <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-rose-500/5">
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <Upload className="h-5 w-5" />
                    Pulihkan / Restore Data
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Pulihkan data aplikasi dari file cadangan (.JSON) yang sebelumnya sudah Anda unduh.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0" /> Perhatian Sebelum Pulihkan:
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Proses ini akan memperbarui dan menimpa rekaman data jika ID cocok dengan data cadangan.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Input 
                      type="file" 
                      accept=".json" 
                      onChange={handleFileChange} 
                      disabled={isRestoring} 
                      className="rounded-xl text-xs bg-background h-10 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          type="button" 
                          variant="destructive" 
                          disabled={!restoreFile || isRestoring}
                          className="w-full rounded-xl font-bold h-11 text-xs gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          {isRestoring ? 'Memulihkan Data...' : 'Mulai Pulihkan Data'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl p-6">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-base font-bold">Konfirmasi Pemulihan Data?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs text-muted-foreground">
                            Tindakan ini akan mengimpor seluruh tabel data dari file cadangan yang dipilih ke akun Anda.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2 pt-2">
                          <AlertDialogCancel className="rounded-xl text-xs font-semibold">Batal</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleRestoreData}
                            className="rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Ya, Pulihkan Sekarang
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* ========================================================================= */}
        {/* BOTTOM FLOATING SAVE BAR */}
        {/* ========================================================================= */}
        <div className="bg-card border border-border/80 p-4 sm:p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-semibold">
            Pastikan klik Simpan setelah mengubah konfigurasi di atas.
          </span>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="rounded-xl font-bold h-11 px-6 text-xs gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Settings;