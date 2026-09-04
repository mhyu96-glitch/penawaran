import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Wrench, Fuel, Utensils, Car, HardHat, DollarSign, Sparkles } from 'lucide-react';
import { cn, safeFormat, formatNumberWithDots, parseDotsToNumber } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Project } from './ProjectForm';

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  expense_date: string;
  notes: string | null;
  project_id: string | null;
};

interface ExpenseFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  expense: Expense | null;
  onSave: () => void;
  defaultProjectId?: string;
}

const FIELD_EXPENSE_PRESETS = [
  { label: 'Material Tambahan', desc: 'Baut, Fisher, Isolasi & Kabel Ties', cat: 'Material Lapangan', icon: Wrench },
  { label: 'BBM & Transport', desc: 'Bensin & Operasional Kendaraan', cat: 'Transportasi', icon: Fuel },
  { label: 'Konsumsi & Makan', desc: 'Makan Siang & Lembur Tim', cat: 'Konsumsi', icon: Utensils },
  { label: 'Parkir & Tol', desc: 'Karcis Parkir & Biaya Tol', cat: 'Parkir & Tol', icon: Car },
  { label: 'Sewa Alat Bantu', desc: 'Sewa Tangga / Scaffolding', cat: 'Sewa Alat', icon: HardHat },
  { label: 'Kasbon Lapangan', desc: 'Uang Muka / Kasbon Lapangan', cat: 'Kasbon', icon: DollarSign },
];

const ExpenseForm = ({ isOpen, setIsOpen, expense, onSave, defaultProjectId }: ExpenseFormProps) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>(defaultProjectId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;
      const { data } = await supabase.from('projects').select('*').eq('user_id', user.id);
      if (data) setProjects(data);
    };
    if (isOpen) fetchProjects();
  }, [user, isOpen]);

  useEffect(() => {
    if (expense) {
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCategory(expense.category || '');
      setExpenseDate(new Date(expense.expense_date));
      setNotes(expense.notes || '');
      setProjectId(expense.project_id || defaultProjectId || undefined);
    } else {
      setDescription('');
      setAmount('');
      setCategory('');
      setExpenseDate(new Date());
      setNotes('');
      setProjectId(defaultProjectId || undefined);
    }
  }, [expense, isOpen, defaultProjectId]);

  const handleApplyPreset = (preset: typeof FIELD_EXPENSE_PRESETS[0]) => {
    setCategory(preset.cat);
    if (!description.trim()) {
      setDescription(preset.desc);
    }
  };

  const handleSubmit = async () => {
    if (!user || !description || !amount || !expenseDate) {
      showError('Deskripsi, jumlah, dan tanggal tidak boleh kosong.');
      return;
    }
    setIsSubmitting(true);

    const expensePayload = {
      user_id: user.id,
      description,
      amount: parseFloat(amount),
      category,
      expense_date: expenseDate.toISOString(),
      notes,
      project_id: projectId || null,
    };

    let error;
    if (expense) {
      ({ error } = await supabase.from('expenses').update(expensePayload).match({ id: expense.id }));
    } else {
      ({ error } = await supabase.from('expenses').insert(expensePayload));
    }

    if (error) {
      showError(`Gagal menyimpan pengeluaran: ${error.message}`);
    } else {
      showSuccess(`Pengeluaran berhasil ${expense ? 'diperbarui' : 'ditambahkan'}!`);
      onSave();
      setIsOpen(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[460px] rounded-3xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {expense ? 'Edit Pengeluaran Lapangan' : 'Catat Pengeluaran / Biaya Lapangan'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Catat biaya tak terduga, operasional, atau kasbon agar profit riil proyek terhitung akurat.
          </DialogDescription>
        </DialogHeader>

        {/* Quick Field Expense Presets */}
        <div className="space-y-1.5 pt-1">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" /> Preset Biaya Lapangan Cepat:
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {FIELD_EXPENSE_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isSelected = category === preset.cat;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all text-left truncate",
                    isSelected 
                      ? "bg-primary/10 border-primary text-primary shadow-2xs" 
                      : "bg-muted/30 border-border/80 text-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-bold">Deskripsi Pengeluaran</Label>
            <Input 
              id="description" 
              placeholder="misal: Beli fisher S6 2 pack & isolasi unibel" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="h-10 rounded-xl text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs font-bold">Nominal Biaya</Label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground select-none">Rp</span>
                <Input 
                  id="amount" 
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatNumberWithDots(amount)} 
                  onChange={(e) => setAmount(String(parseDotsToNumber(e.target.value)))} 
                  className="h-10 rounded-xl pl-9 font-bold tabular-nums text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Kategori</Label>
              <Input 
                id="category" 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                placeholder="misal: Material, BBM" 
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Tanggal Transaksi</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full h-10 rounded-xl justify-start text-left text-xs font-medium", !expenseDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {expenseDate ? safeFormat(expenseDate.toISOString(), 'PPP') : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={expenseDate} onSelect={setExpenseDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project" className="text-xs font-bold">Proyek Terkait</Label>
            <Select value={projectId || "none"} onValueChange={(val) => setProjectId(val === "none" ? undefined : val)}>
              <SelectTrigger className="h-10 rounded-xl text-xs">
                <SelectValue placeholder="Pilih proyek terkait" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Tanpa Proyek --</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-bold">Catatan / Keterangan Toko (Opsional)</Label>
            <Textarea 
              id="notes" 
              placeholder="Contoh: Nota dibeli di Toko Bangunan Berkah Jl. Melati" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              className="rounded-xl text-xs font-medium min-h-16"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl h-10 text-xs">
            Batal
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="rounded-xl h-10 text-xs font-bold">
            {isSubmitting ? 'Menyimpan...' : (expense ? 'Simpan Perubahan' : 'Catat Pengeluaran')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseForm;