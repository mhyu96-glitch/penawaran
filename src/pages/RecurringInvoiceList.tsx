import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Repeat, PlayCircle, PauseCircle, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError } from '@/utils/toast';
import RecurringInvoiceForm from '@/components/RecurringInvoiceForm';
import { formatCurrency, safeFormat } from '@/lib/utils';

type RecurringProfile = {
  id: string;
  frequency: string;
  next_run_date: string;
  status: string;
  template_data: any;
  clients: { name: string } | null;
};

const RecurringInvoiceList = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<RecurringProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchProfiles = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('recurring_invoices')
      .select('*, clients(name)')
      .eq('user_id', user.id)
      .order('next_run_date', { ascending: true });

    if (error) console.error(error);
    else setProfiles(data as RecurringProfile[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, [user]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('recurring_invoices').update({ status: newStatus }).eq('id', id);
    if (error) showError('Gagal mengubah status');
    else {
        showSuccess(`Jadwal berhasil ${newStatus === 'active' ? 'diaktifkan' : 'dijeda'}`);
        fetchProfiles();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus jadwal ini?')) return;
    const { error } = await supabase.from('recurring_invoices').delete().eq('id', id);
    if (error) showError('Gagal menghapus');
    else {
        showSuccess('Jadwal dihapus');
        fetchProfiles();
    }
  };

  // Fungsi untuk memicu manual (testing purposes)
  const handleTriggerNow = async () => {
    const { error } = await supabase.functions.invoke('process-recurring-invoices');
    if (error) showError('Gagal memproses: ' + error.message);
    else {
        showSuccess('Proses dijalankan. Cek daftar faktur Anda.');
        fetchProfiles();
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Repeat className="h-7 w-7 text-blue-600" />
              <CardTitle className="text-3xl">Faktur Berulang (Langganan)</CardTitle>
            </div>
            <CardDescription>Atur tagihan otomatis untuk klien langganan Anda.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTriggerNow} title="Jalankan manual (untuk testing)">
                <PlayCircle className="mr-2 h-4 w-4" /> Proses Sekarang
            </Button>
            <Button onClick={() => setIsFormOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Buat Jadwal Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : profiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Belum ada jadwal faktur rutin.</div>
          ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Klien</TableHead>
                        <TableHead>Judul</TableHead>
                        <TableHead>Frekuensi</TableHead>
                        <TableHead>Nominal</TableHead>
                        <TableHead>Eksekusi Berikutnya</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {profiles.map(p => (
                        <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.clients?.name}</TableCell>
                            <TableCell>{p.template_data.title}</TableCell>
                            <TableCell className="capitalize">{p.frequency === 'monthly' ? 'Bulanan' : p.frequency}</TableCell>
                            <TableCell>{formatCurrency(p.template_data.items?.[0]?.unit_price || 0)}</TableCell>
                            <TableCell>{safeFormat(p.next_run_date, 'PPP')}</TableCell>
                            <TableCell>
                                <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                                    {p.status === 'active' ? 'Aktif' : 'Dijeda'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button size="icon" variant="ghost" onClick={() => toggleStatus(p.id, p.status)}>
                                    {p.status === 'active' ? <PauseCircle className="h-4 w-4 text-orange-500" /> : <PlayCircle className="h-4 w-4 text-green-500" />}
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <RecurringInvoiceForm isOpen={isFormOpen} setIsOpen={setIsFormOpen} onSave={fetchProfiles} />
    </div>
  );
};

export default RecurringInvoiceList;