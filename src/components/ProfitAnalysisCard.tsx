import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, calculateItemTotal } from '@/lib/utils';
import { TrendingUp, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Item {
  description: string;
  quantity: number;
  unit_price: number;
  cost_price: number; // Harga Modal
}

interface ProfitAnalysisCardProps {
  items: Item[];
  discountAmount: number;
  taxAmount: number; // Pajak tidak dihitung sebagai profit, tapi perlu ditampilkan
  type: 'Penawaran' | 'Faktur';
}

const ProfitAnalysisCard = ({ items, discountAmount, type }: ProfitAnalysisCardProps) => {
  const analysis = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;

    // Filter out items with 0 quantity (Category Headers)
    const activeItems = items.filter(item => item.quantity > 0);

    const itemsAnalysis = activeItems.map(item => {
      const revenue = calculateItemTotal(item.quantity, item.unit_price);
      const cost = calculateItemTotal(item.quantity, item.cost_price || 0);
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      
      totalRevenue += revenue;
      totalCost += cost;

      return { ...item, revenue, cost, profit, margin };
    });

    // Kurangi diskon dari total pendapatan untuk mendapatkan pendapatan bersih
    const netRevenue = totalRevenue - discountAmount;
    const grossProfit = netRevenue - totalCost;
    const netMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    return { totalRevenue, netRevenue, totalCost, grossProfit, netMargin, itemsAnalysis };
  }, [items, discountAmount]);

  return (
    <Card className="border-l-4 border-l-blue-500 shadow-md bg-slate-50 print:hidden mt-8">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-full">
                <TrendingUp className="h-5 w-5 text-blue-700" />
            </div>
            <div>
                <CardTitle className="text-lg text-blue-900">Analisis Keuntungan (Internal)</CardTitle>
                <CardDescription>Laporan profitabilitas untuk {type} ini. Hanya terlihat oleh Anda.</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Penjualan (Net)</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(analysis.netRevenue)}</p>
                {discountAmount > 0 && <p className="text-xs text-red-500 mt-1">Termasuk diskon {formatCurrency(discountAmount)}</p>}
            </div>
            <div className="bg-white p-4 rounded-lg border shadow-sm">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Modal (HPP)</p>
                <p className="text-xl font-bold text-gray-600">{formatCurrency(analysis.totalCost)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border shadow-sm bg-green-50 border-green-100">
                <p className="text-xs text-green-600 uppercase font-semibold">Laba Kotor</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(analysis.grossProfit)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border shadow-sm">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Margin Keuntungan</p>
                <div className="flex items-center gap-2">
                    <p className={`text-xl font-bold ${analysis.netMargin < 10 ? 'text-red-500' : 'text-blue-600'}`}>
                        {analysis.netMargin.toFixed(1)}%
                    </p>
                    {analysis.netMargin < 10 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                </div>
            </div>
        </div>

        <Separator />

        {/* Detailed Table */}
        <div className="rounded-md border bg-white">
            <div className="p-3 bg-gray-50 border-b font-medium text-sm flex items-center gap-2">
                <Package className="h-4 w-4" /> Rincian Profitabilitas per Item
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Deskripsi</TableHead>
                        <TableHead className="text-right">Modal Satuan</TableHead>
                        <TableHead className="text-right">Jual Satuan</TableHead>
                        <TableHead className="text-right">Total Laba</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {analysis.itemsAnalysis.length > 0 ? (
                        analysis.itemsAnalysis.map((item, idx) => (
                            <TableRow key={idx}>
                                <TableCell className="font-medium">
                                    {item.description} <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">{formatCurrency(item.cost_price || 0)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                <TableCell className="text-right font-bold text-green-600">{formatCurrency(item.profit)}</TableCell>
                                <TableCell className="text-right">
                                    <Badge variant={item.margin > 30 ? 'default' : item.margin > 10 ? 'secondary' : 'destructive'} className="text-[10px]">
                                        {item.margin.toFixed(0)}%
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                                Belum ada item dengan jumlah {'>'} 0.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitAnalysisCard;