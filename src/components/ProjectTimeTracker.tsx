import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, PlusCircle, Edit3, Trash2, Clock, Check, X } from 'lucide-react';
import { cn, safeFormat } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type TimeEntry = {
  id: string;
  entry_date: string;
  duration_minutes: number;
  notes: string | null;
};

interface ProjectTimeTrackerProps {
  projectId: string;
  initialEntries: TimeEntry[];
  onEntryUpdate: () => void;
}

const ProjectTimeTracker = ({ projectId, initialEntries, onEntryUpdate }: ProjectTimeTrackerProps) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit dialog state
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editDuration, setEditDuration] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  const handleAddTimeEntry = async () => {
    if (!user || !date || !duration) {
      showError('Tanggal dan durasi jam kerja harus diisi.');
      return;
    }
    const durationMinutes = parseFloat(duration) * 60;
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      showError('Durasi jam tidak valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          project_id: projectId,
          user_id: user.id,
          entry_date: date.toISOString(),
          duration_minutes: durationMinutes,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (error) {
        showError(`Gagal menyimpan: ${error.message}`);
      } else {
        showSuccess('Catatan waktu berhasil ditambahkan.');
        setEntries([data as TimeEntry, ...entries]);
        setDuration('');
        setNotes('');
        onEntryUpdate();
      }
    } catch (err: any) {
      showError('Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditDate(new Date(entry.entry_date));
    setEditDuration((entry.duration_minutes / 60).toString());
    setEditNotes(entry.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editDate || !editDuration) {
      showError('Tanggal dan durasi harus diisi.');
      return;
    }

    const durationMinutes = parseFloat(editDuration) * 60;
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      showError('Durasi jam tidak valid.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          entry_date: editDate.toISOString(),
          duration_minutes: durationMinutes,
          notes: editNotes.trim() || null,
        })
        .eq('id', editingEntry.id);

      if (error) {
        showError(`Gagal memperbarui: ${error.message}`);
      } else {
        showSuccess('Catatan jam kerja berhasil diperbarui.');
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? {
          ...e,
          entry_date: editDate.toISOString(),
          duration_minutes: durationMinutes,
          notes: editNotes.trim() || null
        } : e));
        setEditingEntry(null);
        onEntryUpdate();
      }
    } catch (err: any) {
      showError('Terjadi kesalahan saat memperbarui.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan waktu ini?')) return;
    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', entryId);
      if (error) {
        showError('Gagal menghapus catatan waktu.');
      } else {
        showSuccess('Catatan waktu berhasil dihapus.');
        setEntries(prev => prev.filter(e => e.id !== entryId));
        onEntryUpdate();
      }
    } catch {
      showError('Terjadi kesalahan.');
    }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return `${h} jam ${m} mnt`;
    if (h > 0) return `${h} jam`;
    return `${m} menit`;
  };

  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Form Tambah Jam Kerja */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 sm:p-5 border border-border/80 rounded-2xl bg-muted/20 shadow-xs">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground">Tanggal Pengerjaan</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-semibold h-10 rounded-xl text-xs", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {date ? safeFormat(date.toISOString(), 'd MMMM yyyy') : <span>Pilih tanggal</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground">Durasi Jam Kerja</Label>
          <Input 
            type="number" 
            step="0.25"
            placeholder="Contoh: 2.5 (2 jam 30 mnt)" 
            value={duration} 
            onChange={(e) => setDuration(e.target.value)} 
            className="h-10 rounded-xl text-xs font-bold"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground">Keterangan / Aktivitas</Label>
          <Input 
            placeholder="Contoh: Setting NVR & Crimp Kabel LAN" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            className="h-10 rounded-xl text-xs"
          />
        </div>

        <div className="md:col-span-3 pt-1">
          <Button 
            onClick={handleAddTimeEntry} 
            disabled={isSubmitting}
            className="w-full rounded-xl font-bold h-10 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <PlusCircle className="h-4 w-4" /> 
            {isSubmitting ? 'Menyimpan...' : 'Tambah Catatan Jam Kerja'}
          </Button>
        </div>
      </div>

      {/* Tabel Catatan Waktu */}
      <div className="rounded-2xl border border-border/80 overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-b border-border/80">
              <TableHead className="font-bold text-xs uppercase">Tanggal</TableHead>
              <TableHead className="font-bold text-xs uppercase">Durasi Jam</TableHead>
              <TableHead className="font-bold text-xs uppercase">Keterangan / Aktivitas</TableHead>
              <TableHead className="w-[110px] text-center font-bold text-xs uppercase">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/60">
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                  Belum ada catatan jam kerja teknisi.
                </TableCell>
              </TableRow>
            ) : (
              entries.map(entry => (
                <TableRow key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-semibold text-xs text-foreground whitespace-nowrap py-3">
                    {safeFormat(entry.entry_date, 'd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 tabular-nums">
                      <Clock className="h-3 w-3" />
                      {formatDuration(entry.duration_minutes)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.notes || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleOpenEdit(entry)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                        title="Edit Jam Kerja"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Hapus Catatan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Total Footer */}
        {entries.length > 0 && (
          <div className="bg-muted/30 border-t border-border/80 p-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">
              Total {entries.length} Sesi Kerja
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Akumulasi Total:</span>
              <strong className="text-sky-600 dark:text-sky-400 font-black text-sm sm:text-base tabular-nums">
                {formatDuration(totalMinutes)} ({(totalMinutes / 60).toFixed(1)} Jam)
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Dialog Edit Jam Kerja */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" />
              Edit Catatan Jam Kerja
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sesuaikan durasi jam, tanggal, atau keterangan aktivitas pengerjaan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Tanggal Pengerjaan</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-semibold h-10 rounded-xl text-xs", !editDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {editDate ? safeFormat(editDate.toISOString(), 'd MMMM yyyy') : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editDate} onSelect={setEditDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Durasi Jam Kerja</Label>
              <Input 
                type="number" 
                step="0.25"
                placeholder="Contoh: 3 atau 1.5" 
                value={editDuration} 
                onChange={(e) => setEditDuration(e.target.value)} 
                className="h-10 rounded-xl text-xs font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Keterangan / Aktivitas</Label>
              <Textarea 
                placeholder="Catatan aktivitas..." 
                value={editNotes} 
                onChange={(e) => setEditNotes(e.target.value)} 
                className="rounded-xl text-xs"
                rows={2}
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditingEntry(null)}
                className="rounded-xl text-xs font-semibold"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={isSavingEdit}
                className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectTimeTracker;