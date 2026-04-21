import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';

interface CSVImporterProps {
  type: 'clients' | 'items';
  onSuccess: () => void;
  triggerButtonText?: string;
}

const TEMPLATES = {
  clients: {
    headers: ['Name', 'Email', 'Phone', 'Address', 'Notes'],
    example: 'PT Maju Mundur,budi@maju.com,08123456789,"Jl. Sudirman No. 1",Klien VIP',
    dbTable: 'clients',
    mapFn: (row: any, userId: string) => ({
      user_id: userId,
      name: row[0] || 'Tanpa Nama',
      email: row[1] || null,
      phone: row[2] || null,
      address: row[3] || null,
      notes: row[4] || null,
    })
  },
  items: {
    headers: ['Description', 'Unit', 'Price', 'Cost', 'Stock'],
    example: 'Jasa Desain Website,Paket,5000000,0,0',
    dbTable: 'items',
    mapFn: (row: any, userId: string) => ({
      user_id: userId,
      description: row[0] || 'Item Baru',
      unit: row[1] || null,
      unit_price: parseFloat(row[2]) || 0,
      cost_price: parseFloat(row[3]) || 0,
      stock: parseInt(row[4]) || 0,
      track_stock: !!row[4] && parseInt(row[4]) > 0,
    })
  }
};

const CSVImporter = ({ type, onSuccess, triggerButtonText }: CSVImporterProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const template = TEMPLATES[type];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        // Skip header row if exists and filter empty rows
        const rows = results.data.slice(1).filter((row: any) => row.length > 1 && row[0]);
        setData(rows);
        setPreview(rows.slice(0, 5)); // Show max 5 rows preview
      },
      header: false,
      skipEmptyLines: true,
    });
  };

  const handleImport = async () => {
    if (!user || data.length === 0) return;
    setIsImporting(true);

    try {
      const formattedData = data.map(row => template.mapFn(row, user.id));
      
      const { error } = await supabase
        .from(template.dbTable)
        .insert(formattedData);

      if (error) throw error;

      showSuccess(`Berhasil mengimpor ${data.length} data!`);
      setIsOpen(false);
      setData([]);
      setPreview([]);
      onSuccess();
    } catch (error: any) {
      showError(`Gagal impor: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + template.headers.join(",") + "\n" 
      + template.example;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `template_${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {triggerButtonText || 'Impor CSV'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Impor Data {type === 'clients' ? 'Klien' : 'Barang'}</DialogTitle>
          <DialogDescription>
            Unggah file CSV untuk menambahkan banyak data sekaligus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Format yang dibutuhkan</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              Urutan kolom: <b>{template.headers.join(', ')}</b>.
              <br />
              <button onClick={downloadTemplate} className="text-blue-600 hover:underline font-medium mt-1">
                Unduh Template CSV
              </button>
            </AlertDescription>
          </Alert>

          {!data.length ? (
            <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Klik untuk pilih file CSV</p>
                <p className="text-xs text-muted-foreground">Maksimal 100 baris per impor</p>
                <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleFileChange} 
                />
            </div>
          ) : (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-green-600 flex items-center gap-1 font-medium">
                        <CheckCircle className="h-4 w-4" /> {data.length} baris data ditemukan
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => { setData([]); setPreview([]); if(fileInputRef.current) fileInputRef.current.value = ''; }}>
                        Ganti File
                    </Button>
                </div>
                <div className="border rounded-md max-h-[200px] overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {template.headers.map((h, i) => <TableHead key={i} className="text-xs">{h}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {preview.map((row, i) => (
                                <TableRow key={i}>
                                    {row.map((cell: string, j: number) => (
                                        <TableCell key={j} className="text-xs py-2">{cell}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {data.length > 5 && <p className="text-xs text-center text-muted-foreground">...dan {data.length - 5} baris lainnya.</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Batal</Button>
          <Button onClick={handleImport} disabled={!data.length || isImporting}>
            {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengimpor...</> : 'Mulai Impor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVImporter;