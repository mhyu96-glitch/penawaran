import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Receipt, FolderKanban, TrendingUp, Sparkles, 
  ArrowRight, ShieldCheck, CheckCircle2, LayoutDashboard, 
  Plus, CreditCard, ChevronRight, Calculator, PieChart, Briefcase
} from "lucide-react";

const Index = () => {
  const { session, loading } = useAuth();

  const features = [
    {
      icon: FileText,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      title: "Penawaran & PDF 1 Halaman",
      description: "Buat surat penawaran harga profesional dengan kop surat kustom, katalog barang/jasa, dan ekspor PDF pas 1 halaman tanpa terpotong."
    },
    {
      icon: Receipt,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      title: "Faktur & Kalkulator DP Otomatis",
      description: "Hitung uang muka (DP 30%, 50%, atau persentase kustom) secara otomatis, pantau sisa pelunasan, dan catat kuitansi pembayaran."
    },
    {
      icon: FolderKanban,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      title: "Manajemen Proyek & Arus Kas",
      description: "Papan Kanban interaktif, checklist pengadaan barang (BOM), dokumentasi foto lapangan, dan pantauan kas riil masuk vs keluar."
    },
    {
      icon: TrendingUp,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-500/20",
      title: "Analisis Profit & Margin Riil",
      description: "Laporan profitabilitas otomatis yang memisahkan pendapatan jasa vs margin barang, akumulasi gaji teknisi, BBM, dan operasional."
    }
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden flex flex-col justify-between">
      {/* Ambient Gradient Background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-primary/15 blur-[120px] rounded-full opacity-70 dark:opacity-40" />
        <div className="absolute top-1/3 -left-20 w-[400px] h-[400px] bg-emerald-500/10 blur-[100px] rounded-full opacity-50" />
        <div className="absolute bottom-10 -right-20 w-[400px] h-[400px] bg-amber-500/10 blur-[100px] rounded-full opacity-40" />
      </div>

      {/* Main Hero Container */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 max-w-6xl space-y-12 sm:space-y-16">
        
        {/* Top Header Badge & Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-black tracking-tight text-foreground">Aplikasi Penawaran</h2>
              <p className="text-[11px] font-semibold text-muted-foreground">Quotation & Project Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading ? (
              <Skeleton className="h-9 w-28 rounded-xl" />
            ) : session ? (
              <Button asChild size="sm" variant="outline" className="rounded-xl font-bold text-xs border-border/80 hover:bg-muted">
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Dashboard
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
                <Link to="/login">
                  Masuk
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Hero Headline & CTA */}
        <div className="text-center space-y-6 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold shadow-2xs backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>Sistem Pembuatan Penawaran & Manajemen Proyek Pintar</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.15]">
            Kelola Penawaran, Faktur & Finansial Proyek <span className="bg-gradient-to-r from-primary via-emerald-400 to-amber-400 bg-clip-text text-transparent">Lebih Cepat</span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto font-medium">
            Platform terpadu untuk membuat surat penawaran harga instan, manajemen termin DP & pelunasan kas, pemantauan proyek fisik, hingga analisis laba riil otomatis.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {loading ? (
              <Skeleton className="h-12 w-48 rounded-2xl" />
            ) : session ? (
              <>
                <Button asChild size="lg" className="h-12 px-7 rounded-2xl font-black text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 transition-all w-full sm:w-auto">
                  <Link to="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Buka Dashboard Utama
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6 rounded-2xl font-bold text-sm border-border/80 hover:bg-muted w-full sm:w-auto">
                  <Link to="/quotes/new">
                    <Plus className="mr-2 h-4 w-4 text-emerald-500" />
                    Buat Penawaran Baru
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg" className="h-12 px-8 rounded-2xl font-black text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 transition-all w-full sm:w-auto">
                  <Link to="/login">
                    Mulai Sekarang
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6 rounded-2xl font-bold text-sm border-border/80 hover:bg-muted w-full sm:w-auto">
                  <Link to="/login">
                    Masuk ke Akun
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Value Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Ekspor PDF 1 Halaman Rapi
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Kalkulator DP & Sisa Pelunasan
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Laporan Margin & Profit Real-time
            </span>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-4">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-3xl border border-border/70 bg-card/60 hover:bg-card/90 backdrop-blur-md p-6 sm:p-7 transition-all duration-200 hover:border-primary/40 hover:shadow-xl space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className={`h-12 w-12 rounded-2xl ${feature.bgColor} ${feature.borderColor} border flex items-center justify-center ${feature.color} shadow-xs transition-transform group-hover:scale-105`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-border/60">
                    Modul 0{idx + 1}
                  </Badge>
                </div>
                <h3 className="text-lg font-black text-foreground group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Workflow Strip Card */}
        <div className="rounded-3xl border border-border/70 bg-gradient-to-r from-muted/30 via-muted/10 to-muted/30 p-6 sm:p-8 backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center md:text-left">
              <h4 className="text-base font-black text-foreground flex items-center justify-center md:justify-start gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Alur Kerja Terintegrasi dari Penawaran hingga Pelunasan
              </h4>
              <p className="text-xs text-muted-foreground max-w-xl">
                Surat Penawaran dibuat $\rightarrow$ Klien setuju $\rightarrow$ Konversi jadi Faktur dengan DP $\rightarrow$ Proyek berjalan & BOM dipantau $\rightarrow$ Pelunasan & Laporan Laba Bersih.
              </p>
            </div>
            {session ? (
              <Button asChild className="rounded-xl h-11 px-5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs">
                <Link to="/dashboard">
                  Mulai Bekerja Sekarang <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild className="rounded-xl h-11 px-5 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-xs">
                <Link to="/login">
                  Masuk Sekarang <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground font-medium bg-card/40 backdrop-blur-xs">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} Aplikasi Penawaran & Manajemen Proyek. All rights reserved.</span>
          <span className="text-[11px] text-muted-foreground/80">Dirancang untuk kecepatan, akurasi finansial & kemudahan operasional.</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
