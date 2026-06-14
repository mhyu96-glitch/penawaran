import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { AlertTriangle, Eye, MoreVertical, Pencil, PlusCircle, Receipt, Search, Trash2 } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { getStatusVariant } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

type Invoice = {
  id: string;
  invoice_number: string;
  to_client: string;
  created_at: string;
  status: string;
  due_date: string;
  project_id?: string | null;
};

const invoiceStatuses = ['Draf', 'Terkirim', 'Lunas', 'Jatuh Tempo'];

const InvoiceList = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, to_client, created_at, status, due_date, project_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      showError('Gagal memuat daftar faktur.');
    } else {
      setInvoices(data as Invoice[]);
    }

    const { data: projectData } = await supabase.from('projects').select('id, name').eq('user_id', user.id);
    if (projectData) setProjects(projectData);

    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  const stats = useMemo(
    () => ({
      total: invoices.length,
      sent: invoices.filter((invoice) => invoice.status === 'Terkirim').length,
      paid: invoices.filter((invoice) => invoice.status === 'Lunas').length,
      overdue: invoices.filter((invoice) => invoice.status !== 'Lunas' && invoice.due_date && isPast(new Date(invoice.due_date))).length,
    }),
    [invoices]
  );

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return invoices.filter((invoice) => {
      const matchesSearch =
        (invoice.invoice_number || '').toLowerCase().includes(term) || (invoice.to_client || '').toLowerCase().includes(term);
      const matchesProject = selectedProject === 'all' || invoice.project_id === selectedProject;
      return matchesSearch && matchesProject;
    });
  }, [invoices, searchTerm, selectedProject]);

  const handleStatusChange = async (invoiceId: string, status: string) => {
    const { error } = await supabase.from('invoices').update({ status }).eq('id', invoiceId);

    if (error) {
      showError('Gagal memperbarui status faktur.');
    } else {
      showSuccess('Status faktur berhasil diperbarui.');
      setInvoices((current) => current.map((invoice) => (invoice.id === invoiceId ? { ...invoice, status } : invoice)));
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    const { error } = await supabase.from('invoices').delete().match({ id: invoiceId });

    if (error) {
      showError('Gagal menghapus faktur.');
    } else {
      showSuccess('Faktur berhasil dihapus.');
      setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceId));
    }
  };

  const renderStatusDropdown = (invoice: Invoice) => {
    const isOverdue = invoice.status !== 'Lunas' && invoice.due_date && isPast(new Date(invoice.due_date));
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto p-0">
            <Badge variant={isOverdue ? 'destructive' : getStatusVariant(invoice.status)} className="cursor-pointer">
              {isOverdue ? 'Jatuh Tempo' : invoice.status || 'Draf'}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Ubah Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {invoiceStatuses.map((status) => (
            <DropdownMenuItem key={status} onClick={() => handleStatusChange(invoice.id, status)}>
              {status}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderActionMenu = (invoice: Invoice) => (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Buka aksi</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={`/invoice/${invoice.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              Lihat
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={`/invoice/edit/${invoice.id}`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus faktur?</AlertDialogTitle>
          <AlertDialogDescription>Tindakan ini akan menghapus faktur secara permanen dari database.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleDeleteInvoice(invoice.id)}>Hapus</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
            <Receipt className="h-4 w-4" />
            Dokumen penagihan
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Faktur</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pantau faktur, status pembayaran, dan tanggal jatuh tempo.</p>
        </div>
        <Button asChild>
          <Link to="/invoice/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Buat Faktur
          </Link>
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Total', stats.total],
          ['Terkirim', stats.sent],
          ['Lunas', stats.paid],
          ['Jatuh Tempo', stats.overdue],
        ].map(([label, value]) => (
          <Card key={label} className="border-0 shadow-sm ring-1 ring-border/70">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{label}</div>
                {label === 'Jatuh Tempo' && <AlertTriangle className="h-4 w-4 text-red-500" />}
              </div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-0 shadow-sm ring-1 ring-border/70">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Daftar faktur</CardTitle>
            <CardDescription>{filteredInvoices.length} dari {invoices.length} dokumen tampil.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nomor atau klien..."
                className="pl-9"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Semua Proyek" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Proyek</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">Belum ada faktur.</p>
              <Button asChild variant="link">
                <Link to="/invoice/new">Buat faktur pertama</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomor</TableHead>
                      <TableHead>Klien</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead className="w-[120px] text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number || 'N/A'}</TableCell>
                        <TableCell>{invoice.to_client || '-'}</TableCell>
                        <TableCell>{renderStatusDropdown(invoice)}</TableCell>
                        <TableCell>{invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy', { locale: localeId }) : '-'}</TableCell>
                        <TableCell className="text-right">{renderActionMenu(invoice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {filteredInvoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/invoice/${invoice.id}`} className="truncate font-semibold hover:underline">
                          {invoice.invoice_number || 'N/A'}
                        </Link>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{invoice.to_client || '-'}</p>
                      </div>
                      {renderActionMenu(invoice)}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      {renderStatusDropdown(invoice)}
                      <span className="text-xs text-muted-foreground">
                        {invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceList;
