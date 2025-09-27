import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type Expense = {
  amount: number;
  category: string | null;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19AF', '#19AFFF'];

const ExpenseReport = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, category')
        .eq('user_id', user.id);
      
      if (error) console.error('Error fetching expenses:', error);
      else setExpenses(data as Expense[]);
      setLoading(false);
    };
    fetchExpenses();
  }, [user]);

  const reportData = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Tanpa Kategori';
      if (!categoryMap[category]) {
        categoryMap[category] = 0;
      }
      categoryMap[category] += expense.amount;
    });

    const chartData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return { chartData, total };
  }, [expenses]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Wallet className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-3xl font-bold">Laporan Pengeluaran</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Total Pengeluaran</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{formatCurrency(reportData.total)}</p>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-5">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Rincian per Kategori</CardTitle>
            <CardDescription>Tabel rincian pengeluaran berdasarkan kategori.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.chartData.map((entry) => (
                  <TableRow key={entry.name}>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Distribusi Pengeluaran</CardTitle>
            <CardDescription>Visualisasi porsi pengeluaran untuk setiap kategori.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={reportData.chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                >
                  {reportData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpenseReport;