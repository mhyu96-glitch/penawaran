import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { 
  PlusCircle, Eye, Pencil, Trash2, Receipt, MoreVertical, Copy,
  Search, Filter, CheckCircle, AlertTriangle, Clock, X
} from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { safeFormat, formatCurrency, calculateSubtotal, calculateTotal, isDateBeforeToday } from '@/lib/utils';
import { differenceInDays } from 'date-fns';

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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Invoice = {
  id: string;
  invoice_number: string;
  to_client: string;
  invoice_date: string;
  due_date: string;
  created_at: string;
  status: string;
  invoice_items: { quantity: number; unit_price: number; }[];
  discount_amount: number;
  tax_amount: number;
};

const InvoiceListGlass = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  
  // Payment Dialog
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; invoice: Invoice | null }>({ 
    open: false, 
    invoice: null 
  });
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'created_at',
    direction: 'desc'
  });

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, to_client, invoice_date, due_date, created_at, status, invoice_items(quantity, unit_price), discount_amount, tax_amount')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invoices:', error);
        showError(`Gagal memuat faktur: ${error.message}`);
      } else {
        setInvoices(data as Invoice[]);
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      showError('Terjadi kesalahan saat memuat data');
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    
    const { error } = await supabase
      .from('invoices')
      .delete()
      .match({ id: invoiceToDelete });

    if (error) {
      showError('Gagal menghapus faktur.');
    } else {
      showSuccess('Faktur berhasil dihapus.');
      setInvoices(invoices.filter(i => i.id !== invoiceToDelete));
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handlePaymentComplete = async () => {
    if (!paymentDialog.invoice || !user) return;
    
    const invoice = paymentDialog.invoice;
    
    try {
      // Update status to "Lunas"
      const { error: statusError } = await supabase
        .from('invoices')
        .update({ status: 'Lunas' })
        .eq('id', invoice.id);

      if (statusError) {
        showError('Gagal mengubah status faktur.');
        return;
      }

      // Calculate total
      const subtotal = calculateSubtotal(invoice.invoice_items);
      const total = calculateTotal(subtotal, invoice.discount_amount, invoice.tax_amount);

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoice.id,
          user_id: user.id,
          payment_date: new Date().toISOString(),
          payment_method: 'Pelunasan Manual',
          amount: total,
          status: 'Lunas',
          notes: 'Pembayaran pelunasan manual'
        });

      if (paymentError) {
        console.error('Payment record error:', paymentError);
      }

      // Update local state
      setInvoices(invoices.map(inv => 
        inv.id === invoice.id ? { ...inv, status: 'Lunas' } : inv
      ));

      showSuccess('Faktur berhasil ditandai sebagai lunas!');
      setPaymentDialog({ open: false, invoice: null });
    } catch (error) {
      console.error('Payment completion error:', error);
      showError('Terjadi kesalahan saat memproses pelunasan.');
    }
  };

  const handleDuplicate = async (invoice: Invoice) => {
    if (!user) return;

    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('id', invoice.id)
        .single();

      if (invoiceError || !invoiceData) {
        showError('Gagal memuat data faktur.');
        return;
      }

      // Generate new invoice number
      const year = new Date().getFullYear();
      const { data: latestInvoices } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('user_id', user.id)
        .like('invoice_number', `INV-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (latestInvoices && latestInvoices.length > 0 && latestInvoices[0]?.invoice_number) {
        const lastNumber = latestInvoices[0].invoice_number.split('-').pop();
        if (lastNumber && !Number.isNaN(Number.parseInt(lastNumber, 10))) {
          nextNumber = Number.parseInt(lastNumber, 10) + 1;
        }
      }

      const newInvoicePayload = {
        ...invoiceData,
        id: undefined,
        invoice_number: `INV-${year}-${String(nextNumber).padStart(3, '0')}`,
        invoice_date: new Date().toISOString(),
        status: 'Draft',
        created_at: undefined,
        updated_at: undefined,
      };

      const { data: newInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert(newInvoicePayload)
        .select('id')
        .single();

      if (insertError || !newInvoice) {
        showError('Gagal menduplikasi faktur.');
        return;
      }

      if (invoiceData.invoice_items && invoiceData.invoice_items.length > 0) {
        const newItems = invoiceData.invoice_items.map(({ id, invoice_id, created_at, ...item }) => ({
          ...item,
          invoice_id: newInvoice.id,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(newItems);

        if (itemsError) {
          showError('Gagal menyalin item.');
          await supabase.from('invoices').delete().match({ id: newInvoice.id });
          return;
        }
      }

      showSuccess('Faktur berhasil diduplikasi.');
      navigate(`/invoice-glass/edit/${newInvoice.id}`);
    } catch (error) {
      showError('Terjadi kesalahan saat menduplikasi.');
    }
  };

  // Overdue invoices
  const overdueInvoices = useMemo(() => {
    return invoices.filter(inv => 
      inv.status !== 'Lunas' && 
      inv.due_date && 
      isDateBeforeToday(inv.due_date)
    ).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [invoices]);

  // Filter & Sort
  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(i => 
        i.invoice_number.toLowerCase().includes(term) ||
        i.to_client.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(i => statusFilter.includes(i.status));
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
  }, [invoices, searchTerm, statusFilter, sortConfig]);

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

  // Overdue Columns
  const overdueColumns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      label: 'Nomor Faktur',
      render: (value, invoice) => (
        <Link 
          to={`/invoice/${invoice.id}`}
          className="font-mono text-glass-accent-error hover:text-glass-accent-error/80 transition-colors"
        >
          {value}
        </Link>
      ),
    },
    {
      key: 'to_client',
      label: 'Klien',
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (_, invoice) => {
        const subtotal = calculateSubtotal(invoice.invoice_items);
        const total = calculateTotal(subtotal, invoice.discount_amount, invoice.tax_amount);
        return (
          <span className="font-mono font-semibold text-glass-text-primary">
            {formatCurrency(total)}
          </span>
        );
      },
    },
    {
      key: 'due_date',
      label: 'Jatuh Tempo',
      render: (value) => {
        const daysOverdue = differenceInDays(new Date(), new Date(value));
        return (
          <div className="flex flex-col">
            <span className="text-glass-text-tertiary text-xs">
              {safeFormat(value, 'dd MMM yyyy')}
            </span>
            <span className="text-glass-accent-error text-xs font-semibold">
              {daysOverdue} hari terlambat
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, invoice) => (
        <GlassButton
          variant="primary"
          size="sm"
          icon={<CheckCircle className="h-4 w-4" />}
          onClick={() => setPaymentDialog({ open: true, invoice })}
          className="bg-glass-accent-secondary hover:bg-glass-accent-secondary/80"
        >
          Pelunasan
        </GlassButton>
      ),
    },
  ];

  // Regular Columns
  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      label: 'Nomor Faktur',
      sortable: true,
      render: (value, invoice) => (
        <Link 
          to={`/invoice/${invoice.id}`}
          className="font-mono text-glass-accent-primary hover:text-glass-accent-secondary transition-colors"
        >
          {value}
        </Link>
      ),
    },
    {
      key: 'invoice_date',
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
      render: (_, invoice) => {
        const subtotal = calculateSubtotal(invoice.invoice_items);
        const total = calculateTotal(subtotal, invoice.discount_amount, invoice.tax_amount);
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
      key: 'due_date',
      label: 'Jatuh Tempo',
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
      render: (_, invoice) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-glass-sm bg-glass-bg-light hover:bg-glass-bg-medium transition-colors">
              <MoreVertical className="h-4 w-4 text-glass-text-secondary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-medium backdrop-blur-lg border-glass-border-DEFAULT">
            <DropdownMenuItem onClick={() => navigate(`/invoice-glass/${invoice.id}`)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/invoice-glass/edit/${invoice.id}`)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDuplicate(invoice)}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            {invoice.status !== 'Lunas' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setPaymentDialog({ open: true, invoice })}
                  className="text-glass-accent-secondary focus:text-glass-accent-secondary"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Pelunasan
                </DropdownMenuItem>
              </>
            )}
            {invoice.status === 'Draft' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    setInvoiceToDelete(invoice.id);
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
            Faktur
          </h1>
          <p className="text-sm text-glass-text-secondary">
            Kelola faktur dan track pembayaran
          </p>
        </div>
        
        <Link to="/invoice-glass/new">
          <GlassButton 
            variant="primary" 
            size="lg"
            icon={<PlusCircle className="h-5 w-5" />}
            glowing
          >
            Buat Faktur
          </GlassButton>
        </Link>
      </div>

      {/* Overdue Section */}
      {overdueInvoices.length > 0 && (
        <GlassCard 
          variant="light" 
          padding="lg"
          rounded="xl"
          className="border-glass-accent-error/30 animate-pulse-slow"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-glass-md bg-glass-accent-error/20 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-glass-accent-error" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-glass-text-primary mb-1">
                Faktur Jatuh Tempo
              </h3>
              <p className="text-sm text-glass-text-secondary">
                {overdueInvoices.length} faktur melewati batas waktu pembayaran. Segera follow up!
              </p>
            </div>
          </div>
          
          <GlassTable
            columns={overdueColumns}
            data={overdueInvoices}
            keyExtractor={(invoice) => invoice.id}
            hoverable
            compact
          />
        </GlassCard>
      )}

      {/* Filters */}
      <GlassCard variant="medium" padding="md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <GlassInput
              placeholder="Cari nomor faktur atau klien..."
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
              {['Draft', 'Terkirim', 'Lunas'].map(status => (
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
            Total Faktur
          </div>
          <div className="text-2xl font-bold text-glass-text-primary">
            {invoices.length}
          </div>
        </GlassCard>

        <GlassCard variant="light" padding="md" hoverable>
          <div className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary mb-2">
            Draft
          </div>
          <div className="text-2xl font-bold text-glass-text-primary">
            {invoices.filter(i => i.status === 'Draft').length}
          </div>
        </GlassCard>

        <GlassCard variant="light" padding="md" hoverable>
          <div className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary mb-2">
            Belum Dibayar
          </div>
          <div className="text-2xl font-bold text-glass-accent-warning">
            {invoices.filter(i => i.status === 'Terkirim').length}
          </div>
        </GlassCard>

        <GlassCard variant="light" padding="md" hoverable>
          <div className="text-xs font-semibold uppercase tracking-wider text-glass-text-secondary mb-2">
            Overdue
          </div>
          <div className="text-2xl font-bold text-glass-accent-error">
            {overdueInvoices.length}
          </div>
        </GlassCard>
      </div>

      {/* Table */}
      {loading ? (
        <GlassTableSkeleton rows={10} />
      ) : (
        <GlassTable
          columns={columns}
          data={filteredAndSortedInvoices}
          keyExtractor={(invoice) => invoice.id}
          sortable
          sortConfig={sortConfig}
          onSort={handleSort}
          hoverable
          emptyMessage="Belum ada faktur. Buat faktur pertama Anda!"
        />
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog({ open: false, invoice: null })}>
        <DialogContent className="glass-heavy backdrop-blur-lg border-glass-border-DEFAULT">
          <DialogHeader>
            <DialogTitle className="text-glass-text-primary">
              Konfirmasi Pelunasan
            </DialogTitle>
            <DialogDescription className="text-glass-text-secondary">
              Tandai faktur {paymentDialog.invoice?.invoice_number} sebagai lunas?
            </DialogDescription>
          </DialogHeader>
          
          {paymentDialog.invoice && (
            <div className="py-4">
              <GlassCard variant="light" padding="md">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-glass-text-secondary">Klien:</span>
                    <span className="text-glass-text-primary font-medium">{paymentDialog.invoice.to_client}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-glass-text-secondary">Total:</span>
                    <span className="text-glass-text-primary font-mono font-bold">
                      {formatCurrency(
                        calculateTotal(
                          calculateSubtotal(paymentDialog.invoice.invoice_items),
                          paymentDialog.invoice.discount_amount,
                          paymentDialog.invoice.tax_amount
                        )
                      )}
                    </span>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
          
          <DialogFooter>
            <GlassButton
              variant="glass"
              onClick={() => setPaymentDialog({ open: false, invoice: null })}
            >
              Batal
            </GlassButton>
            <GlassButton
              variant="primary"
              icon={<CheckCircle className="h-4 w-4" />}
              onClick={handlePaymentComplete}
              className="bg-glass-accent-secondary hover:bg-glass-accent-secondary/80"
            >
              Konfirmasi Pelunasan
            </GlassButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-heavy backdrop-blur-lg border-glass-border-DEFAULT">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-glass-text-primary">
              Hapus Faktur?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-glass-text-secondary">
              Aksi ini tidak dapat dibatalkan. Faktur akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass-button">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteInvoice}
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

export default InvoiceListGlass;
