import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Eye, Pencil, Trash2, Receipt, MoreVertical, Download, Copy, Search, Filter } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';

type Invoice = {
  id: string;
  invoice_number: string;
  to_client: string;
  created_at: string;
  status: string;
  due_date: string;
  view_count: number;
  last_viewed_at: string | null;
  tax_amount: number;
  discount_amount: number;
  down_payment_amount: number;
};

// Helper for safe date formatting to prevent crashes
const safeFormat = (dateStr: string | null | undefined, formatStr: string) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid Date';
    return format(date, formatStr, { locale: localeId });
  } catch (e) {
    console.error("Date format error", e);
    return 'Error';
  }
};

const safeFormatDistance = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return formatDistanceToNow(date, { addSuffix: true, locale: localeId });
  } catch (e) {
    return '-';
  }
};

const InvoiceList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, to_client, created_at, status, due_date, view_count, last_viewed_at, tax_amount, discount_amount, down_payment_amount')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      showError('Gagal memuat daftar faktur.');
    } else {
      setInvoices(data as Invoice[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  const handleStatusChange = async (invoiceId: string, status: string) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status })
      .eq('id', invoiceId);

    if (error) {
      showError('Gagal memperbarui status faktur.');
    } else {
      showSuccess('Status faktur berhasil diperbarui.');
      setInvoices(invoices.map(i => i.id === invoiceId ? { ...i, status } : i));
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    const { error } = await supabase.from('invoices').delete().match({ id: invoiceId });

    if (error) {
      showError('Gagal menghapus faktur.');
    } else {
      showSuccess('Faktur berhasil dihapus.');
      setInvoices(invoices.filter(i => i.id !== invoiceId));
    }
  };

  const handleDuplicateInvoice = async (invoiceId: string) => {
    const { data: originalInvoice, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .single();

    if (error || !originalInvoice) {
      showError('Gagal memuat data untuk duplikasi.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, invoice_number, view_count, last_viewed_at, payments, ...newInvoiceData } = originalInvoice;

    const payload = {
      ...newInvoiceData,
      status: 'Draf',
      invoice_date: new Date().toISOString(),
      due_date: null,
      invoice_number: null,
      view_count: 0,
      last_viewed_at: null,
    };

    const { data: newInvoice, error: insertError } = await supabase
      .from('invoices')
      .insert(payload)
      .select()
      .single();

    if (insertError || !newInvoice) {
      showError('Gagal membuat duplikat faktur.');
      return;
    }

    if (originalInvoice.invoice_items && originalInvoice.invoice_items.length > 0) {
      const newItems = originalInvoice.invoice_items.map(({ id: itemId, invoice_id, ...item }: any) => ({
        ...item,
        invoice_id: newInvoice.id,
      }));
      const { error: itemsError } = await supabase.from('invoice_items').insert(newItems);
      if (itemsError) {
        showError('Gagal menduplikasi item faktur.');
        return;
      }
    }

    showSuccess('Faktur berhasil diduplikasi.');
    navigate(`/invoice/edit/${newInvoice.id}`);
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesSearch = 
        (invoice.invoice_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (invoice.to_client?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(invoice.status);

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) return;

    const headers = ["Nomor Faktur", "Klien", "Tanggal Dibuat", "Jatuh Tempo", "Status", "Pajak", "Diskon", "Uang Muka"];
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number || 'N/A',
      `"${inv.to_client}"`,
      safeFormat(inv.created_at, 'yyyy-MM-dd'),
      safeFormat(inv.due_date, 'yyyy-MM-dd'),
      inv.status,
      inv.tax_amount || 0,
      inv.discount_amount || 0,
      inv.down_payment_amount || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Faktur_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Lunas': return 'default';
      case 'Terkirim': return 'secondary';
      case 'Jatuh Tempo': return 'destructive';
      case 'Draf': return 'outline';
      default: return 'outline';
    }
  };

  const invoiceStatuses = ['Draf', 'Terkirim', 'Lunas', 'Jatuh Tempo'];

  const renderStatusDropdown = (invoice: Invoice) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="p-0 h-auto">
          <Badge variant={getStatusVariant(invoice.status)} className="cursor-pointer">{invoice.status || 'Draf'}</Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Ubah Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {invoiceStatuses.map(status => (
          <DropdownMenuItem key={status} onClick={() => handleStatusChange(invoice.id, status)}>
            {status}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderActions = (invoice: Invoice) => (
    <>
      <DropdownMenuItem asChild><Link to={`/invoice/${invoice.id}`}><Eye className="mr-2 h-4 w-4" />Lihat</Link></DropdownMenuItem>
      <DropdownMenuItem asChild><Link to={`/invoice/edit/${invoice.id}`}><Pencil className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleDuplicateInvoice(invoice.id)}><Copy className="mr-2 h-4 w-4" />Duplikat</DropdownMenuItem>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />Hapus</DropdownMenuItem>
      </AlertDialogTrigger>
    </>
  );

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <div className="flex items-center gap-3">
                <Receipt className="h-7 w-7" />
                <CardTitle className="text-3xl">Faktur Saya</CardTitle>
                </div>
                <CardDescription>Kelola semua faktur Anda di sini.</CardDescription>
            </div>
            <div className="flex gap-2">
                {filteredInvoices.length > 0 && (
                    <Button variant="outline" onClick={handleExportCSV}>
                        <Download className="mr-2 h-4 w-4" /> CSV
                    </Button>
                )}
                <Button asChild>
                    <Link to="/invoice/new">
                    <PlusCircle className="mr-2 h-4 w-4" /> Buat Faktur
                    </Link>
                </Button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari nomor faktur atau nama klien..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="border-dashed">
                        <Filter className="mr-2 h-4 w-4" />
                        Status
                        {statusFilter.length > 0 && (
                            <Badge variant="secondary" className="ml-2 px-1 rounded-sm h-5 font-normal">
                                {statusFilter.length}
                            </Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {invoiceStatuses.map((status) => (
                        <DropdownMenuCheckboxItem
                            key={status}
                            checked={statusFilter.includes(status)}
                            onCheckedChange={() => toggleStatusFilter(status)}
                        >
                            {status}
                        </DropdownMenuCheckboxItem>
                    ))}
                    {statusFilter.length > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setStatusFilter([])} className="justify-center text-center">
                                Reset Filter
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Tidak ada faktur yang sesuai dengan pencarian Anda.</p>
              {invoices.length === 0 && (
                  <Button asChild variant="link" className="mt-2">
                    <Link to="/invoice/new">Mulai buat faktur pertama Anda</Link>
                  </Button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomor Faktur</TableHead>
                      <TableHead>Klien</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dilihat</TableHead>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number || 'N/A'}</TableCell>
                        <TableCell>{invoice.to_client}</TableCell>
                        <TableCell>{renderStatusDropdown(invoice)}</TableCell>
                        <TableCell>
                            {invoice.view_count > 0 ? (
                                <Tooltip>
                                    <TooltipTrigger>
                                        <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                            <Eye className="h-4 w-4" /> {invoice.view_count}x
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Terakhir dilihat: {safeFormatDistance(invoice.last_viewed_at)}
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                            )}
                        </TableCell>
                        <TableCell>{safeFormat(invoice.due_date, 'PPP')}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button asChild variant="outline" size="icon"><Link to={`/invoice/${invoice.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="outline" size="icon"><Link to={`/invoice/edit/${invoice.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                          <Button variant="outline" size="icon" onClick={() => handleDuplicateInvoice(invoice.id)}><Copy className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus faktur secara permanen.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteInvoice(invoice.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-4">
                {filteredInvoices.map(invoice => (
                  <Card key={invoice.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{invoice.invoice_number || 'N/A'}</CardTitle>
                          <CardDescription>{invoice.to_client}</CardDescription>
                        </div>
                        <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">{renderActions(invoice)}</DropdownMenuContent>
                          </DropdownMenu>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus faktur secara permanen.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteInvoice(invoice.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardHeader>
                    <CardFooter className="flex justify-between text-sm items-center">
                        <div className="flex gap-2 items-center">
                            {renderStatusDropdown(invoice)}
                            {invoice.view_count > 0 && <span className="text-green-600 text-xs flex items-center gap-1"><Eye className="h-3 w-3"/> {invoice.view_count}</span>}
                        </div>
                      <span className="text-muted-foreground">Due: {safeFormat(invoice.due_date, 'dd MMM')}</span>
                    </CardFooter>
                  </Card>
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