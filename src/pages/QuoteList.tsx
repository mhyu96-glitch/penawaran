import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Eye, Pencil, Trash2, Copy, FileText, MoreVertical } from 'lucide-react';
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
} from "@/components/ui/dropdown-menu";
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Quote = {
  id: string;
  quote_number: string;
  to_client: string;
  created_at: string;
  status: string;
  view_count: number;
  last_viewed_at: string | null;
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
      .select('id, quote_number, to_client, created_at, status, view_count, last_viewed_at')
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

  const handleStatusChange = async (quoteId: string, status: string) => {
    const { error } = await supabase
      .from('quotes')
      .update({ status })
      .eq('id', quoteId);

    if (error) {
      showError('Gagal memperbarui status.');
    } else {
      showSuccess('Status berhasil diperbarui.');
      setQuotes(quotes.map(q => q.id === quoteId ? { ...q, status } : q));
    }
  };

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
    const { id, created_at, quote_number, view_count, last_viewed_at, ...newQuoteData } = originalQuote;

    const payload = {
      ...newQuoteData,
      status: 'Draf',
      quote_date: new Date().toISOString(),
      valid_until: null,
      quote_number: null,
      view_count: 0,
      last_viewed_at: null,
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

  const quoteStatuses = ['Draf', 'Terkirim', 'Diterima', 'Ditolak'];

  const renderStatusDropdown = (quote: Quote) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="p-0 h-auto">
          <Badge variant={getStatusVariant(quote.status)} className="cursor-pointer">{quote.status || 'Draf'}</Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Ubah Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {quoteStatuses.map(status => (
          <DropdownMenuItem key={status} onClick={() => handleStatusChange(quote.id, status)}>
            {status}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderActions = (quote: Quote) => (
    <>
      <DropdownMenuItem asChild><Link to={`/quote/${quote.id}`}><Eye className="mr-2 h-4 w-4" />Lihat</Link></DropdownMenuItem>
      <DropdownMenuItem asChild><Link to={`/quote/edit/${quote.id}`}><Pencil className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleDuplicateQuote(quote.id)}><Copy className="mr-2 h-4 w-4" />Duplikat</DropdownMenuItem>
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
              <FileText className="h-7 w-7" />
              <CardTitle className="text-3xl">Penawaran Saya</CardTitle>
            </div>
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
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomor Penawaran</TableHead>
                      <TableHead>Klien</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dilihat</TableHead>
                      <TableHead>Tanggal Dibuat</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium">{quote.quote_number || 'N/A'}</TableCell>
                        <TableCell>{quote.to_client}</TableCell>
                        <TableCell>{renderStatusDropdown(quote)}</TableCell>
                        <TableCell>
                            {quote.view_count > 0 ? (
                                <Tooltip>
                                    <TooltipTrigger>
                                        <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                            <Eye className="h-4 w-4" /> {quote.view_count}x
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Terakhir dilihat: {quote.last_viewed_at ? formatDistanceToNow(new Date(quote.last_viewed_at), { addSuffix: true, locale: localeId }) : '-'}
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                            )}
                        </TableCell>
                        <TableCell>{format(new Date(quote.created_at), 'PPP', { locale: localeId })}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button asChild variant="outline" size="icon"><Link to={`/quote/${quote.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="outline" size="icon"><Link to={`/quote/edit/${quote.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                          <Button variant="outline" size="icon" onClick={() => handleDuplicateQuote(quote.id)}><Copy className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Ini akan menghapus penawaran secara permanen.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteQuote(quote.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
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
                {quotes.map(quote => (
                  <Card key={quote.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{quote.quote_number || 'N/A'}</CardTitle>
                          <CardDescription>{quote.to_client}</CardDescription>
                        </div>
                        <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">{renderActions(quote)}</DropdownMenuContent>
                          </DropdownMenu>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus penawaran secara permanen.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteQuote(quote.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardHeader>
                    <CardFooter className="flex justify-between text-sm items-center">
                      <div className="flex gap-2 items-center">
                        {renderStatusDropdown(quote)}
                        {quote.view_count > 0 && <span className="text-green-600 text-xs flex items-center gap-1"><Eye className="h-3 w-3"/> {quote.view_count}</span>}
                      </div>
                      <span className="text-muted-foreground">{format(new Date(quote.created_at), 'dd MMM yyyy')}</span>
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

export default QuoteList;