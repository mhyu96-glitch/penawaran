import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Phone, MapPin } from 'lucide-react';
import { Client } from './ClientList';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

type Quote = {
  id: string;
  quote_number: string;
  created_at: string;
  status: string;
};

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientDetails = async () => {
      if (!id) return;
      setLoading(true);

      // Fetch client info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (clientError) {
        console.error('Error fetching client:', clientError);
      } else {
        setClient(clientData);
      }

      // Fetch client's quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id, quote_number, created_at, status')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      if (quotesError) {
        console.error('Error fetching quotes for client:', quotesError);
      } else {
        setQuotes(quotesData as Quote[]);
      }

      setLoading(false);
    };

    fetchClientDetails();
  }, [id]);

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
      <Button asChild variant="outline" size="sm">
        <Link to="/clients"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Klien</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{client.name}</CardTitle>
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
          <CardTitle>Riwayat Penawaran</CardTitle>
          <CardDescription>Semua penawaran yang terkait dengan {client.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Belum ada penawaran untuk klien ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor Penawaran</TableHead>
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
  );
};

export default ClientDetail;