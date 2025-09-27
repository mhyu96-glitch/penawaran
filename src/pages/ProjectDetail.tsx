import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, Wallet, TrendingUp, FileText, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

type ProjectDetails = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  clients: { name: string } | null;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!id) return;
      setLoading(true);

      const projectRes = await supabase.from('projects').select('*, clients(name)').eq('id', id).single();
      if (projectRes.data) setProject(projectRes.data as ProjectDetails);

      const quotesRes = await supabase.from('quotes').select('*, quote_items(*)').eq('project_id', id);
      if (quotesRes.data) setQuotes(quotesRes.data as Quote[]);

      const invoicesRes = await supabase.from('invoices').select('*, invoice_items(*)').eq('project_id', id);
      if (invoicesRes.data) setInvoices(invoicesRes.data as Invoice[]);

      const expensesRes = await supabase.from('expenses').select('*').eq('project_id', id);
      if (expensesRes.data) setExpenses(expensesRes.data as Expense[]);

      setLoading(false);
    };
    fetchProjectData();
  }, [id]);

  const financials = useMemo(() => {
    const totalRevenue = invoices
      .filter(inv => inv.status === 'Lunas')
      .reduce((sum, inv) => {
        const subtotal = inv.invoice_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
        return sum + (subtotal - (inv.discount_amount || 0) + (inv.tax_amount || 0));
      }, 0);

    const projectExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const costOfGoodsSold = quotes
      .filter(q => q.status === 'Diterima')
      .reduce((sum, q) => sum + q.quote_items.reduce((acc, item) => acc + item.quantity * (item.cost_price || 0), 0), 0);

    const totalCosts = projectExpenses + costOfGoodsSold;
    const netProfit = totalRevenue - totalCosts;

    return { totalRevenue, totalCosts, netProfit };
  }, [invoices, expenses, quotes]);

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
        <div className="grid md:grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) return <div className="container mx-auto p-8 text-center">Proyek tidak ditemukan.</div>;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <Button asChild variant="outline" size="sm"><Link to="/projects"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Proyek</Link></Button>
      
      <Card>
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

      <div className="grid md:grid-cols-3 gap-6">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle><DollarSign className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(financials.totalRevenue)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Biaya</CardTitle><Wallet className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(financials.totalCosts)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Laba Bersih</CardTitle><TrendingUp className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(financials.netProfit)}</div></CardContent></Card>
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
          {expenses.length > 0 ? <Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader><TableBody>{expenses.map(e => <TableRow key={e.id}><TableCell>{format(new Date(e.expense_date), 'PPP', { locale: localeId })}</TableCell><TableCell className="font-medium">{e.description}</TableCell><TableCell className="text-right">{formatCurrency(e.amount)}</TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground text-center py-4">Belum ada pengeluaran.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDetail;