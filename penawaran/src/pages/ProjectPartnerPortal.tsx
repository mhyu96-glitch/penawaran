import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  CheckCircle2, 
  Clock, 
  Download, 
  MapPin, 
  Phone, 
  Layers, 
  Sparkles, 
  ListTodo, 
  Check, 
  AlertCircle,
  Calendar,
  User,
  Wrench,
  ShieldCheck
} from 'lucide-react';
import { safeFormat, cn } from '@/lib/utils';
import { generatePdf } from '@/utils/pdfGenerator';
import { showSuccess } from '@/utils/toast';

type ProjectDocPhoto = {
  id: string;
  url: string;
  title: string;
  stage: 'Sebelum Pengerjaan (Before)' | 'Sedang Pengerjaan (In Progress)' | 'Selesai Terpasang (After)' | 'Lainnya';
  date: string;
  notes?: string;
};

type Task = {
  id: string;
  title: string;
  is_completed: boolean;
  due_date?: string | null;
  priority?: string;
};

type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  clients: { name: string; phone?: string | null; address?: string | null } | null;
  budget: number;
  created_at?: string;
  user_id?: string;
};

const STAGES = [
  { step: 1, label: 'Persiapan & Logistik', percent: 20, desc: 'Pengecekan unit, material, dan jalur instalasi' },
  { step: 2, label: 'Penarikan Jalur & Pipa', percent: 40, desc: 'Instalasi pipa proteksi, penarikan kabel UTP/FO/Power' },
  { step: 3, label: 'Pemasangan Unit', percent: 60, desc: 'Mounting bracket, pemasangan kamera/perangkat di titik' },
  { step: 4, label: 'Setting & Konfigurasi', percent: 80, desc: 'Setup NVR/Router, terminasi konektor, konfigurasi jaringan & app' },
  { step: 5, label: 'Testing & BAST Selesai', percent: 100, desc: 'Uji coba fungsi menyeluruh, serah terima pekerjaan' },
];

export const ProjectPartnerPortal = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [photos, setPhotos] = useState<ProjectDocPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoFilter, setPhotoFilter] = useState<string>('Semua');
  const [activePhotoModal, setActivePhotoModal] = useState<ProjectDocPhoto | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const fetchProjectPortalData = async () => {
      if (!id) {
        setError('ID Proyek tidak ditemukan.');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // 1. Fetch Project Details
        const { data: projData, error: projError } = await supabase
          .from('projects')
          .select('id, name, description, status, budget, user_id, created_at, clients(name, phone, address)')
          .eq('id', id)
          .single();

        if (projError || !projData) {
          setError('Proyek tidak ditemukan atau link sudah tidak berlaku.');
          setLoading(false);
          return;
        }

        setProject(projData as any);

        // 2. Fetch Tasks
        const { data: taskData } = await supabase
          .from('project_tasks')
          .select('id, title, is_completed, due_date, priority')
          .eq('project_id', id)
          .order('created_at', { ascending: true });

        const loadedTasks: Task[] = taskData || [];
        setTasks(loadedTasks);

        // 3. Calculate Progress
        let savedProgress = 0;
        try {
          const localProg = localStorage.getItem(`project-progress-${id}`);
          if (localProg) savedProgress = parseInt(localProg, 10);
        } catch {}

        if (savedProgress > 0) {
          setProgressPercent(savedProgress);
        } else if (loadedTasks.length > 0) {
          const completedCount = loadedTasks.filter(t => t.is_completed).length;
          setProgressPercent(Math.round((completedCount / loadedTasks.length) * 100));
        } else {
          const s = (projData.status || '').toLowerCase();
          if (s.includes('selesai') || s.includes('completed')) setProgressPercent(100);
          else if (s.includes('in progress') || s.includes('pengerjaan')) setProgressPercent(50);
          else setProgressPercent(25);
        }

        // 4. Fetch Documentation Photos from localStorage or Supabase
        try {
          const storedPhotos = localStorage.getItem(`project-doc-photos-${id}`);
          if (storedPhotos) {
            setPhotos(JSON.parse(storedPhotos));
          }
        } catch {}

      } catch (err: any) {
        console.error('Error fetching partner portal data:', err);
        setError('Terjadi kesalahan saat memuat data proyek.');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectPortalData();
  }, [id]);

  const filteredPhotos = useMemo(() => {
    if (photoFilter === 'Semua') return photos;
    return photos.filter(p => p.stage.toLowerCase().includes(photoFilter.toLowerCase()));
  }, [photos, photoFilter]);

  const handleExportBast = async () => {
    const reportElement = document.getElementById('project-report-pdf-area');
    if (!reportElement) return;

    setIsExportingPdf(true);
    try {
      await generatePdf(reportElement, `Laporan-Kerja-${project?.name.replace(/[^a-zA-Z0-9]/g, '-') || 'Proyek'}.pdf`, { format: 'f4' });
      showSuccess('Laporan Kerja & BAST berhasil diunduh!');
    } catch (e) {
      console.error(e);
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 flex flex-col items-center justify-center space-y-4">
        <Skeleton className="h-10 w-64 rounded-2xl bg-slate-800" />
        <Skeleton className="h-64 w-full max-w-4xl rounded-3xl bg-slate-900" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Portal Tidak Dapat Dibuka</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">{error || 'Link proyek tidak valid atau telah dihapus.'}</p>
        <Button asChild variant="outline" className="rounded-xl border-slate-800 text-slate-300">
          <Link to="/">Kembali ke Beranda</Link>
        </Button>
      </div>
    );
  }

  const completedTasksCount = tasks.filter(t => t.is_completed).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 font-sans pb-24">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full bg-sky-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        
        {/* Top Partner Navigation Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-md">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
                Portal Rekanan & Toko
              </span>
              <span className="text-sm font-extrabold text-white">
                Live Field Tracker
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportBast}
              disabled={isExportingPdf}
              size="sm"
              className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 gap-1.5 active:scale-95 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExportingPdf ? 'Mengekspor...' : 'Unduh Laporan Kerja (PDF)'}</span>
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* EXECUTIVE PROJECT HERO BANNER */}
        {/* ========================================================================= */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-indigo-950/60 p-5 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse mr-1.5" />
                  Live Tracking
                </Badge>
                <Badge variant="outline" className="text-xs font-semibold text-slate-300 border-slate-700">
                  {project.status || 'Dalam Pengerjaan'}
                </Badge>
              </div>

              <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                {project.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                {project.clients?.name && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Pemberi Tugas: <strong className="text-slate-200">{project.clients.name}</strong></span>
                  </div>
                )}
                {project.clients?.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-rose-400" />
                    <span className="truncate max-w-xs">{project.clients.address}</span>
                  </div>
                )}
                {project.created_at && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Mulai: {safeFormat(project.created_at, 'd MMMM yyyy')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Overall Progress Gauge Widget */}
            <div className="flex items-center gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 shrink-0">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Progres Lapangan</span>
                <span className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
                  {progressPercent}%
                </span>
                <span className="text-[11px] text-indigo-400 font-semibold block">
                  {progressPercent === 100 ? '🎉 Selesai 100%' : `${completedTasksCount}/${tasks.length || 5} Tahapan`}
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Large Visual Progress Bar */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-300">
              <span>Kemajuan Pekerjaan Lapangan</span>
              <span className="text-indigo-400">{progressPercent}% Selesai</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-slate-700/50">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5 STAGES TIMELINE ROADMAP */}
        {/* ========================================================================= */}
        <Card className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-950/40">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Tahapan Pekerjaan Lapangan
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Rincian milestone pengerjaan instalasi dari awal hingga serah terima selesai.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {STAGES.map((stage) => {
                const isPassed = progressPercent >= stage.percent;
                const isCurrent = progressPercent >= stage.percent - 20 && progressPercent < stage.percent;

                return (
                  <div
                    key={stage.step}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all space-y-2 relative overflow-hidden",
                      isPassed
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : isCurrent
                        ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-200 ring-1 ring-indigo-500/30"
                        : "bg-slate-950/40 border-slate-800/80 text-slate-400"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border",
                        isPassed 
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                          : isCurrent 
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      )}>
                        Step {stage.step}
                      </span>
                      {isPassed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : isCurrent ? (
                        <Clock className="h-4 w-4 text-indigo-400 animate-spin" />
                      ) : (
                        <span className="text-[10px] text-slate-500 font-bold">{stage.percent}%</span>
                      )}
                    </div>

                    <h4 className="font-bold text-xs text-white leading-tight">
                      {stage.label}
                    </h4>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {stage.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* CHECKLIST TUGAS LAPANGAN REAL-TIME */}
        {/* ========================================================================= */}
        <Card className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-emerald-400" />
                  Checklist Pekerjaan Lapangan
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  Item pekerjaan yang telah diselesaikan dan sedang diproses oleh teknisi.
                </CardDescription>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                {completedTasksCount} dari {tasks.length} Selesai
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-800/60">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-8 w-8 text-indigo-400 mx-auto mb-2 opacity-80" />
                <span>Teknisi sedang memproses seluruh rangkaian tahapan pekerjaan di lokasi.</span>
              </div>
            ) : (
              tasks.map((task, idx) => (
                <div key={task.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-6 w-6 rounded-lg flex items-center justify-center shrink-0 border",
                      task.is_completed 
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                        : "bg-slate-800 text-slate-500 border-slate-700"
                    )}>
                      {task.is_completed ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                    </div>
                    <span className={cn(
                      "text-xs font-semibold truncate",
                      task.is_completed ? "text-slate-200 line-through opacity-80" : "text-white"
                    )}>
                      {task.title}
                    </span>
                  </div>

                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] font-bold shrink-0",
                      task.is_completed 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    )}
                  >
                    {task.is_completed ? 'Selesai' : 'Dalam Proses'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* GALERI FOTO DOKUMENTASI LAPANGAN (BEFORE, IN PROGRESS, AFTER) */}
        {/* ========================================================================= */}
        <Card className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-400" />
                  Dokumentasi Foto Lapangan
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  Foto bukti pengerjaan teknisi di lapangan (Klik foto untuk memperbesar).
                </CardDescription>
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                {['Semua', 'Before', 'In Progress', 'After'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setPhotoFilter(f)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border",
                      photoFilter === f
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {filteredPhotos.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                <Layers className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-300">Belum ada foto dokumentasi</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                  Foto dokumentasi akan tampil di sini saat teknisi mengunggah progres pengerjaan di lokasi.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setActivePhotoModal(photo)}
                    className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-indigo-500/50 transition-all hover:scale-[1.02] shadow-md"
                  >
                    <div className="aspect-video sm:aspect-square w-full overflow-hidden bg-black/40 relative">
                      <img 
                        src={photo.url} 
                        alt={photo.title} 
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge className="text-[9px] font-black px-1.5 py-0.5 bg-black/70 text-white backdrop-blur-md border-0">
                          {photo.stage.includes('Before') ? 'Before' : photo.stage.includes('After') ? 'After' : 'Progress'}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-2.5 space-y-1">
                      <h5 className="font-bold text-xs text-white truncate">{photo.title}</h5>
                      <span className="text-[10px] text-slate-400 block">{safeFormat(photo.date, 'd MMM yyyy')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* BERITA ACARA SERAH TERIMA (BAST) & CONTACT PIC */}
        {/* ========================================================================= */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Berita Acara Serah Terima (BAST)</h3>
                <p className="text-xs text-slate-400">Dokumen resmi penyelesaian & jaminan garansi instalasi pekerjaan.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Status Serah Terima:</span>
                <span className="font-bold text-emerald-400">{progressPercent === 100 ? 'Pekerjaan Selesai & Teruji' : 'Sedang Berlangsung'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Garansi Pemasangan:</span>
                <span className="font-bold text-white">30 Hari Pasca Serah Terima</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Dokumen Pendukung:</span>
                <span className="font-semibold text-indigo-400">Foto Lapangan & Form Uji Fungsi</span>
              </div>
            </div>

            <Button
              onClick={handleExportBast}
              disabled={isExportingPdf}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 gap-2"
            >
              <Download className="h-4 w-4" />
              <span>Cetak Berita Acara (BAST) & Laporan Kerja</span>
            </Button>
          </Card>

          {/* Card Kontak Teknisi */}
          <Card className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Hubungi Teknisi</h3>
                <p className="text-xs text-slate-400">Kordinasi teknis di lokasi.</p>
              </div>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Jika ada penyesuaian titik atau instruksi khusus dari pihak toko, silakan hubungi tim kami.
              </p>
            </div>

            {project.clients?.phone && (
              <Button asChild variant="outline" className="w-full h-10 rounded-xl border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-bold gap-2">
                <a href={`https://wa.me/${project.clients.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">
                  <Phone className="h-3.5 w-3.5 text-emerald-400" />
                  <span>WhatsApp Lapangan</span>
                </a>
              </Button>
            )}
          </Card>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* HIDDEN PRINT / PDF REPORT AREA FOR BAST & WORK COMPLETION */}
      {/* ========================================================================= */}
      <div className="hidden">
        <div id="project-report-pdf-area" className="p-8 bg-white text-slate-900 max-w-[800px] mx-auto font-sans space-y-6">
          {/* Header Report */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">BERITA ACARA SERAH TERIMA (BAST)</h2>
              <p className="text-xs text-slate-600 mt-1 font-semibold">LAPORAN PENYELESAIAN PEKERJAAN INSTALASI & JASA LAPANGAN</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold text-slate-900">TANGGAL: {safeFormat(new Date().toISOString(), 'd MMMM yyyy')}</p>
              <p className="text-slate-500">KODE PROYEK: #{project.id.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>

          {/* Project Details */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-slate-500 font-semibold">NAMA PROYEK / PEKERJAAN:</p>
              <p className="font-bold text-sm text-slate-900 mt-0.5">{project.name}</p>
              <p className="text-slate-600 mt-1">{project.description || 'Instalasi & konfigurasi teknis lapangan'}</p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold">PIHAK REKANAN / TOKO / KLIEN:</p>
              <p className="font-bold text-sm text-slate-900 mt-0.5">{project.clients?.name || '-'}</p>
              <p className="text-slate-600 mt-1">{project.clients?.address || '-'}</p>
            </div>
          </div>

          {/* Tasks Done Checklist */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Daftar Pekerjaan Yang Diselesaikan:</h4>
            <table className="w-full text-xs border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                <tr>
                  <th className="py-2 px-3 text-left w-10">No</th>
                  <th className="py-2 px-3 text-left">Uraian Pekerjaan</th>
                  <th className="py-2 px-3 text-center w-24">Hasil Uji</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tasks.length > 0 ? (
                  tasks.map((t, idx) => (
                    <tr key={t.id}>
                      <td className="py-2 px-3 text-center font-bold">{idx + 1}</td>
                      <td className="py-2 px-3">{t.title}</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-600">BAIK / LULUS</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-center text-slate-500">Semua instalasi telah berfungsi normal sesuai spesifikasi teknis.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Statement */}
          <p className="text-xs text-slate-600 leading-relaxed">
            Dengan ini kedua belah pihak menyatakan bahwa pekerjaan di atas telah diselesaikan dengan baik, diuji fungsinya, dan diserahterimakan dalam kondisi beroperasi normal.
          </p>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
            <div>
              <p className="font-semibold text-slate-600">Pihak Pertama (Teknisi / Pelaksana)</p>
              <div className="h-20 flex items-center justify-center">
                <span className="text-[10px] text-slate-400 italic">( Tanda Tangan & Cap )</span>
              </div>
              <p className="font-bold border-t border-slate-400 pt-1">Pelaksana Teknis</p>
            </div>
            <div>
              <p className="font-semibold text-slate-600">Pihak Kedua (Toko / Partner / Klien)</p>
              <div className="h-20 flex items-center justify-center">
                <span className="text-[10px] text-slate-400 italic">( Tanda Tangan & Cap )</span>
              </div>
              <p className="font-bold border-t border-slate-400 pt-1">{project.clients?.name || 'Pemberi Kerja'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Image Lightbox Modal */}
      {activePhotoModal && (
        <div 
          onClick={() => setActivePhotoModal(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div 
            onClick={e => e.stopPropagation()} 
            className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-3 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">{activePhotoModal.title}</h4>
                <span className="text-xs text-slate-400">{safeFormat(activePhotoModal.date, 'd MMMM yyyy')} • {activePhotoModal.stage}</span>
              </div>
              <Button 
                onClick={() => setActivePhotoModal(null)}
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-white"
              >
                ✕
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded-2xl bg-black flex items-center justify-center">
              <img src={activePhotoModal.url} alt={activePhotoModal.title} className="max-h-[70vh] w-auto object-contain" />
            </div>
            {activePhotoModal.notes && (
              <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                {activePhotoModal.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPartnerPortal;
