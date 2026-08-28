import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, Calendar as CalendarIcon, Printer, 
  CheckCircle2, AlertCircle, 
  ArrowLeft, Send, Landmark, Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  formatCurrency, safeFormat, calculateSubtotal, calculateTotal, cn 
} from '@/lib/utils';
import { generatePdf } from '@/utils/pdfGenerator';
import { showError, showSuccess } from '@/utils/toast';
import { 
  startOfMonth, endOfMonth, subMonths, 
  isWithinInterval, parseISO 
} from 'date-fns';

type Client = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

type InvoiceItem = {
  quantity: number;
  unit_price: number;
};

type Invoice = {
  id: string;
  invoice_number: string;
  created_at: string;
  due_date: string | null;
  status: string;
  title?: string | null;
  client_id?: string | null;
  to_client: string;
  discount_amount: number;
  tax_amount: number;
  down_payment_amount?: number;
  terms?: string | null;
  invoice_items?: InvoiceItem[];
};

type Payment = {
  id: string;
  invoice_id: string;
  amount_paid?: number;
  amount?: number;
  payment_date: string;
  payment_method: string;
  status: string;
  notes?: string | null;
};

type ProfileInfo = {
  company_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  company_logo_url: string | null;
  custom_footer: string | null;
};

const PartnerStatementReport = () => {
  const { clientId } = useParams<{ clientId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const statementRef = useRef<HTMLDivElement>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(clientId || '');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [periodFilter, setPeriodFilter] = useState<'this_month' | 'last_month' | 'last_3_months' | 'all'>('this_month');

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user) return;
      setLoading(true);

      const [clientsRes, profileRes] = await Promise.all([
        supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      ]);

      if (clientsRes.data) {
        setClients(clientsRes.data);
        if (!selectedClientId && clientsRes.data.length > 0) {
          const storeClient = clientsRes.data.find(c => (c.notes || '').includes('[CLIENT_TYPE:partner_store]'));
          setSelectedClientId(storeClient ? storeClient.id : clientsRes.data[0].id);
        }
      }

      if (profileRes.data) {
        setProfile(profileRes.data as ProfileInfo);
      }

      setLoading(false);
    };

    fetchInitialData();
  }, [user]);

  useEffect(() => {
    const fetchClientDocuments = async () => {
      if (!user || !selectedClientId) return;

      const currentClient = clients.find(c => c.id === selectedClientId);
      const clientName = currentClient?.name;

      let invoiceQuery = supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('user_id', user.id);

      if (clientName) {
        invoiceQuery = invoiceQuery.or(`client_id.eq.${selectedClientId},to_client.eq.${clientName}`);
      } else {
        invoiceQuery = invoiceQuery.eq('client_id', selectedClientId);
      }

      const { data: invData } = await invoiceQuery.order('created_at', { ascending: false });
      const loadedInvoices = (invData || []) as Invoice[];
      setInvoices(loadedInvoices);

      const invoiceIds = loadedInvoices.map(i => i.id);
      if (invoiceIds.length > 0) {
        const { data: payData } = await supabase
          .from('payments')
          .select('*')
          .in('invoice_id', invoiceIds);
        setPayments((payData || []) as Payment[]);
      } else {
        setPayments([]);
      }
    };

    fetchClientDocuments();
  }, [user, selectedClientId, clients]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  const filteredInvoices = useMemo(() => {
    if (periodFilter === 'all') return invoices;

    const now = new Date();
    let start: Date;
    let end: Date;

    if (periodFilter === 'this_month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (periodFilter === 'last_month') {
      const lastMonth = subMonths(now, 1);
      start = startOfMonth(lastMonth);
      end = endOfMonth(lastMonth);
    } else {
      start = startOfMonth(subMonths(now, 2));
      end = endOfMonth(now);
    }

    return invoices.filter(inv => {
      try {
        const invDate = parseISO(inv.created_at);
        return isWithinInterval(invDate, { start, end });
      } catch {
        return true;
      }
    });
  }, [invoices, periodFilter]);

  const statementRows = useMemo(() => {
    return filteredInvoices.map((inv) => {
      const items = inv.invoice_items || [];
      const subtotal = calculateSubtotal(items);
      const totalAmount = calculateTotal(subtotal, inv.discount_amount || 0, inv.tax_amount || 0);

      const invPayments = payments.filter(p => p.invoice_id === inv.id && (p.status === 'confirmed' || p.status === 'completed' || !p.status));
      const totalPaid = invPayments.reduce((sum, p) => sum + (p.amount_paid || p.amount || 0), 0);

      const balanceRemaining = Math.max(0, totalAmount - totalPaid);
      const isPaidOff = totalPaid >= totalAmount && totalAmount > 0;
      const isPartiallyPaid = totalPaid > 0 && totalPaid < totalAmount;

      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        date: inv.created_at,
        dueDate: inv.due_date,
        title: inv.title || 'Pekerjaan Jasa Instalasi / Proyek Toko',
        totalAmount,
        totalPaid,
        balanceRemaining,
        status: isPaidOff ? 'Lunas' : isPartiallyPaid ? 'DP / Sebagian' : (inv.status === 'paid' ? 'Lunas' : 'Belum Lunas')
      };
    });
  }, [filteredInvoices, payments]);

  const summary = useMemo(() => {
    const totalBilled = statementRows.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalPaid = statementRows.reduce((sum, r) => sum + r.totalPaid, 0);
    const totalOutstanding = statementRows.reduce((sum, r) => sum + r.balanceRemaining, 0);
    const totalProjects = statementRows.length;
    const paidProjects = statementRows.filter(r => r.status === 'Lunas').length;

    return {
      totalBilled,
      totalPaid,
      totalOutstanding,
      totalProjects,
      paidProjects,
    };
  }, [statementRows]);

  const handleShareWhatsApp = () => {
    if (!selectedClient) return;

    const periodLabel = periodFilter === 'this_month' ? 'Bulan Ini' : periodFilter === 'last_month' ? 'Bulan Lalu' : periodFilter === 'last_3_months' ? '3 Bulan Terakhir' : 'Semua Periode';
    
    let message = `*REKAP TAGIHAN JASA & PEKERJAAN PROYEK*\n`;
    message += `Kepada Yth: *${selectedClient.name}*\n`;
    message += `Periode: *${periodLabel}*\n\n`;
    message += `Halo, berikut rincian rekap tagihan pekerjaan jasa yang telah selesai kami kerjakan:\n\n`;

    statementRows.forEach((r, idx) => {
      message += `${idx + 1}. *${r.invoiceNumber}* (${safeFormat(r.date, 'd MMM yyyy')})\n`;
      message += `   📍 ${r.title}\n`;
      message += `   Tagihan: ${formatCurrency(r.totalAmount)}\n`;
      message += `   Status: ${r.status} ${r.balanceRemaining > 0 ? `(Sisa: ${formatCurrency(r.balanceRemaining)})` : '✅'}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 *RINGKASAN REKAP:*\n`;
    message += `• Total Nilai Tagihan: *${formatCurrency(summary.totalBilled)}*\n`;
    message += `• Sudah Dibayar: *${formatCurrency(summary.totalPaid)}*\n`;
    message += `• *SISA YANG HARUS DIBAYAR: ${formatCurrency(summary.totalOutstanding)}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (profile?.bank_name && profile?.bank_account_number) {
      message += `💳 *Rekening Pembayaran:*\n`;
      message += `Bank: ${profile.bank_name}\n`;
      message += `No. Rekening: *${profile.bank_account_number}*\n`;
      message += `Atas Nama: *${profile.bank_account_name || profile.company_name}*\n\n`;
    }

    message += `Mohon konfirmasinya jika tagihan telah diproses. Terima kasih atas kerja samanya! 🙏`;

    const phone = selectedClient.phone ? selectedClient.phone.replace(/[^0-9]/g, '') : '';
    const formattedPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    const url = formattedPhone 
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  const handlePrintPDF = async () => {
    if (!statementRef.current || !selectedClient) return;
    setIsGeneratingPDF(true);
    try {
      await generatePdf(statementRef.current, `Rekap_Tagihan_${selectedClient.name.replace(/\s+/g, '_')}_${safeFormat(new Date().toISOString(), 'yyyyMMdd')}`);
      showSuccess('Dokumen Rekap Tagihan berhasil diunduh!');
    } catch (err) {
      console.error('PDF error:', err);
      showError('Gagal mencetak dokumen PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-12 w-64 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 sm:py-8 px-3 sm:px-6 space-y-6">
      {/* Top Header Controls (No-Print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden no-pdf">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="h-8 px-2 rounded-xl text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Kembali ke Klien
            </Button>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Rekap Tagihan & Rekening Koran Mitra Toko
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Laporan rekapitulasi gabungan seluruh faktur dan proyek jasa untuk mitra / toko pemberi kerja.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShareWhatsApp}
            className="h-10 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold text-xs gap-1.5"
          >
            <Send className="h-4 w-4 text-emerald-500" /> Kirim Rekap WA
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePrintPDF}
            disabled={isGeneratingPDF}
            className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-sm gap-1.5"
          >
            <Printer className="h-4 w-4" /> {isGeneratingPDF ? 'Mencetak...' : 'Cetak Rekap PDF'}
          </Button>
        </div>
      </div>

      {/* Filter Bar (No-Print) */}
      <Card className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs print:hidden no-pdf">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
          {/* Client / Store Selector */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Pilih Mitra / Toko:
            </span>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background">
                <SelectValue placeholder="Pilih Toko / Partner" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => {
                  const isStore = (c.notes || '').includes('[CLIENT_TYPE:partner_store]');
                  return (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {isStore ? '🏢 ' : '👤 '} {c.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Period Filter */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Periode Bulan:
            </span>
            <Select value={periodFilter} onValueChange={(val: any) => setPeriodFilter(val)}>
              <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background">
                <SelectValue placeholder="Pilih Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month" className="text-xs">📅 Bulan Ini ({safeFormat(new Date().toISOString(), 'MMMM yyyy')})</SelectItem>
                <SelectItem value="last_month" className="text-xs">📅 Bulan Lalu ({safeFormat(subMonths(new Date(), 1).toISOString(), 'MMMM yyyy')})</SelectItem>
                <SelectItem value="last_3_months" className="text-xs">📅 3 Bulan Terakhir</SelectItem>
                <SelectItem value="all" className="text-xs">🌐 Semua Riwayat Proyek</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Info */}
          <div className="sm:col-span-2 lg:col-span-1 rounded-2xl bg-muted/30 border border-border/60 p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total Proyek Periode Ini</span>
              <span className="text-sm font-black text-foreground">{summary.totalProjects} Proyek / Titik</span>
            </div>
            <Badge variant="outline" className="rounded-xl px-2.5 py-1 text-xs font-bold bg-primary/10 border-primary/20 text-primary">
              {summary.paidProjects} / {summary.totalProjects} Lunas
            </Badge>
          </div>
        </div>
      </Card>

      {/* KPI Cards (No-Print) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 print:hidden no-pdf">
        {/* Total Billed */}
        <Card className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Nilai Tagihan</span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-foreground mt-2 tabular-nums">
            {formatCurrency(summary.totalBilled)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Dari {summary.totalProjects} faktur/pekerjaan jasa
          </p>
        </Card>

        {/* Total Paid */}
        <Card className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sudah Diterima</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {formatCurrency(summary.totalPaid)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Pembayaran DP & Pelunasan masuk
          </p>
        </Card>

        {/* Total Outstanding */}
        <Card className={cn(
          "rounded-3xl border p-4 sm:p-5 shadow-2xs",
          summary.totalOutstanding > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border/80 bg-card"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sisa Piutang Toko</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {formatCurrency(summary.totalOutstanding)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {summary.totalOutstanding === 0 ? "🎉 Semua tagihan sudah lunas!" : "Menunggu pelunasan dari toko"}
          </p>
        </Card>
      </div>

      {/* PRINTABLE STATEMENT OF ACCOUNT DOCUMENT CANVAS */}
      <div 
        ref={statementRef}
        className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white text-foreground print:text-slate-900"
      >
        {/* Document Letterhead */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b pb-6 print:border-b-2 print:border-slate-800">
          <div className="space-y-1">
            {profile?.company_logo_url && (
              <img src={profile.company_logo_url} alt="Logo" className="h-10 w-auto object-contain mb-2" />
            )}
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground print:text-slate-900">
              {profile?.company_name || 'BENGKEL / JASA TEKNISI KELILING'}
            </h2>
            {profile?.address && <p className="text-xs text-muted-foreground print:text-slate-600 max-w-sm">{profile.address}</p>}
            {profile?.phone && <p className="text-xs text-muted-foreground print:text-slate-600">Telp / WA: {profile.phone}</p>}
          </div>

          <div className="sm:text-right space-y-1">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-primary/10 text-primary uppercase tracking-wider print:border print:border-slate-800 print:text-slate-900">
              STATEMENT OF ACCOUNT
            </span>
            <h3 className="text-sm font-bold text-foreground print:text-slate-900 mt-1">
              Rekapitulasi Tagihan Jasa
            </h3>
            <p className="text-xs text-muted-foreground print:text-slate-600">
              Tanggal Cetak: {safeFormat(new Date().toISOString(), 'd MMMM yyyy')}
            </p>
          </div>
        </div>

        {/* Client & Partner Details Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b print:border-slate-200">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">
              Ditagihkan Kepada (Mitra / Toko):
            </span>
            <p className="text-sm font-black text-foreground print:text-slate-900">
              {selectedClient?.name || '-'}
            </p>
            {selectedClient?.address && (
              <p className="text-xs text-muted-foreground print:text-slate-600">{selectedClient.address}</p>
            )}
            {selectedClient?.phone && (
              <p className="text-xs text-muted-foreground print:text-slate-600">Kontak: {selectedClient.phone}</p>
            )}
          </div>

          <div className="sm:text-right space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">
              Periode Rekap:
            </span>
            <p className="text-xs font-bold text-foreground print:text-slate-900">
              {periodFilter === 'this_month' ? `Bulan Ini (${safeFormat(new Date().toISOString(), 'MMMM yyyy')})` :
               periodFilter === 'last_month' ? `Bulan Lalu (${safeFormat(subMonths(new Date(), 1).toISOString(), 'MMMM yyyy')})` :
               periodFilter === 'last_3_months' ? '3 Bulan Terakhir' : 'Semua Riwayat Pengerjaan'}
            </p>
            <p className="text-xs font-black text-amber-600 dark:text-amber-400 print:text-slate-900 mt-1">
              Total Sisa Piutang: {formatCurrency(summary.totalOutstanding)}
            </p>
          </div>
        </div>

        {/* Statement Items Table */}
        <div className="py-4 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 print:bg-slate-100 print:border-slate-400">
                <th className="py-2.5 px-3 font-bold text-muted-foreground print:text-slate-800 uppercase text-[10px]">No.</th>
                <th className="py-2.5 px-3 font-bold text-muted-foreground print:text-slate-800 uppercase text-[10px]">Tanggal</th>
                <th className="py-2.5 px-3 font-bold text-muted-foreground print:text-slate-800 uppercase text-[10px]">No. Faktur</th>
                <th className="py-2.5 px-3 font-bold text-muted-foreground print:text-slate-800 uppercase text-[10px]">Uraian Pekerjaan / Proyek</th>
                <th className="py-2.5 px-3 font-bold text-muted-foreground print:text-slate-800 uppercase text-[10px] text-right">Nilai Tagihan</th>
                <th className="py-2.5 px-3 font-bold text-muted-foreground print:text-slate-800 uppercase text-[10px] text-right">Terbayar</th>
                <th className="py-2.5 px-3 font-bold text-muted-foreground print:text-slate-800 uppercase text-[10px] text-right">Sisa (Piutang)</th>
                <th className="py-2.5 px-3 font-bold text-muted-foreground print:text-slate-800 uppercase text-[10px] text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 print:divide-slate-200">
              {statementRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                    Tidak ada transaksi faktur yang tercatat untuk mitra ini pada periode yang dipilih.
                  </td>
                </tr>
              ) : (
                statementRows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-muted/20 print:hover:bg-transparent">
                    <td className="py-2.5 px-3 text-muted-foreground print:text-slate-600 font-bold">{index + 1}</td>
                    <td className="py-2.5 px-3 text-muted-foreground print:text-slate-600 font-medium whitespace-nowrap">
                      {safeFormat(row.date, 'd MMM yyyy')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-foreground print:text-slate-900 whitespace-nowrap">
                      <Link to={`/invoice/${row.id}`} className="hover:underline text-primary print:text-slate-900">
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground print:text-slate-900 max-w-xs truncate">
                      {row.title}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-foreground print:text-slate-900 tabular-nums">
                      {formatCurrency(row.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 print:text-slate-700 tabular-nums">
                      {formatCurrency(row.totalPaid)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400 print:text-slate-900 tabular-nums">
                      {row.balanceRemaining > 0 ? formatCurrency(row.balanceRemaining) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={cn(
                        "inline-block px-2 py-0.5 rounded-md text-[10px] font-bold",
                        row.status === 'Lunas' ? "bg-emerald-500/10 text-emerald-600 print:text-slate-900" : "bg-amber-500/10 text-amber-600 print:text-slate-900"
                      )}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border/80 font-black bg-muted/30 print:bg-slate-100 print:border-slate-400">
                <td colSpan={4} className="py-3 px-3 uppercase text-[11px] text-foreground print:text-slate-900">
                  Total Rekapitulasi ({statementRows.length} Proyek)
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-[11px] text-foreground print:text-slate-900">
                  {formatCurrency(summary.totalBilled)}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-[11px] text-emerald-600 print:text-slate-900">
                  {formatCurrency(summary.totalPaid)}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-[11px] text-amber-600 print:text-slate-900 font-black">
                  {formatCurrency(summary.totalOutstanding)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bank Account & Payment Instructions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t print:border-slate-200">
          <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/80 space-y-1.5 print:bg-slate-50 print:border-slate-300">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-slate-700 flex items-center gap-1">
              <Landmark className="h-3.5 w-3.5 text-primary print:text-slate-800" /> Rekening Pembayaran Resmi:
            </span>
            {profile?.bank_name && (
              <div className="text-xs space-y-0.5 print:text-slate-900">
                <p className="font-bold text-foreground print:text-slate-900">
                  Bank: {profile.bank_name}
                </p>
                <p className="font-mono font-bold text-primary print:text-slate-900 text-sm">
                  {profile.bank_account_number}
                </p>
                <p className="text-muted-foreground print:text-slate-600 text-[11px]">
                  a.n. {profile.bank_account_name || profile.company_name}
                </p>
              </div>
            )}
          </div>

          {/* Signature Box for Corporate Official Statement */}
          <div className="flex flex-col justify-between text-center sm:text-right p-2">
            <p className="text-xs text-muted-foreground print:text-slate-700">
              Hormat Kami,
            </p>
            <div className="h-16"></div>
            <div>
              <p className="text-xs font-black text-foreground print:text-slate-900 underline">
                {profile?.bank_account_name || profile?.company_name || 'Penanggung Jawab Teknis'}
              </p>
              <p className="text-[10px] text-muted-foreground print:text-slate-600">
                {profile?.company_name || 'Subkon / Partner Lapangan'}
              </p>
            </div>
          </div>
        </div>

        {profile?.custom_footer && (
          <div className="mt-4 pt-3 border-t text-center print:border-slate-200">
            <p className="text-[10px] text-muted-foreground print:text-slate-500 whitespace-pre-wrap">
              {profile.custom_footer}
            </p>
          </div>
        )}
      </div>

      {/* PDF and Print Styles */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          .no-pdf, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PartnerStatementReport;
