import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { 
  PlusCircle, Eye, Pencil, Trash2, Copy, Receipt, MoreVertical, 
  Search, Filter, FileText, X 
} from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { safeFormat, formatCurrency, calculateSubtotal, calculateTotal } from '@/lib/utils';

// Glass Components
import { 
  GlassCard, 
  GlassButton, 
  GlassBadge, 
  GlassInput,
  GlassTable,
  GlassTableSkeleton,
  getBadgeVariant,
  getStatusLabel,
  Column
} from '@/components/glass';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Quote = {
  id: string;
  quote_number: string;
  to_client: string;
  quote_date: string;
  valid_until: string;
  created_at: string;
  status: string;
  quote_items: { quantity: number; unit_price: number; }[];
  discount_amount: number;
  tax_amount: number;
};

const QuoteListGlass = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'created_at',
    direction: 'desc'
  });

  const fetchQuotes = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, to_client, quote_date, valid_until, created_at, status, quote_items(quantity, unit_price), discount_amount, tax_amount')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotes:', error);
        showError(`Gagal memuat penawaran: ${error.message}`);
      } else {
        setQuotes(data as Quote[]);
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      showError('Terjadi kesalahan saat memuat data');
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, [user]);

  const handleStatusChange = async (quoteId: string, status: string) => {
    const { error } = await supabase
      .from('quotes')
      .update({ status })
      .eq('id', quoteId);

    if (error) {
      showError('Gagal memperbarui status.');
    } else {
      showSuccess('Status berhasil diperbarui.');
      setQuotes(quotes.map(q => q.id === quoteId ? { ...q, status } : q));
    }
  };

  const handleDeleteQuote = async () => {
    if (!quoteToDelete) return;
    
    const { error } = await supabase
      .from('quotes')
      .delete()
      .match({ id: quoteToDelete });

    if (error) {
      showError('Gagal menghapus penawaran.');
    } else {
      showSuccess('Penawaran berhasil dihapus.');
      setQuotes(quotes.filter(q => q.id !== quoteToDelete));
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    }
  };

  const handleDuplicate = async (quote: Quote) => {
    if (!user) return;

    try {
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', quote.id)
        .single();

      if (quoteError || !quoteData) {
        showError('Gagal memuat data penawaran.');
        return;
      }

      // Generate new quote number
      const year = new Date().getFullYear();
      const { data: latestQuotes } = await supabase
        .from('quotes')
        .select('quote_number')
        .eq('user_id', user.id)
        .like('quote_number', `QT-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (latestQuotes && latestQuotes.length > 0 && latestQuotes[0].quote_number) {
        const lastNumber = latestQuotes[0].quote_number.split('-').pop();
        if (lastNumber && !Number.isNaN(Number.parseInt(lastNumber, 10))) {
          nextNumber = Number.parseInt(lastNumber, 10) + 1;
        }
      }

      const newQuotePayload = {
        ...quoteData,
        id: undefined,
        quote_number: `QT-${year}-${String(nextNumber).padStart(3, '0')}`,
        quote_date: new Date().toISOString(),
        status: 'Draft',
        created_at: undefined,
        updated_at: undefined,
      };

      const { data: newQuote, error: insertError } = await supabase
        .from('quotes')
        .insert(newQuotePayload)
        .select('id')
        .single();

      if (insertError || !newQuote) {
        showError('Gagal menduplikasi penawaran.');
        return;
      }

      if (quoteData.quote_items && quoteData.quote_items.length > 0) {
        const newItems = quoteData.quote_items.map(({ id, quote_id, created_at, ...item }) => ({
          ...item,
          quote_id: newQuote.id,
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(newItems);

        if (itemsError) {
          showError('Gagal menyalin item.');
          await supabase.from('quotes').delete().match({ id: newQuote.id });
          return;
        }
      }

      showSuccess('Penawaran berhasil diduplikasi.');
      navigate(`/quote-glass/edit/${newQuote.id}`);
    } catch (error) {
      showError('Terjadi kesalahan saat menduplikasi.');
    }
  };

  const handleCreateInvoice = async (quote: Quote) => {
    if (!user) return;

    try {
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', quote.id)
        .single();

      if (quoteError || !quoteData) {
        showError('Gagal memuat data penawaran.');
        return;
      }

      const year = new Date().getFullYear();
      const { data: latestInvoices } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('user_id', user.id)
        .like('invoice_number', `INV-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (latestInvoices && latestInvoices.length > 0 && latestInvoices[0].invoice_number) {
        const lastNumber = latestInvoices[0].invoice_number.split('-').pop();
        if (lastNumber && !Number.isNaN(Number.parseInt(lastNumber, 10))) {
          nextNumber = Number.parseInt(lastNumber, 10) + 1;
        }
      }

      const newInvoicePayload = {
        user_id: user.id,
        quote_id: quoteData.id,
        client_id: quoteData.client_id,
        to_client: quoteData.to_client,
        to_address: quoteData.to_address,
        to_phone: quoteData.to_phone,
        discount_amount: quoteData.discount_amount,
        tax_amount: quoteData.tax_amount,
        terms: quoteData.terms,
        status: 'Draft',
        invoice_number: `INV-${year}-${String(nextNumber).padStart(3, '0')}`,
        invoice_date: new Date().toISOString(),
        due_date: quoteData.valid_until || null,
      };

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(newInvoicePayload)
        .select('id')
        .single();

      if (invoiceError || !newInvoice) {
        showError('Gagal membuat faktur.');
        return;
      }

      if (quoteData.quote_items && quoteData.quote_items.length > 0) {
        const newInvoiceItems = quoteData.quote_items.map(({ id, quote_id, created_at, ...item }) => ({
          ...item,
          invoice_id: newInvoice.id,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(newInvoiceItems);

        if (itemsError) {
          showError('Gagal menyalin item ke faktur.');
          await supabase.from('invoices').delete().match({ id: newInvoice.id });
          return;
        }
      }

      showSuccess('Faktur berhasil dibuat.');
      navigate(`/invoice-glass/edit/${newInvoice.id}`);
    } catch (error) {
      showError('Terjadi kesalahan saat membuat faktur.');
    }
  };

  // Filter & Sort
  const filteredAndSortedQuotes = useMemo(() => {
    let filtered = quotes;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(q => 
        q.quote_number.toLowerCase().includes(term) ||
        q.to_client.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(q => statusFilter.includes(q.status));
    }

    // Sort
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = (a as any)[sortConfig.key];
        const bValue = (b as any)[sortConfig.key];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [quotes, searchTerm, statusFilter, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Table Columns
  const columns: Column<Quote>[] = [
    {
      key: 'quote_number',
      label: 'Nomor Penawaran',
      sortable: true,
      render: (value, quote) => (
        <Link 
          to={`/quote/${quote.id}`}
          className="font-mono text-glass-accent-primary hover:text-glass-accent-secondary transition-colors"
        >
          {value}
        </Link>
      ),
    },
    {
      key: 'quote_date',
      label: 'Tanggal',
      sortable: true,
      render: (value) => (
        <span className="text-glass-text-secondary">
          {safeFormat(value, 'dd MMM yyyy')}
        </span>
      ),
    },
    {
      key: 'to_client',
      label: 'Klien',
      sortable: true,
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (_, quote) => {
        const subtotal = calculateSubtotal(quote.quote_items);
        const total = calculateTotal(subtotal, quote.discount_amount, quote.tax_amount);
        return (
          <span className="font-mono font-semibold text-glass-text-primary">
            {formatCurrency(total)}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (value) => (
        <GlassBadge variant={getBadgeVariant(value)}>
          {getStatusLabel(value)}
        </GlassBadge>
      ),
    },
    {
      key: 'valid_until',
      label: 'Valid Until',
      sortable: true,
      render: (value) => (
        <span className="text-glass-text-tertiary text-xs">
          {safeFormat(value, 'dd MMM yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, quote) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-glass-sm bg-glass-bg-light hover:bg-glass-bg-medium transition-colors">
              <MoreVertical className="h-4 w-4 text-glass-text-secondary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-medium backdrop-blur-lg border-glass-border-DEFAULT">
            <DropdownMenuItem onClick={() => navigate(`/quote-glass/${quote.id}`)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/quote-glass/edit/${quote.id}`)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDuplicate(quote)}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            {(quote.status === 'Diterima' || quote.status === 'Terkirim') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleCreateInvoice(quote)}>
                  <Receipt className="h-4 w-4 mr-2" />
                  Buat Faktur
                </DropdownMenuItem>
              </>
            )}
            {quote.status === 'Draft' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    setQuoteToDelete(quote.id);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-glass-accent-error focus:text-glass-accent-error"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-glass-text-primary mb-2">
            Penawaran
          </h1>
          <p className="text-sm text-glass-text-secondary">
            Kelola semua penawaran dan convert ke faktur
          </p>
        </div>
        
        <Link to="/quote-glass/new">
          <GlassButton 
            variant="primary" 
            size="lg"
            icon={<PlusCircle className="h-5 w-5" />}
            glowing
          >
            Buat Penawaran
          </GlassButton>
        </Link>
      </div>

      {/* Filters */}
      <GlassCard variant="medium" padding="md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <GlassInput
              placeholder="Cari nomor penawaran atau klien..."
              prefix={<Search className="h-4 w-4" />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              inputSize="md"
            />
          </div>

          {/* Filter Toggle */}
          <GlassButton
            variant="glass"
            size="md"
            icon={<Filter className="h-4 w-4" />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filter ({statusFilter.length})
          </GlassButton>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-glass-border-DEFAULT">
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary mr-2">
                Status:
              </span>
              {['Draft', 'Terkirim', 'Diterima', 'Ditolak'].map(status => (
                <button
                  key={status}
                  onClick={() => toggleStatusFilter(status)}
                  className={`px-3 py-1 rounded-glass-sm text-xs font-medium transition-all ${
                    statusFilter.includes(status)
                      ? 'bg-glass-accent-primary/20 text-glass-accent-primary border border-glass-accent-primary/50'
                      : 'bg-glass-bg-light text-glass-text-secondary border border-glass-border-DEFAULT hover:bg-glass-bg-medium'
                  }`}
                >
                  {status}
                </button>
              ))}
              {statusFilter.length > 0 && (
                <button
                  onClick={() => setStatusFilter([])}
                  className="px-3 py-1 rounded-glass-sm text-xs font-medium text-glass-accent-error hover:bg-glass-accent-error/10 transition-colors flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <GlassCard variant="light" padding="md" hoverable>
          <div className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary mb-2">
            Total Penawaran
          </div>
          <div className="text-2xl font-bold text-glass-text-primary">
            {quotes.length}
          </div>
        </GlassCard>

        <GlassCard variant="light" padding="md" hoverable>
          <div className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary mb-2">
            Draft
          </div>
          <div className="text-2xl font-bold text-glass-text-primary">
            {quotes.filter(q => q.status === 'Draft').length}
          </div>
        </GlassCard>

        <GlassCard variant="light" padding="md" hoverable>
          <div className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary mb-2">
            Terkirim
          </div>
          <div className="text-2xl font-bold text-glass-text-primary">
            {quotes.filter(q => q.status === 'Terkirim').length}
          </div>
        </GlassCard>

        <GlassCard variant="light" padding="md" hoverable>
          <div className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary mb-2">
            Diterima
          </div>
          <div className="text-2xl font-bold text-glass-accent-secondary">
            {quotes.filter(q => q.status === 'Diterima').length}
          </div>
        </GlassCard>
      </div>

      {/* Table */}
      {loading ? (
        <GlassTableSkeleton rows={10} />
      ) : (
        <GlassTable
          columns={columns}
          data={filteredAndSortedQuotes}
          keyExtractor={(quote) => quote.id}
          sortable
          sortConfig={sortConfig}
          onSort={handleSort}
          hoverable
          emptyMessage="Belum ada penawaran. Buat penawaran pertama Anda!"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-heavy backdrop-blur-lg border-glass-border-DEFAULT">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-glass-text-primary">
              Hapus Penawaran?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-glass-text-secondary">
              Aksi ini tidak dapat dibatalkan. Penawaran akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass-button">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteQuote}
              className="bg-glass-accent-error hover:bg-glass-accent-error/80 text-white"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QuoteListGlass;
