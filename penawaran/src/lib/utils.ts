import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isBefore, isValid, parseISO, startOfDay } from "date-fns";
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

export const getCleanTerms = (terms?: string | null): string => {
  if (!terms) return '';
  return terms.replace(/\[CATEGORY:[a-zA-Z0-9_-]+\]/g, '').trim();
};

// Status Helper
export const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  const s = status || '';
  switch (s) {
    case 'Lunas':
    case 'Diterima':
    case 'Completed':
      return 'default'; // Usually Primary Color
    case 'Terkirim':
    case 'Ongoing':
    case 'Pending':
      return 'secondary'; // Usually Gray/Muted
    case 'Jatuh Tempo':
    case 'Ditolak':
      return 'destructive'; // Red
    case 'Draf':
    case 'Archived':
    default:
      return 'outline';
  }
};

export const isDateBeforeToday = (dateStr: string | null | undefined) => {
  if (!dateStr) return false;
  const date = dateStr.includes('T') ? new Date(dateStr) : parseISO(dateStr);
  return isValid(date) && isBefore(startOfDay(date), startOfDay(new Date()));
};

// Dot Thousand Separator Helpers for IDR Nominals (e.g. 1.000.000)
export const formatNumberWithDots = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    return Math.round(val).toLocaleString('id-ID');
  }
  const cleanStr = String(val).replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return '';
  return Math.round(num).toLocaleString('id-ID');
};

export const parseDotsToNumber = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

