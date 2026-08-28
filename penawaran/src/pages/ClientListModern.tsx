import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Search, 
  Filter,
  Mail,
  Phone,
  MoreVertical,
  UserPlus,
  TrendingUp
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from '@/lib/utils';

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  status: 'active' | 'inactive';
  created_at: string;
};

type ClientStats = {
  [clientId: string]: {
    activeProjects: number;
    totalRevenue: number;
    activeInvoices: number;
    hasOverdue: boolean;
  };
};

const ClientListModern = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchClients = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
    } else {
      setClients(data || []);
      
      // Fetch stats for each client
      if (data && data.length > 0) {
        await fetchClientStats(data.map(c => c.id));
      }
    }
    
    setLoading(false);
  };

  const fetchClientStats = async (clientIds: string[]) => {
    if (!user) return;

    const stats: ClientStats = {};

    // Fetch projects count
    const { data: projects } = await supabase
      .from('projects')
      .select('id, client_id, status')
      .eq('user_id', user.id)
      .in('client_id', clientIds);

    // Fetch invoices and calculate revenue
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, client_id, status, due_date, invoice_items(quantity, unit_price)')
      .eq('user_id', user.id)
      .in('client_id', clientIds);

    // Process stats
    clientIds.forEach(clientId => {
      const clientProjects = projects?.filter(p => p.client_id === clientId) || [];
      const clientInvoices = invoices?.filter(i => i.client_id === clientId) || [];

      const activeProjects = clientProjects.filter(p => 
        p.status === 'In Progress' || p.status === 'Planning'
      ).length;

      let totalRevenue = 0;
      let hasOverdue = false;

      clientInvoices.forEach(inv => {
        // Calculate invoice total
        if (inv.invoice_items && inv.invoice_items.length > 0) {
          const invTotal = inv.invoice_items.reduce((sum, item: any) => {
            return sum + (item.quantity * item.unit_price);
          }, 0);
          
          if (inv.status === 'Lunas') {
            totalRevenue += invTotal;
          }
        }

        // Check for overdue
        if (inv.status !== 'Lunas' && inv.due_date) {
          const dueDate = new Date(inv.due_date);
          if (dueDate < new Date()) {
            hasOverdue = true;
          }
        }
      });

      stats[clientId] = {
        activeProjects,
        totalRevenue,
        activeInvoices: clientInvoices.filter(i => i.status !== 'Lunas').length,
        hasOverdue
      };
    });

    setClientStats(stats);
  };

  useEffect(() => {
    fetchClients();
  }, [user]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => 
      (client.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (client.company?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (client.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  const handleClientClick = (clientId: string) => {
    navigate(`/client/${clientId}`);
  };

  const handleAddClient = () => {
    navigate('/clients');
  };

  // Get initials from name
  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Generate avatar color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-teal-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <Skeleton className="h-64 w-full rounded-2xl bg-white/5" />
            <Skeleton className="h-64 w-full rounded-2xl bg-white/5" />
            <Skeleton className="h-64 w-full rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] text-[#dbe2fd]">
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-1">Client Roster</h2>
            <p className="text-[#c4c6d0]">Manage and monitor your active client relationships.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            
            <Button 
              onClick={handleAddClient}
              className="flex items-center gap-2 px-4 py-2 bg-[#adc6ff] text-[#122f5f] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#d8e2ff] transition-all shadow-[0_0_15px_rgba(173,198,255,0.2)]"
            >
              <UserPlus className="h-4 w-4" />
              Add Client
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="flex items-center bg-[#222a3e] rounded-full px-4 py-3 border border-white/10 focus-within:ring-2 focus-within:ring-primary transition-all duration-200">
            <Search className="h-5 w-5 text-[#c4c6d0] mr-3" />
            <Input
              type="text"
              placeholder="Search clients, projects, or quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-white placeholder:text-[#8e909a] w-full p-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        {/* Featured Analytics Section */}
        <div className="mb-8 w-full h-48 md:h-64 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 relative transition-all duration-300 hover:border-white/20 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.3),inset_0_0_20px_rgba(173,198,255,0.15),0_0_15px_rgba(173,198,255,0.2)] hover:-translate-y-0.5">
          <div className="w-full h-full bg-[#2d3449]/30 flex items-center justify-center relative overflow-hidden">
            {/* Grid Pattern */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" patternUnits="userSpaceOnUse" width="40" height="40">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#adc6ff" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Chart Visualization */}
            <svg className="w-full h-full px-6 pt-12 pb-16" viewBox="0 0 800 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#adc6ff" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#adc6ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,180 Q100,140 200,160 T400,80 T600,120 T800,40 L800,200 L0,200 Z" fill="url(#chartGradient)" />
              <path d="M0,180 Q100,140 200,160 T400,80 T600,120 T800,40" fill="none" stroke="#adc6ff" strokeWidth="3" strokeLinecap="round" />
              <circle cx="200" cy="160" r="4" fill="#adc6ff" />
              <circle cx="400" cy="80" r="4" fill="#adc6ff" />
              <circle cx="600" cy="120" r="4" fill="#adc6ff" />
              <circle cx="800" cy="40" r="4" fill="#adc6ff" />
            </svg>

            {/* Floating Badge */}
            <div className="absolute top-6 right-6 bg-white/5 backdrop-blur-xl px-4 py-2 rounded-full border border-[#adc6ff]/30 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
              <span className="text-xs font-mono font-medium text-white">LIVE TRACKING</span>
            </div>
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1326] via-transparent to-transparent pointer-events-none" />
          
          <div className="absolute bottom-4 left-6">
            <h3 className="text-xl font-semibold text-white">Client Growth Analytics</h3>
            <p className="text-xs font-mono text-[#adc6ff]">Q3 PERFORMANCE MATRIX</p>
          </div>
        </div>

        {/* Client Grid */}
        {filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#8e909a] mb-4">
              {clients.length === 0 
                ? 'No clients yet. Add your first client to get started!' 
                : 'No clients found matching your search.'
              }
            </p>
            {clients.length === 0 && (
              <Button 
                onClick={handleAddClient}
                className="bg-[#adc6ff] text-[#122f5f] hover:bg-[#d8e2ff]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add First Client
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredClients.map((client) => {
              const stats = clientStats[client.id] || {
                activeProjects: 0,
                totalRevenue: 0,
                activeInvoices: 0,
                hasOverdue: false
              };

              return (
                <div 
                  key={client.id}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col group transition-all duration-300 hover:border-white/30 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.3),inset_0_0_20px_rgba(173,198,255,0.15),0_0_15px_rgba(173,198,255,0.2)] hover:-translate-y-0.5 cursor-pointer"
                  onClick={() => handleClientClick(client.id)}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-full ${getAvatarColor(client.name)} flex items-center justify-center text-white font-bold text-sm shrink-0 border border-white/20`}>
                        {getInitials(client.name)}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold text-white group-hover:text-[#adc6ff] transition-colors truncate">
                          {client.company || client.name}
                        </h3>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#c4c6d0]">
                          {stats.activeProjects > 5 ? 'Enterprise' : stats.activeProjects > 2 ? 'Mid-Market' : 'SME'}
                        </p>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-[#c4c6d0] hover:text-white h-8 w-8"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="end"
                        className="border-white/10 bg-[#1a2235] text-white"
                      >
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/client/${client.id}`);
                          }}
                          className="hover:bg-white/10 cursor-pointer"
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/quote/new?client=${client.id}`);
                          }}
                          className="hover:bg-white/10 cursor-pointer"
                        >
                          Create Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/invoice/new?client=${client.id}`);
                          }}
                          className="hover:bg-white/10 cursor-pointer"
                        >
                          Create Invoice
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-4 mb-6 mt-2">
                    <div className="bg-[#131b2e]/50 backdrop-blur-md p-3 rounded-lg border border-white/10">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#c4c6d0] block mb-1">
                        Active Projects
                      </span>
                      <span className="text-lg font-mono text-white">
                        {stats.activeProjects.toString().padStart(2, '0')}
                      </span>
                    </div>
                    
                    <div className="bg-[#131b2e]/50 backdrop-blur-md p-3 rounded-lg border border-white/10">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#c4c6d0] block mb-1">
                        Total Revenue
                      </span>
                      <span className="text-lg font-mono text-[#adc6ff]">
                        {stats.totalRevenue > 999999 
                          ? `${(stats.totalRevenue / 1000000).toFixed(1)}M`
                          : stats.totalRevenue > 999
                          ? `${(stats.totalRevenue / 1000).toFixed(1)}k`
                          : stats.totalRevenue.toString()
                        }
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${stats.hasOverdue ? 'bg-[#ffb4ab]' : 'bg-[#4edea3]'} shadow-[0_0_8px_${stats.hasOverdue ? 'rgba(255,180,171,0.6)' : 'rgba(78,222,163,0.6)'}]`} />
                      <span className={`text-xs font-bold uppercase tracking-wide ${stats.hasOverdue ? 'text-[#ffb4ab]' : 'text-[#4edea3]'}`}>
                        {stats.hasOverdue ? 'Invoice Overdue' : 'Active'}
                      </span>
                    </div>
                    
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`mailto:${client.email}`}
                        className="w-8 h-8 rounded-full bg-[#171f33]/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[#adc6ff]/20 hover:text-[#adc6ff] transition-colors border border-white/10"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                      <a
                        href={`tel:${client.phone}`}
                        className="w-8 h-8 rounded-full bg-[#171f33]/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[#adc6ff]/20 hover:text-[#adc6ff] transition-colors border border-white/10"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientListModern;
