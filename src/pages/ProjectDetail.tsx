import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, Wallet, TrendingUp, FileText, Receipt, Clock, ListTodo, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, safeFormat, calculateSubtotal, calculateTotal, calculateItemTotal } from '@/lib/utils';
import ProjectTaskList, { Task } from '@/components/ProjectTaskList';
import ProjectTimeTracker, { TimeEntry } from '@/components/ProjectTimeTracker';
import { Progress } from '@/components/ui/progress';

type ProjectDetails = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  clients: { name: string } | null;
  budget: number;
};

type Quote = { id: string; quote_number: string; created_at: string; status: string; quote_items: { quantity: number; unit_price: number; cost_price: number }[] };
type Invoice = { id: string; invoice_number: string; created_at: string; status: string; invoice_items: { quantity: number; unit_price: number }[]; discount_amount: number; tax_amount: number; };
type Expense = { id: string; description: string; expense_date: string; amount: number; };

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjectData = async () => {
    if (!id) return;
    setLoading(true);

    const [projectRes, quotesRes, invoicesRes, expensesRes, tasksRes, timeEntriesRes] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').eq('id', id).single(),
      supabase.from('quotes').select('*, quote_items(*)').eq('project_id', id),
      supabase.from('invoices').select('*, invoice_items(*)').eq('project_id', id),
      supabase.from('expenses').select('*').eq('project_id', id),
      supabase.from('project_tasks').select('*').eq('project_id', id).order('created_at', { ascending: true }),
      supabase.from('time_entries').select('*').eq('project_id', id).order('entry_date', { ascending: false })
    ]);

    if (projectRes.data) setProject(projectRes.data as ProjectDetails);
    if (quotesRes.data) setQuotes(quotesRes.data as Quote[]);
    if (invoicesRes.data) setInvoices(invoicesRes.data as Invoice[]);
    if (expensesRes.data) setExpenses(expensesRes.data as Expense[]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (timeEntriesRes.data) setTimeEntries(timeEntriesRes.data as TimeEntry[]);

    setLoading(false);
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const financials = useMemo(() => {
    const totalRevenue = invoices
      .filter(inv => inv.status === 'Lunas')
      .reduce((sum, inv) => {
        const subtotal = calculateSubtotal(inv.invoice_items);
        return sum + calculateTotal(subtotal, inv.discount_amount, inv.tax_amount);
      }, 0);

    const projectExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const costOfGoodsSold = quotes
      .filter(q => q.status === 'Diterima')
      .reduce((sum, q) => sum + q.quote_items.reduce((acc, item) => acc + calculateItemTotal(item.quantity, item.cost_price || 0), 0), 0);

    const totalCosts = projectExpenses + costOfGoodsSold;
    const netProfit = totalRevenue - totalCosts;
    const totalMinutes = timeEntries.reduce((sum, entry) => sum + entry.duration_minutes, 0);

    return { totalRevenue, totalCosts, netProfit, totalHours: totalMinutes / 60 };
  }, [invoices, expenses, quotes, timeEntries]);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Diterima': case 'Lunas': case 'Completed': return 'default';
      case 'Terkirim': case 'Ongoing': return 'secondary';
      case 'Ditolak': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-4 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) return <div className="container mx-auto p-8 text-center">Proyek tidak ditemukan.</div>;

  const budgetUsedPercent = project.budget > 0 ? (financials.totalCosts / project.budget) * 100 : 0;
  const budgetRemaining = project.budget - financials.totalCosts;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <Button asChild variant="outline" size="sm"><Link to="/projects"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Proyek</Link></Button>
      
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
            <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                <CardTitle className="text-3xl">{project.name}</CardTitle>
                <CardDescription>{project.clients?.name || 'Tanpa klien'}</CardDescription>
                </div>
                <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
            </div>
            {project.description && <p className="text-sm text-muted-foreground pt-2">{project.description}</p>}
            </CardHeader>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Anggaran Proyek</CardTitle>
            </CardHeader>
            <CardContent>
                {project.budget > 0 ? (
                    <div className="space-y-2">
                        <Progress value={budgetUsedPercent} />
                        <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{formatCurrency(financials.totalCosts)}</span> dari <span className="font-medium text-foreground">{formatCurrency(project.budget)}</span> digunakan ({budgetUsedPercent.toFixed(1)}%)
                        </div>
                        <div className={`text-sm font-medium ${budgetRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {budgetRemaining >= 0 ? `${formatCurrency(budgetRemaining)} tersisa` : `${formatCurrency(Math.abs(budgetRemaining))} melebihi anggaran`}
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Tidak ada anggaran yang ditetapkan untuk proyek ini.</p>
                )}
            </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle><DollarSign className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(financials.totalRevenue)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Biaya</CardTitle><Wallet className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(financials.totalCosts)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Laba Bersih</CardTitle><TrendingUp className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(financials.netProfit)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Jam Tercatat</CardTitle><Clock className="h-4 w-4 text-blue-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{financials.totalHours.toFixed(2)} Jam</div></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ListTodo className="h-5 w-5" /> Daftar Tugas</CardTitle></CardHeader>
          <CardContent><ProjectTaskList projectId={project.id} initialTasks={tasks} onTaskUpdate={fetchProjectData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Catatan Waktu</CardTitle></CardHeader>
          <CardContent><ProjectTimeTracker projectId={project.id} initialEntries={timeEntries} onEntryUpdate={fetchProjectData} /></CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Penawaran</CardTitle></CardHeader>
          <CardContent>
            {quotes.length > 0 ? <Table><TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{quotes.map(q => <TableRow key={q.id}><TableCell className="font-medium">{q.quote_number}</TableCell><TableCell><Badge variant={getStatusVariant(q.status)}>{q.status}</Badge></TableCell><TableCell className="text-right"><Button asChild variant="outline" size="sm"><Link to={`/quote/${q.id}`}>Lihat</Link></Button></TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground text-center py-4">Belum ada penawaran.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Faktur</CardTitle></CardHeader>
          <CardContent>
            {invoices.length > 0 ? <Table><TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{invoices.map(i => <TableRow key={i.id}><TableCell className="font-medium">{i.invoice_number}</TableCell><TableCell><Badge variant={getStatusVariant(i.status)}>{i.status}</Badge></TableCell><TableCell className="text-right"><Button asChild variant="outline" size="sm"><Link to={`/invoice/${i.id}`}>Lihat</Link></Button></TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground text-center py-4">Belum ada faktur.</p>}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Pengeluaran</CardTitle></CardHeader>
        <CardContent>
          {expenses.length > 0 ? <Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader><TableBody>{expenses.map(e => <TableRow key={e.id}><TableCell>{safeFormat(e.expense_date, 'PPP')}</TableCell><TableCell className="font-medium">{e.description}</TableCell><TableCell className="text-right">{formatCurrency(e.amount)}</TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground text-center py-4">Belum ada pengeluaran.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDetail;