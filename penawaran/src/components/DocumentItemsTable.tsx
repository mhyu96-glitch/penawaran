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

  const isStoreUnitItem = (item: DocumentItem, index: number, allItems: DocumentItem[]) => {
    if (Number(item.quantity) === 0) return false;
    if ((item as any).is_store_unit) return true;

    const desc = (item.description || '').toLowerCase();
    if (
      desc.includes('bawaan toko') || 
      desc.includes('non-tagihan') || 
      desc.includes('unit toko') || 
      desc.includes('dari toko') ||
      desc.includes('supply toko') ||
      desc.includes('disediakan toko')
    ) {
      return true;
    }

    for (let i = index - 1; i >= 0; i--) {
      if (Number(allItems[i].quantity) === 0) {
        const headerDesc = (allItems[i].description || '').toLowerCase();
        if (
          headerDesc.includes('disediakan') ||
          headerDesc.includes('toko') ||
          headerDesc.includes('non-tagihan') ||
          headerDesc.includes('bawaan') ||
          headerDesc.includes('material partner')
        ) {
          return true;
        }
        break;
      }
    }

    return false;
  };

  // Calculate total visible columns accurately
  const totalColumns = 1 // No.
    + 1 // Deskripsi
    + (showQuantity ? 1 : 0)
    + (showUnit ? 1 : 0)
    + (showUnitPrice ? 1 : 0)
    + 1; // Total

  let itemCounter = 0;

  return (
    <>
      {/* Mobile View */}
      <div className="mobile-document-items space-y-2 md:hidden">
        {items.map((item, index) => {
          const isHeader = Number(item.quantity) === 0;
          const isStoreUnit = isStoreUnitItem(item, index, items);

          if (isHeader) {
            return (
              <div key={index} className="rounded-xl border border-border/80 bg-muted/40 px-3 py-2 mt-3 first:mt-0 print:bg-slate-100 print:border-slate-300">
                <p className="text-xs font-black uppercase tracking-wider text-foreground print:text-slate-900">
                  {item.description.replace(/^[-=_*~#\s]+/, '')}
                </p>
              </div>
            );
          }

          itemCounter += 1;

          return (
            <div key={index} className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs print:bg-white print:border-slate-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase print:text-slate-500">#{itemCounter}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isStoreUnit && (
                      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground border border-border/80 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                        Unit Toko
                      </span>
                    )}
                    <p className="whitespace-pre-wrap text-xs font-bold leading-snug text-foreground print:text-slate-900">{item.description}</p>
                  </div>
                </div>
                <p className="shrink-0 text-right text-xs font-black text-foreground tabular-nums print:text-slate-900">
                  {isStoreUnit ? '-' : formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                {showQuantity && (
                  <div className="rounded-lg bg-muted/30 px-2 py-1 print:bg-slate-50">
                    <p className="text-[10px] text-muted-foreground print:text-slate-500">Qty</p>
                    <p className="font-bold text-foreground tabular-nums print:text-slate-900">{item.quantity}</p>
                  </div>
                )}
                {showUnit && (
                  <div className="rounded-lg bg-muted/30 px-2 py-1 print:bg-slate-50">
                    <p className="text-[10px] text-muted-foreground print:text-slate-500">Satuan</p>
                    <p className="font-bold text-foreground print:text-slate-900">{item.unit || '-'}</p>
                  </div>
                )}
                {showUnitPrice && (
                  <div className="rounded-lg bg-muted/30 px-2 py-1 text-right print:bg-slate-50">
                    <p className="text-[10px] text-muted-foreground print:text-slate-500">Harga</p>
                    <p className="font-bold text-foreground tabular-nums print:text-slate-900">
                      {isStoreUnit ? '-' : formatCurrency(item.unit_price)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop & Print Table */}
      <div className="desktop-document-table hidden overflow-hidden rounded-2xl border border-border/80 md:block bg-card print:border print:border-slate-300 print:rounded-xl print:bg-white">
        <table className="w-full text-xs text-left border-collapse print:bg-white">
          <thead className="bg-muted/40 border-b border-border/80 print:bg-slate-100 print:border-b-2 print:border-slate-300">
            <tr>
              <th className="w-12 py-2.5 px-3 text-center font-bold text-muted-foreground uppercase text-[10px] tracking-wider print:text-slate-700">No.</th>
              <th className="py-2.5 px-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider print:text-slate-700">Deskripsi</th>
              {showQuantity && <th className="w-16 py-2.5 px-3 text-center font-bold text-muted-foreground uppercase text-[10px] tracking-wider print:text-slate-700">Jumlah</th>}
              {showUnit && <th className="w-16 py-2.5 px-3 text-center font-bold text-muted-foreground uppercase text-[10px] tracking-wider print:text-slate-700">Satuan</th>}
              {showUnitPrice && <th className="w-32 py-2.5 px-3 text-right font-bold text-muted-foreground uppercase text-[10px] tracking-wider print:text-slate-700">Harga Satuan</th>}
              <th className="w-36 py-2.5 px-3 text-right font-bold text-muted-foreground uppercase text-[10px] tracking-wider print:text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 print:divide-slate-200">
            {(() => {
              let count = 0;
              return items.map((item, index) => {
                const isHeader = Number(item.quantity) === 0;
                const isStoreUnit = isStoreUnitItem(item, index, items);

                if (isHeader) {
                  return (
                    <tr key={index} className="section-header-row bg-muted/40 font-bold border-y border-border/80 print:bg-slate-100 print:border-slate-300">
                      <td colSpan={totalColumns} className="py-2 px-3 text-foreground tracking-wide font-black uppercase text-[10px] print:bg-slate-100 print:text-slate-900">
                        <span className="inline-flex items-center gap-1.5 text-foreground print:text-slate-900">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/70 print:bg-slate-700" />
                          {item.description.replace(/^[-=_*~#\s]+/, '')}
                        </span>
                      </td>
                    </tr>
                  );
                }

                count += 1;

                return (
                  <tr key={index} className="hover:bg-muted/20 transition-colors print:bg-white">
                    <td className="py-2.5 px-3 text-center font-bold text-muted-foreground tabular-nums print:text-slate-600">{count}</td>
                    <td className="py-2.5 px-3 font-semibold text-foreground whitespace-pre-wrap print:text-slate-900">
                      <div className="flex items-center gap-2">
                        {isStoreUnit && (
                          <span className="inline-flex items-center shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground border border-border/80 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                            Unit Toko
                          </span>
                        )}
                        <span>{item.description}</span>
                      </div>
                    </td>
                    {showQuantity && <td className="py-2.5 px-3 text-center font-bold text-foreground tabular-nums print:text-slate-900">{item.quantity}</td>}
                    {showUnit && <td className="py-2.5 px-3 text-center text-muted-foreground font-medium print:text-slate-600">{item.unit || '-'}</td>}
                    {showUnitPrice && (
                      <td className="py-2.5 px-3 text-right font-semibold text-muted-foreground tabular-nums print:text-slate-700">
                        {isStoreUnit ? '-' : formatCurrency(item.unit_price)}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right font-bold text-foreground tabular-nums print:text-slate-900">
                      {isStoreUnit ? '-' : formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
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
