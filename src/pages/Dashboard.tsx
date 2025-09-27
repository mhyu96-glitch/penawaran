import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, FileText, Clock, Calendar as CalendarIcon, AlertCircle, LayoutDashboard, Wallet, Bell, TrendingUp, Users } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { format, addDays, isPast, differenceInDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
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
  clients: { name: string } | null;
  client_id: string;
};

type Invoice = {
    id: string;
    status: string;
    due_date: string;
    to_client: string;
    discount_amount: number;
    tax_amount: number;
    invoice_items: { quantity: number; unit_price: number; }[];
};

type Expense = {
    amount: number;
    expense_date: string;
};

type Payment = {
    amount: number;
    payment_date: string;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -29),
    to: new Date(),
  });

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      const fromDate = date?.from ? date.from.toISOString() : undefined;
      const toDate = date?.to ? addDays(date.to, 1).toISOString() : undefined;

      const quoteQuery = supabase.from('quotes').select('id, status, to_client, created_at, client_id, clients(name), quote_items(quantity, unit_price, cost_price)').eq('user_id', user.id).order('created_at', { ascending: false });
      const invoiceQuery = supabase.from('invoices').select('id, status, due_date, to_client, discount_amount, tax_amount, invoice_items(quantity, unit_price)').eq('user_id', user.id);
      const expenseQuery = supabase.from('expenses').select('amount, expense_date').eq('user_id', user.id);
      const paymentQuery = supabase.from('payments').select('amount, payment_date').eq('user_id', user.id).eq('status', 'Lunas');

      if (fromDate) {
        quoteQuery.gte('created_at', fromDate);
        invoiceQuery.gte('created_at', fromDate);
        expenseQuery.gte('expense_date', fromDate);
        paymentQuery.gte('payment_date', fromDate);
      }
      if (toDate) {
        quoteQuery.lt('created_at', toDate);
        invoiceQuery.lt('created_at', toDate);
        expenseQuery.lt('expense_date', toDate);
        paymentQuery.lt('payment_date', toDate);
      }

      const [quoteRes, invoiceRes, expenseRes, paymentRes] = await Promise.all([quoteQuery, invoiceQuery, expenseQuery, paymentQuery]);

      if (quoteRes.error) console.error('Error fetching quotes:', quoteRes.error); else setQuotes(quoteRes.data as Quote[]);
      if (invoiceRes.error) console.error('Error fetching invoices:', invoiceRes.error); else setInvoices(invoiceRes.data as Invoice[]);
      if (expenseRes.error) console.error('Error fetching expenses:', expenseRes.error); else setExpenses(expenseRes.data as Expense[]);
      if (paymentRes.error) console.error('Error fetching payments:', paymentRes.error); else setPayments(paymentRes.data as Payment[]);
      
      setLoading(false);
    };

    fetchData();
  }, [user, date]);

  const { totalProfit, acceptedQuotesCount } = useMemo(() => {
    const acceptedQuotes = quotes.filter(q => q.status === 'Diterima');
    const profit = acceptedQuotes.reduce((acc, quote) => {
      const quoteProfit = quote.quote_items.reduce((qAcc, item) => qAcc + (item.quantity * (item.unit_price - (item.cost_price || 0))), 0);
      return acc + quoteProfit;
    }, 0);
    return { totalProfit: profit, acceptedQuotesCount: acceptedQuotes.length };
  }, [quotes]);

  const totalExpenses = useMemo(() => expenses.reduce((acc, exp) => acc + exp.amount, 0), [expenses]);
  const netProfit = totalProfit - totalExpenses;

  const invoiceStats = useMemo(() => {
    let unpaidAmount = 0;
    let overdueAmount = 0;
    invoices.forEach(invoice => {
        if (invoice.status !== 'Lunas') {
            const subtotal = invoice.invoice_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
            const total = subtotal - (invoice.discount_amount || 0) + (invoice.tax_amount || 0);
            unpaidAmount += total;
            if (invoice.due_date && isPast(new Date(invoice.due_date))) {
                overdueAmount += total;
            }
        }
    });
    return { unpaidAmount, overdueAmount };
  }, [invoices]);

  const quoteConversionRate = useMemo(() => {
    const sentOrAcceptedQuotes = quotes.filter(q => q.status === 'Terkirim' || q.status === 'Diterima' || q.status === 'Ditolak');
    if (sentOrAcceptedQuotes.length === 0) return 0;
    const acceptedCount = quotes.filter(q => q.status === 'Diterima').length;
    return (acceptedCount / sentOrAcceptedQuotes.length) * 100;
  }, [quotes]);

  const financialChartData = useMemo(() => {
    if (!date?.from || !date?.to) return [];
    const days = eachDayOfInterval({ start: date.from, end: date.to });
    return days.map(day => {
        const formattedDate = format(day, 'dd MMM');
        const dayStart = startOfDay(day);

        const dailyRevenue = payments
            .filter(p => startOfDay(new Date(p.payment_date)).getTime() === dayStart.getTime())
            .reduce((sum, p) => sum + p.amount, 0);

        const dailyExpenses = expenses
            .filter(e => startOfDay(new Date(e.expense_date)).getTime() === dayStart.getTime())
            .reduce((sum, e) => sum + e.amount, 0);

        return { name: formattedDate, Pendapatan: dailyRevenue, Pengeluaran: dailyExpenses };
    });
  }, [payments, expenses, date]);

  const topClients = useMemo(() => {
    const clientProfit: Record<string, { name: string; totalProfit: number }> = {};
    const acceptedQuotes = quotes.filter(q => q.status === 'Diterima');

    acceptedQuotes.forEach(quote => {
        const clientId = quote.client_id;
        const clientName = quote.clients?.name || quote.to_client;
        if (!clientProfit[clientId]) {
            clientProfit[clientId] = { name: clientName, totalProfit: 0 };
        }
        const quoteProfit = quote.quote_items.reduce((sum, item) => sum + (item.quantity * (item.unit_price - (item.cost_price || 0))), 0);
        clientProfit[clientId].totalProfit += quoteProfit;
    });

    return Object.values(clientProfit).sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5);
  }, [quotes]);

  const pendingQuotes = useMemo(() => quotes.filter(q => q.status === 'Terkirim'), [quotes]);
  const upcomingInvoices = useMemo(() => invoices.filter(inv => inv.status !== 'Lunas' && inv.due_date && !isPast(new Date(inv.due_date)) && differenceInDays(new Date(inv.due_date), new Date()) <= 7).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()), [invoices]);
  const overdueInvoices = useMemo(() => invoices.filter(inv => inv.status !== 'Lunas' && inv.due_date && isPast(new Date(inv.due_date))).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()), [invoices]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-80 md:col-span-2" /><Skeleton className="h-80" /></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4"><LayoutDashboard className="h-8 w-8 text-muted-foreground" /><h1 className="text-3xl font-bold">Dashboard</h1></div>
            <Popover>
                <PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/></PopoverContent>
            </Popover>
        </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Keuntungan Bersih</CardTitle><DollarSign className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(netProfit)}</div><p className="text-xs text-muted-foreground">Dari {acceptedQuotesCount} penawaran</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle><Wallet className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div><p className="text-xs text-muted-foreground">Dalam rentang waktu</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Tagihan Belum Dibayar</CardTitle><Clock className="h-4 w-4 text-blue-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(invoiceStats.unpaidAmount)}</div><p className="text-xs text-muted-foreground">Dari semua faktur aktif</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Tagihan Jatuh Tempo</CardTitle><AlertCircle className="h-4 w-4 text-orange-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(invoiceStats.overdueAmount)}</div><p className="text-xs text-muted-foreground">Total faktur terlambat</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Tingkat Konversi</CardTitle><TrendingUp className="h-4 w-4 text-purple-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{quoteConversionRate.toFixed(1)}%</div><p className="text-xs text-muted-foreground">Penawaran diterima</p></CardContent></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Tren Keuangan</CardTitle><CardDescription>Pendapatan vs. Pengeluaran dalam rentang waktu yang dipilih.</CardDescription></CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={financialChartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => new Intl.NumberFormat('id-ID', { notation: 'compact', compactDisplay: 'short' }).format(value as number)} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line type="monotone" dataKey="Pendapatan" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Pengeluaran" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Klien Paling Menguntungkan</CardTitle><CardDescription>Berdasarkan penawaran diterima.</CardDescription></CardHeader>
            <CardContent>
                {topClients.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Klien</TableHead><TableHead className="text-right">Laba</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {topClients.map(client => (
                                <TableRow key={client.name}><TableCell className="font-medium">{client.name}</TableCell><TableCell className="text-right">{formatCurrency(client.totalProfit)}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Belum ada data keuntungan.</p>}
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;