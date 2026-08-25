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
  Building2, CheckSquare, Sparkles, DollarSign, LayoutGrid, ListFilter
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
  const [viewMode, setViewMode] = useState<'grid' | 'agenda'>('grid');

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
    <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* ========================================================================= */}
      {/* HERO COMMAND BANNER & MONTH NAVIGATION */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-slate-900 via-slate-900/90 to-teal-950/40 p-6 sm:p-8 shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 border border-teal-500/30 px-3 py-1 text-xs font-bold text-teal-400 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                Kalender Kerja & Jatuh Tempo
              </div>
              <span className="rounded-full bg-slate-800/90 border border-border/70 px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
                {events.length} Agenda Bulan Ini
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Jadwal & Agenda Proyek
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Pantau jadwal pengiriman surat penawaran, tanggal jatuh tempo faktur pembayaran, dan progres awal proyek secara terpusat.
            </p>
          </div>

          {/* Stepper & Controls */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <Button 
              onClick={fetchEvents} 
              variant="outline" 
              size="icon"
              className="h-10 w-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-border/80 shadow-xs active:scale-95"
              title="Perbarui Data"
            >
              <RefreshCw className={cn("h-4 w-4 text-teal-400", loading && "animate-spin")} />
            </Button>

            {/* Month Stepper */}
            <div className="flex items-center bg-slate-900/90 border border-border/80 rounded-2xl p-1 shadow-md">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={prevMonth} 
                className="h-8 w-8 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 font-bold text-xs sm:text-sm text-white min-w-[130px] text-center capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: localeId })}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={nextMonth} 
                className="h-8 w-8 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button 
              onClick={goToToday} 
              className="h-10 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-3.5 shadow-md text-xs active:scale-95"
            >
              Hari Ini
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 STAT KPI METRIC CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Jatuh Tempo */}
        <Card className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Jatuh Tempo Bulan Ini</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
              {formatCurrency(monthStats.overdueInvoicesAmount)}
            </h3>
          </div>
          <p className="mt-2 text-[11px] text-rose-700/80 dark:text-rose-300 font-semibold border-t border-rose-500/20 pt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
            <span>{monthStats.overdueInvoicesCount} Faktur Menunggu Pembayaran</span>
          </p>
        </Card>

        {/* Card 2: Faktur Lunas */}
        <Card className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Faktur Lunas Bulan Ini</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(monthStats.paidInvoicesAmount)}
            </h3>
          </div>
          <p className="mt-2 text-[11px] text-emerald-700/80 dark:text-emerald-300 font-semibold border-t border-emerald-500/20 pt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{monthStats.paidInvoicesCount} Faktur Berhasil Diterima</span>
          </p>
        </Card>

        {/* Card 3: Penawaran Aktif */}
        <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Penawaran Aktif</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
              {formatCurrency(monthStats.quotesAmount)}
            </h3>
          </div>
          <p className="mt-2 text-[11px] text-amber-700/80 dark:text-amber-300 font-semibold border-t border-amber-500/20 pt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{monthStats.quotesCount} Penawaran Terjadwal</span>
          </p>
        </Card>

        {/* Card 4: Proyek Berjalan */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Proyek Sedang Berjalan</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <FolderKanban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">{monthStats.ongoingProjectsCount}</h3>
            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
              Aktif
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            <span>Progres operasional proyek</span>
          </p>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* MAIN CALENDAR CARD WITH REFINED TOOLBAR & GRID */}
      {/* ========================================================================= */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        {/* Toolbar: Filters & Legend */}
        <CardHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded-2xl border border-border/60 overflow-x-auto">
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
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap select-none cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-black"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/60 font-medium"
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Color Legend Indicators */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
                <span>Jatuh Tempo</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                <span>Lunas</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                <span>Penawaran</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.6)]" />
                <span>Proyek</span>
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Day of Week Header Grid */}
          <div className="grid grid-cols-7 border-b border-border/80 bg-muted/40 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">
            {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((day, idx) => (
              <div 
                key={day} 
                className={cn(
                  "py-3 px-2",
                  (idx === 0 || idx === 6) && "text-rose-500/80 font-extrabold"
                )}
              >
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
                      "min-h-[120px] sm:min-h-[135px] p-2 sm:p-2.5 transition-all duration-150 relative cursor-pointer group select-none flex flex-col justify-between",
                      isCurrentMonth ? "bg-card hover:bg-muted/30" : "bg-muted/10 text-muted-foreground/40",
                      isDayToday && "bg-teal-500/5 ring-1 ring-inset ring-teal-500/50"
                    )}
                  >
                    {/* Top Row: Date Number & Counter Badge */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn(
                        "text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                        isDayToday 
                          ? "bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-black shadow-md shadow-teal-500/30" 
                          : isCurrentMonth ? "text-foreground font-bold" : "text-muted-foreground/50"
                      )}>
                        {format(day, 'd')}
                      </span>

                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-black text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded-full border border-border/60">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Event Chips List */}
                    <div className="space-y-1 flex-1">
                      {dayEvents.slice(0, 3).map((event) => {
                        const s = (event.status || '').toLowerCase();
                        let chipStyle = 'bg-slate-500/10 text-slate-300 border-slate-500/20';

                        if (event.type === 'invoice') {
                          if (s === 'lunas') chipStyle = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                          else chipStyle = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
                        } else if (event.type === 'quote') {
                          chipStyle = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
                        } else if (event.type === 'project') {
                          chipStyle = 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30';
                        }

                        return (
                          <div
                            key={`${event.type}-${event.id}`}
                            className={cn(
                              "text-[10px] sm:text-[11px] px-2 py-1 rounded-xl border font-bold truncate flex items-center gap-1.5 transition-all shadow-2xs hover:scale-[1.02]",
                              chipStyle
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
                        <div className="text-[10px] font-bold text-primary/80 px-1 pt-0.5">
                          +{dayEvents.length - 3} lainnya...
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

      {/* ========================================================================= */}
      {/* POP-UP DETAIL DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 border border-border/80 shadow-2xl bg-card">
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

            <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
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
                    const s = (quote.status || '').toLowerCase();

                    return (
                      <div 
                        key={quote.id}
                        className="rounded-2xl border border-border/80 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20">
                              #{quote.quote_number || 'N/A'}
                            </span>
                            <span className="font-bold text-sm text-foreground">
                              {quote.to_client || 'Klien Umum'}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              {quote.status || 'Draf'}
                            </span>
                          </div>
                          {quote.valid_until && (
                            <p className="text-xs text-muted-foreground">
                              Berlaku hingga: <strong className="text-foreground">{format(new Date(quote.valid_until), 'd MMMM yyyy', { locale: localeId })}</strong>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <span className="font-black text-sm text-foreground tabular-nums">
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

            {/* SECTION 3: PROYEK */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-teal-500" />
                  Mulai Proyek ({selectedProjects.length})
                </h4>
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs font-bold text-primary">
                  <Link to="/projects" onClick={() => setIsDetailOpen(false)}>
                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Lihat Semua Proyek
                  </Link>
                </Button>
              </div>

              {selectedProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
                  Tidak ada proyek baru yang dibuat pada tanggal ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedProjects.map((event) => {
                    const proj = event.rawData as ProjectData;
                    const totalTasks = proj.project_tasks?.length || 0;
                    const completedTasks = proj.project_tasks?.filter(t => t.is_completed).length || 0;
                    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                    return (
                      <div 
                        key={proj.id}
                        className="rounded-2xl border border-border/80 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground truncate">
                              {proj.name}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-[11px] font-bold px-2 py-0.5">
                              {proj.status || 'Ongoing'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{proj.clients?.name || 'Tanpa Klien'}</span>
                          </p>
                          
                          {totalTasks > 0 && (
                            <div className="max-w-xs space-y-1 pt-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                                <span>Tugas Selesai</span>
                                <span>{completedTasks}/{totalTasks} ({progressPercent}%)</span>
                              </div>
                              <Progress value={progressPercent} className="h-1.5 rounded-full" />
                            </div>
                          )}
                        </div>

                        <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-semibold h-8 shrink-0">
                          <Link to={`/project/${proj.id}`} onClick={() => setIsDetailOpen(false)}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> Buka Proyek
                          </Link>
                        </Button>
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