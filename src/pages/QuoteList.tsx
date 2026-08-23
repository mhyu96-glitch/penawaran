import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { safeFormat, safeFormatDistance, getStatusVariant } from '@/lib/utils';

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

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const fetchQuotes = async () => {
    if (!user) {
      console.log('No user found, skipping fetch');
      return;
    }
    setLoading(true);
    
    console.log('Fetching quotes for user:', user.id);
    
    try {
      // First try with all columns
      let { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, to_client, created_at, status, view_count, last_viewed_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // If there's a column error, try with basic columns only
      if (error && error.message?.includes('column')) {
        console.log('Column error detected, trying with basic columns:', error.message);
        const result = await supabase
          .from('quotes')
          .select('id, quote_number, to_client, created_at, status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        data = result.data;
        error = result.error;
        
        // Add default values for missing columns
        if (data) {
          data = data.map(quote => ({
            ...quote,
            view_count: 0,
            last_viewed_at: null
          }));
        }
      }

      console.log('Supabase response:', { data, error, count: data?.length || 0 });

      if (error) {
        console.error('Error fetching quotes:', error);
        showError(`Gagal memuat penawaran: ${error.message}`);
      } else {
        console.log(`Found ${data?.length || 0} quotes`);
        setQuotes(data as Quote[]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      showError('Terjadi kesalahan tidak terduga saat memuat penawaran');
    }
    
    setLoading(false);
  };

  useEffect(() => {
    console.log('Current user:', user);
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

  const handleCreateInvoice = async (quote: Quote) => {
    if (!user) return;

    try {
      // Get quote details
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', quote.id)
        .single();

      if (quoteError || !quoteData) {
        showError('Gagal memuat data penawaran.');
        return;
      }

      const year = new Date().getFullYear();
      const { data: latestInvoices, error: numberError } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('user_id', user.id)
        .like('invoice_number', `INV-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (!numberError && latestInvoices && latestInvoices.length > 0 && latestInvoices[0].invoice_number) {
        const lastNumber = latestInvoices[0].invoice_number.split('-').pop();
        if (lastNumber && !Number.isNaN(Number.parseInt(lastNumber, 10))) {
          nextNumber = Number.parseInt(lastNumber, 10) + 1;
        }
      }

      const newInvoicePayload = {
        user_id: user.id,
        quote_id: quoteData.id,
        client_id: quoteData.client_id,
        project_id: quoteData.project_id || null,
        from_company: quoteData.from_company,
        from_address: quoteData.from_address,
        from_website: quoteData.from_website,
        to_client: quoteData.to_client,
        to_address: quoteData.to_address,
        to_phone: quoteData.to_phone,
        title: quoteData.title,
        discount_amount: quoteData.discount_amount,
        tax_amount: quoteData.tax_amount,
        terms: quoteData.terms,
        status: 'Draf',
        invoice_number: `INV-${year}-${String(nextNumber).padStart(3, '0')}`,
        invoice_date: new Date().toISOString(),
        due_date: quoteData.valid_until || null,
        down_payment_amount: 0,
        attachments: quoteData.attachments || [],
      };

      let invoiceResult = await supabase
        .from('invoices')
        .insert(newInvoicePayload)
        .select('id')
        .single();

      // Handle missing column error for compatibility
      if (invoiceResult.error?.message?.toLowerCase().includes('schema cache') && 
          invoiceResult.error.message.toLowerCase().includes('column')) {
        const { project_id, down_payment_amount, ...compatiblePayload } = newInvoicePayload;
        invoiceResult = await supabase
          .from('invoices')
          .insert(compatiblePayload)
          .select('id')
          .single();
      }

      if (invoiceResult.error || !invoiceResult.data) {
        showError(`Gagal membuat faktur dari penawaran: ${invoiceResult.error?.message || 'data faktur kosong'}`);
        console.error(invoiceResult.error);
        return;
      }

      const newInvoice = invoiceResult.data;

      if (quoteData.quote_items && quoteData.quote_items.length > 0) {
        const newInvoiceItemsPayload = quoteData.quote_items.map(({ description, quantity, unit, unit_price, cost_price, item_id }) => ({
          invoice_id: newInvoice.id,
          item_id,
          description,
          quantity,
          unit,
          unit_price,
          cost_price,
        }));

        let itemsResult = await supabase.from('invoice_items').insert(newInvoiceItemsPayload);

        // Handle missing column error for compatibility  
        if (itemsResult.error?.message?.toLowerCase().includes('schema cache') && 
            itemsResult.error.message.toLowerCase().includes('column')) {
          const compatibleItemsPayload = newInvoiceItemsPayload.map(({ item_id, ...item }) => item);
          itemsResult = await supabase.from('invoice_items').insert(compatibleItemsPayload);
        }

        if (itemsResult.error) {
          showError(`Gagal menyalin item ke faktur: ${itemsResult.error.message}`);
          await supabase.from('invoices').delete().match({ id: newInvoice.id });
          console.error(itemsResult.error);
          return;
        }
      }

      showSuccess('Faktur berhasil dibuat. Mengarahkan ke halaman edit...');
      navigate(`/invoice/edit/${newInvoice.id}`);
    } catch (error) {
      showError('Terjadi kesalahan saat membuat faktur.');
      console.error('Create invoice error:', error);
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

    const {
      id,
      created_at,
      quote_number,
      view_count,
      last_viewed_at,
      quote_items,
      ...newQuoteData
    } = originalQuote;

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

    if (quote_items && quote_items.length > 0) {
      const newItems = quote_items.map(({ id: itemId, quote_id, created_at: itemCreatedAt, ...item }) => ({
        ...item,
        quote_id: newQuote.id,
      }));
      const { error: itemsError } = await supabase.from('quote_items').insert(newItems);
      if (itemsError) {
        await supabase.from('quotes').delete().eq('id', newQuote.id);
        showError('Gagal menduplikasi item penawaran.');
        return;
      }
    }

    showSuccess('Penawaran berhasil diduplikasi.');
    navigate(`/quote/edit/${newQuote.id}`);
  };

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = 
        (quote.quote_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (quote.to_client?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(quote.status);

      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  const quoteStatuses = ['Draf', 'Terkirim', 'Diterima', 'Ditolak'];

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

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
      <DropdownMenuItem onClick={() => handleCreateInvoice(quote)} className="text-green-600">
        <Receipt className="mr-2 h-4 w-4" />Buat Faktur
      </DropdownMenuItem>
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
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari nomor penawaran atau nama klien..."
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
                    {quoteStatuses.map((status) => (
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
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Tidak ada penawaran yang sesuai dengan pencarian Anda.</p>
              {quotes.length === 0 && (
                  <Button asChild variant="link" className="mt-2">
                    <Link to="/quote/new">Mulai buat penawaran pertama Anda</Link>
                  </Button>
              )}
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
                    {filteredQuotes.map((quote) => (
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
                                        Terakhir dilihat: {safeFormatDistance(quote.last_viewed_at)}
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                            )}
                        </TableCell>
                        <TableCell>{safeFormat(quote.created_at, 'PPP')}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button asChild variant="outline" size="icon"><Link to={`/quote/${quote.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          <Button variant="outline" size="icon" onClick={() => handleCreateInvoice(quote)} className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                            <Receipt className="h-4 w-4" />
                          </Button>
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
                {filteredQuotes.map(quote => (
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
                      <span className="text-muted-foreground">{safeFormat(quote.created_at, 'dd MMM yyyy')}</span>
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
