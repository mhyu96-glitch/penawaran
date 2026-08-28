import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  isValid,
  isBefore,
  startOfDay
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter, Calendar as CalendarIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  type: 'invoice' | 'quote' | 'project';
  status: string;
  client?: string;
};

const ProjectCalendarModern = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);

    const startDate = startOfWeek(startOfMonth(currentDate));
    const endDate = endOfWeek(endOfMonth(currentDate));

    const promises = [
      // Faktur berdasarkan due_date
      supabase.from('invoices')
        .select('id, invoice_number, to_client, due_date, status')
        .eq('user_id', user.id)
        .gte('due_date', startDate.toISOString())
        .lte('due_date', endDate.toISOString()),
      
      // Penawaran berdasarkan valid_until
      supabase.from('quotes')
        .select('id, quote_number, to_client, valid_until, status')
        .eq('user_id', user.id)
        .gte('valid_until', startDate.toISOString())
        .lte('valid_until', endDate.toISOString()),

      // Proyek berdasarkan start_date
      supabase.from('projects')
        .select('id, name, start_date, status')
        .eq('user_id', user.id)
        .gte('start_date', startDate.toISOString())
        .lte('start_date', endDate.toISOString())
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
              title: `Inv #${inv.invoice_number || 'N/A'} Due`,
              date: date,
              type: 'invoice',
              status: inv.status,
              client: inv.to_client
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
              title: `Quote #${quote.quote_number || 'N/A'}`,
              date: date,
              type: 'quote',
              status: quote.status,
              client: quote.to_client
            });
          }
        }
      });
    }

    // Process Projects
    if (projectsRes.data) {
      projectsRes.data.forEach((proj: any) => {
        if (proj.start_date) {
          const date = new Date(proj.start_date);
          if (isValid(date)) {
            newEvents.push({
              id: proj.id,
              title: proj.name,
              date: date,
              type: 'project',
              status: proj.status
            });
          }
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

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentDate)),
      end: endOfWeek(endOfMonth(currentDate))
    });
  }, [currentDate]);

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.date, day));
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'invoice') navigate(`/invoice/${event.id}`);
    else if (event.type === 'quote') navigate(`/quote/${event.id}`);
    else if (event.type === 'project') navigate(`/project/${event.id}`);
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    const today = startOfDay(new Date());
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    const activeProjects = events.filter(e => 
      e.type === 'project' && 
      e.date >= monthStart && 
      e.date <= monthEnd
    ).length;

    const invoicesDue = events.filter(e => 
      e.type === 'invoice' && 
      e.status !== 'Lunas' &&
      e.date >= monthStart && 
      e.date <= monthEnd
    ).length;

    return { activeProjects, invoicesDue };
  }, [events, currentDate]);

  // Get upcoming tasks (sorted by date)
  const upcomingTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return events
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10);
  }, [events]);

  const getEventColorClass = (type: string, status: string) => {
    if (type === 'invoice') {
      return 'bg-secondary/20 border-secondary/30 text-secondary hover:bg-secondary/30 hover:border-secondary/50';
    }
    if (type === 'quote') {
      return 'bg-[#ffdea4]/20 border-[#ffdea4]/30 text-[#ffdea4] hover:bg-[#ffdea4]/30 hover:border-[#ffdea4]/50';
    }
    if (type === 'project') {
      return 'bg-primary/20 border-primary/30 text-primary hover:bg-primary/30 hover:border-primary/50';
    }
    return 'bg-white/10 border-white/20 text-gray-300';
  };

  const getTaskTimeIndicator = (date: Date) => {
    const today = startOfDay(new Date());
    const taskDay = startOfDay(date);
    
    if (isSameDay(taskDay, today)) {
      return { label: 'Today', color: 'error', class: 'bg-error text-on-error' };
    }
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (isSameDay(taskDay, tomorrow)) {
      return { label: 'Tomorrow', color: 'outline', class: 'bg-outline/30 text-on-surface' };
    }
    
    return { 
      label: format(date, 'MMM dd', { locale: localeId }), 
      color: 'primary', 
      class: 'bg-primary/20 text-primary' 
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-[600px] w-full rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] text-[#dae2fd]">
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar Section */}
          <section className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-4xl font-bold text-white">
                  {format(currentDate, 'MMMM yyyy', { locale: localeId })}
                </h2>
                <p className="text-[#c4c6d0] mt-1">Project Timeline & Deadlines</p>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  onClick={prevMonth}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 p-2 rounded text-[#c4c6d0] hover:text-primary hover:border-primary hover:shadow-[0_0_15px_rgba(173,198,255,0.2)] transition-all"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                
                <Button 
                  onClick={goToToday}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-white hover:text-primary hover:border-primary hover:shadow-[0_0_15px_rgba(173,198,255,0.2)] transition-all"
                >
                  Today
                </Button>
                
                <Button 
                  onClick={nextMonth}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 p-2 rounded text-[#c4c6d0] hover:text-primary hover:border-primary hover:shadow-[0_0_15px_rgba(173,198,255,0.2)] transition-all"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-[#131b2e]/60 backdrop-blur-xl border border-white/10 shadow-lg rounded-2xl flex-1 flex flex-col overflow-hidden">
              {/* Days Header */}
              <div className="grid grid-cols-7 border-b border-white/10 bg-white/5 backdrop-blur-md">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                  <div key={day} className="py-3 text-center text-xs font-bold text-[#c4c6d0] uppercase tracking-widest">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Body */}
              <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-white/5 gap-[1px]">
                {daysInMonth.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const today = isToday(day);
                  const otherMonth = !isSameMonth(day, currentDate);
                  
                  return (
                    <div 
                      key={day.toString()}
                      className={`
                        bg-[#0b1326]/40 hover:bg-white/5 transition-colors backdrop-blur-sm p-2 min-h-[100px]
                        ${today ? 'bg-primary/5 relative' : ''}
                      `}
                    >
                      {today && (
                        <div 
                          className="absolute inset-0 border border-primary/40 rounded-sm pointer-events-none z-10"
                          style={{ boxShadow: 'inset 0 0 15px rgba(173, 198, 255, 0.3)' }}
                        />
                      )}
                      
                      <div className="relative z-20">
                        <span className={`
                          text-xs font-mono font-medium
                          ${today ? 'text-primary bg-primary/20 backdrop-blur-md border border-primary/30 rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-[0_0_10px_rgba(173,198,255,0.4)]' : ''}
                          ${otherMonth ? 'text-[#8e909a]' : 'text-[#c4c6d0]'}
                        `}>
                          {format(day, 'd')}
                        </span>

                        {today && dayEvents.length > 0 && (
                          <span className="absolute top-0 right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_5px_rgba(173,198,255,0.8)]" />
                        )}
                        
                        <div className="mt-2 space-y-1">
                          {dayEvents.slice(0, 3).map((event, idx) => (
                            <div 
                              key={`${event.id}-${idx}`}
                              onClick={() => handleEventClick(event)}
                              className={`
                                rounded px-1.5 py-0.5 cursor-pointer transition-all backdrop-blur-md shadow-sm
                                ${getEventColorClass(event.type, event.status)}
                              `}
                            >
                              <p className="text-xs font-bold uppercase tracking-wide truncate">
                                {event.title}
                              </p>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-[#8e909a] pl-1.5">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="w-full lg:w-80 flex flex-col space-y-6">
            {/* Metrics Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg rounded-2xl p-6">
              <h3 className="text-xs font-bold text-[#c4c6d0] mb-4 tracking-widest uppercase">
                {format(currentDate, 'MMMM', { locale: localeId })} Overview
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-3xl font-bold text-primary leading-none" style={{ textShadow: '0 0 10px rgba(173, 198, 255, 0.5)' }}>
                    {metrics.activeProjects}
                  </p>
                  <p className="text-xs text-[#8e909a] mt-1 font-mono">Active Projects</p>
                </div>
                
                <div>
                  <p className="text-3xl font-bold text-secondary leading-none" style={{ textShadow: '0 0 15px rgba(78, 222, 163, 0.3)' }}>
                    {metrics.invoicesDue}
                  </p>
                  <p className="text-xs text-[#8e909a] mt-1 font-mono">Invoices Due</p>
                </div>
              </div>
            </div>

            {/* Upcoming List */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg rounded-2xl flex-1 flex flex-col overflow-hidden">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-md">
                <h3 className="text-xl font-semibold text-white">Agenda</h3>
                <button className="text-primary hover:text-[#adc6ff] transition-all" style={{ filter: 'drop-shadow(0 0 8px rgba(173, 198, 255, 0.4))' }}>
                  <Filter className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {upcomingTasks.length === 0 ? (
                  <div className="p-8 text-center text-[#8e909a]">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No upcoming tasks</p>
                  </div>
                ) : (
                  upcomingTasks.map((task, idx) => {
                    const timeInfo = getTaskTimeIndicator(task.date);
                    const isUrgent = isSameDay(task.date, new Date());
                    
                    return (
                      <div 
                        key={`${task.id}-${idx}`}
                        onClick={() => handleEventClick(task)}
                        className="p-3 rounded-lg border border-white/10 hover:border-primary/50 bg-white/5 backdrop-blur-md transition-all shadow-sm cursor-pointer group hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`
                              w-2 h-2 rounded-full
                              ${isUrgent ? 'bg-error animate-pulse shadow-[0_0_8px_rgba(255,180,171,0.6)]' : 'bg-primary shadow-[0_0_8px_rgba(173,198,255,0.6)]'}
                            `} />
                            <span className={`
                              text-xs font-mono
                              ${isUrgent ? 'text-error' : 'text-primary'}
                            `}>
                              {format(task.date, 'dd MMM, HH:mm', { locale: localeId })}
                            </span>
                          </div>
                        </div>
                        
                        <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors mb-2">
                          {task.title}
                        </h4>
                        
                        {task.client && (
                          <p className="text-xs text-[#8e909a] uppercase tracking-wide truncate">
                            Client: {task.client}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ProjectCalendarModern;
