import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, FileText, Clock, Calendar as CalendarIcon, AlertCircle, LayoutDashboard, Wallet, Bell } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { format, addDays, isPast, differenceInDays } from 'date-fns';
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
};

const Dashboard = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      const fromDate = date?.from ? date.from.toISOString() : undefined;
      const toDate = date?.to ? addDays(date.to, 1).toISOString() : undefined;

      const quoteQuery = supabase.from('quotes').select('id, status, to_client, created_at, quote_items(quantity, unit_price, cost_price)').eq('user_id', user.id).order('created_at', { ascending: false });
      const invoiceQuery = supabase.from('invoices').select('id, status, due_date, to_client, discount_amount, tax_amount, invoice_items(quantity, unit_price)').eq('user_id', user.id);
      const expenseQuery = supabase.from('expenses').select('amount').eq('user_id', user.id);

      if (fromDate) {
        quoteQuery.gte('created_at', fromDate);
        invoiceQuery.gte('created_at', fromDate);
        expenseQuery.gte('expense_date', fromDate);
      }
      if (toDate) {
        quoteQuery.lt('created_at', toDate);
        invoiceQuery.lt('created_at', toDate);
        expenseQuery.lt('expense_date', toDate);
      }

      const [quoteRes, invoiceRes, expenseRes] = await Promise.all([quoteQuery, invoiceQuery, expenseQuery]);

      if (quoteRes.error) console.error('Error fetching quotes:', quoteRes.error); else setQuotes(quoteRes.data as Quote[]);
      if (invoiceRes.error) console.error('Error fetching invoices:', invoiceRes.error); else setInvoices(invoiceRes.data as Invoice[]);
      if (expenseRes.error) console.error('Error fetching expenses:', expenseRes.error); else setExpenses(expenseRes.data as Expense[]);
      
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

  const chartData = useMemo(() => {
    const statusCounts = quotes.reduce((acc, quote) => {
      const status = quote.status || 'Draf';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(statusCounts).map(([name, total]) => ({ name, total }));
  }, [quotes]);

  const pendingQuotes = useMemo(() => quotes.filter(q => q.status === 'Terkirim'), [quotes]);
  
  const upcomingInvoices = useMemo(() => {
    const today = new Date();
    const next7Days = addDays(today, 7);
    return invoices
      .filter(inv => {
        if (inv.status === 'Lunas' || !inv.due_date) return false;
        const dueDate = new Date(inv.due_date);
        return !isPast(dueDate) && dueDate <= next7Days;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [invoices]);

  const overdueInvoices = useMemo(() => {
    return invoices
      .filter(inv => {
        if (inv.status === 'Lunas' || !inv.due_date) return false;
        return isPast(new Date(inv.due_date));
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [invoices]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" /> <Skeleton className="h-32" />
          <Skeleton className="h-32" /> <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-80" /> <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
                <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
                <h1 className="text-3xl font-bold">Dashboard</h1>
            </div>
            <Popover>
                <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/>
                </PopoverContent>
            </Popover>
        </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Keuntungan Bersih</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{netProfit.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</div>
            <p className="text-xs text-muted-foreground">Dari {acceptedQuotesCount} penawaran diterima</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
            <Wallet className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExpenses.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</div>
            <p className="text-xs text-muted-foreground">Dalam rentang waktu yang dipilih</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tagihan Belum Dibayar</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceStats.unpaidAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</div>
            <p className="text-xs text-muted-foreground">Dari semua faktur yang aktif</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tagihan Jatuh Tempo</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceStats.overdueAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</div>
            <p className="text-xs text-muted-foreground">Total dari faktur yang terlambat</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Perlu Tindakan</CardTitle>
                <CardDescription>Item yang membutuhkan perhatian Anda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="text-sm font-medium mb-2 text-red-600">Faktur Jatuh Tempo ({overdueInvoices.length})</h3>
                    {overdueInvoices.length > 0 ? (
                        <Table>
                            <TableBody>
                                {overdueInvoices.slice(0, 3).map(inv => (
                                    <TableRow key={inv.id}><TableCell><Link to={`/invoice/${inv.id}`} className="hover:underline">{inv.to_client}</Link></TableCell><TableCell className="text-right text-xs text-red-500">Terlambat {differenceInDays(new Date(), new Date(inv.due_date))} hari</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <p className="text-sm text-muted-foreground text-center py-2">Tidak ada faktur yang jatuh tempo.</p>}
                </div>
                <div>
                    <h3 className="text-sm font-medium mb-2 text-orange-600">Faktur Mendekati Jatuh Tempo ({upcomingInvoices.length})</h3>
                    {upcomingInvoices.length > 0 ? (
                        <Table>
                            <TableBody>
                                {upcomingInvoices.slice(0, 3).map(inv => (
                                    <TableRow key={inv.id}><TableCell><Link to={`/invoice/${inv.id}`} className="hover:underline">{inv.to_client}</Link></TableCell><TableCell className="text-right text-xs text-orange-500">Jatuh tempo dalam {differenceInDays(new Date(inv.due_date), new Date())} hari</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <p className="text-sm text-muted-foreground text-center py-2">Tidak ada faktur yang akan jatuh tempo.</p>}
                </div>
                <div>
                    <h3 className="text-sm font-medium mb-2">Penawaran Menunggu Keputusan ({pendingQuotes.length})</h3>
                    {pendingQuotes.length > 0 ? (
                        <Table>
                            <TableBody>
                                {pendingQuotes.slice(0, 3).map(q => (
                                    <TableRow key={q.id}><TableCell><Link to={`/quote/${q.id}`} className="hover:underline">{q.to_client}</Link></TableCell><TableCell className="text-right text-xs text-muted-foreground">{format(new Date(q.created_at), 'dd MMM yyyy')}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <p className="text-sm text-muted-foreground text-center py-2">Tidak ada penawaran yang menunggu.</p>}
                </div>
            </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ringkasan Status Penawaran</CardTitle></CardHeader>
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
      </div>
    </div>
  );
};

export default Dashboard;