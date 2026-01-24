import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { id as localeId } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number) => {
  return amount.toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

export const safeFormat = (dateStr: string | null | undefined, formatStr: string, fallback: string = 'N/A') => {
  if (!dateStr) return fallback;
  try {
    const date = new Date(dateStr);
    if (!isValid(date)) return 'Invalid Date';
    return format(date, formatStr, { locale: localeId });
  } catch (e) {
    return 'Error';
  }
};

export const safeFormatDistance = (dateStr: string | null | undefined, fallback: string = '-') => {
  if (!dateStr) return fallback;
  try {
    const date = new Date(dateStr);
    if (!isValid(date)) return fallback;
    return formatDistanceToNow(date, { addSuffix: true, locale: localeId });
  } catch (e) {
    return fallback;
  }
};

// Financial Calculations
export const calculateItemTotal = (quantity: number, price: number) => {
  return (Number(quantity) || 0) * (Number(price) || 0);
};

export const calculateSubtotal = (items: { quantity: number; unit_price: number }[]) => {
  return items.reduce((acc, item) => acc + calculateItemTotal(item.quantity, item.unit_price), 0);
};

export const calculateTotal = (subtotal: number, discount: number, tax: number) => {
  return subtotal - (Number(discount) || 0) + (Number(tax) || 0);
};