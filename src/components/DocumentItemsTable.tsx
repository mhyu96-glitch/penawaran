import { calculateItemTotal, formatCurrency, cn } from '@/lib/utils';

export interface DocumentItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface DocumentItemsTableProps {
  items: DocumentItem[];
  config?: {
    showQuantity?: boolean;
    showUnit?: boolean;
    showUnitPrice?: boolean;
  };
}

export const DocumentItemsTable = ({ items, config = {} }: DocumentItemsTableProps) => {
  const {
    showQuantity = true,
    showUnit = true,
    showUnitPrice = true
  } = config;

  const colSpanCount = 1 // Total column
    + (showQuantity ? 1 : 0)
    + (showUnit ? 1 : 0)
    + (showUnitPrice ? 1 : 0);

  let itemCounter = 0;

  return (
    <>
      {/* Mobile Layout */}
      <div className="mobile-document-items space-y-2 md:hidden">
        {items.map((item, index) => {
          const isHeader = Number(item.quantity) === 0;

          if (isHeader) {
            return (
              <div key={index} className="rounded-xl border border-border/80 bg-muted/40 px-3 py-2 mt-3 first:mt-0">
                <p className="text-xs font-black uppercase tracking-wider text-foreground">
                  {item.description.replace(/^[-=_*~#\s]+/, '')}
                </p>
              </div>
            );
          }

          itemCounter += 1;

          return (
            <div key={index} className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">#{itemCounter}</span>
                  <p className="whitespace-pre-wrap text-xs font-bold leading-snug text-foreground">{item.description}</p>
                </div>
                <p className="shrink-0 text-right text-xs font-black text-foreground tabular-nums">
                  {formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                {showQuantity && (
                  <div className="rounded-lg bg-muted/30 px-2 py-1">
                    <p className="text-[10px] text-muted-foreground">Qty</p>
                    <p className="font-bold text-foreground tabular-nums">{item.quantity}</p>
                  </div>
                )}
                {showUnit && (
                  <div className="rounded-lg bg-muted/30 px-2 py-1">
                    <p className="text-[10px] text-muted-foreground">Satuan</p>
                    <p className="font-bold text-foreground">{item.unit || '-'}</p>
                  </div>
                )}
                {showUnitPrice && (
                  <div className="rounded-lg bg-muted/30 px-2 py-1 text-right">
                    <p className="text-[10px] text-muted-foreground">Harga</p>
                    <p className="font-bold text-foreground tabular-nums">{formatCurrency(item.unit_price)}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop / Print Table */}
      <div className="desktop-document-table hidden overflow-hidden rounded-2xl border border-border/80 md:block bg-card">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-muted/40 border-b border-border/80">
            <tr>
              <th className="w-12 py-2.5 px-3 text-center font-bold text-muted-foreground uppercase text-[10px] tracking-wider">No.</th>
              <th className="py-2.5 px-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Deskripsi</th>
              {showQuantity && <th className="w-16 py-2.5 px-3 text-center font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Jumlah</th>}
              {showUnit && <th className="w-16 py-2.5 px-3 text-center font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Satuan</th>}
              {showUnitPrice && <th className="w-32 py-2.5 px-3 text-right font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Harga Satuan</th>}
              <th className="w-36 py-2.5 px-3 text-right font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {(() => {
              let count = 0;
              return items.map((item, index) => {
                const isHeader = Number(item.quantity) === 0;

                if (isHeader) {
                  return (
                    <tr key={index} className="bg-muted/30 font-bold border-y border-border/80">
                      <td colSpan={colSpanCount + 1} className="py-2 px-3 text-foreground tracking-wide font-black uppercase text-[11px]">
                        <span className="inline-flex items-center gap-1.5 text-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {item.description.replace(/^[-=_*~#\s]+/, '')}
                        </span>
                      </td>
                    </tr>
                  );
                }

                count += 1;

                return (
                  <tr key={index} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 text-center font-bold text-muted-foreground tabular-nums">{count}</td>
                    <td className="py-2 px-3 font-semibold text-foreground whitespace-pre-wrap">{item.description}</td>
                    {showQuantity && <td className="py-2 px-3 text-center font-bold text-foreground tabular-nums">{item.quantity}</td>}
                    {showUnit && <td className="py-2 px-3 text-center text-muted-foreground font-medium">{item.unit || '-'}</td>}
                    {showUnitPrice && <td className="py-2 px-3 text-right font-semibold text-muted-foreground tabular-nums">{formatCurrency(item.unit_price)}</td>}
                    <td className="py-2 px-3 text-right font-bold text-foreground tabular-nums">
                      {formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </>
  );
};
