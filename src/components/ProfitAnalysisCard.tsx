import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency, calculateItemTotal } from '@/lib/utils';
import { TrendingUp, Package } from 'lucide-react';

interface Item {
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  cost_price: number; // Harga Modal
}

type ItemAnalysis = Item & {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  mergedCount: number;
};

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

    const groupedItems = activeItems.reduce<Map<string, ItemAnalysis>>((groups, item) => {
      const description = item.description.trim();
      const unit = item.unit || '';
      const unitPrice = Number(item.unit_price) || 0;
      const costPrice = Number(item.cost_price) || 0;
      const revenue = calculateItemTotal(item.quantity, item.unit_price);
      const cost = calculateItemTotal(item.quantity, item.cost_price || 0);
      const key = [description.toLowerCase(), unit.toLowerCase(), unitPrice, costPrice].join('|');
      
      totalRevenue += revenue;
      totalCost += cost;

      const existingItem = groups.get(key);
      if (existingItem) {
        existingItem.quantity += item.quantity;
        existingItem.revenue += revenue;
        existingItem.cost += cost;
        existingItem.profit = existingItem.revenue - existingItem.cost;
        existingItem.margin = existingItem.revenue > 0 ? (existingItem.profit / existingItem.revenue) * 100 : 0;
        existingItem.mergedCount += 1;
      } else {
        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        groups.set(key, {
          ...item,
          description,
          unit,
          unit_price: unitPrice,
          cost_price: costPrice,
          revenue,
          cost,
          profit,
          margin,
          mergedCount: 1,
        });
      }

      return groups;
    }, new Map<string, ItemAnalysis>());

    const itemsAnalysis = Array.from(groupedItems.values());

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
                <p className="text-base font-bold text-slate-900" title={formatCurrency(analysis.netRevenue)}>{formatCurrency(analysis.netRevenue)}</p>
            </div>
            <div className="p-3 rounded-xl border bg-slate-50/50 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Modal</p>
                <p className="text-base font-bold text-slate-600" title={formatCurrency(analysis.totalCost)}>{formatCurrency(analysis.totalCost)}</p>
            </div>
            <div className="p-3 rounded-xl border bg-green-50/50 border-green-100 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-green-600 font-semibold">Laba Kotor</p>
                <p className="text-base font-bold text-green-700" title={formatCurrency(analysis.grossProfit)}>{formatCurrency(analysis.grossProfit)}</p>
            </div>
            <div className="p-3 rounded-xl border bg-blue-50/50 border-blue-100 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Margin</p>
                <div className="flex items-center gap-1">
                    <p className={`text-base font-bold ${analysis.netMargin < 10 ? 'text-orange-600' : 'text-blue-700'}`}>
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
            
            <div className="overflow-hidden rounded-lg border">
                {analysis.itemsAnalysis.length > 0 ? (
                    <div className="divide-y">
                        {analysis.itemsAnalysis.map((item, idx) => (
                            <div key={idx} className="space-y-3 p-3 hover:bg-slate-50/60">
                                <div>
                                    <div className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800" title={item.description}>
                                        {item.description}
                                    </div>
                                    <div className="mt-1 text-[10px] leading-relaxed text-slate-500">
                                        {item.quantity} x {formatCurrency(item.unit_price)}
                                        {item.mergedCount > 1 && (
                                            <span className="ml-1 text-blue-600">({item.mergedCount} baris digabung)</span>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-md bg-slate-50 px-2.5 py-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total Modal</p>
                                        <p className="mt-0.5 text-xs font-semibold text-slate-700">{formatCurrency(item.cost)}</p>
                                    </div>
                                    <div className="rounded-md bg-green-50 px-2.5 py-2 text-right">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-green-700">Laba</p>
                                        <p className="mt-0.5 text-xs font-bold text-green-700">{formatCurrency(item.profit)}</p>
                                        <p className={`text-[10px] ${item.margin < 15 ? 'text-orange-600' : 'text-slate-500'}`}>
                                            {item.margin.toFixed(0)}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                        Belum ada item.
                    </div>
                )}
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitAnalysisCard;
