import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  PlusCircle, 
  Pencil, 
  Trash2, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  X, 
  Wrench, 
  Boxes, 
  TrendingUp, 
  Coins,
  Infinity as InfinityIcon,
  Tag
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import ItemForm from '@/components/ItemForm';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type Item = {
  id: string;
  description: string;
  unit: string | null;
  unit_price: number;
  cost_price: number;
  stock: number;
  track_stock: boolean;
};

const ItemList = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'stock' | 'low_stock' | 'services'>('all');

  const fetchItems = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, description, unit, unit_price, cost_price, stock, track_stock')
        .eq('user_id', user.id)
        .order('description', { ascending: true });

      if (error) {
        console.error('Error fetching items:', error);
        showError('Gagal memuat daftar item.');
      } else {
        setItems((data as Item[]) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [user]);

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from('items').delete().match({ id: itemId });

      if (error) {
        showError('Gagal menghapus item.');
      } else {
        showSuccess('Item berhasil dihapus.');
        setItems(prev => prev.filter(i => i.id !== itemId));
      }
    } catch {
      showError('Gagal menghapus item.');
    }
  };

  const handleOpenForm = (item: Item | null = null) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    setIsFormOpen(false);
    fetchItems();
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalItems = items.length;
    const trackedStockItems = items.filter(i => i.track_stock);
    const lowStockItems = trackedStockItems.filter(i => (Number(i.stock) || 0) <= 5);
    const serviceItems = items.filter(i => !i.track_stock);
    
    // Inventory valuation
    const totalStockValue = trackedStockItems.reduce((sum, i) => {
      const qty = Number(i.stock) || 0;
      const cost = Number(i.cost_price) || 0;
      return sum + (qty * cost);
    }, 0);

    return {
      totalItems,
      lowStockCount: lowStockItems.length,
      serviceCount: serviceItems.length,
      totalStockValue,
    };
  }, [items]);

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery.trim() || 
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.unit || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = 
        filterType === 'all' ? true :
        filterType === 'stock' ? item.track_stock :
        filterType === 'low_stock' ? (item.track_stock && (Number(item.stock) || 0) <= 5) :
        !item.track_stock; // services

      return matchesSearch && matchesType;
    });
  }, [items, searchQuery, filterType]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6 px-3 py-3 sm:px-6 lg:px-8 pb-28 sm:pb-8">
      {/* ========================================================================= */}
      {/* HERO BANNER & HEADER */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-4 sm:p-7 shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Master Katalog Produk & Jasa
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-muted text-muted-foreground border border-border/60">
                {items.length} Item
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
              Pustaka Barang & Jasa
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl hidden sm:block">
              Simpan daftar inventaris barang, kontrol sisa stok, modal beli (HPP), dan standar harga jual untuk mempercepat pembuatan penawaran & faktur.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button 
              size="sm"
              onClick={() => handleOpenForm()}
              className="rounded-xl font-bold h-10 px-4 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Tambah Item Baru
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 KPI SUMMARY CARDS - 2 COLUMNS ON MOBILE */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Master Item */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Item</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Boxes className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {stats.totalItems} <span className="text-xs font-normal text-muted-foreground">Item</span>
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 hidden sm:flex items-center justify-between">
            <span>Siap dipakai di Penawaran</span>
          </div>
        </Card>

        {/* Card 2: Stok Menipis */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Stok Tipis (≤5)</p>
            <div className={cn(
              "flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl border",
              stats.lowStockCount > 0 
                ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400" 
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            )}>
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className={cn(
              "text-base sm:text-2xl font-black tracking-tight tabular-nums",
              stats.lowStockCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
            )}>
              {stats.lowStockCount} <span className="text-xs font-normal text-muted-foreground">Barang</span>
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 hidden sm:flex items-center justify-between">
            <span>{stats.lowStockCount > 0 ? 'Perlu Restock Segera' : 'Semua Stok Aman'}</span>
          </div>
        </Card>

        {/* Card 3: Nilai Stok Persediaan */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Nilai Inventaris</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
              {formatCurrency(stats.totalStockValue)}
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 hidden sm:flex items-center justify-between">
            <span>Total Nilai Modal Gudang</span>
          </div>
        </Card>

        {/* Card 4: Jasa & Layanan */}
        <Card className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Jasa & Layanan</p>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
              <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-base sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {stats.serviceCount} <span className="text-xs font-normal text-muted-foreground">Layanan</span>
            </h3>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium border-t border-border/60 pt-2 hidden sm:flex items-center justify-between">
            <span>Tanpa Kontrol Stok Gudang</span>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* MAIN CATALOG TABLE CARD */}
      {/* ========================================================================= */}
      <Card className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
        {/* Filter & Search Toolbar */}
        <CardHeader className="p-4 sm:p-6 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama barang, jasa, atau satuan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl h-10 text-xs bg-background"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 p-1 rounded-2xl border border-border/60">
              <button
                onClick={() => setFilterType('all')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                  filterType === 'all' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Semua ({items.length})
              </button>
              <button
                onClick={() => setFilterType('stock')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                  filterType === 'stock' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                📦 Stok Fisik ({items.filter(i => i.track_stock).length})
              </button>
              <button
                onClick={() => setFilterType('low_stock')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                  filterType === 'low_stock' ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                ⚠️ Stok Rendah ({stats.lowStockCount})
              </button>
              <button
                onClick={() => setFilterType('services')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                  filterType === 'services' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                🔧 Jasa ({stats.serviceCount})
              </button>
            </div>
          </div>
        </CardHeader>

        {/* Content Table / Empty State */}
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                <Package className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-foreground">
                  {searchQuery || filterType !== 'all' ? 'Item Tidak Ditemukan' : 'Belum Ada Item di Pustaka'}
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {searchQuery || filterType !== 'all'
                    ? 'Coba ganti kata kunci pencarian atau pilih filter kategori yang lain.'
                    : 'Tambahkan master barang dan jasa Anda untuk mempercepat pembuatan surat penawaran & faktur.'}
                </p>
              </div>
              {searchQuery || filterType !== 'all' ? (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchQuery(''); setFilterType('all'); }}
                  className="rounded-xl text-xs font-semibold"
                >
                  Reset Filter
                </Button>
              ) : (
                <Button 
                  onClick={() => handleOpenForm()}
                  className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" /> Tambah Item Sekarang
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border/80">
                    <TableHead className="w-[60px] text-center font-bold text-xs uppercase text-muted-foreground">#</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-muted-foreground">Deskripsi Item / Layanan</TableHead>
                    <TableHead className="w-[140px] font-bold text-xs uppercase text-muted-foreground text-center">Status Stok</TableHead>
                    <TableHead className="w-[160px] text-right font-bold text-xs uppercase text-muted-foreground">Harga Modal (HPP)</TableHead>
                    <TableHead className="w-[160px] text-right font-bold text-xs uppercase text-muted-foreground">Harga Jual Satuan</TableHead>
                    <TableHead className="w-[130px] text-center font-bold text-xs uppercase text-muted-foreground">Estimasi Margin</TableHead>
                    <TableHead className="w-[100px] text-center font-bold text-xs uppercase text-muted-foreground">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/60">
                  {filteredItems.map((item, index) => {
                    const cost = Number(item.cost_price) || 0;
                    const price = Number(item.unit_price) || 0;
                    const profit = price - cost;
                    const margin = price > 0 ? (profit / price) * 100 : 0;

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30 transition-colors group">
                        {/* No */}
                        <TableCell className="text-center font-bold text-xs text-muted-foreground">
                          {index + 1}
                        </TableCell>

                        {/* Deskripsi & Satuan */}
                        <TableCell className="py-3.5">
                          <span className="font-bold text-xs sm:text-sm block text-foreground">
                            {item.description}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.unit && (
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border/60">
                                Satuan: {item.unit}
                              </span>
                            )}
                            {item.track_stock ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                                <Package className="h-2.5 w-2.5" /> Barang Fisik
                              </span>
                            ) : (
                              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-0.5">
                                <Wrench className="h-2.5 w-2.5" /> Jasa Layanan
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Status Stok */}
                        <TableCell className="text-center">
                          {item.track_stock ? (
                            item.stock <= 5 ? (
                              <Badge variant="destructive" className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-0.5">
                                <AlertTriangle className="h-3 w-3" /> {item.stock} {item.unit || 'unit'}
                              </Badge>
                            ) : (
                              <Badge className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" /> {item.stock} {item.unit || 'unit'}
                              </Badge>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium bg-muted/60 px-2 py-0.5 rounded-full">
                              <InfinityIcon className="h-3 w-3 opacity-60" /> Tak Terbatas
                            </span>
                          )}
                        </TableCell>

                        {/* Modal HPP */}
                        <TableCell className="text-right font-semibold text-xs sm:text-sm text-muted-foreground tabular-nums">
                          {cost > 0 ? formatCurrency(cost) : <span className="text-xs text-muted-foreground italic">Rp 0</span>}
                        </TableCell>

                        {/* Harga Jual */}
                        <TableCell className="text-right font-black text-xs sm:text-sm text-foreground tabular-nums">
                          {formatCurrency(price)}
                        </TableCell>

                        {/* Estimasi Margin */}
                        <TableCell className="text-center">
                          {price > 0 ? (
                            <span className={cn(
                              "text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border",
                              margin >= 30 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" :
                              margin > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25" :
                              "bg-rose-500/10 text-rose-600 border-rose-500/25"
                            )}>
                              {margin.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Aksi */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenForm(item)}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                              title="Edit Item"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Hapus Item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl p-6">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-base font-bold">Hapus Item dari Pustaka?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs text-muted-foreground">
                                    Item "{item.description}" akan dihapus permanen dari pustaka katalog.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2 pt-2">
                                  <AlertDialogCancel className="rounded-xl text-xs font-semibold">Batal</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Table Footer */}
          {filteredItems.length > 0 && (
            <div className="bg-muted/30 border-t border-border/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-xs text-muted-foreground font-semibold">
                Menampilkan {filteredItems.length} dari total {items.length} item katalog
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Stok Terpantau: <strong className="text-foreground">{items.filter(i => i.track_stock).length}</strong></span>
                <span>•</span>
                <span>Jasa/Layanan: <strong className="text-foreground">{stats.serviceCount}</strong></span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Item Form Dialog */}
      <ItemForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        item={selectedItem}
        onSave={handleFormSave}
      />
    </div>
  );
};

export default ItemList;