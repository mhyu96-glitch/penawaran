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

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr className="border-b">
            <th className="p-3 text-center font-medium text-gray-700 w-[40px]">No.</th>
            <th className="p-3 text-left font-medium text-gray-700">Deskripsi</th>
            {showQuantity && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Jumlah</th>}
            {showUnit && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Satuan</th>}
            {showUnitPrice && <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Harga Satuan</th>}
            <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b last:border-none">
              <td className="p-3 text-center align-top">{index + 1}</td>
              <td className="p-3 align-top whitespace-pre-wrap">{item.description}</td>
              {showQuantity && <td className="p-3 text-center align-top">{item.quantity}</td>}
              {showUnit && <td className="p-3 text-center align-top">{item.unit || '-'}</td>}
              {showUnitPrice && <td className="p-3 text-right align-top">{formatCurrency(item.unit_price)}</td>}
              <td className="p-3 text-right align-top">
                {formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};