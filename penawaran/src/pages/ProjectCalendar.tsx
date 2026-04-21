import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, FileText, Receipt, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  type: 'invoice' | 'quote' | 'project';
  status: string;
  amount?: number;
};

const ProjectCalendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);

    // Ambil awal dan akhir bulan yang sedang ditampilkan (dengan buffer minggu)
    const startDate = startOfWeek(startOfMonth(currentDate)).toISOString();
    const endDate = endOfWeek(endOfMonth(currentDate)).toISOString();

    const promises = [
      // 1. Ambil Faktur (Berdasarkan Due Date)
      supabase.from('invoices')
        .select('id, invoice_number, to_client, due_date, status, invoice_items(unit_price, quantity)')
        .eq('user_id', user.id)
        .gte('due_date', startDate)
        .lte('due_date', endDate),
      
      // 2. Ambil Penawaran (Berdasarkan Valid Until)
      supabase.from('quotes')
        .select('id, quote_number, to_client, valid_until, status')
        .eq('user_id', user.id)
        .gte('valid_until', startDate)
        .lte('valid_until', endDate),

      // 3. Ambil Proyek (Berdasarkan Created At)
      supabase.from('projects')
        .select('id, name, created_at, status')
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
    ];

    const [invoicesRes, quotesRes, projectsRes] = await Promise.all(promises);

    const newEvents: CalendarEvent[] = [];

    // Process Invoices
    if (invoicesRes.data) {
      invoicesRes.data.forEach((inv: any) => {
        if (inv.due_date) {
          const date = new Date(inv.due_date);
          if (isValid(date)) {
            newEvents.push({
                id: inv.id,
                title: `Faktur #${inv.invoice_number || 'N/A'} - ${inv.to_client}`,
                date: date,
                type: 'invoice',
                status: inv.status
            });
          }
        }
      });
    }

    // Process Quotes
    if (quotesRes.data) {
      quotesRes.data.forEach((quote: any) => {
        if (quote.valid_until) {
          const date = new Date(quote.valid_until);
          if (isValid(date)) {
            newEvents.push({
                id: quote.id,
                title: `Penawaran #${quote.quote_number || 'N/A'} - ${quote.to_client}`,
                date: date,
                type: 'quote',
                status: quote.status
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
                title: `Mulai Proyek: ${proj.name}`,
                date: date,
                type: 'project',
                status: proj.status
            });
        }
      });
    }

    setEvents(newEvents);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [user, currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate))
  });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.date, day));
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'invoice') navigate(`/invoice/${event.id}`);
    else if (event.type === 'quote') navigate(`/quote/${event.id}`);
    else if (event.type === 'project') navigate(`/project/${event.id}`);
  };

  const getEventColor = (type: string, status: string) => {
    if (type === 'invoice') {
        if (status === 'Lunas') return 'bg-green-100 text-green-700 border-green-200';
        return 'bg-red-100 text-red-700 border-red-200'; // Jatuh tempo / belum bayar
    }
    if (type === 'quote') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (type === 'project') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-gray-100';
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
            <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            <div>
                <h1 className="text-3xl font-bold">Kalender Proyek</h1>
                <p className="text-muted-foreground">Pantau jadwal jatuh tempo dan dimulainya proyek.</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-xl font-semibold min-w-[150px] text-center">
                {format(currentDate, 'MMMM yyyy', { locale: localeId })}
            </h2>
            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="secondary" onClick={goToToday} className="ml-2">Hari Ini</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
            {/* Header Hari */}
            <div className="grid grid-cols-7 border-b bg-muted/50">
                {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((day) => (
                    <div key={day} className="p-4 text-center font-medium text-sm text-muted-foreground">
                        {day}
                    </div>
                ))}
            </div>
            
            {/* Grid Tanggal */}
            {loading ? (
                <div className="p-8 space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            ) : (
                <div className="grid grid-cols-7 auto-rows-fr bg-muted/20 gap-px border-b border-l border-r">
                    {daysInMonth.map((day, dayIdx) => {
                        const dayEvents = getEventsForDay(day);
                        return (
                            <div 
                                key={day.toString()} 
                                className={`
                                    min-h-[120px] bg-background p-2 transition-colors hover:bg-muted/10 relative border-b border-r
                                    ${!isSameMonth(day, currentDate) ? 'text-muted-foreground bg-muted/5' : ''}
                                `}
                            >
                                <div className={`
                                    text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full
                                    ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}
                                `}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-1">
                                    {dayEvents.map((event) => (
                                        <div 
                                            key={`${event.type}-${event.id}`}
                                            onClick={() => handleEventClick(event)}
                                            className={`
                                                text-xs p-1.5 rounded border cursor-pointer truncate flex items-center gap-1.5 font-medium
                                                ${getEventColor(event.type, event.status)}
                                            `}
                                            title={event.title}
                                        >
                                            {event.type === 'invoice' && <Receipt className="h-3 w-3 shrink-0" />}
                                            {event.type === 'quote' && <FileText className="h-3 w-3 shrink-0" />}
                                            {event.type === 'project' && <FolderKanban className="h-3 w-3 shrink-0" />}
                                            <span className="truncate">{event.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span>Mulai Proyek</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
            <span>Faktur Jatuh Tempo (Belum Lunas)</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span>Faktur Lunas</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
            <span>Batas Penawaran</span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCalendar;