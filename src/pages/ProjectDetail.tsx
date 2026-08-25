import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, DollarSign, Wallet, TrendingUp, FileText, Receipt, Clock, 
  ListTodo, Target, ShoppingCart, CheckCircle2, Circle, Edit3, Check, 
  X, AlertCircle, PackageCheck, Layers, Sparkles, User, Fuel, Utensils,
  Users, Hotel, Wrench, Plus, Trash2, PieChart, Calculator, Car, Landmark
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  formatCurrency, safeFormat, calculateSubtotal, calculateTotal, 
  calculateItemTotal, getStatusVariant, cn,
  formatNumberWithDots, parseDotsToNumber
} from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import ProjectTaskList, { Task } from '@/components/ProjectTaskList';
import ProjectTimeTracker, { TimeEntry } from '@/components/ProjectTimeTracker';
import { Progress } from '@/components/ui/progress';

type ProjectDetails = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  clients: { name: string } | null;
  budget: number;
};

type QuoteItem = {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  cost_price: number;
};

type Quote = { 
  id: string; 
  quote_number: string; 
  created_at: string; 
  status: string; 
  discount_amount?: number;
  tax_amount?: number;
  quote_items: QuoteItem[];
};

type Invoice = { 
  id: string; 
  invoice_number: string; 
  created_at: string; 
  status: string; 
  invoice_items: { quantity: number; unit_price: number }[]; 
  discount_amount: number; 
  tax_amount: number; 
  down_payment_amount?: number;
};

type Payment = {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
  invoice_id?: string;
};

type Expense = { 
  id: string; 
  description: string; 
  amount: number; 
  category: string | null;
  expense_date: string; 
  notes?: string | null;
  user_id?: string;
  project_id?: string | null;
};

const EXPENSE_CATEGORIES = [
  { value: 'Bensin & Transportasi', label: 'Bensin & Transportasi', icon: Fuel, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  { value: 'Makan & Konsumsi', label: 'Makan & Konsumsi Tim', icon: Utensils, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
  { value: 'Gaji & Upah Teknisi', label: 'Gaji & Upah Teknisi', icon: Users, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { value: 'Penginapan & Hotel', label: 'Penginapan & Hotel', icon: Hotel, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  { value: 'Alat & Lain-lain', label: 'Alat Kerja & Lain-lain', icon: Wrench, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
];

type ProjectDocPhoto = {
  id: string;
  url: string;
  title: string;
  stage: 'Sebelum (Before)' | 'Sedang Pengerjaan (In Progress)' | 'Hasil Akhir (After)' | 'Nota & Berkas';
  date: string;
  notes?: string;
};

const STAGE_OPTIONS = [
  { value: 'Sebelum (Before)', label: 'Sebelum Pengerjaan (Before)', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  { value: 'Sedang Pengerjaan (In Progress)', label: 'Sedang Pengerjaan (In Progress)', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
  { value: 'Hasil Akhir (After)', label: 'Hasil Akhir (After / Selesai)', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { value: 'Nota & Berkas', label: 'Nota / Surat Jalan / Berkas', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
];

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Procurement items purchase state (stored in localStorage per project)
  const [purchasedItemIds, setPurchasedItemIds] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(`project-purchased-${id}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Inline editing state for item cost_price
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingCostPrice, setEditingCostPrice] = useState<string>('');
  const [isSavingCost, setIsSavingCost] = useState(false);

  // Add Expense Dialog state
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('Bensin & Transportasi');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpenseNotes, setNewExpenseNotes] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Documentation Photo Gallery State
  const [docPhotos, setDocPhotos] = useState<ProjectDocPhoto[]>(() => {
    try {
      const stored = localStorage.getItem(`project-doc-photos-${id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [selectedPhotoFilter, setSelectedPhotoFilter] = useState<string>('Semua');
  const [isUploadPhotoDialogOpen, setIsUploadPhotoDialogOpen] = useState(false);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [newPhotoStage, setNewPhotoStage] = useState<ProjectDocPhoto['stage']>('Sedang Pengerjaan (In Progress)');
  const [newPhotoDate, setNewPhotoDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPhotoNotes, setNewPhotoNotes] = useState('');
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<ProjectDocPhoto | null>(null);

  // Handle file selected for photo upload
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewPhotoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit photo upload
  const handleUploadPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoPreview || !newPhotoTitle.trim() || !id) {
      showError('Pilih foto dan isi judul dokumentasi.');
      return;
    }

    setIsSubmittingPhoto(true);
    try {
      let finalImageUrl = newPhotoPreview;

      // Try uploading to Supabase storage if file is available
      if (newPhotoFile && user) {
        try {
          const fileExt = newPhotoFile.name.split('.').pop();
          const filePath = `${user.id}/projects/${id}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('document_attachments')
            .upload(filePath, newPhotoFile);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('document_attachments')
              .getPublicUrl(filePath);
            if (urlData?.publicUrl) {
              finalImageUrl = urlData.publicUrl;
            }
          }
        } catch (storageErr) {
          console.warn('Storage upload fallback to base64:', storageErr);
        }
      }

      const newPhotoItem: ProjectDocPhoto = {
        id: crypto.randomUUID(),
        url: finalImageUrl,
        title: newPhotoTitle.trim(),
        stage: newPhotoStage,
        date: newPhotoDate,
        notes: newPhotoNotes.trim() || undefined
      };

      const updated = [newPhotoItem, ...docPhotos];
      setDocPhotos(updated);
      try {
        localStorage.setItem(`project-doc-photos-${id}`, JSON.stringify(updated));
      } catch (err) {
        console.error('Save local photo error:', err);
      }

      showSuccess('Foto dokumentasi berhasil ditambahkan!');
      setIsUploadPhotoDialogOpen(false);
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
      setNewPhotoTitle('');
      setNewPhotoNotes('');
    } catch (err: any) {
      console.error(err);
      showError('Gagal mengunggah foto.');
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  // Delete photo from gallery
  const handleDeletePhoto = (photoId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus foto dokumentasi ini?')) return;
    const updated = docPhotos.filter(p => p.id !== photoId);
    setDocPhotos(updated);
    try {
      localStorage.setItem(`project-doc-photos-${id}`, JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    showSuccess('Foto dokumentasi berhasil dihapus.');
  };

  // Filtered photos
  const filteredDocPhotos = useMemo(() => {
    if (selectedPhotoFilter === 'Semua') return docPhotos;
    return docPhotos.filter(p => p.stage === selectedPhotoFilter);
  }, [docPhotos, selectedPhotoFilter]);

  const fetchProjectData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const [projectRes, quotesRes, invoicesRes, expensesRes, tasksRes, timeEntriesRes] = await Promise.all([
        supabase.from('projects').select('*, clients(name)').eq('id', id).single(),
        supabase.from('quotes').select('*, quote_items(*)').eq('project_id', id),
        supabase.from('invoices').select('*, invoice_items(*)').eq('project_id', id),
        supabase.from('expenses').select('*').eq('project_id', id).order('expense_date', { ascending: false }),
        supabase.from('project_tasks').select('*').eq('project_id', id).order('created_at', { ascending: true }),
        supabase.from('time_entries').select('*').eq('project_id', id).order('entry_date', { ascending: false })
      ]);

      if (projectRes.data) setProject(projectRes.data as ProjectDetails);
      if (quotesRes.data) setQuotes(quotesRes.data as Quote[]);
      if (invoicesRes.data) {
        const invList = invoicesRes.data as Invoice[];
        setInvoices(invList);

        const invIds = invList.map(inv => inv.id);
        if (invIds.length > 0) {
          const { data: pData } = await supabase
            .from('payments')
            .select('*')
            .in('invoice_id', invIds)
            .order('payment_date', { ascending: false });
          setPayments(pData || []);
        } else {
          setPayments([]);
        }
      }
      if (expensesRes.data) setExpenses(expensesRes.data as Expense[]);
      if (tasksRes.data) setTasks(tasksRes.data as Task[]);
      if (timeEntriesRes.data) setTimeEntries(timeEntriesRes.data as TimeEntry[]);
    } catch (err) {
      console.error('Fetch project error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  // Toggle item purchased status
  const handleTogglePurchased = (itemId: string) => {
    setPurchasedItemIds(prev => {
      const updated = { ...prev, [itemId]: !prev[itemId] };
      if (!updated[itemId]) {
        delete updated[itemId];
      }
      try {
        localStorage.setItem(`project-purchased-${id}`, JSON.stringify(updated));
      } catch (err) {
        console.error('Save purchased state error:', err);
      }
      return updated;
    });
  };

  // Start editing item cost price
  const handleStartEditCost = (item: QuoteItem) => {
    setEditingItemId(item.id);
    setEditingCostPrice(String(item.cost_price || 0));
  };

  // Save updated cost price directly to Supabase
  const handleSaveCostPrice = async (itemId: string, quoteId: string) => {
    const numPrice = Number(editingCostPrice) || 0;
    setIsSavingCost(true);

    try {
      const { error } = await supabase
        .from('quote_items')
        .update({ cost_price: numPrice })
        .eq('id', itemId);

      if (error) {
        showError(`Gagal menyimpan harga: ${error.message}`);
      } else {
        showSuccess('Harga beli berhasil diperbarui!');
        setQuotes(prevQuotes => prevQuotes.map(q => {
          if (q.id !== quoteId) return q;
          return {
            ...q,
            quote_items: (q.quote_items || []).map(it => it.id === itemId ? { ...it, cost_price: numPrice } : it)
          };
        }));
        setEditingItemId(null);
      }
    } catch (err: any) {
      console.error(err);
      showError('Terjadi kesalahan saat menyimpan harga.');
    } finally {
      setIsSavingCost(false);
    }
  };

  // Handle adding new expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    if (!newExpenseDescription.trim()) {
      showError('Deskripsi biaya wajib diisi');
      return;
    }
    const amountNum = Number(newExpenseAmount);
    if (!amountNum || amountNum <= 0) {
      showError('Jumlah biaya harus lebih dari 0');
      return;
    }

    setIsSubmittingExpense(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          project_id: id,
          description: newExpenseDescription.trim(),
          category: newExpenseCategory,
          amount: amountNum,
          expense_date: newExpenseDate,
          notes: newExpenseNotes.trim() || null
        })
        .select()
        .single();

      if (error) {
        showError(`Gagal menambah biaya: ${error.message}`);
      } else {
        showSuccess('Biaya operasional berhasil dicatat!');
        if (data) {
          setExpenses(prev => [data as Expense, ...prev]);
        }
        setIsExpenseDialogOpen(false);
        setNewExpenseDescription('');
        setNewExpenseAmount('');
        setNewExpenseNotes('');
      }
    } catch (err: any) {
      console.error(err);
      showError('Terjadi kesalahan.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Handle deleting expense
  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan biaya ini?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
      if (error) {
        showError(`Gagal menghapus: ${error.message}`);
      } else {
        showSuccess('Catatan biaya berhasil dihapus');
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
      }
    } catch (err: any) {
      console.error(err);
      showError('Gagal menghapus biaya.');
    }
  };

// Helper untuk mendeteksi item pembatas / header section
const isHeaderOrDivider = (item: { description?: string | null; quantity?: number; unit_price?: number; cost_price?: number }) => {
  const desc = (item.description || '').trim().toLowerCase();
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price) || 0;
  const cost = Number(item.cost_price) || 0;

  // Qty 0 atau bernilai 0 tanpa harga
  if (qty <= 0) return true;
  if (price === 0 && cost === 0) return true;

  // Format pembatas simbolik: ---, ===, [header], ***
  if (/^[-=_*~#]{2,}/.test(desc) || /^\[.*\]$/.test(desc)) return true;

  // Kata kunci pembatas / header
  const headerKeywords = [
    'item utama', 'material utama', 'daftar barang', 'daftar material',
    'peralatan', 'perangkat', 'pembatas', 'header', 'kategori',
    'rincian barang', 'rincian jasa', 'sub total', 'subtotal', 'section'
  ];
  if (headerKeywords.some(kw => desc === kw || desc === `${kw}:` || desc === `[${kw}]` || desc.startsWith(`${kw} `))) {
    if (price === 0 || qty <= 0) return true;
  }

  return false;
};

// Helper untuk mendeteksi item jasa / upah (tidak masuk ke belanja barang fisik BOM)
const isServiceItem = (item: { description?: string | null; unit?: string | null }) => {
  const desc = (item.description || '').trim().toLowerCase();
  const unit = (item.unit || '').trim().toLowerCase();

  // Satuan berjenis jasa
  if (['jasa', 'srv', 'service', 'titik pasang', 'titik'].includes(unit)) return true;

  // Kata kunci jasa
  const serviceKeywords = [
    'jasa pasang', 'jasa instalasi', 'jasa pemasangan', 'jasa setting',
    'jasa konfigurasi', 'jasa tarik kabel', 'jasa penarikan', 'jasa borongan',
    'jasa maintenance', 'jasa perbaikan', 'jasa servis', 'jasa service',
    'ongkos pasang', 'ongkos kerja', 'biaya pasang', 'biaya instalasi',
    'biaya setting', 'upah kerja', 'upah teknisi', 'instalasi & setting',
    'instalasi cctv', 'tarik kabel', 'setting nvr', 'setting dvr', 'setting cctv'
  ];

  return serviceKeywords.some(kw => desc.startsWith(kw) || desc.includes(` ${kw}`) || desc === kw) || desc.startsWith('jasa ');
};

  // Flatten all procurement items from linked quotes, filtering out headers and services
  const procurementItems = useMemo(() => {
    const list: (QuoteItem & { quote_number: string })[] = [];
    quotes.forEach(q => {
      (q.quote_items || []).forEach(item => {
        if (isHeaderOrDivider(item) || isServiceItem(item)) return;

        list.push({
          ...item,
          quote_number: q.quote_number
        });
      });
    });
    return list;
  }, [quotes]);

  // Procurement summary calculations
  const procurementStats = useMemo(() => {
    let totalItems = procurementItems.length;
    let purchasedCount = 0;
    let totalEstimatedCost = 0;
    let totalPurchasedCost = 0;
    let totalSalesValue = 0;

    procurementItems.forEach(item => {
      const isPurchased = !!purchasedItemIds[item.id];
      const itemCostTotal = (item.quantity || 1) * (item.cost_price || 0);
      const itemSalesTotal = (item.quantity || 1) * (item.unit_price || 0);

      totalEstimatedCost += itemCostTotal;
      totalSalesValue += itemSalesTotal;

      if (isPurchased) {
        purchasedCount += 1;
        totalPurchasedCost += itemCostTotal;
      }
    });

    const unpurchasedCost = totalEstimatedCost - totalPurchasedCost;
    const progressPercent = totalItems > 0 ? (purchasedCount / totalItems) * 100 : 0;
    const grossProfitItems = totalSalesValue - totalEstimatedCost;

    return {
      totalItems,
      purchasedCount,
      totalEstimatedCost,
      totalPurchasedCost,
      unpurchasedCost,
      progressPercent,
      grossProfitItems
    };
  }, [procurementItems, purchasedItemIds]);

  // Expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    let fuelTotal = 0;
    let mealTotal = 0;
    let techTotal = 0;
    let hotelTotal = 0;
    let otherTotal = 0;

    expenses.forEach(e => {
      const cat = e.category || 'Alat & Lain-lain';
      const amt = Number(e.amount) || 0;
      if (cat.includes('Bensin') || cat.includes('Transport')) fuelTotal += amt;
      else if (cat.includes('Makan') || cat.includes('Konsumsi')) mealTotal += amt;
      else if (cat.includes('Gaji') || cat.includes('Teknisi') || cat.includes('Upah')) techTotal += amt;
      else if (cat.includes('Penginapan') || cat.includes('Hotel')) hotelTotal += amt;
      else otherTotal += amt;
    });

    const totalOperational = fuelTotal + mealTotal + techTotal + hotelTotal + otherTotal;

    return {
      fuelTotal,
      mealTotal,
      techTotal,
      hotelTotal,
      otherTotal,
      totalOperational
    };
  }, [expenses]);

  // Financial calculations
  const financials = useMemo(() => {
    const paidRevenue = invoices
      .filter(inv => inv.status === 'Lunas')
      .reduce((sum, inv) => {
        const subtotal = calculateSubtotal(inv.invoice_items);
        return sum + calculateTotal(subtotal, inv.discount_amount, inv.tax_amount);
      }, 0);

    const allInvoicesTotal = invoices.reduce((sum, inv) => {
      const subtotal = calculateSubtotal(inv.invoice_items);
      return sum + calculateTotal(subtotal, inv.discount_amount, inv.tax_amount);
    }, 0);

    const acceptedQuotesTotal = quotes
      .filter(q => q.status === 'Diterima' || q.status === 'accepted')
      .reduce((sum, q) => {
        const subtotal = (q.quote_items || []).reduce((s, it) => s + calculateItemTotal(it.quantity, it.unit_price || 0), 0);
        return sum + calculateTotal(subtotal, q.discount_amount || 0, q.tax_amount || 0);
      }, 0);

    // Total pendapatan proyek (Nilai Kontrak)
    const totalRevenue = allInvoicesTotal > 0 
      ? allInvoicesTotal 
      : (acceptedQuotesTotal > 0 ? acceptedQuotesTotal : (project?.budget || 0));

    // Total Uang Masuk Riil dari Klien (DP + Termin + Pelunasan)
    const settledPaymentsTotal = payments
      .filter(p => p.status === 'Lunas')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const invoiceDownPayments = invoices.reduce((sum, inv) => sum + (Number(inv.down_payment_amount) || 0), 0);
    const actualCashIn = settledPaymentsTotal > 0 
      ? settledPaymentsTotal 
      : (paidRevenue > 0 ? paidRevenue : invoiceDownPayments);
    
    // Sisa Piutang yang belum dibayar klien
    const unpaidReceivables = Math.max(0, totalRevenue - actualCashIn);

    // Biaya modal barang fisik (HPP BOM) - excluding pembatas & jasa
    const costOfGoodsSold = quotes
      .filter(q => q.status === 'Diterima' || q.status === 'accepted')
      .reduce((sum, q) => sum + (q.quote_items || [])
        .filter(item => !isHeaderOrDivider(item) && !isServiceItem(item))
        .reduce((acc, item) => acc + calculateItemTotal(item.quantity, item.cost_price || 0), 0), 0);

    // Total pengeluaran operasional (bensin, makan, gaji teknisi, dll)
    const totalOperationalExpenses = expenseBreakdown.totalOperational;

    // Total Seluruh Biaya Proyek (Barang + Akomodasi/Operasional)
    const totalCosts = costOfGoodsSold + totalOperationalExpenses;
    
    // Laba Bersih Riil
    const netProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // Arus Kas Bersih Proyek Saat Ini (Kas Masuk Riil - Pengeluaran Riil)
    const netCashFlow = actualCashIn - totalCosts;

    const totalMinutes = timeEntries.reduce((sum, entry) => sum + entry.duration_minutes, 0);

    return { 
      totalRevenue, 
      paidRevenue, 
      actualCashIn,
      unpaidReceivables,
      costOfGoodsSold,
      totalOperationalExpenses,
      totalCosts, 
      netProfit, 
      profitMargin,
      netCashFlow,
      totalHours: totalMinutes / 60 
    };
  }, [invoices, payments, quotes, expenseBreakdown, timeEntries, project]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid md:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-lg font-bold">Proyek tidak ditemukan</h2>
        <Button asChild variant="outline" className="mt-4 rounded-xl">
          <Link to="/projects">Kembali ke Daftar Proyek</Link>
        </Button>
      </div>
    );
  }

  const budgetUsedPercent = project.budget > 0 ? (financials.totalCosts / project.budget) * 100 : 0;
  const budgetRemaining = project.budget - financials.totalCosts;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6 px-3 py-3 sm:px-6 lg:px-8 pb-28 sm:pb-8">
      {/* Top Header Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="w-fit rounded-xl text-muted-foreground hover:text-foreground">
          <Link to="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Proyek
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(project.status)} className="px-3 py-1 text-xs font-bold rounded-full">
            {project.status}
          </Badge>
        </div>
      </div>

      {/* Hero Project Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-bold text-primary">
                <Layers className="h-3.5 w-3.5" /> Workspace Proyek
              </span>
              {project.clients?.name && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> {project.clients.name}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
              {project.name}
            </h1>

            {project.description && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {project.description}
              </p>
            )}
          </div>

          {/* Budget Quick Summary Card */}
          <div className="bg-muted/40 border border-border/70 rounded-2xl p-4 sm:p-5 min-w-[280px] sm:min-w-[320px] space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Target className="h-4 w-4 text-primary" /> Anggaran Proyek</span>
              <span className="text-foreground font-extrabold">{budgetUsedPercent.toFixed(0)}%</span>
            </div>
            <Progress value={budgetUsedPercent} className="h-2 rounded-full" />
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground">Biaya: <strong className="text-foreground">{formatCurrency(financials.totalCosts)}</strong></span>
              <span className={cn("font-bold", budgetRemaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600")}>
                Sisa: {formatCurrency(budgetRemaining)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Pendapatan */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Pendapatan</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(financials.totalRevenue)}
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Nilai Kontrak</span>
            {financials.paidRevenue > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Lunas: {formatCurrency(financials.paidRevenue)}</span>
            )}
          </div>
        </Card>

        {/* Card 2: Total Biaya (HPP + Akomodasi) */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Seluruh Biaya</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {formatCurrency(financials.totalCosts)}
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Barang: {formatCurrency(financials.costOfGoodsSold)}</span>
            <span className="font-semibold text-foreground">Akom: {formatCurrency(financials.totalOperationalExpenses)}</span>
          </div>
        </Card>

        {/* Card 3: Laba Bersih */}
        <Card className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Estimasi Laba Bersih</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className={cn("text-base sm:text-2xl font-black tracking-tight truncate tabular-nums", financials.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600")}>
              {formatCurrency(financials.netProfit)}
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-emerald-700/80 dark:text-emerald-300 font-bold border-t border-emerald-500/20 pt-2 flex items-center justify-between">
            <span>Margin Keuntungan</span>
            <span>{financials.profitMargin.toFixed(1)}%</span>
          </div>
        </Card>

        {/* Card 4: Jam & Progress */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Jam & Tugas</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground truncate tabular-nums">
              {financials.totalHours.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">Jam</span>
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 flex items-center justify-between">
            <span>Progress Tugas</span>
            <span className="font-semibold text-foreground">{tasks.filter(t => t.is_completed).length}/{tasks.length} Selesai</span>
          </div>
        </Card>
      </div>

      {/* Main Tabs Section */}
      <Tabs defaultValue="procurement" className="space-y-5">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 w-full h-auto p-1.5 rounded-2xl bg-card border border-border/80 shadow-2xs gap-1.5">
          <TabsTrigger 
            value="procurement" 
            className="rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold gap-1.5 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <span className="truncate">Belanja (BOM)</span>
            {procurementItems.length > 0 && (
              <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-black leading-none shrink-0">
                {procurementItems.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger 
            value="accommodation" 
            className="rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold gap-1.5 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
          >
            <Car className="h-4 w-4 shrink-0" />
            <span className="truncate">Akomodasi & Upah</span>
            {expenses.length > 0 && (
              <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-black leading-none shrink-0">
                {expenses.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger 
            value="report" 
            className="rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold gap-1.5 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
          >
            <PieChart className="h-4 w-4 shrink-0" />
            <span className="truncate">Laporan Laba Rugi</span>
          </TabsTrigger>

          <TabsTrigger 
            value="tasks" 
            className="rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold gap-1.5 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
          >
            <ListTodo className="h-4 w-4 shrink-0" />
            <span className="truncate">Tugas</span>
            {tasks.length > 0 && (
              <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-black leading-none shrink-0">
                {tasks.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger 
            value="time" 
            className="rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold gap-1.5 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span className="truncate">Jam Kerja</span>
          </TabsTrigger>

          <TabsTrigger 
            value="documents" 
            className="rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold gap-1.5 justify-center transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span className="truncate">Dokumentasi</span>
            {docPhotos.length > 0 && (
              <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-black leading-none shrink-0">
                {docPhotos.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: PENGADAAN & DAFTAR BARANG YANG DIBELI (BOM) */}
        {/* ========================================================================= */}
        <TabsContent value="procurement" className="space-y-4">
          <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <PackageCheck className="h-5 w-5 text-primary" />
                    Daftar Belanja & Pengadaan Barang (BOM)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Item dari penawaran otomatis tercatat di sini. Sesuaikan harga beli asli dan centang barang yang sudah dibeli.
                  </CardDescription>
                </div>

                {/* Procurement Progress Pill */}
                <div className="flex items-center gap-3 bg-background border border-border/80 rounded-2xl p-2.5 px-4 shrink-0 shadow-2xs">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Progres Belanja</p>
                    <p className="text-sm font-black text-foreground">{procurementStats.purchasedCount} dari {procurementStats.totalItems} Barang ({procurementStats.progressPercent.toFixed(0)}%)</p>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {procurementItems.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground/60 mx-auto" />
                  <h4 className="text-base font-bold text-foreground">Belum Ada Item Pengadaan</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Kaitkan penawaran yang berisi item barang/jasa ke proyek ini untuk memuat daftar belanja secara otomatis.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80 hover:bg-transparent">
                        <TableHead className="w-[60px] text-center font-bold text-xs uppercase text-muted-foreground">Beli</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-muted-foreground">Nama Barang / Deskripsi</TableHead>
                        <TableHead className="w-[100px] text-center font-bold text-xs uppercase text-muted-foreground">Qty</TableHead>
                        <TableHead className="w-[140px] text-right font-bold text-xs uppercase text-muted-foreground">Harga Jual</TableHead>
                        <TableHead className="w-[180px] text-right font-bold text-xs uppercase text-muted-foreground">Harga Beli (HPP)</TableHead>
                        <TableHead className="w-[140px] text-right font-bold text-xs uppercase text-muted-foreground">Total Belanja</TableHead>
                        <TableHead className="w-[120px] text-center font-bold text-xs uppercase text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {procurementItems.map((item) => {
                        const isPurchased = !!purchasedItemIds[item.id];
                        const isEditing = editingItemId === item.id;
                        const itemQty = Number(item.quantity) || 1;
                        const itemCost = Number(item.cost_price) || 0;
                        const itemPrice = Number(item.unit_price) || 0;
                        const totalItemCost = itemQty * itemCost;
                        const itemMargin = (itemPrice - itemCost) * itemQty;

                        return (
                          <TableRow 
                            key={item.id} 
                            className={cn(
                              "transition-colors group",
                              isPurchased ? "bg-emerald-500/5 hover:bg-emerald-500/10" : "hover:bg-muted/30"
                            )}
                          >
                            {/* Checkbox Sudah Dibeli */}
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={isPurchased}
                                  onCheckedChange={() => handleTogglePurchased(item.id)}
                                  className="h-5 w-5 rounded-md border-border data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 cursor-pointer"
                                  title={isPurchased ? "Tandai belum dibeli" : "Tandai sudah dibeli"}
                                />
                              </div>
                            </TableCell>

                            {/* Nama & Deskripsi Barang */}
                            <TableCell className="py-3.5">
                              <div>
                                <span className={cn("font-bold text-xs sm:text-sm block text-foreground", isPurchased && "line-through text-muted-foreground")}>
                                  {item.description || 'Item Tanpa Nama'}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                  <span>Penawaran: {item.quote_number}</span>
                                  {itemCost > 0 && itemPrice > itemCost && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Profit: {formatCurrency(itemMargin)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Qty & Satuan */}
                            <TableCell className="text-center font-bold text-xs sm:text-sm text-foreground">
                              {item.quantity} <span className="text-[11px] font-normal text-muted-foreground">{item.unit || 'unit'}</span>
                            </TableCell>

                            {/* Harga Jual ke Klien */}
                            <TableCell className="text-right text-xs sm:text-sm font-semibold text-muted-foreground tabular-nums">
                              {formatCurrency(itemPrice)}
                            </TableCell>

                            {/* Harga Beli / HPP (Bisa diedit langsung inline) */}
                            <TableCell className="text-right">
                              {isEditing ? (
                                <div className="relative flex items-center justify-end gap-1.5">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatNumberWithDots(editingCostPrice)}
                                    onChange={(e) => setEditingCostPrice(String(parseDotsToNumber(e.target.value)))}
                                    className="h-8 w-28 text-right font-bold text-xs rounded-lg tabular-nums"
                                    autoFocus
                                    placeholder="0"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveCostPrice(item.id, item.quote_id);
                                      if (e.key === 'Escape') setEditingItemId(null);
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleSaveCostPrice(item.id, item.quote_id)}
                                    disabled={isSavingCost}
                                    className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                                    title="Simpan"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditingItemId(null)}
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted"
                                    title="Batal"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div 
                                  onClick={() => handleStartEditCost(item)}
                                  className="group/cost inline-flex items-center gap-1.5 cursor-pointer rounded-lg px-2 py-1 hover:bg-muted/60 transition-colors"
                                  title="Klik untuk sesuaikan harga beli"
                                >
                                  <span className="font-bold text-xs sm:text-sm text-foreground tabular-nums">
                                    {formatCurrency(itemCost)}
                                  </span>
                                  <Edit3 className="h-3.5 w-3.5 text-muted-foreground/60 group-hover/cost:text-primary transition-colors" />
                                </div>
                              )}
                            </TableCell>

                            {/* Total Biaya Belanja (Qty x HPP) */}
                            <TableCell className="text-right font-black text-xs sm:text-sm text-foreground tabular-nums">
                              {formatCurrency(totalItemCost)}
                            </TableCell>

                            {/* Status Badge */}
                            <TableCell className="text-center">
                              {isPurchased ? (
                                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold gap-1 px-2 py-0.5">
                                  <CheckCircle2 className="h-3 w-3" /> Terbeli
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px] font-semibold gap-1 px-2 py-0.5">
                                  <Circle className="h-2.5 w-2.5" /> Rencana
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Bottom Summary Bar */}
              {procurementItems.length > 0 && (
                <div className="bg-muted/30 border-t border-border/70 p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>Klik pada <strong>Harga Beli (HPP)</strong> kapan saja untuk menyesuaikan harga dari supplier toko.</span>
                  </div>

                  <div className="flex items-center gap-6 justify-end text-xs">
                    <div>
                      <span className="text-muted-foreground block">Realisasi Terbeli:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm tabular-nums">
                        {formatCurrency(procurementStats.totalPurchasedCost)}
                      </strong>
                    </div>
                    <div className="border-l border-border pl-6">
                      <span className="text-muted-foreground block">Total Estimasi Belanja:</span>
                      <strong className="text-foreground font-black text-sm tabular-nums">
                        {formatCurrency(procurementStats.totalEstimatedCost)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: AKOMODASI, OPERASIONAL & GAJI TEKNISI */}
        {/* ========================================================================= */}
        <TabsContent value="accommodation" className="space-y-4">
          <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Car className="h-5 w-5 text-amber-500" />
                    Biaya Akomodasi, Operasional & Gaji Teknisi
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Catat pengeluaran riil lapangan seperti bensin, uang makan, gaji/upah teknisi, penginapan hotel, dan alat kerja.
                  </CardDescription>
                </div>

                <Button 
                  onClick={() => setIsExpenseDialogOpen(true)} 
                  className="rounded-xl font-bold gap-1.5 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                >
                  <Plus className="h-4 w-4" /> Tambah Pengeluaran
                </Button>
              </div>

              {/* 5 Category Quick Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-4">
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Fuel className="h-3.5 w-3.5" /> Bensin & Transport
                  </div>
                  <p className="text-sm sm:text-base font-extrabold text-foreground mt-1.5 tabular-nums">
                    {formatCurrency(expenseBreakdown.fuelTotal)}
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400">
                    <Utensils className="h-3.5 w-3.5" /> Makan & Konsumsi
                  </div>
                  <p className="text-sm sm:text-base font-extrabold text-foreground mt-1.5 tabular-nums">
                    {formatCurrency(expenseBreakdown.mealTotal)}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                    <Users className="h-3.5 w-3.5" /> Upah / Gaji Teknisi
                  </div>
                  <p className="text-sm sm:text-base font-extrabold text-foreground mt-1.5 tabular-nums">
                    {formatCurrency(expenseBreakdown.techTotal)}
                  </p>
                </div>

                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                    <Hotel className="h-3.5 w-3.5" /> Penginapan Hotel
                  </div>
                  <p className="text-sm sm:text-base font-extrabold text-foreground mt-1.5 tabular-nums">
                    {formatCurrency(expenseBreakdown.hotelTotal)}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <Wrench className="h-3.5 w-3.5" /> Alat & Lain-lain
                  </div>
                  <p className="text-sm sm:text-base font-extrabold text-foreground mt-1.5 tabular-nums">
                    {formatCurrency(expenseBreakdown.otherTotal)}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {expenses.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Car className="h-10 w-10 text-muted-foreground/60 mx-auto" />
                  <h4 className="text-base font-bold text-foreground">Belum Ada Biaya Operasional / Akomodasi</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Klik tombol "Tambah Pengeluaran" di atas untuk mencatat bensin, uang makan, upah teknisi, atau akomodasi lainnya.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="w-[120px] font-bold text-xs uppercase text-muted-foreground">Tanggal</TableHead>
                        <TableHead className="w-[180px] font-bold text-xs uppercase text-muted-foreground">Kategori</TableHead>
                        <TableHead className="font-bold text-xs uppercase text-muted-foreground">Deskripsi Biaya</TableHead>
                        <TableHead className="w-[160px] text-right font-bold text-xs uppercase text-muted-foreground">Jumlah (Rp)</TableHead>
                        <TableHead className="w-[80px] text-center font-bold text-xs uppercase text-muted-foreground">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {expenses.map((expense) => {
                        const matchedCat = EXPENSE_CATEGORIES.find(c => c.value === expense.category) || {
                          icon: Wrench,
                          color: 'text-muted-foreground bg-muted border-border',
                          label: expense.category || 'Lain-lain'
                        };
                        const IconComp = matchedCat.icon;

                        return (
                          <TableRow key={expense.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                              {safeFormat(expense.expense_date, 'd MMM yyyy')}
                            </TableCell>

                            <TableCell>
                              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border", matchedCat.color)}>
                                <IconComp className="h-3 w-3" />
                                {matchedCat.label}
                              </span>
                            </TableCell>

                            <TableCell className="py-3">
                              <span className="font-bold text-xs sm:text-sm block text-foreground">
                                {expense.description}
                              </span>
                              {expense.notes && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                                  Catatan: {expense.notes}
                                </p>
                              )}
                            </TableCell>

                            <TableCell className="text-right font-black text-xs sm:text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                              {formatCurrency(expense.amount)}
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Hapus Biaya"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Total Akomodasi Footer Bar */}
              {expenses.length > 0 && (
                <div className="bg-muted/30 border-t border-border/70 p-4 sm:p-5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-semibold">
                    Total {expenses.length} Catatan Biaya Operasional
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground mr-3">Total Biaya Operasional & Akomodasi:</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-black text-base tabular-nums">
                      {formatCurrency(expenseBreakdown.totalOperational)}
                    </strong>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: AKUMULASI LAPORAN KEUANGAN PROYEK (FINANCIAL RECAP) */}
        {/* ========================================================================= */}
        <TabsContent value="report" className="space-y-6">
          {/* Quick Cash Flow Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Kas Masuk (DP & Cicilan)</span>
                <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
                {formatCurrency(financials.actualCashIn)}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                {financials.totalRevenue > 0 ? `${((financials.actualCashIn / financials.totalRevenue) * 100).toFixed(0)}% dari nilai kontrak` : 'Dana masuk riil'}
              </p>
            </div>

            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Pengeluaran Riil (BOM + Ops)</span>
                <Wallet className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <h4 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 tabular-nums">
                {formatCurrency(financials.totalCosts)}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                Biaya belanja material & operasional
              </p>
            </div>

            <div className={cn(
              "rounded-3xl border p-4 sm:p-5",
              financials.netCashFlow >= 0 ? "border-sky-500/30 bg-sky-500/5" : "border-amber-500/30 bg-amber-500/5"
            )}>
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-bold uppercase tracking-wider", financials.netCashFlow >= 0 ? "text-sky-700 dark:text-sky-400" : "text-amber-700 dark:text-amber-400")}>
                  Saldo Kas Proyek Saat Ini
                </span>
                <DollarSign className={cn("h-4 w-4", financials.netCashFlow >= 0 ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400")} />
              </div>
              <h4 className={cn("text-2xl font-black mt-2 tabular-nums", financials.netCashFlow >= 0 ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400")}>
                {formatCurrency(financials.netCashFlow)}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                {financials.netCashFlow >= 0 ? 'Sisa dana DP setelah dibelanjakan' : 'Perlu penambahan dana kas'}
              </p>
            </div>
          </div>

          <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-emerald-500" />
                Akumulasi Laporan Laba Rugi & Arus Kas Proyek
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Rekapitulasi lengkap pemasukan kontrak, uang muka (DP), belanja barang (HPP), biaya akomodasi, dan laba bersih riil.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Financial Breakdown Table */}
              <div className="rounded-2xl border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border/80">
                      <TableHead className="font-bold text-xs uppercase">Komponen Keuangan</TableHead>
                      <TableHead className="w-[180px] font-bold text-xs uppercase">Keterangan</TableHead>
                      <TableHead className="w-[200px] text-right font-bold text-xs uppercase">Jumlah (Rp)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60 text-xs sm:text-sm">
                    {/* 1. Pendapatan */}
                    <TableRow className="bg-emerald-500/5 hover:bg-emerald-500/10 font-bold">
                      <TableCell className="py-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <DollarSign className="h-4 w-4" />
                        <span>A. Total Pendapatan / Nilai Kontrak</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-normal">Faktur / Penawaran Diterima</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-extrabold tabular-nums">
                        {formatCurrency(financials.totalRevenue)}
                      </TableCell>
                    </TableRow>

                    {/* 1.1 Kas Masuk (DP & Cicilan) */}
                    <TableRow className="hover:bg-muted/20">
                      <TableCell className="py-2.5 pl-8 flex items-center gap-2 text-foreground font-medium">
                        <Landmark className="h-4 w-4 text-emerald-500" />
                        <span>• Uang Masuk Riil dari Klien (DP & Pelunasan)</span>
                      </TableCell>
                      <TableCell className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                        {financials.totalRevenue > 0 ? `${((financials.actualCashIn / financials.totalRevenue) * 100).toFixed(0)}% Terbayar` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(financials.actualCashIn)}
                      </TableCell>
                    </TableRow>

                    {/* 1.2 Sisa Piutang */}
                    {financials.unpaidReceivables > 0 && (
                      <TableRow className="hover:bg-muted/20">
                        <TableCell className="py-2.5 pl-8 flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span>• Sisa Piutang Klien (Belum Lunas)</span>
                        </TableCell>
                        <TableCell className="text-amber-600 dark:text-amber-400 font-semibold text-xs">Menunggu Pelunasan</TableCell>
                        <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          {formatCurrency(financials.unpaidReceivables)}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* 2. HPP Barang */}
                    <TableRow className="hover:bg-muted/20">
                      <TableCell className="py-3 pl-8 flex items-center gap-2 text-foreground font-medium">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                        <span>B. Biaya Belanja Barang (HPP Modal)</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{procurementStats.totalItems} Barang ({procurementStats.purchasedCount} Terbeli)</TableCell>
                      <TableCell className="text-right font-bold text-foreground tabular-nums">
                        {formatCurrency(financials.costOfGoodsSold)}
                      </TableCell>
                    </TableRow>

                    {/* 3. Akomodasi - Bensin */}
                    <TableRow className="hover:bg-muted/20">
                      <TableCell className="py-2.5 pl-12 flex items-center gap-2 text-muted-foreground">
                        <Fuel className="h-3.5 w-3.5 text-amber-500" />
                        <span>• Bensin & Transportasi</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">BBM, Tol, Parkir</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground tabular-nums">
                        {formatCurrency(expenseBreakdown.fuelTotal)}
                      </TableCell>
                    </TableRow>

                    {/* 3. Akomodasi - Makan */}
                    <TableRow className="hover:bg-muted/20">
                      <TableCell className="py-2.5 pl-12 flex items-center gap-2 text-muted-foreground">
                        <Utensils className="h-3.5 w-3.5 text-orange-500" />
                        <span>• Makan & Konsumsi Tim</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">Konsumsi Lapangan</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground tabular-nums">
                        {formatCurrency(expenseBreakdown.mealTotal)}
                      </TableCell>
                    </TableRow>

                    {/* 3. Akomodasi - Gaji Teknisi */}
                    <TableRow className="hover:bg-muted/20">
                      <TableCell className="py-2.5 pl-12 flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3.5 w-3.5 text-blue-500" />
                        <span>• Gaji & Upah Teknisi</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">Upah Harian / Borongan</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground tabular-nums">
                        {formatCurrency(expenseBreakdown.techTotal)}
                      </TableCell>
                    </TableRow>

                    {/* 3. Akomodasi - Hotel & Lainnya */}
                    <TableRow className="hover:bg-muted/20">
                      <TableCell className="py-2.5 pl-12 flex items-center gap-2 text-muted-foreground">
                        <Hotel className="h-3.5 w-3.5 text-purple-500" />
                        <span>• Penginapan, Alat & Lain-lain</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">Hotel / Sewa Alat</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground tabular-nums">
                        {formatCurrency(expenseBreakdown.hotelTotal + expenseBreakdown.otherTotal)}
                      </TableCell>
                    </TableRow>

                    {/* Subtotal Operasional */}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell className="py-3 pl-8 flex items-center gap-2 text-foreground">
                        <Car className="h-4 w-4 text-amber-500" />
                        <span>C. Subtotal Akomodasi & Operasional</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{expenses.length} Transaksi</TableCell>
                      <TableCell className="text-right font-bold text-foreground tabular-nums">
                        {formatCurrency(financials.totalOperationalExpenses)}
                      </TableCell>
                    </TableRow>

                    {/* Total Biaya Proyek */}
                    <TableRow className="bg-rose-500/10 hover:bg-rose-500/15 font-bold border-t-2 border-rose-500/30">
                      <TableCell className="py-3.5 flex items-center gap-2 text-rose-700 dark:text-rose-400">
                        <Wallet className="h-4 w-4" />
                        <span>D. Total Seluruh Pengeluaran Proyek (B + C)</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-normal">HPP Barang + Akomodasi</TableCell>
                      <TableCell className="text-right text-rose-600 dark:text-rose-400 font-extrabold text-base tabular-nums">
                        {formatCurrency(financials.totalCosts)}
                      </TableCell>
                    </TableRow>

                    {/* LABA BERSIH RIIL */}
                    <TableRow className="bg-emerald-500/15 hover:bg-emerald-500/20 font-black border-t-2 border-emerald-500/40">
                      <TableCell className="py-4 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-sm sm:text-base">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                        <span>E. LABA BERSIH RIIL (A - D)</span>
                      </TableCell>
                      <TableCell className="text-emerald-700 dark:text-emerald-400 font-bold text-xs sm:text-sm">
                        Margin Laba: {financials.profitMargin.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-black text-lg sm:text-xl tabular-nums">
                        {formatCurrency(financials.netProfit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 4: DAFTAR TUGAS */}
        {/* ========================================================================= */}
        <TabsContent value="tasks">
          <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-violet-500" />
                Daftar Tugas & Pekerjaan Proyek
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Kelola checklist tugas, tenggat waktu, dan progres pengerjaan lapangan.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ProjectTaskList projectId={project.id} initialTasks={tasks} onTaskUpdate={fetchProjectData} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 5: CATATAN WAKTU */}
        {/* ========================================================================= */}
        <TabsContent value="time">
          <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-sky-500" />
                Pelacak Jam Kerja Tim
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Catat durasi kerja dan log pengerjaan teknisi di proyek ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ProjectTimeTracker projectId={project.id} initialEntries={timeEntries} onEntryUpdate={fetchProjectData} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 6: DOKUMEN (PENAWARAN & FAKTUR) */}
        {/* ========================================================================= */}
        <TabsContent value="documents" className="space-y-6">
          <div className="space-y-6">
            {/* ========================================================================= */}
            {/* SECTION 1: GALERI DOKUMENTASI & FOTO PENGERJAAN LAPANGAN */}
            {/* ========================================================================= */}
            <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Layers className="h-5 w-5 text-primary" />
                      Galeri Foto & Dokumentasi Pekerjaan
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      Unggah foto bukti pengerjaan lapangan (sebelum, proses pengerjaan, hasil akhir, hingga nota/surat jalan).
                    </CardDescription>
                  </div>

                  <Button
                    onClick={() => setIsUploadPhotoDialogOpen(true)}
                    className="rounded-xl font-bold gap-1.5 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                  >
                    <Plus className="h-4 w-4" /> Upload Foto Dokumentasi
                  </Button>
                </div>

                {/* Filter Tahapan Pills */}
                {docPhotos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-3">
                    {['Semua', 'Sebelum (Before)', 'Sedang Pengerjaan (In Progress)', 'Hasil Akhir (After)', 'Nota & Berkas'].map(stage => {
                      const count = stage === 'Semua' ? docPhotos.length : docPhotos.filter(p => p.stage === stage).length;
                      return (
                        <button
                          key={stage}
                          onClick={() => setSelectedPhotoFilter(stage)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold transition-all border",
                            selectedPhotoFilter === stage 
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs" 
                              : "bg-muted/50 text-muted-foreground hover:bg-muted border-border/60"
                          )}
                        >
                          {stage} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                {docPhotos.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <div className="h-14 w-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                      <Layers className="h-7 w-7" />
                    </div>
                    <h4 className="text-base font-bold text-foreground">Belum Ada Foto Dokumentasi</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Klik tombol <strong>"Upload Foto Dokumentasi"</strong> di atas untuk mengunggah foto progres pengerjaan lapangan atau nota.
                    </p>
                  </div>
                ) : filteredDocPhotos.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Tidak ada foto pada kategori filter ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredDocPhotos.map(photo => {
                      const matchedStage = STAGE_OPTIONS.find(s => s.value === photo.stage) || STAGE_OPTIONS[1];
                      return (
                        <div 
                          key={photo.id}
                          className="group relative rounded-2xl border border-border/80 bg-muted/20 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          {/* Image Thumbnail with Click to Zoom */}
                          <div 
                            onClick={() => setPreviewPhoto(photo)}
                            className="relative h-44 w-full overflow-hidden bg-black/20 cursor-pointer"
                          >
                            <img 
                              src={photo.url} 
                              alt={photo.title}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-xs font-bold text-white bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-xs flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5" /> Lihat Ukuran Penuh
                              </span>
                            </div>

                            {/* Stage Badge on Top Left */}
                            <div className="absolute top-2.5 left-2.5">
                              <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border backdrop-blur-md", matchedStage.color)}>
                                {photo.stage}
                              </span>
                            </div>
                          </div>

                          {/* Info Footer */}
                          <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                            <div>
                              <h5 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1">
                                {photo.title}
                              </h5>
                              {photo.notes && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                                  {photo.notes}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                              <span>{safeFormat(photo.date, 'd MMM yyyy')}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePhoto(photo.id);
                                }}
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Hapus Foto"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ========================================================================= */}
            {/* SECTION 2: DOKUMEN ADMINISTRASI (PENAWARAN & FAKTUR) */}
            {/* ========================================================================= */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Penawaran */}
              <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
                <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Penawaran Terkait
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {quotes.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-b border-border/80">
                          <TableHead className="font-bold text-xs uppercase">Nomor</TableHead>
                          <TableHead className="font-bold text-xs uppercase">Status</TableHead>
                          <TableHead className="text-right font-bold text-xs uppercase">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-border/60">
                        {quotes.map(q => (
                          <TableRow key={q.id}>
                            <TableCell className="font-mono font-bold text-xs text-primary">{q.quote_number}</TableCell>
                            <TableCell><Badge variant={getStatusVariant(q.status)} className="text-[11px] font-bold">{q.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-semibold">
                                <Link to={`/quote/${q.id}`}>Lihat</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">Belum ada penawaran terkait.</p>
                  )}
                </CardContent>
              </Card>

              {/* Faktur */}
              <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
                <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-emerald-500" /> Faktur Tagihan
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {invoices.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-b border-border/80">
                          <TableHead className="font-bold text-xs uppercase">Nomor</TableHead>
                          <TableHead className="font-bold text-xs uppercase">Status</TableHead>
                          <TableHead className="text-right font-bold text-xs uppercase">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-border/60">
                        {invoices.map(i => (
                          <TableRow key={i.id}>
                            <TableCell className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{i.invoice_number}</TableCell>
                            <TableCell><Badge variant={getStatusVariant(i.status)} className="text-[11px] font-bold">{i.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-semibold">
                                <Link to={`/invoice/${i.id}`}>Lihat</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">Belum ada faktur tagihan.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* DIALOG: UPLOAD FOTO DOKUMENTASI PENGERJAAN */}
      {/* ========================================================================= */}
      <Dialog open={isUploadPhotoDialogOpen} onOpenChange={setIsUploadPhotoDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Upload Foto Dokumentasi Pekerjaan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ambil foto atau pilih file gambar dari perangkat Anda.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadPhotoSubmit} className="space-y-4 py-2">
            {/* File Input & Preview */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Pilih Foto / Gambar</Label>
              {newPhotoPreview ? (
                <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-border group bg-black/10">
                  <img src={newPhotoPreview} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setNewPhotoPreview(null);
                      setNewPhotoFile(null);
                    }}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 w-full rounded-2xl border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors p-4">
                  <Layers className="h-8 w-8 text-muted-foreground/60 mb-2" />
                  <span className="text-xs font-bold text-foreground">Klik untuk memilih foto</span>
                  <span className="text-[10px] text-muted-foreground">PNG, JPG, JPEG dari HP atau Komputer</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelected}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Judul Foto */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Judul / Kegiatan Pengerjaan</Label>
              <Input
                placeholder="Contoh: Pemasangan CCTV Titik 1 Ruang Kasir"
                value={newPhotoTitle}
                onChange={(e) => setNewPhotoTitle(e.target.value)}
                className="rounded-xl h-10 text-xs"
                required
              />
            </div>

            {/* Tahapan & Tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Tahapan Pengerjaan</Label>
                <Select value={newPhotoStage} onValueChange={(val: any) => setNewPhotoStage(val)}>
                  <SelectTrigger className="rounded-xl h-10 text-xs">
                    <SelectValue placeholder="Pilih Tahap" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {STAGE_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Tanggal Foto</Label>
                <Input
                  type="date"
                  value={newPhotoDate}
                  onChange={(e) => setNewPhotoDate(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>
            </div>

            {/* Catatan / Keterangan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Catatan / Keterangan (Opsional)</Label>
              <Input
                placeholder="Contoh: Kabel sudah ditanam rapi dengan pipa conduit"
                value={newPhotoNotes}
                onChange={(e) => setNewPhotoNotes(e.target.value)}
                className="rounded-xl h-10 text-xs"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsUploadPhotoDialogOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmittingPhoto || !newPhotoPreview}
                className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmittingPhoto ? 'Menyimpan...' : 'Simpan Foto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: PREVIEW ZOOM FOTO FULLSIZE */}
      {/* ========================================================================= */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] rounded-3xl p-4 overflow-hidden flex flex-col">
          {previewPhoto && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-foreground">{previewPhoto.title}</h4>
                  <p className="text-xs text-muted-foreground">{safeFormat(previewPhoto.date, 'EEEE, d MMMM yyyy')}</p>
                </div>
                <span className={cn("px-3 py-1 rounded-full text-xs font-bold border", 
                  STAGE_OPTIONS.find(s => s.value === previewPhoto.stage)?.color || 'bg-muted text-muted-foreground'
                )}>
                  {previewPhoto.stage}
                </span>
              </div>

              <div className="relative w-full max-h-[60vh] rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center">
                <img 
                  src={previewPhoto.url} 
                  alt={previewPhoto.title} 
                  className="max-h-[60vh] w-auto max-w-full object-contain"
                />
              </div>

              {previewPhoto.notes && (
                <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-xl border border-border/60">
                  {previewPhoto.notes}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: TAMBAH BIAYA OPERASIONAL & AKOMODASI */}
      {/* ========================================================================= */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Car className="h-5 w-5 text-amber-500" />
              Catat Biaya Akomodasi & Operasional
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Masukkan rincian pengeluaran lapangan untuk proyek {project.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddExpense} className="space-y-4 py-2">
            {/* Kategori */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Kategori Biaya</Label>
              <Select value={newExpenseCategory} onValueChange={setNewExpenseCategory}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="rounded-lg">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <c.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{c.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deskripsi */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Deskripsi Pengeluaran</Label>
              <Input
                placeholder="Contoh: Bensin 2 mobil ke lokasi klien, Makan 3 teknisi"
                value={newExpenseDescription}
                onChange={(e) => setNewExpenseDescription(e.target.value)}
                className="rounded-xl h-10 text-xs"
                required
              />
            </div>

            {/* Jumlah Nominal & Tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Jumlah (Rp)</Label>
                <div className="relative flex items-center">
                  <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground select-none">Rp</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formatNumberWithDots(newExpenseAmount)}
                    onChange={(e) => setNewExpenseAmount(String(parseDotsToNumber(e.target.value)))}
                    className="rounded-xl h-10 text-xs font-bold pl-9 tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Tanggal</Label>
                <Input
                  type="date"
                  value={newExpenseDate}
                  onChange={(e) => setNewExpenseDate(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>
            </div>

            {/* Catatan Tambahan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Catatan Tambahan (Opsional)</Label>
              <Input
                placeholder="Contoh: Nota terlampir / dibayar via kas kecil"
                value={newExpenseNotes}
                onChange={(e) => setNewExpenseNotes(e.target.value)}
                className="rounded-xl h-10 text-xs"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsExpenseDialogOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmittingExpense}
                className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmittingExpense ? 'Menyimpan...' : 'Simpan Pengeluaran'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;