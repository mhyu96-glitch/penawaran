import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, CheckCheck, Eye, CheckCircle2, DollarSign, FileText, Clock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safeFormatDistance, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type Notification = {
  id: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const getNotificationIcon = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes('melihat') || lower.includes('dibuka')) {
    return <Eye className="h-4 w-4 text-sky-500" />;
  }
  if (lower.includes('diterima') || lower.includes('disetujui') || lower.includes('lunas')) {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (lower.includes('bayar') || lower.includes('pembayaran')) {
    return <DollarSign className="h-4 w-4 text-teal-500" />;
  }
  if (lower.includes('faktur') || lower.includes('penawaran')) {
    return <FileText className="h-4 w-4 text-primary" />;
  }
  return <Bell className="h-4 w-4 text-muted-foreground" />;
};

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);
      
      if (error) console.error('Error fetching notifications:', error);
      else setNotifications(data as Notification[]);

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };

    fetchNotifications();

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
    }
    setIsOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-background/80 hover:bg-muted/60 text-foreground transition-all duration-150 active:scale-95 shadow-xs cursor-pointer"
          title="Notifikasi"
          aria-label="Buka notifikasi"
        >
          <Bell className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-xs animate-in zoom-in">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 sm:w-96 p-0 rounded-3xl border border-border/80 bg-popover/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border/70 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-foreground">Notifikasi</h4>
            {unreadCount > 0 ? (
              <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border-rose-500/20">
                {unreadCount} Baru
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground border-border/70">
                Semua dibaca
              </Badge>
            )}
          </div>

          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleMarkAllAsRead} 
              className="h-8 px-2.5 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 rounded-xl"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Tandai semua dibaca
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60 scrollbar-thin">
          {notifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="h-10 w-10 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto text-muted-foreground">
                <Bell className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">Belum ada notifikasi</p>
              <p className="text-[11px] text-muted-foreground">Aktivitas pembukaan dokumen dan penawaran oleh klien akan muncul di sini.</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "p-3.5 flex items-start gap-3 cursor-pointer transition-all duration-150 hover:bg-muted/40",
                  !n.is_read 
                    ? "bg-primary/10 border-l-3 border-l-primary" 
                    : "bg-transparent opacity-80 hover:opacity-100"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                  !n.is_read ? "bg-primary/20" : "bg-muted/50"
                )}>
                  {getNotificationIcon(n.message)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs leading-relaxed text-foreground",
                    !n.is_read ? "font-bold" : "font-normal text-muted-foreground"
                  )}>
                    {n.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                    <Clock className="h-3 w-3" />
                    <span>{safeFormatDistance(n.created_at)}</span>
                  </p>
                </div>

                {!n.is_read && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5 shadow-[0_0_6px_rgba(20,184,166,0.6)]" />
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;