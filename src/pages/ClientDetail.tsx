import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Phone, MapPin, UserCircle, DollarSign, Save, Share2 } from 'lucide-react';
import { Client } from './ClientList';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { showError, showSuccess } from '@/utils/toast';

type Quote = {
  id: string;
  quote_number: string;
  created_at: string;
  status: string;
};

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<(Client & { access_key: string }) | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [financials, setFinancials] = useState({ totalRevenue: 0 });

  useEffect(() => {
    const fetchClientDetails = async () => {
      if (!id) return;
      setLoading(true);

      const { data: clientData, error: clientError } = await supabase.from('clients').select('*').eq('id', id).single();
      if (clientError) console.error('Error fetching client:', clientError);
      else {
        setClient(clientData);
        setNotes(clientData.notes || '');
      }

      const { data: quotesData, error: quotesError } = await supabase.from('quotes').select('id, quote_number, created_at, status').eq('client_id', id).order('created_at', { ascending: false });
      if (quotesError) console.error('Error fetching quotes for client:', quotesError);
      else setQuotes(quotesData as Quote[]);

      const { data: invoices, error: invoicesError } = await supabase.from('invoices').select('id').eq('client_id', id);
      if (!invoicesError && invoices && invoices.length > 0) {
        const invoiceIds = invoices.map(inv => inv.id);
        const { data: payments, error: paymentsError } = await supabase.from('payments').select('amount').in('invoice_id', invoiceIds);
        if (!paymentsError && payments) {
          const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
          setFinancials({ totalRevenue });
        }
      }

      setLoading(false);
    };

    fetchClientDetails();
  }, [id]);

  const handleSaveNotes = async () => {
    if (!id) return;
    setIsSavingNotes(true);
    const { error } = await supabase.from('clients').update({ notes }).eq('id', id);
    if (error) showError('Gagal menyimpan catatan.');
    else showSuccess('Catatan berhasil disimpan.');
    setIsSavingNotes(false);
  };

  const handleCopyPortalLink = () => {
    if (!client) return;
    const link = `${window.location.origin}/portal/${client.access_key}`;
    navigator.clipboard.writeText(link);
    showSuccess('Tautan portal klien telah disalin!');
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

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return <div className="container mx-auto p-8 text-center">Klien tidak ditemukan.</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Button asChild variant="outline" size="sm">
                <Link to="/clients"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Klien</Link>
            </Button>
            <Button onClick={handleCopyPortalLink} size="sm">
                <Share2 className="mr-2 h-4 w-4" /> Salin Tautan Portal Klien
            </Button>
        </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                <div className="flex items-center gap-3">
                    <UserCircle className="h-8 w-8 text-muted-foreground" />
                    <CardTitle className="text-3xl">{client.name}</CardTitle>
                </div>
                <CardDescription>Detail kontak dan informasi klien.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                {client.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{client.email}</span></div>}
                {client.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{client.phone}</span></div>}
                {client.address && <div className="flex items-center gap-2 md:col-span-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{client.address}</span></div>}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                <CardTitle>Riwayat Dokumen</CardTitle>
                <CardDescription>Semua penawaran dan faktur yang terkait dengan {client.name}.</CardDescription>
                </CardHeader>
                <CardContent>
                {quotes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Belum ada dokumen untuk klien ini.</p>
                ) : (
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Nomor Dokumen</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tanggal Dibuat</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {quotes.map((quote) => (
                        <TableRow key={quote.id}>
                            <TableCell className="font-medium">{quote.quote_number || 'N/A'}</TableCell>
                            <TableCell><Badge variant={getStatusVariant(quote.status)}>{quote.status || 'Draf'}</Badge></TableCell>
                            <TableCell>{format(new Date(quote.created_at), 'PPP', { locale: localeId })}</TableCell>
                            <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                                <Link to={`/quote/${quote.id}`}>Lihat</Link>
                            </Button>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                )}
                </CardContent>
            </Card>
        </div>
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Ringkasan Finansial</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Pendapatan</span>
                        <span className="font-bold flex items-center gap-1"><DollarSign className="h-4 w-4 text-green-500" /> {financials.totalRevenue.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Catatan Pribadi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea placeholder="Simpan informasi penting tentang klien ini..." rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveNotes} disabled={isSavingNotes} className="w-full">
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingNotes ? 'Menyimpan...' : 'Simpan Catatan'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default ClientDetail;