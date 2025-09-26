import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Eye, Pencil, Trash2, Copy } from 'lucide-react';
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
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';

type Quote = {
  id: string;
  quote_number: string;
  to_client: string;
  created_at: string;
  status: string;
};

const QuoteList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, to_client, created_at, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotes:', error);
    } else {
      setQuotes(data as Quote[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, [user]);

  const handleDeleteQuote = async (quoteId: string) => {
    const { error } = await supabase.from('quotes').delete().match({ id: quoteId });

    if (error) {
      showError('Gagal menghapus penawaran.');
    } else {
      showSuccess('Penawaran berhasil dihapus.');
      setQuotes(quotes.filter(q => q.id !== quoteId));
    }
  };

  const handleDuplicateQuote = async (quoteId: string) => {
    const { data: originalQuote, error } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', quoteId)
      .single();

    if (error || !originalQuote) {
      showError('Gagal memuat data untuk duplikasi.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, quote_number, ...newQuoteData } = originalQuote;

    const payload = {
      ...newQuoteData,
      status: 'Draf',
      quote_date: new Date().toISOString(),
      valid_until: null,
      quote_number: null, // Will be auto-generated on the edit page
    };

    const { data: newQuote, error: insertError } = await supabase
      .from('quotes')
      .insert(payload)
      .select()
      .single();

    if (insertError || !newQuote) {
      showError('Gagal membuat duplikat penawaran.');
      return;
    }

    if (originalQuote.quote_items && originalQuote.quote_items.length > 0) {
      const newItems = originalQuote.quote_items.map(({ id: itemId, quote_id, ...item }) => ({
        ...item,
        quote_id: newQuote.id,
      }));
      const { error: itemsError } = await supabase.from('quote_items').insert(newItems);
      if (itemsError) {
        showError('Gagal menduplikasi item penawaran.');
        return;
      }
    }

    showSuccess('Penawaran berhasil diduplikasi.');
    navigate(`/quote/edit/${newQuote.id}`);
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Diterima': return 'default';
      case 'Terkirim': return 'secondary';
      case 'Ditolak': return 'destructive';
      case 'Draf': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl">Penawaran Saya</CardTitle>
            <CardDescription>Lihat dan kelola semua penawaran Anda di sini.</CardDescription>
          </div>
          <Button asChild>
            <Link to="/quote/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Buat Penawaran Baru
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
          ) : quotes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Anda belum membuat penawaran apa pun.</p>
              <Button asChild variant="link">
                <Link to="/quote/new">Mulai buat penawaran pertama Anda</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor Penawaran</TableHead>
                  <TableHead>Klien</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.quote_number || 'N/A'}</TableCell>
                    <TableCell>{quote.to_client}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(quote.status)}>{quote.status || 'Draf'}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(quote.created_at), 'PPP', { locale: localeId })}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/quote/${quote.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/quote/edit/${quote.id}`}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDuplicateQuote(quote.id)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
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
                            <AlertDialogAction onClick={() => handleDeleteQuote(quote.id)}>Hapus</AlertDialogAction>
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

export default QuoteList;