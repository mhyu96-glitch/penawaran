import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Eye, Pencil, Trash2, Copy, FileText, MoreVertical, Search, Filter, Receipt } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { safeFormat, getStatusVariant } from '@/lib/utils';

type Quote = {
  id: string;
  quote_number: string;
  to_client: string;
  created_at: string;
  status: string;
};

const QuoteListSimple = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchQuotes = async () => {
    if (!user) {
      console.log('❌ No user found, skipping fetch');
      return;
    }
    setLoading(true);
    
    console.log('📡 Simple fetch for user:', user.id);
    
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, to_client, created_at, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Fetch failed:', error);
        showError(`Error: ${error.message}`);
      } else {
        console.log(`✅ Success: ${data?.length || 0} quotes`);
        setQuotes(data || []);
      }
    } catch (err: any) {
      console.error('❌ Catch error:', err);
      showError('Terjadi kesalahan saat memuat data');
    }
    
    setLoading(false);
  };

  const handleCreateInvoice = async (quote: Quote) => {
    if (!user) return;

    try {
      // Get quote details first
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quote.id)
        .single();

      if (quoteError) {
        showError('Gagal memuat data penawaran.');
        return;
      }

      // Create invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          quote_id: quote.id,
          from_company: quoteData.from_company,
          from_address: quoteData.from_address,
          to_client: quoteData.to_client,
          to_address: quoteData.to_address,
          title: quoteData.title,
          status: 'Draf',
          invoice_number: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
          invoice_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (invoiceError) {
        showError('Gagal membuat faktur.');
        console.error(invoiceError);
      } else {
        showSuccess('Faktur berhasil dibuat!');
        navigate(`/invoice/edit/${newInvoice.id}`);
      }
    } catch (err) {
      console.error('Create invoice error:', err);
      showError('Terjadi kesalahan saat membuat faktur.');
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
    if (error) {
      showError('Gagal menghapus penawaran.');
    } else {
      showSuccess('Penawaran berhasil dihapus.');
      setQuotes(quotes.filter(q => q.id !== quoteId));
    }
  };

  useEffect(() => {
    console.log('🔄 User changed:', user?.id);
    fetchQuotes();
  }, [user]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => 
      (quote.quote_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (quote.to_client?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [quotes, searchTerm]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-3xl flex items-center gap-3">
                <FileText className="h-7 w-7" />
                Penawaran Saya
              </CardTitle>
              <CardDescription>Lihat dan kelola semua penawaran Anda di sini.</CardDescription>
            </div>
            <Button asChild>
              <Link to="/quote/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Buat Penawaran Baru
              </Link>
            </Button>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nomor penawaran atau nama klien..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {quotes.length === 0 
                  ? 'Tidak ada penawaran. Mulai buat penawaran pertama Anda!' 
                  : 'Tidak ada penawaran yang sesuai dengan pencarian Anda.'
                }
              </p>
              {quotes.length === 0 && (
                <Button asChild variant="link" className="mt-2">
                  <Link to="/quote/new">Buat Penawaran Pertama</Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor</TableHead>
                  <TableHead>Klien</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.quote_number || 'N/A'}</TableCell>
                    <TableCell>{quote.to_client}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(quote.status)}>
                        {quote.status || 'Draf'}
                      </Badge>
                    </TableCell>
                    <TableCell>{safeFormat(quote.created_at, 'PPP')}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button asChild variant="outline" size="icon">
                        <Link to={`/quote/${quote.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleCreateInvoice(quote)}
                        className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                        title="Buat Faktur"
                      >
                        <Receipt className="h-4 w-4" />
                      </Button>
                      <Button asChild variant="outline" size="icon">
                        <Link to={`/quote/edit/${quote.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tindakan ini tidak dapat dibatalkan. Ini akan menghapus penawaran secara permanen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteQuote(quote.id)}>
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuoteListSimple;