import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  isValid
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, FileText, 
  Receipt, FolderKanban, CheckCircle2, Clock, AlertTriangle, 
  TrendingUp, PlusCircle, ExternalLink, RefreshCw, X, Eye, 
  Building2, CheckSquare, Sparkles, DollarSign
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from '@/components/ui/progress';
import { cn, formatCurrency, isDateBeforeToday } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type InvoiceItem = {
  unit_price: number;
  quantity: number;
};

type InvoiceData = {
  id: string;
  invoice_number: string;
  to_client: string;
  due_date: string;
  status: string;
  discount_amount?: number;
  tax_amount?: number;
  invoice_items?: InvoiceItem[];
};

type QuoteItem = {
  unit_price: number;
  quantity: number;
};

type QuoteData = {
  id: string;
  quote_number: string;
  to_client: string;
  valid_until?: string;
  created_at: string;
  status: string;
  discount_amount?: number;
  tax_amount?: number;
  quote_items?: QuoteItem[];
};

type ProjectTask = {
  id: string;
  is_completed: boolean;
};

type ProjectData = {
  id: string;
  name: string;
  created_at: string;
  status: string;
  clients?: { name: string } | null;
  project_tasks?: ProjectTask[];
};

type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  type: 'invoice' | 'quote' | 'project';
  status: string;
  amount: number;
  clientName: string;
  rawData: InvoiceData | QuoteData | ProjectData;
};

const ProjectCalendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [allOngoingProjects, setAllOngoingProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'invoices' | 'quotes' | 'projects'>('all');

  // Selected Day Pop-up Modal State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const calculateInvoiceTotal = (inv: InvoiceData) => {
    const subtotal = inv.invoice_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(inv.discount_amount) || 0);
    return afterDiscount + (Number(inv.tax_amount) || 0);
  };

  const calculateQuoteTotal = (quote: QuoteData) => {
    const subtotal = quote.quote_items?.reduce((sum, item) => 
      sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0) || 0;
    const afterDiscount = subtotal - (Number(quote.discount_amount) || 0);
    return afterDiscount + (Number(quote.tax_amount) || 0);
  };

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart).toISOString();
    const endDate = endOfWeek(monthEnd).toISOString();

    try {
      const [invoicesRes, quotesRes, projectsRes, allProjectsRes] = await Promise.all([
        // 1. Invoices
        supabase.from('invoices')
          .select('id, invoice_number, to_client, due_date, status, discount_amount, tax_amount, invoice_items(unit_price, quantity)')
          .eq('user_id', user.id)
          .gte('due_date', startDate)
          .lte('due_date', endDate),
        
        // 2. Quotes
        supabase.from('quotes')
          .select('id, quote_number, to_client, valid_until, created_at, status, discount_amount, tax_amount, quote_items(unit_price, quantity)')
          .eq('user_id', user.id)
          .gte('created_at', startDate)
          .lte('created_at', endDate),

        // 3. Projects Created around this interval
        supabase.from('projects')
          .select('id, name, created_at, status, clients(name), project_tasks(id, is_completed)')
          .eq('user_id', user.id)
          .gte('created_at', startDate)
          .lte('created_at', endDate),

        // 4. All Ongoing Projects for reference
        supabase.from('projects')
          .select('id, name, created_at, status, clients(name), project_tasks(id, is_completed)')
          .eq('user_id', user.id)
          .eq('status', 'Ongoing')
      ]);

      const newEvents: CalendarEvent[] = [];

      // Process Invoices
      if (invoicesRes.data) {
        invoicesRes.data.forEach((inv: any) => {
          if (inv.due_date) {
            const date = new Date(inv.due_date);
            if (isValid(date)) {
              newEvents.push({
                id: inv.id,
                title: `Faktur #${inv.invoice_number || 'N/A'} - ${inv.to_client || 'Klien'}`,
                date: date,
                type: 'invoice',
                status: inv.status || 'Draf',
                amount: calculateInvoiceTotal(inv),
                clientName: inv.to_client || 'Klien',
                rawData: inv,
              });
            }
          }
        });
      }

      // Process Quotes
      if (quotesRes.data) {
        quotesRes.data.forEach((quote: any) => {
          const targetDateStr = quote.valid_until || quote.created_at;
          if (targetDateStr) {
            const date = new Date(targetDateStr);
            if (isValid(date)) {
              newEvents.push({
                id: quote.id,
                title: `Penawaran #${quote.quote_number || 'N/A'} - ${quote.to_client || 'Klien'}`,
                date: date,
                type: 'quote',
                status: quote.status || 'Draf',
                amount: calculateQuoteTotal(quote),
                clientName: quote.to_client || 'Klien',
                rawData: quote,
              });
            }
          }
        });
      }

      // Process Projects
      if (projectsRes.data) {
        projectsRes.data.forEach((proj: any) => {
          const date = new Date(proj.created_at);
          if (isValid(date)) {
            newEvents.push({
              id: proj.id,
              title: `Proyek: ${proj.name}`,
              date: date,
              type: 'project',
              status: proj.status || 'Ongoing',
              amount: 0,
              clientName: proj.clients?.name || 'Tanpa Klien',
              rawData: proj,
            });
          }
        });
      }

      setEvents(newEvents);
      if (allProjectsRes.data) {
        setAllOngoingProjects(allProjectsRes.data as ProjectData[]);
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user, currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentDate)),
      end: endOfWeek(endOfMonth(currentDate))
    });
  }, [currentDate]);

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const matchDay = isSameDay(event.date, day);
      if (!matchDay) return false;
      if (filterType === 'invoices') return event.type === 'invoice';
      if (filterType === 'quotes') return event.type === 'quote';
      if (filterType === 'projects') return event.type === 'project';
      return true;
    });
  };

  // Month Statistics
  const monthStats = useMemo(() => {
    let overdueInvoicesCount = 0;
    let overdueInvoicesAmount = 0;
    let paidInvoicesCount = 0;
    let paidInvoicesAmount = 0;
    let quotesCount = 0;
    let quotesAmount = 0;

    events.forEach(event => {
      if (event.type === 'invoice') {
        const s = (event.status || '').toLowerCase();
        if (s === 'lunas') {
          paidInvoicesCount++;
          paidInvoicesAmount += event.amount;
        } else {
          overdueInvoicesCount++;
          overdueInvoicesAmount += event.amount;
        }
      } else if (event.type === 'quote') {
        quotesCount++;
        quotesAmount += event.amount;
      }
    });

    return {
      overdueInvoicesCount,
      overdueInvoicesAmount,
      paidInvoicesCount,
      paidInvoicesAmount,
      quotesCount,
      quotesAmount,
      ongoingProjectsCount: allOngoingProjects.length,
    };
  }, [events, allOngoingProjects]);

  // Open Pop-up Detail on Date Click
  const handleDateClick = (day: Date) => {
    setSelectedDate(day);
    setIsDetailOpen(true);
  };

  // Events of Selected Date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(event => isSameDay(event.date, selectedDate));
  }, [selectedDate, events]);

  const selectedInvoices = useMemo(() => 
    selectedDateEvents.filter(e => e.type === 'invoice'), [selectedDateEvents]
  );
  
  const selectedQuotes = useMemo(() => 
    selectedDateEvents.filter(e => e.type === 'quote'), [selectedDateEvents]
  );

  const selectedProjects = useMemo(() => 
    selectedDateEvents.filter(e => e.type === 'project'), [selectedDateEvents]
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* Executive Header Command Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white p-6 sm:p-8 shadow-2xl">
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/4 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 px-3 py-1 text-xs font-semibold text-sky-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                Jadwal & Agenda Interaktif
              </div>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                {events.length} Agenda Terjadwal
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Kalender Proyek & Tagihan
            </h1>

            <p className="text-slate-300/90 text-sm leading-relaxed">
              Klik tanggal atau kegiatan mana saja untuk membuka <strong>Pop-up Detail Lengkap</strong> faktur jatuh tempo, penawaran, dan proyek yang sedang berjalan.
            </p>
          </div>

          {/* Month Navigation & Action Controls */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <Button 
              onClick={fetchEvents} 
              variant="outline" 
              size="lg"
              className="h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600 transition-all shadow-md active:scale-95"
              title="Refresh Kalender"
            >
              <RefreshCw className={cn("h-4 w-4 text-sky-400", loading && "animate-spin")} />
            </Button>

            {/* Month Stepper */}
            <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-2xl p-1 shadow-lg">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={prevMonth} 
                className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 font-bold text-sm text-white min-w-[140px] text-center capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: localeId })}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={nextMonth} 
                className="h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button 
              onClick={goToToday} 
              className="h-11 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 shadow-lg shadow-sky-950/50 transition-all active:scale-95 text-xs"
            >
              Hari Ini
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Stat KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faktur Belum Bayar / Jatuh Tempo */}
        <Card className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Jatuh Tempo Bulan Ini</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-2xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 truncate">
              {formatCurrency(monthStats.overdueInvoicesAmount)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-rose-700/80 dark:text-rose-300 font-bold border-t border-rose-500/20 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
            <span>{monthStats.overdueInvoicesCount} Faktur Menunggu Pembayaran</span>
          </div>
        </Card>

        {/* Card 2: Faktur Lunas */}
        <Card className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Faktur Lunas Bulan Ini</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              {formatCurrency(monthStats.paidInvoicesAmount)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700/80 dark:text-emerald-300 font-bold border-t border-emerald-500/20 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{monthStats.paidInvoicesCount} Faktur Berhasil Diterima</span>
          </div>
        </Card>

        {/* Card 3: Penawaran Harga */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Batas Penawaran</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-2xs">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black tracking-tight text-foreground truncate">
              {formatCurrency(monthStats.quotesAmount)}
            </h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{monthStats.quotesCount} Penawaran Aktif Bulan Ini</span>
          </div>
        </Card>

        {/* Card 4: Proyek Sedang Dikerjakan */}
        <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Proyek Sedang Berjalan</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-3xl font-extrabold tracking-tight text-foreground">{monthStats.ongoingProjectsCount}</h3>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
              Aktif
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span>Progres tugas proyek berjalan</span>
          </div>
        </Card>
      </div>

      {/* Main Calendar Card */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        {/* Calendar Header Filter Controls & Legend */}
        <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 overflow-x-auto max-w-full">
              {[
                { key: 'all', label: 'Semua Agenda' },
                { key: 'invoices', label: 'Faktur Tagihan', icon: Receipt },
                { key: 'quotes', label: 'Penawaran', icon: FileText },
                { key: 'projects', label: 'Mulai Proyek', icon: FolderKanban },
              ].map(tab => {
                const isActive = filterType === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilterType(tab.key as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap select-none",
                      isActive
                        ? "bg-background text-foreground shadow-xs border border-border/70"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Color Legend Indicators */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Faktur Jatuh Tempo</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Faktur Lunas</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Penawaran</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>Proyek</span>
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Day of Week Header Grid */}
          <div className="grid grid-cols-7 border-b border-border/80 bg-muted/40 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">
            {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((day) => (
              <div key={day} className="py-3.5 px-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          {loading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="grid grid-cols-7 auto-rows-fr bg-border/40 gap-px">
              {daysInMonth.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDayToday = isToday(day);

                return (
                  <div
                    key={day.toString()}
                    onClick={() => handleDateClick(day)}
                    className={cn(
                      "min-h-[120px] sm:min-h-[135px] p-2 sm:p-2.5 transition-all duration-150 relative cursor-pointer group select-none",
                      isCurrentMonth ? "bg-card hover:bg-muted/40" : "bg-muted/15 text-muted-foreground/50",
                      isDayToday && "bg-sky-500/[0.04] ring-1 ring-inset ring-sky-500/40"
                    )}
                  >
                    {/* Top Row: Date Number */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn(
                        "text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                        isDayToday 
                          ? "bg-sky-600 text-white font-black shadow-md shadow-sky-600/30" 
                          : isCurrentMonth ? "text-foreground font-bold" : "text-muted-foreground/60"
                      )}>
                        {format(day, 'd')}
                      </span>

                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-extrabold text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded-full border border-border/50">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Event Chips List */}
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => {
                        const s = (event.status || '').toLowerCase();
                        let badgeBg = 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';

                        if (event.type === 'invoice') {
                          if (s === 'lunas') badgeBg = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                          else badgeBg = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
                        } else if (event.type === 'quote') {
                          badgeBg = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
                        } else if (event.type === 'project') {
                          badgeBg = 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
                        }

                        return (
                          <div
                            key={`${event.type}-${event.id}`}
                            className={cn(
                              "text-[11px] px-2 py-1 rounded-lg border font-semibold truncate flex items-center gap-1.5 transition-all shadow-2xs group-hover:border-primary/40",
                              badgeBg
                            )}
                            title={event.title}
                          >
                            {event.type === 'invoice' && <Receipt className="h-3 w-3 shrink-0" />}
                            {event.type === 'quote' && <FileText className="h-3 w-3 shrink-0" />}
                            {event.type === 'project' && <FolderKanban className="h-3 w-3 shrink-0" />}
                            <span className="truncate">{event.title}</span>
                          </div>
                        );
                      })}

                      {dayEvents.length > 3 && (
                        <div className="text-[10px] font-bold text-muted-foreground/80 px-1 pt-0.5">
                          +{dayEvents.length - 3} kegiatan lainnya...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* POP-UP DETAIL DIALOG: PENAWARAN, FAKTUR, DAN PROYEK YANG SEDANG DIKERJAKAN */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 border border-border/80 shadow-2xl">
          <DialogHeader className="space-y-2 border-b border-border/70 pb-4 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-bold text-primary">
                <CalendarIcon className="h-3.5 w-3.5" />
                {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy', { locale: localeId }) : ''}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {selectedDateEvents.length} Agenda Terjadwal
              </span>
            </div>

            <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
              Detail Agenda & Proyek Harian
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Rincian penawaran, faktur jatuh tempo, dan proyek yang sedang berjalan pada tanggal ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* SECTION 1: FAKTUR & TAGIHAN */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-rose-500" />
                  Faktur & Tagihan ({selectedInvoices.length})
                </h4>
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs font-bold text-primary">
                  <Link to="/invoice/new" onClick={() => setIsDetailOpen(false)}>
                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Buat Faktur
                  </Link>
                </Button>
              </div>

              {selectedInvoices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
                  Tidak ada faktur jatuh tempo pada tanggal ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedInvoices.map((event) => {
                    const inv = event.rawData as InvoiceData;
                    const s = (inv.status || '').toLowerCase();
                    const isOverdue = s !== 'lunas' && isDateBeforeToday(inv.due_date);

                    return (
                      <div 
                        key={inv.id}
                        className="rounded-2xl border border-border/80 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                              #{inv.invoice_number || 'N/A'}
                            </span>
                            <span className="font-bold text-sm text-foreground">
                              {inv.to_client || 'Klien Umum'}
                            </span>
                            {s === 'lunas' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold px-2 py-0.5">
                                <CheckCircle2 className="h-3 w-3" /> Lunas
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-bold px-2 py-0.5">
                                <AlertTriangle className="h-3 w-3 animate-pulse" /> Jatuh Tempo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-[11px] font-bold px-2 py-0.5">
                                <Clock className="h-3 w-3" /> {inv.status || 'Pending'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Jatuh tempo: <strong className="text-foreground">{format(new Date(inv.due_date), 'd MMMM yyyy', { locale: localeId })}</strong>
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <span className="font-black text-sm text-foreground tabular-nums">
                            {formatCurrency(event.amount)}
                          </span>
                          <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-semibold h-8">
                            <Link to={`/invoice/${inv.id}`} onClick={() => setIsDetailOpen(false)}>
                              <Eye className="mr-1 h-3.5 w-3.5" /> Buka Faktur
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 2: PENAWARAN HARGA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  Penawaran Harga ({selectedQuotes.length})
                </h4>
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs font-bold text-primary">
                  <Link to="/quote/new" onClick={() => setIsDetailOpen(false)}>
                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Buat Penawaran
                  </Link>
                </Button>
              </div>

              {selectedQuotes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
                  Tidak ada penawaran harga yang dijadwalkan pada tanggal ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedQuotes.map((event) => {
                    const quote = event.rawData as QuoteData;
                    return (
                      <div 
                        key={quote.id}
                        className="rounded-2xl border border-border/80 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/25">
                              #{quote.quote_number || 'N/A'}
                            </span>
                            <span className="font-bold text-sm text-foreground">
                              {quote.to_client || 'Klien Umum'}
                            </span>
                            <Badge variant="outline" className="text-[11px] font-bold">
                              {quote.status || 'Draf'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Estimasi Nilai Proyek
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(event.amount)}
                          </span>
                          <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-semibold h-8">
                            <Link to={`/quote/${quote.id}`} onClick={() => setIsDetailOpen(false)}>
                              <Eye className="mr-1 h-3.5 w-3.5" /> Buka Penawaran
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 3: PROYEK YANG SEDANG DIKERJAKAN */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-indigo-500" />
                  Proyek Yang Sedang Dikerjakan ({allOngoingProjects.length})
                </h4>
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs font-bold text-primary">
                  <Link to="/projects" onClick={() => setIsDetailOpen(false)}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Semua Proyek
                  </Link>
                </Button>
              </div>

              {allOngoingProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
                  Tidak ada proyek berstatus aktif saat ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {allOngoingProjects.map((proj) => {
                    const totalTasks = proj.project_tasks?.length || 0;
                    const doneTasks = proj.project_tasks?.filter(t => t.is_completed).length || 0;
                    const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

                    return (
                      <div 
                        key={proj.id}
                        className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start sm:items-center justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-sm text-foreground truncate">
                                {proj.name}
                              </h5>
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 px-2 py-0.2 text-[10px] font-bold shrink-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Sedang Berjalan
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Building2 className="h-3 w-3" />
                              {proj.clients?.name || 'Tanpa Klien'}
                            </p>
                          </div>

                          <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-semibold h-8 shrink-0">
                            <Link to={`/project/${proj.id}`} onClick={() => setIsDetailOpen(false)}>
                              <TrendingUp className="mr-1 h-3.5 w-3.5 text-emerald-500" /> Detail
                            </Link>
                          </Button>
                        </div>

                        {/* Task Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                            <span className="flex items-center gap-1">
                              <CheckSquare className="h-3 w-3 text-primary" />
                              Progres Tugas
                            </span>
                            <span>{doneTasks}/{totalTasks} Selesai ({progress.toFixed(0)}%)</span>
                          </div>
                          <Progress value={progress} className="h-1.5 rounded-full" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectCalendar;