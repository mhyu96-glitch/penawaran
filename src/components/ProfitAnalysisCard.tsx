import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency, calculateItemTotal, cn } from '@/lib/utils';
import { TrendingUp, Package, DollarSign, Wallet, Percent, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Item {
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  cost_price: number;
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
  taxAmount: number;
  type: 'Penawaran' | 'Faktur';
}

const ProfitAnalysisCard = ({ items, discountAmount, type }: ProfitAnalysisCardProps) => {
  const analysis = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;

    // Filter out items with 0 quantity (Category Headers)
    const activeItems = (items || []).filter(item => Number(item.quantity) > 0);

    const groupedItems = activeItems.reduce<Map<string, ItemAnalysis>>((groups, item) => {
      const description = (item.description || '').trim();
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

    const netRevenue = totalRevenue - (discountAmount || 0);
    const grossProfit = netRevenue - totalCost;
    const netMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    return { totalRevenue, netRevenue, totalCost, grossProfit, netMargin, itemsAnalysis };
  }, [items, discountAmount]);

  return (
    <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden print:hidden">
      <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                Analisis Estimasi Laba & Margin
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Kalkulasi internal laba kotor & margin profit untuk {type} ini.
              </CardDescription>
            </div>
          </div>

          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {analysis.itemsAnalysis.length} Rincian Item
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Penjualan Net */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Penjualan Bersih (Net)</p>
            <h4 className="text-lg sm:text-xl font-black text-foreground tabular-nums">
              {formatCurrency(analysis.netRevenue)}
            </h4>
            <p className="text-[10px] text-muted-foreground font-medium">Setelah dikurangi diskon</p>
          </div>

          {/* Card 2: Total Modal */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Modal Beli (HPP)</p>
            <h4 className="text-lg sm:text-xl font-black text-foreground tabular-nums">
              {formatCurrency(analysis.totalCost)}
            </h4>
            <p className="text-[10px] text-muted-foreground font-medium">Biaya belanja supplier</p>
          </div>

          {/* Card 3: Laba Kotor */}
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Estimasi Laba Kotor</p>
            <h4 className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(analysis.grossProfit)}
            </h4>
            <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300 font-medium">Penjualan − Modal</p>
          </div>

          {/* Card 4: Margin */}
          <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Profit Margin</p>
            <h4 className={cn(
              "text-lg sm:text-xl font-black tabular-nums",
              analysis.netMargin < 15 ? 'text-amber-500' : 'text-primary'
            )}>
              {analysis.netMargin.toFixed(1)}%
            </h4>
            <p className="text-[10px] text-muted-foreground font-medium">Persentase keuntungan</p>
          </div>
        </div>

        {/* Detailed Item Grid */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Rincian Laba Per Item Barang / Jasa</span>
          </div>
          
          {analysis.itemsAnalysis.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {analysis.itemsAnalysis.map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors space-y-3 flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-foreground line-clamp-2" title={item.description}>
                      {item.description}
                    </h5>
                    <p className="text-[11px] text-muted-foreground font-medium mt-1">
                      {item.quantity} {item.unit || 'unit'} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                    <div className="p-2.5 rounded-xl bg-background border border-border/60">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Modal Beli</p>
                      <p className="text-xs font-bold text-foreground tabular-nums mt-0.5">{formatCurrency(item.cost)}</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
                      <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Laba ({item.margin.toFixed(0)}%)</p>
                      <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">{formatCurrency(item.profit)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Belum ada rincian item barang/jasa.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitAnalysisCard;
