import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';

type QuoteItem = {
  quantity: number;
  unit_price: number;
};

type Quote = {
  id: string;
  quote_number: string;
  to_client: string;
  created_at: string;
  status: string;
  valid_until: string | null;
  discount_amount: number;
  tax_amount: number;
  quote_items: QuoteItem[];
  clients: { company_name: string } | null;
};

interface QuoteStats {
  totalDrafts: number;
  sentPending: number;
  acceptedValue: number;
}

const QuoteListModern = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [stats, setStats] = useState<QuoteStats>({
    totalDrafts: 0,
    sentPending: 0,
    acceptedValue: 0
  });

  const fetchQuotes = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id, 
          quote_number, 
          to_client, 
          created_at, 
          status,
          valid_until,
          discount_amount,
          tax_amount,
          total,
          client_id,
          clients(company_name),
          quote_items(quantity, unit_price)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const quotesData = (data || []) as Quote[];
      setQuotes(quotesData);

      // Calculate stats
      const drafts = quotesData.filter(q => q.status === 'draft').length;
      const sent = quotesData.filter(q => q.status === 'sent' || q.status === 'pending').length;
      const acceptedVal = quotesData
        .filter(q => q.status === 'accepted')
        .reduce((sum, q) => sum + calculateQuoteTotal(q), 0);

      setStats({
        totalDrafts: drafts,
        sentPending: sent,
        acceptedValue: acceptedVal
      });
    } catch (err: any) {
      console.error('Error fetching quotes:', err);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, [user]);

  const calculateQuoteTotal = (quote: Quote): number => {
    const subtotal = quote.quote_items?.reduce((sum, item) => 
      sum + (item.quantity * item.unit_price), 0) || 0;
    const afterDiscount = subtotal - (quote.discount_amount || 0);
    return afterDiscount + (quote.tax_amount || 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent':
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#4b8eff]/20 text-[#4b8eff] text-[11px] font-bold tracking-wider uppercase gap-1 border border-[#4b8eff]/30 shadow-[0_0_10px_rgba(75,142,255,0.2)] backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4b8eff] animate-pulse shadow-[0_0_5px_rgba(75,142,255,0.8)]"></span>
            Sent
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-secondary/20 text-secondary text-[11px] font-bold tracking-wider uppercase gap-1 border border-secondary/30 shadow-[0_0_10px_rgba(78,222,163,0.2)] backdrop-blur-md">
            <span className="material-symbols-outlined text-[10px] drop-shadow-[0_0_5px_rgba(78,222,163,0.8)]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Accepted
          </span>
        );
      case 'expired':
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-error/20 text-error text-[11px] font-bold tracking-wider uppercase gap-1 border border-error/30 shadow-[0_0_10px_rgba(255,180,171,0.2)] backdrop-blur-md">
            Expired
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-white/5 backdrop-blur-md text-on-surface-variant text-[11px] font-bold tracking-wider uppercase gap-1 shadow-sm border border-white/10">
            Draft
          </span>
        );
    }
  };

  const getClientInitials = (clientName: string) => {
    const words = clientName.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clientName.substring(0, 2).toUpperCase();
  };

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = 
        quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (quote.clients?.company_name || quote.to_client).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filterStatus === 'all' ||
        (filterStatus === 'draft' && quote.status === 'draft') ||
        (filterStatus === 'sent' && (quote.status === 'sent' || quote.status === 'pending')) ||
        (filterStatus === 'accepted' && quote.status === 'accepted');

      return matchesSearch && matchesFilter;
    });
  }, [quotes, searchTerm, filterStatus]);

  const statusCounts = useMemo(() => {
    return {
      all: quotes.length,
      draft: quotes.filter(q => q.status === 'draft').length,
      sent: quotes.filter(q => q.status === 'sent' || q.status === 'pending').length,
      accepted: quotes.filter(q => q.status === 'accepted').length
    };
  }, [quotes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#4b8eff]/30 border-t-[#4b8eff] rounded-full animate-spin"></div>
          <p className="text-on-surface-variant">Loading quotes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060e20] to-[#0b1326] text-on-background antialiased relative">
      {/* Background radial gradient overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#4b8eff]/5 via-transparent to-transparent -z-10"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl md:text-[40px] font-bold text-on-background leading-tight tracking-tight drop-shadow-sm">
              Quotations
            </h2>
            <p className="text-base text-on-surface-variant mt-1">
              Manage, track, and create client proposals.
            </p>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-4 py-2 bg-white/5 backdrop-blur-xl hover:bg-white/10 rounded border border-white/5 text-on-surface transition-all flex items-center justify-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-sm">download</span>
              Export
            </button>
            <Link 
              to="/quote/new"
              className="flex-1 sm:flex-none px-4 py-2 bg-[#4b8eff]/20 border border-[#4b8eff]/30 text-[#4b8eff] rounded hover:bg-[#4b8eff]/30 hover:border-[#4b8eff]/50 transition-all flex items-center justify-center gap-2 font-medium shadow-[0_0_15px_rgba(75,142,255,0.2)]"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
              Create New
            </Link>
          </div>
        </div>

        {/* Bento Grid Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Metric 1 - Total Drafts */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-xl p-6 relative overflow-hidden group hover:shadow-[0_0_25px_rgba(173,198,255,0.1)] transition-all">
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-[#4b8eff]/10 rounded-full blur-3xl group-hover:bg-[#4b8eff]/20 transition-all duration-500"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-white/5 backdrop-blur-md border border-[#4b8eff]/20 rounded-lg shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                <span className="material-symbols-outlined text-[#4b8eff] drop-shadow-[0_0_8px_rgba(173,198,255,0.5)]">pending_actions</span>
              </div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant bg-white/5 backdrop-blur-md border border-white/10 px-2 py-1 rounded">
                THIS MONTH
              </span>
            </div>

            <h3 className="text-sm text-on-surface-variant mb-1 relative z-10">Total Drafts</h3>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-[32px] font-semibold text-on-background leading-tight drop-shadow-sm">
                {stats.totalDrafts}
              </span>
              <span className="text-xs text-error font-['JetBrains_Mono'] drop-shadow-[0_0_5px_rgba(255,180,171,0.5)] flex items-center">
                <span className="material-symbols-outlined text-[14px]">arrow_downward</span> 12%
              </span>
            </div>
          </div>

          {/* Metric 2 - Sent Pending */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-xl p-6 relative overflow-hidden group hover:shadow-[0_0_25px_rgba(78,222,163,0.1)] transition-all">
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-secondary/10 rounded-full blur-3xl group-hover:bg-secondary/20 transition-all duration-500"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-white/5 backdrop-blur-md border border-secondary/20 rounded-lg shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                <span className="material-symbols-outlined text-secondary drop-shadow-[0_0_8px_rgba(78,222,163,0.5)]">mark_email_read</span>
              </div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant bg-white/5 backdrop-blur-md border border-white/10 px-2 py-1 rounded">
                THIS MONTH
              </span>
            </div>

            <h3 className="text-sm text-on-surface-variant mb-1 relative z-10">Sent Pending</h3>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-[32px] font-semibold text-on-background leading-tight drop-shadow-sm">
                {stats.sentPending}
              </span>
              <span className="text-xs text-secondary font-['JetBrains_Mono'] drop-shadow-[0_0_5px_rgba(78,222,163,0.5)] flex items-center">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span> 5%
              </span>
            </div>
          </div>

          {/* Metric 3 - Accepted Value */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-xl p-6 relative overflow-hidden group hover:shadow-[0_0_25px_rgba(255,222,164,0.1)] transition-all">
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-[#ffdea4]/10 rounded-full blur-3xl group-hover:bg-[#ffdea4]/20 transition-all duration-500"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-white/5 backdrop-blur-md border border-[#ffdea4]/20 rounded-lg shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                <span className="material-symbols-outlined text-[#ffdea4] drop-shadow-[0_0_8px_rgba(255,222,164,0.5)]" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
              </div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant bg-white/5 backdrop-blur-md border border-white/10 px-2 py-1 rounded">
                THIS MONTH
              </span>
            </div>

            <h3 className="text-sm text-on-surface-variant mb-1 relative z-10">Accepted Value</h3>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-[32px] font-semibold text-on-background leading-tight drop-shadow-sm">
                {formatCurrency(stats.acceptedValue).replace('.00', '')}k
              </span>
              <span className="text-xs text-secondary font-['JetBrains_Mono'] drop-shadow-[0_0_5px_rgba(78,222,163,0.5)] flex items-center">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span> 24%
              </span>
            </div>
          </div>
        </div>

        {/* Data Table Section */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-xl flex flex-col overflow-hidden shadow-lg">
          {/* Table Controls */}
          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded py-1.5 pl-9 pr-3 text-sm text-on-surface focus:border-[#4b8eff]/50 focus:ring-1 focus:ring-[#4b8eff]/50 outline-none transition-all placeholder-on-surface-variant/50 shadow-inner backdrop-blur-md"
                  placeholder="Search ID, Client..."
                />
              </div>
              <button className="p-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-on-surface-variant hover:text-on-surface transition-all flex items-center justify-center backdrop-blur-md">
                <span className="material-symbols-outlined text-sm">filter_list</span>
              </button>
            </div>

            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
              <button 
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-full font-['JetBrains_Mono'] text-xs whitespace-nowrap transition-all ${
                  filterStatus === 'all'
                    ? 'bg-[#4b8eff]/20 border border-[#4b8eff]/30 text-[#4b8eff] shadow-[0_0_10px_rgba(75,142,255,0.15)]'
                    : 'bg-white/5 hover:bg-white/10 text-on-surface-variant border border-white/10 backdrop-blur-md'
                }`}
              >
                All ({statusCounts.all})
              </button>
              <button 
                onClick={() => setFilterStatus('draft')}
                className={`px-3 py-1 rounded-full font-['JetBrains_Mono'] text-xs whitespace-nowrap transition-all ${
                  filterStatus === 'draft'
                    ? 'bg-[#4b8eff]/20 border border-[#4b8eff]/30 text-[#4b8eff] shadow-[0_0_10px_rgba(75,142,255,0.15)]'
                    : 'bg-white/5 hover:bg-white/10 text-on-surface-variant border border-white/10 backdrop-blur-md'
                }`}
              >
                Drafts ({statusCounts.draft})
              </button>
              <button 
                onClick={() => setFilterStatus('sent')}
                className={`px-3 py-1 rounded-full font-['JetBrains_Mono'] text-xs whitespace-nowrap transition-all flex items-center gap-1 ${
                  filterStatus === 'sent'
                    ? 'bg-[#4b8eff]/20 border border-[#4b8eff]/30 text-[#4b8eff] shadow-[0_0_10px_rgba(75,142,255,0.15)]'
                    : 'bg-white/5 hover:bg-white/10 text-on-surface-variant border border-white/10 backdrop-blur-md'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#4b8eff] shadow-[0_0_5px_rgba(75,142,255,0.8)]"></span>
                Sent ({statusCounts.sent})
              </button>
              <button 
                onClick={() => setFilterStatus('accepted')}
                className={`px-3 py-1 rounded-full font-['JetBrains_Mono'] text-xs whitespace-nowrap transition-all flex items-center gap-1 ${
                  filterStatus === 'accepted'
                    ? 'bg-[#4b8eff]/20 border border-[#4b8eff]/30 text-[#4b8eff] shadow-[0_0_10px_rgba(75,142,255,0.15)]'
                    : 'bg-white/5 hover:bg-white/10 text-on-surface-variant border border-white/10 backdrop-blur-md'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_5px_rgba(78,222,163,0.8)]"></span>
                Accepted ({statusCounts.accepted})
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">Quote ID</th>
                  <th className="p-4 text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">Client</th>
                  <th className="p-4 text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">Date</th>
                  <th className="p-4 text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">Amount</th>
                  <th className="p-4 text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">Status</th>
                  <th className="p-4 text-[11px] font-bold tracking-wider uppercase text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <span className="material-symbols-outlined text-6xl text-outline mb-4 block opacity-20">description</span>
                      <p className="text-on-surface-variant">No quotes found</p>
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((quote) => {
                    const clientName = quote.clients?.company_name || quote.to_client;
                    const total = calculateQuoteTotal(quote);
                    const isAccepted = quote.status === 'accepted';

                    return (
                      <tr 
                        key={quote.id}
                        className={`hover:bg-white/5 transition-colors group ${isAccepted ? 'bg-secondary/5 border-l-2 border-l-secondary' : ''}`}
                      >
                        <td className="p-4 font-['JetBrains_Mono'] text-xs text-on-background drop-shadow-sm relative z-10">
                          {quote.quote_number}
                        </td>
                        <td className="p-4 relative z-10">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded bg-white/5 backdrop-blur-md flex items-center justify-center font-bold text-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border ${
                              isAccepted ? 'border-secondary/20 text-secondary' : 'border-white/10 text-on-surface-variant'
                            }`}>
                              {getClientInitials(clientName)}
                            </div>
                            <div>
                              <div className="text-sm text-on-background font-medium drop-shadow-sm">
                                {clientName}
                              </div>
                              <div className="font-['JetBrains_Mono'] text-xs text-on-surface-variant">
                                {quote.status === 'accepted' ? 'Accepted' : 'Pending'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-['JetBrains_Mono'] text-xs text-on-surface-variant relative z-10">
                          {formatDate(quote.created_at)}
                        </td>
                        <td className="p-4 font-['JetBrains_Mono'] text-xs text-on-background font-medium drop-shadow-sm relative z-10">
                          {formatCurrency(total)}
                        </td>
                        <td className="p-4 relative z-10">
                          {getStatusBadge(quote.status)}
                        </td>
                        <td className="p-4 text-right relative z-10">
                          <Link
                            to={`/quote/${quote.id}`}
                            className="text-on-surface-variant hover:text-on-surface opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white/5 hover:bg-white/10 rounded inline-flex backdrop-blur-md border border-white/10"
                          >
                            <span className="material-symbols-outlined text-sm">more_vert</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between bg-white/5">
            <span className="font-['JetBrains_Mono'] text-xs text-on-surface-variant">
              Showing 1 to {Math.min(filteredQuotes.length, 10)} of {filteredQuotes.length} entries
            </span>
            <div className="flex gap-1">
              <button className="p-1 rounded bg-white/5 text-on-surface-variant opacity-50 cursor-not-allowed backdrop-blur-md border border-white/10">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button className="p-1 px-3 rounded bg-[#4b8eff]/20 border border-[#4b8eff]/30 text-[#4b8eff] font-['JetBrains_Mono'] text-xs shadow-[0_0_10px_rgba(75,142,255,0.15)]">
                1
              </button>
              <button className="p-1 px-3 rounded bg-white/5 hover:bg-white/10 text-on-surface font-['JetBrains_Mono'] text-xs transition-colors backdrop-blur-md border border-white/10">
                2
              </button>
              <button className="p-1 px-3 rounded bg-white/5 hover:bg-white/10 text-on-surface font-['JetBrains_Mono'] text-xs transition-colors backdrop-blur-md border border-white/10">
                3
              </button>
              <button className="p-1 rounded bg-white/5 hover:bg-white/10 text-on-surface transition-colors backdrop-blur-md border border-white/10">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default QuoteListModern;
