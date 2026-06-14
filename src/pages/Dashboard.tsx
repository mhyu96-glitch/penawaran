import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, differenceInDays, eachDayOfInterval, format, isPast, startOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  AlertCircle,
  ArrowUpRight,
  Calendar as CalendarIcon,
  Clock,
  FilePlus2,
  FileText,
  LayoutDashboard,
  PlusCircle,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';

type Quote = {
  id: string;
  status: string;
  quote_items: { quantity: number; unit_price: number; cost_price: number }[];
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
  invoice_items: { quantity: number; unit_price: number }[];
};

type Expense = {
  amount: number;
  expense_date: string;
};

type Payment = {
  amount: number;
  payment_date: string;
};

const chartColors = ['#059669', '#2563eb', '#f59e0b', '#ef4444', '#7c3aed'];

const compactNumber = (value: number) =>
  new Intl.NumberFormat('id-ID', { notation: 'compact', compactDisplay: 'short' }).format(value);

const MetricCard = ({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof TrendingUp;
  tone: 'emerald' | 'blue' | 'amber' | 'red' | 'violet';
}) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
    red: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900',
  };

  return (
    <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border/70">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={cn('rounded-lg p-2 ring-1', tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
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

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      const fromDate = date?.from ? date.from.toISOString() : undefined;
      const toDate = date?.to ? addDays(date.to, 1).toISOString() : undefined;

      const quoteQuery = supabase
        .from('quotes')
        .select('id, status, to_client, created_at, client_id, clients(name), quote_items(quantity, unit_price, cost_price)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const invoiceQuery = supabase
        .from('invoices')
        .select('id, status, due_date, to_client, discount_amount, tax_amount, invoice_items(quantity, unit_price)')
        .eq('user_id', user.id);
      const expenseQuery = supabase.from('expenses').select('amount, expense_date').eq('user_id', user.id);
      const paymentQuery = supabase.from('payments').select('amount, payment_date').eq('user_id', user.id).eq('status', 'Lunas');

      if (fromDate) {
        expenseQuery.gte('expense_date', fromDate);
        paymentQuery.gte('payment_date', fromDate);
      }
      if (toDate) {
        expenseQuery.lt('expense_date', toDate);
        paymentQuery.lt('payment_date', toDate);
      }

      const [quoteRes, invoiceRes, expenseRes, paymentRes] = await Promise.all([
        quoteQuery,
        invoiceQuery,
        expenseQuery,
        paymentQuery,
      ]);

      if (quoteRes.error) console.error('Error fetching quotes:', quoteRes.error);
      else setQuotes(quoteRes.data as Quote[]);
      if (invoiceRes.error) console.error('Error fetching invoices:', invoiceRes.error);
      else setInvoices(invoiceRes.data as Invoice[]);
      if (expenseRes.error) console.error('Error fetching expenses:', expenseRes.error);
      else setExpenses(expenseRes.data as Expense[]);
      if (paymentRes.error) console.error('Error fetching payments:', paymentRes.error);
      else setPayments(paymentRes.data as Payment[]);

      setLoading(false);
    };

    fetchData();
  }, [user, date]);

  const { totalProfit, acceptedQuotesCount } = useMemo(() => {
    const acceptedQuotes = quotes.filter((quote) => quote.status === 'Diterima');
    const profit = acceptedQuotes.reduce((acc, quote) => {
      const quoteProfit = quote.quote_items.reduce(
        (qAcc, item) => qAcc + item.quantity * (item.unit_price - (item.cost_price || 0)),
        0
      );
      return acc + quoteProfit;
    }, 0);
    return { totalProfit: profit, acceptedQuotesCount: acceptedQuotes.length };
  }, [quotes]);

  const totalExpenses = useMemo(() => expenses.reduce((acc, expense) => acc + expense.amount, 0), [expenses]);
  const totalPayments = useMemo(() => payments.reduce((acc, payment) => acc + payment.amount, 0), [payments]);
  const netProfit = totalProfit - totalExpenses;

  const invoiceStats = useMemo(() => {
    let unpaidAmount = 0;
    let overdueAmount = 0;
    let overdueCount = 0;

    invoices.forEach((invoice) => {
      if (invoice.status !== 'Lunas') {
        const subtotal = invoice.invoice_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
        const total = subtotal - (invoice.discount_amount || 0) + (invoice.tax_amount || 0);
        unpaidAmount += total;

        if (invoice.due_date && isPast(new Date(invoice.due_date))) {
          overdueAmount += total;
          overdueCount += 1;
        }
      }
    });

    return { unpaidAmount, overdueAmount, overdueCount };
  }, [invoices]);

  const quoteConversionRate = useMemo(() => {
    const finishedQuotes = quotes.filter((quote) => ['Terkirim', 'Diterima', 'Ditolak'].includes(quote.status));
    if (finishedQuotes.length === 0) return 0;
    return (quotes.filter((quote) => quote.status === 'Diterima').length / finishedQuotes.length) * 100;
  }, [quotes]);

  const financialChartData = useMemo(() => {
    if (!date?.from || !date?.to) return [];
    const days = eachDayOfInterval({ start: date.from, end: date.to });

    return days.map((day) => {
      const dayStart = startOfDay(day);
      const Pendapatan = payments
        .filter((payment) => startOfDay(new Date(payment.payment_date)).getTime() === dayStart.getTime())
        .reduce((sum, payment) => sum + payment.amount, 0);
      const Pengeluaran = expenses
        .filter((expense) => startOfDay(new Date(expense.expense_date)).getTime() === dayStart.getTime())
        .reduce((sum, expense) => sum + expense.amount, 0);

      return { name: format(day, 'dd MMM'), Pendapatan, Pengeluaran };
    });
  }, [payments, expenses, date]);

  const topClients = useMemo(() => {
    const clientProfit: Record<string, { name: string; totalProfit: number; totalRevenue: number }> = {};

    quotes
      .filter((quote) => quote.status === 'Diterima')
      .forEach((quote) => {
        const clientId = quote.client_id || quote.to_client;
        const clientName = quote.clients?.name || quote.to_client;
        if (!clientProfit[clientId]) {
          clientProfit[clientId] = { name: clientName, totalProfit: 0, totalRevenue: 0 };
        }

        clientProfit[clientId].totalRevenue += quote.quote_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
        clientProfit[clientId].totalProfit += quote.quote_items.reduce(
          (sum, item) => sum + item.quantity * (item.unit_price - (item.cost_price || 0)),
          0
        );
      });

    return Object.values(clientProfit)
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 5);
  }, [quotes]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { name: string; revenue: number; expense: number }> = {};

    payments.forEach((payment) => {
      const month = format(new Date(payment.payment_date), 'MMM yyyy');
      if (!months[month]) months[month] = { name: month, revenue: 0, expense: 0 };
      months[month].revenue += payment.amount;
    });

    expenses.forEach((expense) => {
      const month = format(new Date(expense.expense_date), 'MMM yyyy');
      if (!months[month]) months[month] = { name: month, revenue: 0, expense: 0 };
      months[month].expense += expense.amount;
    });

    return Object.values(months).slice(-6);
  }, [payments, expenses]);

  const pendingQuotes = useMemo(() => quotes.filter((quote) => quote.status === 'Terkirim').slice(0, 5), [quotes]);
  const overdueInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.status !== 'Lunas' && invoice.due_date && isPast(new Date(invoice.due_date)))
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5),
    [invoices]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-96 rounded-xl xl:col-span-2" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-slate-950">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_360px] lg:p-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <LayoutDashboard className="h-4 w-4" />
              Pusat kendali bisnis
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard operasional</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Pantau penawaran, faktur, pembayaran, dan pengeluaran dari satu layar yang siap dipakai di komputer maupun PWA.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/quote/new">
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Buat Penawaran
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/invoice/new">
                  <Receipt className="mr-2 h-4 w-4" />
                  Buat Faktur
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/clients">
                  <Users className="mr-2 h-4 w-4" />
                  Kelola Klien
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-900/50">
            <div className="text-sm font-medium">Rentang laporan</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn('mt-3 w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, 'dd MMM yyyy', { locale: localeId })} - {format(date.to, 'dd MMM yyyy', { locale: localeId })}
                      </>
                    ) : (
                      format(date.from, 'dd MMM yyyy', { locale: localeId })
                    )
                  ) : (
                    <span>Pilih tanggal</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white p-3 ring-1 ring-border dark:bg-slate-950">
                <div className="text-muted-foreground">Diterima</div>
                <div className="mt-1 text-xl font-semibold">{acceptedQuotesCount}</div>
              </div>
              <div className="rounded-lg bg-white p-3 ring-1 ring-border dark:bg-slate-950">
                <div className="text-muted-foreground">Overdue</div>
                <div className="mt-1 text-xl font-semibold text-red-600">{invoiceStats.overdueCount}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Profit Bersih" value={formatCurrency(netProfit)} description={`${acceptedQuotesCount} penawaran diterima`} icon={TrendingUp} tone="emerald" />
        <MetricCard title="Pembayaran Masuk" value={formatCurrency(totalPayments)} description="Dalam rentang tanggal" icon={Receipt} tone="blue" />
        <MetricCard title="Pengeluaran" value={formatCurrency(totalExpenses)} description="Biaya tercatat" icon={Wallet} tone="amber" />
        <MetricCard title="Belum Dibayar" value={formatCurrency(invoiceStats.unpaidAmount)} description="Semua faktur aktif" icon={Clock} tone="violet" />
        <MetricCard title="Jatuh Tempo" value={formatCurrency(invoiceStats.overdueAmount)} description={`${invoiceStats.overdueCount} faktur terlambat`} icon={AlertCircle} tone="red" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-0 shadow-sm ring-1 ring-border/70 xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Arus kas harian</CardTitle>
              <CardDescription>Pendapatan dan pengeluaran dalam rentang terpilih.</CardDescription>
            </div>
            <Badge variant="outline">{quoteConversionRate.toFixed(1)}% konversi</Badge>
          </CardHeader>
          <CardContent className="pl-0 sm:pl-2">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={financialChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => compactNumber(value as number)} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Line type="monotone" dataKey="Pendapatan" stroke="#059669" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Pengeluaran" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-border/70">
          <CardHeader>
            <CardTitle>Klien terbaik</CardTitle>
            <CardDescription>Berdasarkan revenue penawaran diterima.</CardDescription>
          </CardHeader>
          <CardContent>
            {topClients.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={topClients} cx="50%" cy="50%" innerRadius={56} outerRadius={82} paddingAngle={4} dataKey="totalRevenue">
                      {topClients.map((client, index) => (
                        <Cell key={client.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {topClients.map((client, index) => (
                    <div key={client.name} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                        <span className="truncate font-medium">{client.name}</span>
                      </div>
                      <span className="shrink-0 text-muted-foreground">{formatCurrency(client.totalRevenue)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada penawaran diterima.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-0 shadow-sm ring-1 ring-border/70 xl:col-span-2">
          <CardHeader>
            <CardTitle>Performa bulanan</CardTitle>
            <CardDescription>Ringkasan pendapatan dan pengeluaran 6 bulan terakhir.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0 sm:pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => compactNumber(value as number)} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="revenue" name="Pendapatan" fill="#059669" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Pengeluaran" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-border/70">
          <CardHeader>
            <CardTitle>Aksi cepat</CardTitle>
            <CardDescription>Jalur cepat untuk pekerjaan harian.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              { to: '/quote/new', icon: PlusCircle, label: 'Buat penawaran baru' },
              { to: '/invoice/new', icon: Receipt, label: 'Buat faktur baru' },
              { to: '/expenses', icon: Wallet, label: 'Input pengeluaran' },
              { to: '/reports', icon: ArrowUpRight, label: 'Buka laporan' },
            ].map((action) => (
              <Button key={action.to} asChild variant="outline" className="h-12 justify-start">
                <Link to={action.to}>
                  <action.icon className="mr-2 h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="border-0 shadow-sm ring-1 ring-border/70">
          <CardHeader>
            <CardTitle>Faktur jatuh tempo</CardTitle>
            <CardDescription>Prioritas penagihan yang perlu ditindaklanjuti.</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueInvoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Klien</TableHead>
                    <TableHead className="text-right">Terlambat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Link to={`/invoice/${invoice.id}`} className="font-medium hover:underline">
                          {invoice.to_client}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{differenceInDays(new Date(), new Date(invoice.due_date))} hari</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Tidak ada faktur jatuh tempo.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-border/70">
          <CardHeader>
            <CardTitle>Penawaran menunggu respons</CardTitle>
            <CardDescription>Dokumen terkirim yang belum mendapat keputusan.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingQuotes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Klien</TableHead>
                    <TableHead className="text-right">Dikirim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell>
                        <Link to={`/quote/${quote.id}`} className="font-medium hover:underline">
                          {quote.to_client}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">{format(new Date(quote.created_at), 'dd MMM yyyy', { locale: localeId })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Tidak ada penawaran tertunda.</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
