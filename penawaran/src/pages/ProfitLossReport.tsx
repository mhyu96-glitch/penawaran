import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { TrendingUp, Calendar as CalendarIcon, Printer } from 'lucide-react';
import { format, addDays, startOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatCurrency } from '@/lib/utils';

type PaymentWithInvoiceItems = {
  amount: number;
  payment_date: string;
  invoices: {
    invoice_items: {
      quantity: number;
      cost_price: number;
    }[]
  } | null;
};

type Expense = {
  amount: number;
  expense_date: string;
};

const ProfitLossReport = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentWithInvoiceItems[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
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
        .select('amount, payment_date, invoices(invoice_items(quantity, cost_price))')
        .eq('user_id', user.id)
        .eq('status', 'Lunas')
        .gte('payment_date', fromDate)
        .lt('payment_date', toDate);

      const expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date')
        .eq('user_id', user.id)
        .gte('expense_date', fromDate)
        .lt('expense_date', toDate);

      const [paymentRes, expenseRes] = await Promise.all([paymentQuery, expenseQuery]);

      if (paymentRes.data) setPayments(paymentRes.data as PaymentWithInvoiceItems[]);
      if (expenseRes.data) setExpenses(expenseRes.data as Expense[]);

      setLoading(false);
    };

    fetchData();
  }, [user, date]);

  const financials = useMemo(() => {
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    
    const cogs = payments.reduce((sum, p) => {
      if (!p.invoices) return sum;
      const invoiceCogs = p.invoices.invoice_items.reduce((invSum, item) => invSum + (item.quantity * (item.cost_price || 0)), 0);
      return sum + invoiceCogs;
    }, 0);

    const grossProfit = totalRevenue - cogs;
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;

    return { totalRevenue, cogs, grossProfit, totalExpenses, netProfit };
  }, [payments, expenses]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6" id="report-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold">Laporan Laba Rugi</h1>
            <p className="text-muted-foreground">Ringkasan pendapatan dan pengeluaran bisnis Anda.</p>
          </div>
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
      
      <Card>
        <CardHeader>
            <CardTitle>Laporan Laba Rugi</CardTitle>
            <CardDescription>
                Untuk periode {date?.from ? format(date.from, "d MMMM yyyy") : '-'} - {date?.to ? format(date.to, "d MMMM yyyy") : '-'}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableBody>
                    <TableRow>
                        <TableCell className="font-medium">Pendapatan</TableCell>
                        <TableCell className="text-right">{formatCurrency(financials.totalRevenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="pl-8 text-muted-foreground">Harga Pokok Penjualan (HPP)</TableCell>
                        <TableCell className="text-right">({formatCurrency(financials.cogs)})</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted font-bold">
                        <TableCell>Laba Kotor</TableCell>
                        <TableCell className="text-right">{formatCurrency(financials.grossProfit)}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium pt-6">Beban Operasional</TableCell>
                        <TableCell className="text-right pt-6">({formatCurrency(financials.totalExpenses)})</TableCell>
                    </TableRow>
                    <TableRow className="bg-primary/10 font-extrabold text-lg">
                        <TableCell>Laba Bersih</TableCell>
                        <TableCell className="text-right">{formatCurrency(financials.netProfit)}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      <style>{`
        @media print {
          body { background-color: white; }
          .print\\:hidden { display: none; }
          #report-page { padding: 0; }
          .card { border: none; box-shadow: none; }
        }
      `}</style>
    </div>
  );
};

export default ProfitLossReport;