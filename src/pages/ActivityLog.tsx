import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollText, FileText, Receipt, Users, Package, Wallet, FolderKanban, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

type ActivityItem = {
    id: string;
    type: 'quote' | 'invoice' | 'client' | 'item' | 'expense' | 'project';
    action: string;
    title: string;
    status: string;
    timestamp: string;
};

const iconMap = {
    quote: FileText,
    invoice: Receipt,
    client: Users,
    item: Package,
    expense: Wallet,
    project: FolderKanban,
};

const labelMap = {
    quote: 'Penawaran',
    invoice: 'Faktur',
    client: 'Klien',
    item: 'Barang',
    expense: 'Pengeluaran',
    project: 'Proyek',
};

const ActivityLog = () => {
    const { user } = useAuth();
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string | null>(null);

    useEffect(() => {
        const fetchAllActivity = async () => {
            if (!user) return;
            setLoading(true);

            const [quotesRes, invoicesRes, clientsRes, itemsRes, expensesRes, projectsRes] = await Promise.all([
                supabase.from('quotes').select('id, quote_number, to_client, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
                supabase.from('invoices').select('id, invoice_number, to_client, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
                supabase.from('clients').select('id, name, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
                supabase.from('items').select('id, name, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
                supabase.from('expenses').select('id, description, amount, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
                supabase.from('projects').select('id, name, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
            ]);

            const items: ActivityItem[] = [];

            quotesRes.data?.forEach(q => items.push({
                id: q.id, type: 'quote', action: 'Dibuat', title: `${q.quote_number || 'N/A'} — ${q.to_client}`, status: q.status || 'Draf', timestamp: q.created_at,
            }));

            invoicesRes.data?.forEach(i => items.push({
                id: i.id, type: 'invoice', action: 'Dibuat', title: `${i.invoice_number || 'N/A'} — ${i.to_client}`, status: i.status || 'Draf', timestamp: i.created_at,
            }));

            clientsRes.data?.forEach(c => items.push({
                id: c.id, type: 'client', action: 'Ditambahkan', title: c.name, status: '', timestamp: c.created_at,
            }));

            itemsRes.data?.forEach(i => items.push({
                id: i.id, type: 'item', action: 'Ditambahkan', title: i.name, status: '', timestamp: i.created_at,
            }));

            expensesRes.data?.forEach(e => items.push({
                id: e.id, type: 'expense', action: 'Dicatat', title: e.description, status: '', timestamp: e.created_at,
            }));

            projectsRes.data?.forEach(p => items.push({
                id: p.id, type: 'project', action: 'Dibuat', title: p.name, status: p.status || '', timestamp: p.created_at,
            }));

            items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setActivities(items);
            setLoading(false);
        };

        fetchAllActivity();
    }, [user]);

    const filteredActivities = filterType ? activities.filter(a => a.type === filterType) : activities;

    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-8 space-y-4">
                <Skeleton className="h-10 w-1/3" />
                {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 animate-in fade-in duration-700">
            <Card className="glass-card bg-background-dark/50 border-white/5 shadow-2xl">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-8">
                    <div>
                        <div className="flex items-center gap-3">
                            <ScrollText className="h-7 w-7 text-cyber-lime glow-lime" />
                            <CardTitle className="text-3xl font-black text-white tracking-tighter uppercase italic">System Logs</CardTitle>
                        </div>
                        <CardDescription className="text-slate-400 font-medium">Real-time event stream and telemetry.</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-cyber-lime/10 border border-cyber-lime/20 rounded-full">
                            <div className="size-1.5 rounded-full bg-cyber-lime animate-pulse"></div>
                            <span className="text-[10px] font-bold text-cyber-lime uppercase tracking-widest">Feed Active</span>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" />{filterType ? labelMap[filterType as keyof typeof labelMap] : 'Semua'}</Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Filter Berdasarkan</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setFilterType(null)}>Semua</DropdownMenuItem>
                            {Object.entries(labelMap).map(([key, label]) => (
                                <DropdownMenuItem key={key} onClick={() => setFilterType(key)}>{label}</DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent>
                    {filteredActivities.length === 0 ? (
                        <p className="text-center py-12 text-muted-foreground">Tidak ada aktivitas ditemukan.</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredActivities.map((activity) => {
                                const Icon = iconMap[activity.type];
                                return (
                                    <div key={`${activity.type}-${activity.id}`} className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all">
                                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Icon className="h-5 w-5 text-slate-400 group-hover:text-cyber-lime" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-100 truncate tracking-tight">{activity.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-black text-cyber-lime/70 uppercase tracking-widest">{labelMap[activity.type]}</span>
                                                <div className="size-1 rounded-full bg-slate-700"></div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">{activity.action}</span>
                                            </div>
                                        </div>
                                        {activity.status && (
                                            <Badge variant="outline" className="shrink-0 bg-cyber-lime/10 text-cyber-lime border-cyber-lime/20 text-[10px] font-black px-2 py-0">
                                                {activity.status}
                                            </Badge>
                                        )}
                                        <span className="text-[11px] font-mono font-bold text-slate-500 whitespace-nowrap">
                                            {format(new Date(activity.timestamp), 'HH:mm:ss')}
                                            <span className="ml-2 opacity-50 hidden sm:inline">{format(new Date(activity.timestamp), 'dd.MM.yy')}</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ActivityLog;
