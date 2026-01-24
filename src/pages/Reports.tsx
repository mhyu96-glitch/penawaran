import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Wallet, AreaChart, Calendar as CalendarIcon, Printer } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, addDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatCurrency, safeFormat } from '@/lib/utils';

type Payment = {
  amount: number;
  payment_date: string;
  notes: string | null;
  invoices: { invoice_number: string | null } | null;
};

type Expense = {
  amount: number;
  expense_date: string;
  description: string;
};

const Reports = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !date?.from) return;
      setLoading(true);

      const fromDate = date.from.toISOString();
      const toDate = date.to ? addDays(date.to, 1).toISOString() : addDays(new Date(), 1).toISOString();

      const paymentQuery = supabase
        .from('payments')
        .select('amount, payment_date, notes, invoices(invoice_number)')
        .eq('user_id', user.id)
        .gte('payment_date', fromDate)
        .lt('payment_date', toDate);

      const expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date, description')
        .eq('user_id', user.id)
        .gte('expense_date', fromDate)
        .lt('expense_date', toDate);

      const [paymentRes, expenseRes] = await Promise.all([paymentQuery, expenseQuery]);

      if (paymentRes.data) setPayments(paymentRes.data as Payment[]);
      if (expenseRes.data) setExpenses(expenseRes.data as Expense[]);

      setLoading(false);
    };

    fetchData();
  }, [user, date]);

  const { totalRevenue, totalExpenses, netProfit } = useMemo(() => {
    const revenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const expense = expenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      totalRevenue: revenue,
      totalExpenses: expense,
      netProfit: revenue - expense,
    };
  }, [payments, expenses]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6" id="report-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <AreaChart className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-3xl font-bold">Laporan Keuangan</h1>
        </div>
        <div className="flex items-center gap-2">
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
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
            <Wallet className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(netProfit)}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
            <CardHeader><CardTitle>Rincian Pendapatan</CardTitle><CardDescription>Berdasarkan pembayaran yang diterima.</CardDescription></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {payments.map((p, i) => (
                            <TableRow key={`p-${i}`}><TableCell>{safeFormat(p.payment_date, 'PPP')}</TableCell><TableCell>Pembayaran Faktur #{p.invoices?.invoice_number || 'N/A'}</TableCell><TableCell className="text-right">{formatCurrency(p.amount)}</TableCell></TableRow>
                        ))}
                        {payments.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">Tidak ada pendapatan pada periode ini.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Rincian Pengeluaran</CardTitle><CardDescription>Berdasarkan pengeluaran yang dicatat.</CardDescription></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {expenses.map((e, i) => (
                            <TableRow key={`e-${i}`}><TableCell>{safeFormat(e.expense_date, 'PPP')}</TableCell><TableCell>{e.description}</TableCell><TableCell className="text-right">{formatCurrency(e.amount)}</TableCell></TableRow>
                        ))}
                        {expenses.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">Tidak ada pengeluaran pada periode ini.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
      <style>{`
        @media print {
          body { background-color: white; }
          .print\\:hidden { display: none; }
          #report-page {
            padding: 0;
          }
          .card {
            border: none;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
};

export default Reports;