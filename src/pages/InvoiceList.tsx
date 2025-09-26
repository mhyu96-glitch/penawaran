import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Eye, Pencil, Trash2, Receipt, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
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
} from "@/components/ui/dropdown-menu";
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';

type Invoice = {
  id: string;
  invoice_number: string;
  to_client: string;
  created_at: string;
  status: string;
  due_date: string;
};

const InvoiceList = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, to_client, created_at, status, due_date')
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

  const handleDeleteInvoice = async (invoiceId: string) => {
    const { error } = await supabase.from('invoices').delete().match({ id: invoiceId });

    if (error) {
      showError('Gagal menghapus faktur.');
    } else {
      showSuccess('Faktur berhasil dihapus.');
      setInvoices(invoices.filter(i => i.id !== invoiceId));
    }
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

  const renderActions = (invoice: Invoice) => (
    <>
      <DropdownMenuItem asChild><Link to={`/invoice/${invoice.id}`}><Eye className="mr-2 h-4 w-4" />Lihat</Link></DropdownMenuItem>
      <DropdownMenuItem asChild><Link to={`/invoice/edit/${invoice.id}`}><Pencil className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />Hapus</DropdownMenuItem>
      </AlertDialogTrigger>
    </>
  );

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Receipt className="h-7 w-7" />
              <CardTitle className="text-3xl">Faktur Saya</CardTitle>
            </div>
            <CardDescription>Kelola semua faktur Anda di sini.</CardDescription>
          </div>
          <Button asChild>
            <Link to="/invoice/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Buat Faktur Baru
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Anda belum membuat faktur apa pun.</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomor Faktur</TableHead>
                      <TableHead>Klien</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number || 'N/A'}</TableCell>
                        <TableCell>{invoice.to_client}</TableCell>
                        <TableCell><Badge variant={getStatusVariant(invoice.status)}>{invoice.status || 'Draf'}</Badge></TableCell>
                        <TableCell>{invoice.due_date ? format(new Date(invoice.due_date), 'PPP', { locale: localeId }) : 'N/A'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button asChild variant="outline" size="icon"><Link to={`/invoice/${invoice.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="outline" size="icon"><Link to={`/invoice/edit/${invoice.id}`}><Pencil className="h-4 w-4" /></Link></Button>
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
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {invoices.map(invoice => (
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
                    <CardFooter className="flex justify-between text-sm">
                      <Badge variant={getStatusVariant(invoice.status)}>{invoice.status || 'Draf'}</Badge>
                      <span className="text-muted-foreground">Jatuh Tempo: {invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : 'N/A'}</span>
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