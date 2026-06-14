import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isBefore, parseISO, startOfDay } from "date-fns";

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

export const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Diterima':
    case 'Lunas':
    case 'Completed':
      return 'default';
    case 'Terkirim':
    case 'Ongoing':
    case 'Pending':
      return 'secondary';
    case 'Ditolak':
    case 'Jatuh Tempo':
      return 'destructive';
    case 'Draf':
    default:
      return 'outline';
  }
};

export const isDateBeforeToday = (value?: string | null) => {
  if (!value) return false;
  return isBefore(startOfDay(parseISO(value)), startOfDay(new Date()));
};
