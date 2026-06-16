import { calculateItemTotal, formatCurrency } from '@/lib/utils';

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

  // Calculate how many columns follow the description column to span correctly
  const colSpanCount = 1 // Total column
    + (showQuantity ? 1 : 0)
    + (showUnit ? 1 : 0)
    + (showUnitPrice ? 1 : 0);

  return (
    <>
      <div className="mobile-document-items space-y-3 md:hidden">
        {items.map((item, index) => {
          const isHeader = item.quantity === 0;

          if (isHeader) {
            return (
              <div key={index} className="rounded-md border bg-gray-50 px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">{item.description}</p>
              </div>
            );
          }

          return (
            <div key={index} className="rounded-md border bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Item {index + 1}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-snug text-gray-950">{item.description}</p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold text-primary">
                  {formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {showQuantity && (
                  <div className="rounded bg-gray-50 px-2 py-2">
                    <p className="text-muted-foreground">Jumlah</p>
                    <p className="mt-1 font-semibold text-gray-900">{item.quantity}</p>
                  </div>
                )}
                {showUnit && (
                  <div className="rounded bg-gray-50 px-2 py-2">
                    <p className="text-muted-foreground">Satuan</p>
                    <p className="mt-1 font-semibold text-gray-900">{item.unit || '-'}</p>
                  </div>
                )}
                {showUnitPrice && (
                  <div className="rounded bg-gray-50 px-2 py-2">
                    <p className="text-muted-foreground">Harga</p>
                    <p className="mt-1 font-semibold text-gray-900">{formatCurrency(item.unit_price)}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="desktop-document-table hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-100">
            <tr className="border-b">
              <th className="w-10 p-3 text-center font-medium text-gray-700">No.</th>
              <th className="p-3 text-left font-medium text-gray-700">Deskripsi</th>
              {showQuantity && <th className="w-20 p-3 text-center font-medium text-gray-700">Jumlah</th>}
              {showUnit && <th className="w-20 p-3 text-center font-medium text-gray-700">Satuan</th>}
              {showUnitPrice && <th className="w-36 p-3 text-right font-medium text-gray-700">Harga Satuan</th>}
              <th className="w-36 p-3 text-right font-medium text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const isHeader = item.quantity === 0;

              if (isHeader) {
                  return (
                      <tr key={index} className="border-b bg-gray-50/80 last:border-none">
                          <td className="select-none p-3 text-center align-top font-medium text-gray-400">#</td>
                          <td className="p-3 align-top font-bold text-gray-800" colSpan={colSpanCount + 1}>
                              {item.description}
                          </td>
                      </tr>
                  );
              }

              return (
                  <tr key={index} className="border-b last:border-none">
                  <td className="p-3 text-center align-top">{index + 1}</td>
                  <td className="whitespace-pre-wrap p-3 align-top">{item.description}</td>
                  {showQuantity && <td className="p-3 text-center align-top">{item.quantity}</td>}
                  {showUnit && <td className="p-3 text-center align-top">{item.unit || '-'}</td>}
                  {showUnitPrice && <td className="p-3 text-right align-top">{formatCurrency(item.unit_price)}</td>}
                  <td className="p-3 text-right align-top">
                      {formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
                  </td>
                  </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};
