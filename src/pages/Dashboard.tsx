import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, FileText, Clock, Calendar as CalendarIcon, AlertCircle, LayoutDashboard, Wallet, Bell, TrendingUp, Users, ArrowUp, ArrowDown } from 'lucide-react';
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
  to_client: string;
  created_at: string;
  clients: { name: string } | null;
  client_id: string;
  quote_items: { quantity: number; unit_price: number; cost_price: number; }[];
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

const PercentageChange = ({ value }: { value: number }) => {
    if (isNaN(value) || !isFinite(value)) {
      return null;
    }
    const isPositive = value >= 0;
    return (
      <p className={cn("text-xs text-muted-foreground flex items-center", isPositive ? "text-emerald-600" : "text-red-600")}>
        {isPositive ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
        {Math.abs(value).toFixed(1)}% dari periode sebelumnya
      </p>
    );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -29),
    to: new Date(),
  });

  const [currentData, setCurrentData] = useState({ quotes: [] as Quote[], expenses: [] as Expense[], payments: [] as Payment[] });
  const [previousData, setPreviousData] = useState({ quotes: [] as Quote[], expenses: [] as Expense[], payments: [] as Payment[] });
  const [activeInvoices, setActiveInvoices] = useState<Invoice[]>([]);

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
      if (!user || !date?.from || !date?.to) return;
      setLoading(true);

      const duration = differenceInDays(date.to, date.from);
      const prevPeriod = {
        from: addDays(date.from, -(duration + 1)),
        to: addDays(date.from, -1),
      };

      const fetchPeriodData = async (period: { from: Date, to: Date }) => {
        const fromDate = period.from.toISOString();
        const toDate = addDays(period.to, 1).toISOString();
        
        const quoteQuery = supabase.from('quotes').select('id, status, to_client, created_at, client_id, clients(name), quote_items(quantity, unit_price, cost_price)').eq('user_id', user.id).gte('created_at', fromDate).lt('created_at', toDate);
        const expenseQuery = supabase.from('expenses').select('amount, expense_date').eq('user_id', user.id).gte('expense_date', fromDate).lt('expense_date', toDate);
        const paymentQuery = supabase.from('payments').select('amount, payment_date').eq('user_id', user.id).eq('status', 'Lunas').gte('payment_date', fromDate).lt('payment_date', toDate);
        
        const [quoteRes, expenseRes, paymentRes] = await Promise.all([quoteQuery, expenseQuery, paymentQuery]);
        return {
            quotes: (quoteRes.data as Quote[]) || [],
            expenses: (expenseRes.data as Expense[]) || [],
            payments: (paymentRes.data as Payment[]) || [],
        };
      };

      const activeInvoicesQuery = supabase.from('invoices').select('id, status, due_date, to_client, discount_amount, tax_amount, invoice_items(quantity, unit_price)').eq('user_id', user.id).neq('status', 'Lunas');
      
      const [current, previous, activeInvoicesRes] = await Promise.all([
        fetchPeriodData(date as { from: Date, to: Date }),
        fetchPeriodData(prevPeriod),
        activeInvoicesQuery
      ]);

      setCurrentData(current);
      setPreviousData(previous);
      setActiveInvoices((activeInvoicesRes.data as Invoice[]) || []);
      
      setLoading(false);
    };

    fetchData();
  }, [user, date]);

  const calculateStats = (data: { quotes: Quote[], expenses: Expense[], payments: Payment[] }) => {
    const totalRevenue = data.payments.reduce((acc, p) => acc + p.amount, 0);
    const totalExpenses = data.expenses.reduce((acc, exp) => acc + exp.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    
    const sentOrRespondedQuotes = data.quotes.filter(q => ['Terkirim', 'Diterima', 'Ditolak'].includes(q.status));
    const acceptedCount = data.quotes.filter(q => q.status === 'Diterima').length;
    const quoteConversionRate = sentOrRespondedQuotes.length > 0 ? (acceptedCount / sentOrRespondedQuotes.length) * 100 : 0;

    return { totalRevenue, totalExpenses, netProfit, quoteConversionRate };
  };

  const currentStats = useMemo(() => calculateStats(currentData), [currentData]);
  const previousStats = useMemo(() => calculateStats(previousData), [previousData]);

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? Infinity : 0;
    return ((current - previous) / previous) * 100;
  };

  const revenueChange = calculatePercentageChange(currentStats.totalRevenue, previousStats.totalRevenue);
  const expensesChange = calculatePercentageChange(currentStats.totalExpenses, previousStats.totalExpenses);
  const netProfitChange = calculatePercentageChange(currentStats.netProfit, previousStats.netProfit);
  const conversionChange = currentStats.quoteConversionRate - previousStats.quoteConversionRate;

  const overdueAmount = useMemo(() => {
    return activeInvoices
      .filter(invoice => invoice.due_date && isPast(new Date(invoice.due_date)))
      .reduce((acc, invoice) => {
        const subtotal = invoice.invoice_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
        return acc + (subtotal - (invoice.discount_amount || 0) + (invoice.tax_amount || 0));
      }, 0);
  }, [activeInvoices]);

  const financialChartData = useMemo(() => {
    if (!date?.from || !date?.to) return [];
    const days = eachDayOfInterval({ start: date.from, end: date.to });
    return days.map(day => {
        const formattedDate = format(day, 'dd MMM');
        const dayStart = startOfDay(day);
        const dailyRevenue = currentData.payments.filter(p => startOfDay(new Date(p.payment_date)).getTime() === dayStart.getTime()).reduce((sum, p) => sum + p.amount, 0);
        const dailyExpenses = currentData.expenses.filter(e => startOfDay(new Date(e.expense_date)).getTime() === dayStart.getTime()).reduce((sum, e) => sum + e.amount, 0);
        return { name: formattedDate, Pendapatan: dailyRevenue, Pengeluaran: dailyExpenses };
    });
  }, [currentData.payments, currentData.expenses, date]);

  const topClients = useMemo(() => {
    const clientProfit: Record<string, { name: string; totalProfit: number }> = {};
    const acceptedQuotes = currentData.quotes.filter(q => q.status === 'Diterima');
    acceptedQuotes.forEach(quote => {
        const clientId = quote.client_id;
        const clientName = quote.clients?.name || quote.to_client;
        if (!clientProfit[clientId]) clientProfit[clientId] = { name: clientName, totalProfit: 0 };
        const quoteProfit = quote.quote_items.reduce((sum, item) => sum + (item.quantity * (item.unit_price - (item.cost_price || 0))), 0);
        clientProfit[clientId].totalProfit += quoteProfit;
    });
    return Object.values(clientProfit).sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5);
  }, [currentData.quotes]);

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
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle><DollarSign className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(currentStats.totalRevenue)}</div><PercentageChange value={revenueChange} /></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle><Wallet className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(currentStats.totalExpenses)}</div><PercentageChange value={expensesChange} /></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Keuntungan Bersih</CardTitle><DollarSign className="h-4 w-4 text-blue-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(currentStats.netProfit)}</div><PercentageChange value={netProfitChange} /></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Tagihan Jatuh Tempo</CardTitle><AlertCircle className="h-4 w-4 text-orange-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(overdueAmount)}</div><p className="text-xs text-muted-foreground">Total faktur terlambat</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Tingkat Konversi</CardTitle><TrendingUp className="h-4 w-4 text-purple-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{currentStats.quoteConversionRate.toFixed(1)}%</div><p className={cn("text-xs text-muted-foreground flex items-center", conversionChange >= 0 ? "text-emerald-600" : "text-red-600")}>{conversionChange >= 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}{Math.abs(conversionChange).toFixed(1)} pts dari periode sebelumnya</p></CardContent></Card>
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