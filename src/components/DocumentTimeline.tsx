import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Eye, Mail, FileEdit, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { safeFormatDistance } from '@/lib/utils';

interface DocumentTimelineProps {
  docId: string;
  type: 'invoice' | 'quote';
}

type Activity = {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
};

const DocumentTimeline = ({ docId, type }: DocumentTimelineProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase
        .from('document_activities')
        .select('*')
        .or(`invoice_id.eq.${docId},quote_id.eq.${docId}`)
        .order('created_at', { ascending: false });
      
      if (data) setActivities(data as Activity[]);
    };

    fetchActivities();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('document_activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'document_activities', filter: `${type}_id=eq.${docId}` }, (payload) => {
        setActivities(prev => [payload.new as Activity, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [docId, type]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'created': return <Plus className="h-4 w-4 text-blue-500" />;
      case 'viewed': return <Eye className="h-4 w-4 text-green-500" />;
      case 'updated': return <FileEdit className="h-4 w-4 text-orange-500" />;
      case 'status_change': return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'email_sent': return <Mail className="h-4 w-4 text-gray-500" />;
      default: return <History className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Riwayat Aktivitas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="relative border-l border-muted ml-2">
            {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6 italic">Belum ada aktivitas tercatat.</p>
            ) : (
                activities.map((activity) => (
                <div key={activity.id} className="mb-6 ml-4 last:mb-0">
                    <span className="absolute -left-[9px] mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-muted">
                    {getIcon(activity.activity_type)}
                    </span>
                    <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium leading-none">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                        {safeFormatDistance(activity.created_at)}
                    </p>
                    </div>
                </div>
                ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default DocumentTimeline;