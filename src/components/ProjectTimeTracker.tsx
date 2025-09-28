import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

  const handleAddTimeEntry = async () => {
    if (!user || !date || !duration) {
      showError('Tanggal dan durasi harus diisi.');
      return;
    }
    const durationMinutes = parseFloat(duration) * 60;
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      showError('Durasi tidak valid.');
      return;
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        project_id: projectId,
        user_id: user.id,
        entry_date: date.toISOString(),
        duration_minutes: durationMinutes,
        notes,
      })
      .select()
      .single();

    if (error) {
      showError('Gagal menyimpan catatan waktu.');
    } else {
      showSuccess('Catatan waktu berhasil disimpan.');
      setEntries([data as TimeEntry, ...entries]);
      setDuration('');
      setNotes('');
      onEntryUpdate();
    }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} jam ${m} mnt`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 border rounded-lg">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: localeId }) : <span>Pilih tanggal</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
        </Popover>
        <Input type="number" placeholder="Durasi (jam)" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <Textarea placeholder="Catatan (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="md:col-span-3" rows={2} />
        <Button onClick={handleAddTimeEntry} className="md:col-span-3"><PlusCircle className="mr-2 h-4 w-4" /> Tambah Catatan Waktu</Button>
      </div>
      <div className="max-h-60 overflow-y-auto pr-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(entry => (
              <TableRow key={entry.id}>
                <TableCell>{format(new Date(entry.entry_date), 'PPP', { locale: localeId })}</TableCell>
                <TableCell>{formatDuration(entry.duration_minutes)}</TableCell>
                <TableCell>{entry.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ProjectTimeTracker;