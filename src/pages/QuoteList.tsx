import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Eye, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';

type Quote = {
  id: string;
  quote_number: string;
  to_client: string;
  created_at: string;
};

const QuoteList = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, to_client, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotes:', error);
      } else {
        setQuotes(data as Quote[]);
      }
      setLoading(false);
    };

    fetchQuotes();
  }, [user]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl">Penawaran Saya</CardTitle>
            <CardDescription>Lihat dan kelola semua penawaran Anda di sini.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/profile">
                <UserIcon className="mr-2 h-4 w-4" />
                Profil
              </Link>
            </Button>
            <Button asChild>
              <Link to="/quote/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Buat Penawaran Baru
              </Link>
            </Button>
          </div>
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
                  <TableHead>Tanggal Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.quote_number || 'N/A'}</TableCell>
                    <TableCell>{quote.to_client}</TableCell>
                    <TableCell>{format(new Date(quote.created_at), 'PPP')}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/quote/${quote.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Lihat
                        </Link>
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

export default QuoteList;