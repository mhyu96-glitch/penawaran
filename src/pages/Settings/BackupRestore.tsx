import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
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

const BackupRestore = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = showLoading('Mengekspor data Anda...');
    try {
      const { data, error } = await supabase.functions.invoke('export-data');
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `freelance-app-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      dismissToast(toastId);
      showSuccess('Data berhasil diekspor.');
    } catch (error: any) {
      dismissToast(toastId);
      showError(error.message || 'Gagal mengekspor data.');
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setImportFile(event.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      showError('Silakan pilih file untuk diimpor.');
      return;
    }

    setIsImporting(true);
    const toastId = showLoading('Mengimpor data... Ini mungkin memakan waktu beberapa saat.');

    try {
      const fileContent = await importFile.text();
      const jsonData = JSON.parse(fileContent);

      const { error } = await supabase.functions.invoke('import-data', {
        body: jsonData,
      });

      if (error) throw error;

      dismissToast(toastId);
      showSuccess('Data berhasil diimpor! Halaman akan dimuat ulang.');
      setTimeout(() => window.location.reload(), 2000);

    } catch (error: any) {
      dismissToast(toastId);
      showError(error.message || 'Gagal mengimpor data. Pastikan file backup valid.');
      console.error(error);
    } finally {
      setIsImporting(false);
      setImportFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ekspor Data</CardTitle>
          <CardDescription>
            Unduh semua data Anda (klien, proyek, penawaran, faktur, dll.) ke dalam satu file JSON. Simpan file ini di tempat yang aman sebagai cadangan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Mengekspor...' : 'Ekspor Semua Data'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impor Data</CardTitle>
          <CardDescription>
            Pulihkan data Anda dari file backup JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Peringatan!</AlertTitle>
            <AlertDescription>
              Mengimpor data akan <strong>MENGHAPUS SEMUA DATA ANDA SAAT INI</strong> secara permanen sebelum memulihkan dari file backup. Tindakan ini tidak dapat dibatalkan.
            </AlertDescription>
          </Alert>
          <div className="flex items-center space-x-2">
            <Input type="file" accept=".json" onChange={handleFileChange} disabled={isImporting} />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!importFile || isImporting}>
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? 'Mengimpor...' : 'Impor Data'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apakah Anda benar-benar yakin?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ini akan menghapus semua data Anda saat ini dan menggantinya dengan data dari file backup. Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleImport}>Ya, Impor Data</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupRestore;