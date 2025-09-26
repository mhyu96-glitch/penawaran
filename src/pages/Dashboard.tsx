import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, FileText, CheckCircle, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Quote = {
  id: string;
  status: string;
  quote_items: { quantity: number; unit_price: number; cost_price: number; }[];
  to_client: string;
  created_at: string;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!user) return;
      setLoading(true);

      let query = supabase
        .from('quotes')
        .select('id, status, to_client, created_at, quote_items(quantity, unit_price, cost_price)')
        .eq('user_id', user.id);

      if (date?.from) {
        query = query.gte('created_at', date.from.toISOString());
      }
      if (date?.to) {
        // Add one day to the end date to include the whole day
        const toDate = new Date(date.to);
        toDate.setDate(toDate.getDate() + 1);
        query = query.lt('created_at', toDate.toISOString());
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching dashboard data:', error);
      } else {
        setQuotes(data as Quote[]);
      }
      setLoading(false);
    };

    fetchQuotes();
  }, [user, date]);

  const stats = useMemo(() => {
    const totalQuotes = quotes.length;
    const acceptedQuotes = quotes.filter(q => q.status === 'Diterima');
    const totalProfit = acceptedQuotes.reduce((acc, quote) => {
      const quoteProfit = quote.quote_items.reduce((qAcc, item) => qAcc + (item.quantity * (item.unit_price - (item.cost_price || 0))), 0);
      return acc + quoteProfit;
    }, 0);
    const pendingQuotes = quotes.filter(q => q.status === 'Terkirim').length;

    return { totalQuotes, totalProfit, acceptedQuotesCount: acceptedQuotes.length, pendingQuotes };
  }, [quotes]);

  const chartData = useMemo(() => {
    const statusCounts = quotes.reduce((acc, quote) => {
      const status = quote.status || 'Draf';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([name, total]) => ({ name, total }));
  }, [quotes]);

  const recentQuotes = quotes.slice(0, 5);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                    "w-full sm:w-[300px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                    date.to ? (
                        <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                        </>
                    ) : (
                        format(date.from, "LLL dd, y")
                    )
                    ) : (
                    <span>Pilih rentang tanggal</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                />
                </PopoverContent>
            </Popover>
        </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Keuntungan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProfit.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</div>
            <p className="text-xs text-muted-foreground">Dari {stats.acceptedQuotesCount} penawaran diterima</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Penawaran Diterima</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats.acceptedQuotesCount}</div>
            <p className="text-xs text-muted-foreground">Total penawaran yang disetujui</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Penawaran Tertunda</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingQuotes}</div>
            <p className="text-xs text-muted-foreground">Penawaran yang telah terkirim</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Penawaran</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuotes}</div>
            <p className="text-xs text-muted-foreground">Jumlah semua penawaran yang dibuat</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Ringkasan Status Penawaran</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip />
                <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Penawaran Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Klien</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tanggal</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {recentQuotes.map(quote => (
                        <TableRow key={quote.id}>
                            <TableCell>
                                <Link to={`/quote/${quote.id}`} className="font-medium hover:underline">{quote.to_client}</Link>
                            </TableCell>
                            <TableCell><Badge variant="outline">{quote.status}</Badge></TableCell>
                            <TableCell>{format(new Date(quote.created_at), 'dd MMM yyyy', { locale: localeId })}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;