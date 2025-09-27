import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
}

const ExpenseForm = ({ isOpen, setIsOpen, expense, onSave }: ExpenseFormProps) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
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
      setProjectId(expense.project_id || undefined);
    } else {
      setDescription('');
      setAmount('');
      setCategory('');
      setExpenseDate(new Date());
      setNotes('');
      setProjectId(undefined);
    }
  }, [expense, isOpen]);

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
      project_id: projectId,
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
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran Baru'}</DialogTitle>
          <DialogDescription>Isi detail pengeluaran di bawah ini. Klik simpan jika sudah selesai.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label htmlFor="description">Deskripsi</Label><Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="amount">Jumlah (IDR)</Label><Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>Tanggal Pengeluaran</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !expenseDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{expenseDate ? format(expenseDate, "PPP", { locale: localeId }) : <span>Pilih tanggal</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={expenseDate} onSelect={setExpenseDate} initialFocus /></PopoverContent></Popover></div>
          <div className="space-y-2"><Label htmlFor="category">Kategori (Opsional)</Label><Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Contoh: Sewa, Alat, Pemasaran" /></div>
          <div className="space-y-2"><Label htmlFor="project">Proyek (Opsional)</Label><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue placeholder="Pilih proyek terkait" /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="notes">Catatan (Opsional)</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseForm;