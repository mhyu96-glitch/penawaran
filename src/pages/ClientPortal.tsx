import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Receipt, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

type Document = {
  id: string;
  number: string | null;
  created_at: string;
  status: string;
  type: 'Penawaran' | 'Faktur';
  public_link: string;
};

const ClientPortal = () => {
  const { accessKey } = useParams<{ accessKey: string }>();
  const [clientName, setClientName] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortalData = async () => {
      if (!accessKey) {
        setError('Kunci akses tidak valid.');
        setLoading(false);
        return;
      }

      // 1. Get Client ID from access key
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('access_key', accessKey)
        .single();

      if (clientError || !clientData) {
        setError('Portal tidak ditemukan atau kunci akses salah.');
        setLoading(false);
        return;
      }
      setClientName(clientData.name);
      const clientId = clientData.id;

      // 2. Fetch Quotes and Invoices for this client
      const [quotesRes, invoicesRes] = await Promise.all([
        supabase.from('quotes').select('id, quote_number, created_at, status').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, invoice_number, created_at, status').eq('client_id', clientId).order('created_at', { ascending: false })
      ]);

      const fetchedDocuments: Document[] = [];
      if (quotesRes.data) {
        fetchedDocuments.push(...quotesRes.data.map(q => ({
          id: q.id,
          number: q.quote_number,
          created_at: q.created_at,
          status: q.status,
          type: 'Penawaran',
          public_link: `/quote/public/${q.id}`
        })));
      }
      if (invoicesRes.data) {
        fetchedDocuments.push(...invoicesRes.data.map(i => ({
          id: i.id,
          number: i.invoice_number,
          created_at: i.created_at,
          status: i.status,
          type: 'Faktur',
          public_link: `/invoice/public/${i.id}`
        })));
      }

      // Sort all documents by date
      fetchedDocuments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setDocuments(fetchedDocuments);
      setLoading(false);
    };

    fetchPortalData();
  }, [accessKey]);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Diterima':
      case 'Lunas':
        return 'default';
      case 'Terkirim':
        return 'secondary';
      case 'Ditolak':
      case 'Jatuh Tempo':
        return 'destructive';
      case 'Draf':
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-4">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="container mx-auto p-8 text-center text-red-600">{error}</div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto p-4 md:p-8">
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
            <CardTitle className="text-3xl">Portal Klien</CardTitle>
            <CardDescription className="text-lg">Selamat datang, {clientName}!</CardDescription>
            <p className="text-sm text-muted-foreground">Di sini Anda dapat melihat semua riwayat penawaran dan faktur Anda.</p>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {documents.map((doc) => (
                    <TableRow key={doc.type + doc.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                        {doc.type === 'Penawaran' ? <FileText className="h-4 w-4 text-muted-foreground" /> : <Receipt className="h-4 w-4 text-muted-foreground" />}
                        {doc.type}
                    </TableCell>
                    <TableCell>{doc.number || 'N/A'}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(doc.status)}>{doc.status || 'Draf'}</Badge></TableCell>
                    <TableCell>{format(new Date(doc.created_at), 'PPP', { locale: localeId })}</TableCell>
                    <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                        <Link to={doc.public_link} target="_blank" rel="noopener noreferrer">
                            <Eye className="mr-2 h-4 w-4" /> Lihat
                        </Link>
                        </Button>
                    </TableCell>
                    </TableRow>
                ))}
                {documents.length === 0 && (
                    <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Belum ada dokumen untuk ditampilkan.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
        </div>
    </div>
  );
};

export default ClientPortal;