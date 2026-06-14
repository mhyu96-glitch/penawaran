import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Copy, Eye, FileText, MoreVertical, Pencil, PlusCircle, Search, Trash2 } from 'lucide-react';
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

type Quote = {
  id: string;
  quote_number: string;
  to_client: string;
  created_at: string;
  status: string;
  project_id?: string | null;
};

const quoteStatuses = ['Draf', 'Terkirim', 'Diterima', 'Ditolak'];

const QuoteList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');

  const fetchQuotes = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, to_client, created_at, status, project_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotes:', error);
      showError('Gagal memuat daftar penawaran.');
    } else {
      setQuotes(data as Quote[]);
    }

    const { data: projectData } = await supabase.from('projects').select('id, name').eq('user_id', user.id);
    if (projectData) setProjects(projectData);

    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, [user]);

  const stats = useMemo(
    () => ({
      total: quotes.length,
      sent: quotes.filter((quote) => quote.status === 'Terkirim').length,
      accepted: quotes.filter((quote) => quote.status === 'Diterima').length,
      draft: quotes.filter((quote) => !quote.status || quote.status === 'Draf').length,
    }),
    [quotes]
  );

  const filteredQuotes = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return quotes.filter((quote) => {
      const matchesSearch =
        (quote.quote_number || '').toLowerCase().includes(term) || (quote.to_client || '').toLowerCase().includes(term);
      const matchesProject = selectedProject === 'all' || quote.project_id === selectedProject;
      return matchesSearch && matchesProject;
    });
  }, [quotes, searchTerm, selectedProject]);

  const handleStatusChange = async (quoteId: string, status: string) => {
    const { error } = await supabase.from('quotes').update({ status }).eq('id', quoteId);

    if (error) {
      showError('Gagal memperbarui status.');
    } else {
      showSuccess('Status berhasil diperbarui.');
      setQuotes((current) => current.map((quote) => (quote.id === quoteId ? { ...quote, status } : quote)));
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    const { error } = await supabase.from('quotes').delete().match({ id: quoteId });

    if (error) {
      showError('Gagal menghapus penawaran.');
    } else {
      showSuccess('Penawaran berhasil dihapus.');
      setQuotes((current) => current.filter((quote) => quote.id !== quoteId));
    }
  };

  const handleDuplicateQuote = async (quoteId: string) => {
    const { data: originalQuote, error } = await supabase.from('quotes').select('*, quote_items(*)').eq('id', quoteId).single();

    if (error || !originalQuote) {
      showError('Gagal memuat data untuk duplikasi.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, quote_number, ...newQuoteData } = originalQuote;

    const { data: newQuote, error: insertError } = await supabase
      .from('quotes')
      .insert({
        ...newQuoteData,
        status: 'Draf',
        quote_date: new Date().toISOString(),
        valid_until: null,
        quote_number: null,
      })
      .select()
      .single();

    if (insertError || !newQuote) {
      showError('Gagal membuat duplikat penawaran.');
      return;
    }

    if (originalQuote.quote_items?.length > 0) {
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

  const renderStatusDropdown = (quote: Quote) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-0">
          <Badge variant={getStatusVariant(quote.status)} className="cursor-pointer">
            {quote.status || 'Draf'}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Ubah Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {quoteStatuses.map((status) => (
          <DropdownMenuItem key={status} onClick={() => handleStatusChange(quote.id, status)}>
            {status}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderActionMenu = (quote: Quote) => (
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
            <Link to={`/quote/${quote.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              Lihat
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={`/quote/edit/${quote.id}`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDuplicateQuote(quote.id)}>
            <Copy className="mr-2 h-4 w-4" />
            Duplikat
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
          <AlertDialogTitle>Hapus penawaran?</AlertDialogTitle>
          <AlertDialogDescription>Tindakan ini akan menghapus penawaran secara permanen dari database.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleDeleteQuote(quote.id)}>Hapus</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <FileText className="h-4 w-4" />
            Dokumen penawaran
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Penawaran</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola draft, penawaran terkirim, dan status persetujuan klien.</p>
        </div>
        <Button asChild>
          <Link to="/quote/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Buat Penawaran
          </Link>
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Total', stats.total],
          ['Terkirim', stats.sent],
          ['Diterima', stats.accepted],
          ['Draf', stats.draft],
        ].map(([label, value]) => (
          <Card key={label} className="border-0 shadow-sm ring-1 ring-border/70">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-0 shadow-sm ring-1 ring-border/70">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Daftar penawaran</CardTitle>
            <CardDescription>{filteredQuotes.length} dari {quotes.length} dokumen tampil.</CardDescription>
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
          ) : quotes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">Belum ada penawaran.</p>
              <Button asChild variant="link">
                <Link to="/quote/new">Buat penawaran pertama</Link>
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
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="w-[140px] text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium">{quote.quote_number || 'N/A'}</TableCell>
                        <TableCell>{quote.to_client || '-'}</TableCell>
                        <TableCell>{renderStatusDropdown(quote)}</TableCell>
                        <TableCell>{format(new Date(quote.created_at), 'dd MMM yyyy', { locale: localeId })}</TableCell>
                        <TableCell className="text-right">{renderActionMenu(quote)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {filteredQuotes.map((quote) => (
                  <div key={quote.id} className="rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/quote/${quote.id}`} className="truncate font-semibold hover:underline">
                          {quote.quote_number || 'N/A'}
                        </Link>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{quote.to_client || '-'}</p>
                      </div>
                      {renderActionMenu(quote)}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      {renderStatusDropdown(quote)}
                      <span className="text-xs text-muted-foreground">{format(new Date(quote.created_at), 'dd MMM yyyy')}</span>
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

export default QuoteList;
