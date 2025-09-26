import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Users, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type AcceptedQuote = {
  id: string;
  clients: { name: string } | null;
  client_id: string;
  quote_items: {
    description: string;
    quantity: number;
    unit_price: number;
    cost_price: number;
  }[];
};

const ProfitabilityReports = () => {
  const { user } = useAuth();
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAcceptedQuotes = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('quotes')
        .select('id, client_id, clients(name), quote_items(description, quantity, unit_price, cost_price)')
        .eq('user_id', user.id)
        .eq('status', 'Diterima');

      if (error) {
        console.error('Error fetching accepted quotes:', error);
      } else {
        setAcceptedQuotes(data as AcceptedQuote[]);
      }
      setLoading(false);
    };

    fetchAcceptedQuotes();
  }, [user]);

  const reportData = useMemo(() => {
    const clientProfit: Record<string, { name: string; totalRevenue: number; totalProfit: number; quoteCount: number }> = {};
    const itemProfit: Record<string, { totalQuantity: number; totalRevenue: number; totalProfit: number }> = {};

    acceptedQuotes.forEach(quote => {
      const clientId = quote.client_id;
      const clientName = quote.clients?.name || 'Klien Tanpa Nama';

      if (!clientProfit[clientId]) {
        clientProfit[clientId] = { name: clientName, totalRevenue: 0, totalProfit: 0, quoteCount: 0 };
      }
      clientProfit[clientId].quoteCount += 1;

      quote.quote_items.forEach(item => {
        const revenue = item.quantity * item.unit_price;
        const profit = item.quantity * (item.unit_price - (item.cost_price || 0));
        
        // Aggregate by client
        clientProfit[clientId].totalRevenue += revenue;
        clientProfit[clientId].totalProfit += profit;

        // Aggregate by item description
        const itemKey = item.description;
        if (!itemProfit[itemKey]) {
          itemProfit[itemKey] = { totalQuantity: 0, totalRevenue: 0, totalProfit: 0 };
        }
        itemProfit[itemKey].totalQuantity += item.quantity;
        itemProfit[itemKey].totalRevenue += revenue;
        itemProfit[itemKey].totalProfit += profit;
      });
    });

    const sortedClients = Object.values(clientProfit).sort((a, b) => b.totalProfit - a.totalProfit);
    const sortedItems = Object.entries(itemProfit).map(([description, data]) => ({ description, ...data })).sort((a, b) => b.totalProfit - a.totalProfit);

    return { clients: sortedClients, items: sortedItems };
  }, [acceptedQuotes]);

  const formatCurrency = (amount: number) => amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <TrendingUp className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-3xl font-bold">Laporan Profitabilitas</h1>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6" />
            <CardTitle>Profitabilitas per Klien</CardTitle>
          </div>
          <CardDescription>Menganalisis klien mana yang paling menguntungkan berdasarkan penawaran yang diterima.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klien</TableHead>
                <TableHead className="text-right">Total Pendapatan</TableHead>
                <TableHead className="text-right">Total Laba</TableHead>
                <TableHead className="text-right">Margin Laba</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.clients.map((client, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(client.totalRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(client.totalProfit)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={client.totalProfit > 0 ? "default" : "destructive"}>
                      {client.totalRevenue > 0 ? `${((client.totalProfit / client.totalRevenue) * 100).toFixed(1)}%` : '0%'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6" />
            <CardTitle>Profitabilitas per Barang/Jasa</CardTitle>
          </div>
          <CardDescription>Menganalisis item mana yang paling laku dan paling menguntungkan.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-center">Total Terjual</TableHead>
                <TableHead className="text-right">Total Pendapatan</TableHead>
                <TableHead className="text-right">Total Laba</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell className="text-center">{item.totalQuantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.totalRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.totalProfit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitabilityReports;