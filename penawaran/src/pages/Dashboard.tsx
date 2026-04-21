import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, FileText, Clock, Calendar as CalendarIcon, AlertCircle, LayoutDashboard, Wallet, TrendingUp, Users, Activity, Bell, Target, Pencil, Check, Package, AlertTriangle, Plus, Receipt } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { format, addDays, isPast, differenceInDays, eachDayOfInterval, startOfDay, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatCurrency, safeFormat, safeFormatDistance, calculateSubtotal, calculateTotal, calculateItemTotal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';

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

type Notification = {
    id: string;
    message: string;
    created_at: string;
    link: string | null;
};

type LowStockItem = {
    id: string;
    description: string;
    stock: number;
    min_stock_alert: number;
    unit: string;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recentActivities, setRecentActivities] = useState<Notification[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -29),
    to: new Date(),
  });
  
  // Target States
  const [revenueGoal, setRevenueGoal] = useState(0);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState('');

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
      const activityQuery = supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
      const profileQuery = supabase.from('profiles').select('monthly_revenue_goal').eq('id', user.id).single();
      
      const stockQuery = supabase.from('items').select('id, description, stock, min_stock_alert, unit').eq('user_id', user.id).eq('track_stock', true);

      if (fromDate) {
        expenseQuery.gte('expense_date', fromDate);
        paymentQuery.gte('payment_date', fromDate);
      }
      if (toDate) {
        expenseQuery.lt('expense_date', toDate);
        paymentQuery.lt('payment_date', toDate);
      }

      const [quoteRes, invoiceRes, expenseRes, paymentRes, activityRes, profileRes, stockRes] = await Promise.all([quoteQuery, invoiceQuery, expenseQuery, paymentQuery, activityQuery, profileQuery, stockQuery]);

      if (quoteRes.error) console.error('Error fetching quotes:', quoteRes.error); else setQuotes(quoteRes.data as Quote[]);
      if (invoiceRes.error) console.error('Error fetching invoices:', invoiceRes.error); else setInvoices(invoiceRes.data as Invoice[]);
      if (expenseRes.error) console.error('Error fetching expenses:', expenseRes.error); else setExpenses(expenseRes.data as Expense[]);
      if (paymentRes.error) console.error('Error fetching payments:', paymentRes.error); else setPayments(paymentRes.data as Payment[]);
      if (activityRes.data) setRecentActivities(activityRes.data as Notification[]);
      if (profileRes.data) setRevenueGoal(profileRes.data.monthly_revenue_goal || 0);
      
      if (stockRes.data) {
          const lowStock = stockRes.data.filter((item: any) => item.stock <= (item.min_stock_alert || 5));
          setLowStockItems(lowStock);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [user, date]);

  const updateGoal = async () => {
    if (!user) return;
    const newGoal = parseFloat(tempGoal);
    if (isNaN(newGoal) || newGoal < 0) return;

    const { error } = await supabase.from('profiles').update({ monthly_revenue_goal: newGoal }).eq('id', user.id);
    if (error) {
        showError('Gagal memperbarui target.');
    } else {
        setRevenueGoal(newGoal);
        setIsEditingGoal(false);
        showSuccess('Target pendapatan diperbarui!');
    }
  };

  const { totalProfit, acceptedQuotesCount } = useMemo(() => {
    const acceptedQuotes = quotes.filter(q => q.status === 'Diterima');
    const profit = acceptedQuotes.reduce((acc, quote) => {
      const quoteProfit = quote.quote_items.reduce((qAcc, item) => {
          const revenue = calculateItemTotal(item.quantity, item.unit_price);
          const cost = calculateItemTotal(item.quantity, item.cost_price || 0);
          return qAcc + (revenue - cost);
      }, 0);
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
            const subtotal = calculateSubtotal(invoice.invoice_items);
            const total = calculateTotal(subtotal, invoice.discount_amount, invoice.tax_amount);
            unpaidAmount += total;
            
            // Safe date check
            if (invoice.due_date) {
                const dueDate = new Date(invoice.due_date);
                if (isValid(dueDate) && isPast(dueDate)) {
                    overdueAmount += total;
                }
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
    try {
        const days = eachDayOfInterval({ start: date.from, end: date.to });
        return days.map(day => {
            const formattedDate = format(day, 'dd MMM');
            const dayStart = startOfDay(day);

            const dailyRevenue = payments
                .filter(p => {
                    const d = new Date(p.payment_date);
                    return isValid(d) && startOfDay(d).getTime() === dayStart.getTime();
                })
                .reduce((sum, p) => sum + p.amount, 0);

            const dailyExpenses = expenses
                .filter(e => {
                    const d = new Date(e.expense_date);
                    return isValid(d) && startOfDay(d).getTime() === dayStart.getTime();
                })
                .reduce((sum, e) => sum + e.amount, 0);

            return { name: formattedDate, Pendapatan: dailyRevenue, Pengeluaran: dailyExpenses };
        });
    } catch (e) {
        console.error("Error generating chart data", e);
        return [];
    }
  }, [payments, expenses, date]);

  const pendingQuotes = useMemo(() => quotes.filter(q => q.status === 'Terkirim').slice(0, 5), [quotes]);
  
  const overdueInvoices = useMemo(() => {
      return invoices
        .filter(inv => {
            if (inv.status === 'Lunas' || !inv.due_date) return false;
            const d = new Date(inv.due_date);
            return isValid(d) && isPast(d);
        })
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5);
  }, [invoices]);

  const currentMonthRevenue = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return payments
        .filter(p => {
            const d = new Date(p.payment_date);
            return isValid(d) && d >= start && d <= end;
        })
        .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const goalProgress = revenueGoal > 0 ? Math.min((currentMonthRevenue / revenueGoal) * 100, 100) : 0;

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
                <PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{date?.from ? (date.to ? (<>{safeFormat(date.from.toISOString(), "LLL dd, y")} - {safeFormat(date.to.toISOString(), "LLL dd, y")}</>) : (safeFormat(date.from.toISOString(), "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/></PopoverContent>
            </Popover>
        </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Goal Section */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 md:col-span-2">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-900">
                        <Target className="h-5 w-5 text-blue-600" /> Target Pendapatan Bulan Ini
                    </CardTitle>
                    {!isEditingGoal ? (
                        <Button variant="ghost" size="sm" onClick={() => { setTempGoal(String(revenueGoal)); setIsEditingGoal(true); }}>
                            <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Input 
                                type="number" 
                                value={tempGoal} 
                                onChange={(e) => setTempGoal(e.target.value)} 
                                className="h-8 w-32 bg-white"
                                placeholder="Target Rp"
                            />
                            <Button size="sm" onClick={updateGoal} className="h-8 bg-blue-600 hover:bg-blue-700"><Check className="h-4 w-4" /></Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium mb-1">
                        <span>Tercapai: {formatCurrency(currentMonthRevenue)}</span>
                        <span className="text-muted-foreground">Target: {formatCurrency(revenueGoal)}</span>
                    </div>
                    <Progress value={goalProgress} className="h-3 bg-blue-200" indicatorClassName="bg-blue-600" />
                    <p className="text-xs text-muted-foreground text-right pt-1">{goalProgress.toFixed(1)}% tercapai</p>
                </div>
            </CardContent>
        </Card>

        {/* Quick Actions Card (Desktop) */}
        <Card className="hidden md:flex flex-col justify-center">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Aksi Cepat</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="justify-start"><Link to="/invoice/new"><Receipt className="mr-2 h-4 w-4 text-blue-600" /> Faktur</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link to="/quote/new"><FileText className="mr-2 h-4 w-4 text-green-600" /> Penawaran</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link to="/expenses"><Wallet className="mr-2 h-4 w-4 text-orange-600" /> Beban</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link to="/clients"><Users className="mr-2 h-4 w-4 text-purple-600" /> Klien</Link></Button>
            </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50">
            <CardHeader className="pb-2">
                <CardTitle className="text-red-700 flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5" /> Stok Menipis
                </CardTitle>
                <CardDescription className="text-red-600/80">Beberapa barang Anda perlu dipesan ulang segera.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {lowStockItems.map(item => (
                        <div key={item.id} className="bg-white p-3 rounded border shadow-sm flex justify-between items-center">
                            <span className="font-medium truncate mr-2">{item.description}</span>
                            <Badge variant="destructive">{item.stock} {item.unit}</Badge>
                        </div>
                    ))}
                </div>
                <Button asChild variant="link" className="px-0 text-red-700 mt-2">
                    <Link to="/items">Kelola Inventaris &rarr;</Link>
                </Button>
            </CardContent>
        </Card>
      )}

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
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Aktivitas Terkini</CardTitle><CardDescription>Update terbaru dari bisnis Anda.</CardDescription></CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {recentActivities.length > 0 ? (
                        recentActivities.map(activity => (
                            <div key={activity.id} className="flex items-start gap-3 text-sm pb-3 border-b last:border-0 last:pb-0">
                                <div className="bg-blue-100 p-2 rounded-full shrink-0 mt-0.5">
                                    <Bell className="h-3 w-3 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{activity.message}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {safeFormatDistance(activity.created_at)}
                                    </p>
                                    {activity.link && (
                                        <Button asChild variant="link" className="h-auto p-0 text-xs mt-1">
                                            <Link to={activity.link}>Lihat Detail</Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Belum ada aktivitas.</p>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader><CardTitle>Faktur Jatuh Tempo</CardTitle><CardDescription>Faktur yang telah melewati tanggal jatuh tempo.</CardDescription></CardHeader>
            <CardContent>
                {overdueInvoices.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Klien</TableHead><TableHead className="text-right">Terlambat</TableHead></TableRow></TableHeader>
                        <TableBody>{overdueInvoices.map(inv => (<TableRow key={inv.id}><TableCell><Link to={`/invoice/${inv.id}`} className="font-medium hover:underline">{inv.to_client}</Link></TableCell><TableCell className="text-right"><Badge variant="destructive">{differenceInDays(new Date(), new Date(inv.due_date))} hari</Badge></TableCell></TableRow>))}</TableBody>
                    </Table>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada faktur jatuh tempo.</p>}
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Penawaran Tertunda</CardTitle><CardDescription>Penawaran yang menunggu respons klien.</CardDescription></CardHeader>
            <CardContent>
                {pendingQuotes.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Klien</TableHead><TableHead className="text-right">Dikirim</TableHead></TableRow></TableHeader>
                        <TableBody>{pendingQuotes.map(q => (<TableRow key={q.id}><TableCell><Link to={`/quote/${q.id}`} className="font-medium hover:underline">{q.to_client}</Link></TableCell><TableCell className="text-right">{safeFormat(q.created_at, 'PPP')}</TableCell></TableRow>))}</TableBody>
                    </Table>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Tidak ada penawaran yang tertunda.</p>}
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;