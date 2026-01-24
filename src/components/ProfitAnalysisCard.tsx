import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, calculateItemTotal } from '@/lib/utils';
import { TrendingUp, Package } from 'lucide-react';
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
    <Card className="border-l-4 border-l-blue-500 shadow-sm bg-white overflow-hidden print:hidden mt-6">
      <CardHeader className="bg-slate-50/50 pb-4 border-b">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-lg shadow-sm">
                <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
                <CardTitle className="text-base font-bold text-slate-800">Analisis Keuntungan</CardTitle>
                <CardDescription className="text-xs">Statistik internal untuk {type} ini.</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        {/* KPI Grid - Fixed 2 columns for better sidebar fit */}
        <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border bg-slate-50/50 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Penjualan Net</p>
                <p className="text-lg font-bold text-slate-900 truncate" title={formatCurrency(analysis.netRevenue)}>{formatCurrency(analysis.netRevenue)}</p>
            </div>
            <div className="p-3 rounded-xl border bg-slate-50/50 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Modal</p>
                <p className="text-lg font-bold text-slate-600 truncate" title={formatCurrency(analysis.totalCost)}>{formatCurrency(analysis.totalCost)}</p>
            </div>
            <div className="p-3 rounded-xl border bg-green-50/50 border-green-100 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-green-600 font-semibold">Laba Kotor</p>
                <p className="text-lg font-bold text-green-700 truncate" title={formatCurrency(analysis.grossProfit)}>{formatCurrency(analysis.grossProfit)}</p>
            </div>
            <div className="p-3 rounded-xl border bg-blue-50/50 border-blue-100 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Margin</p>
                <div className="flex items-center gap-1">
                    <p className={`text-lg font-bold ${analysis.netMargin < 10 ? 'text-orange-600' : 'text-blue-700'}`}>
                        {analysis.netMargin.toFixed(1)}%
                    </p>
                </div>
            </div>
        </div>

        {/* Detailed Table */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Package className="h-4 w-4" />
                <span>Rincian per Item</span>
            </div>
            
            <div className="rounded-lg border overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[50%] text-xs font-semibold text-slate-600 h-9 pl-3">Item</TableHead>
                            <TableHead className="text-right text-xs font-semibold text-slate-600 h-9 px-2">Modal</TableHead>
                            <TableHead className="text-right text-xs font-semibold text-slate-600 h-9 pr-3">Laba</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {analysis.itemsAnalysis.length > 0 ? (
                            analysis.itemsAnalysis.map((item, idx) => (
                                <TableRow key={idx} className="hover:bg-slate-50/50">
                                    <TableCell className="py-2.5 pl-3 text-xs font-medium align-top">
                                        <div className="line-clamp-2 leading-snug text-slate-800" title={item.description}>{item.description}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5 font-normal">
                                            {item.quantity} x {formatCurrency(item.unit_price)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-2.5 px-2 text-xs text-slate-500 align-top">
                                        {formatCurrency(item.cost_price || 0)}
                                    </TableCell>
                                    <TableCell className="text-right py-2.5 pr-3 text-xs font-bold text-green-600 align-top">
                                        {formatCurrency(item.profit)}
                                        <div className={`text-[9px] font-normal mt-0.5 ${item.margin < 15 ? 'text-orange-500' : 'text-slate-400'}`}>
                                            {item.margin.toFixed(0)}%
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                                    Belum ada item.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitAnalysisCard;