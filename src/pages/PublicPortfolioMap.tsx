import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BORNEO_ETAM_PACKAGES,
  BorneoPresetPackage,
  KALTIM_REGIONS,
  KaltimCityKey,
  PublicPortfolioInstallation,
  ServiceType,
  fetchPublicPortfolioInstallations,
  loadBorneoPackages,
} from '@/services/cctvCommandService';
import { CCTVLeafletMap, MapMarkerItem } from '@/components/CCTVLeafletMap';
import { InstallationPhotoGallery } from '@/components/InstallationPhotoGallery';
import { SurveyRequestDialog } from '@/components/SurveyRequestDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import {
  Calendar,
  CheckCircle2,
  Crosshair,
  Search,
  Shield,
  Sparkles,
  Star,
  X,
  Lock,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

const PublicPortfolioMap: React.FC = () => {
  const [items, setItems] = useState<PublicPortfolioInstallation[]>([]);
  const [packages] = useState<BorneoPresetPackage[]>(() => loadBorneoPackages());
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<KaltimCityKey>('ALL');
  const [serviceFilter, setServiceFilter] = useState<'ALL' | ServiceType>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);

  // Survey Modal state
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);
  const [selectedPresetName, setSelectedPresetName] = useState<string>(
    BORNEO_ETAM_PACKAGES[0].shortName
  );
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType>('CCTV');

  useEffect(() => {
    fetchPublicPortfolioInstallations().then((data) => {
      setItems(data);
      if (data.length > 0) setSelectedId(data[0].id);
      setLoading(false);
    });
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (cityFilter !== 'ALL' && item.city !== cityFilter) return false;
      if (serviceFilter !== 'ALL' && item.service_type !== serviceFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${item.public_display_name} ${item.city} ${item.area_landmark} ${item.hardware_specs} ${item.package_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, cityFilter, serviceFilter, searchQuery]);

  const mapMarkers: MapMarkerItem[] = useMemo(() => {
    return filteredItems.map((it) => ({
      id: it.id,
      title: it.public_display_name,
      subtitle: it.area_landmark,
      city: it.city,
      service_type: it.service_type,
      package_name: it.package_name,
      lat: it.fuzzy_lat,
      lng: it.fuzzy_lng,
      progress: it.progress,
      warranty_months: it.warranty_months,
      rating: it.rating,
      review_text: it.review_text,
      hardware_specs: it.hardware_specs,
      photos: it.photos,
      isPublicMode: true,
    }));
  }, [filteredItems]);

  const activeShowcase = useMemo(
    () => filteredItems.find((i) => i.id === selectedId) || filteredItems[0] || null,
    [filteredItems, selectedId]
  );

  const handleOpenSurveyForPackage = (pkgName: string, sType: ServiceType) => {
    setSelectedPresetName(pkgName);
    setSelectedServiceType(sType);
    setIsSurveyOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-teal-500 selection:text-white">
      <SurveyRequestDialog
        isOpen={isSurveyOpen}
        setIsOpen={setIsSurveyOpen}
        defaultPackageName={selectedPresetName}
        defaultServiceType={selectedServiceType}
      />

      {/* Top Sticky Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1720px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-600 to-teal-800 text-white shadow-md shadow-teal-700/25">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm sm:text-base tracking-tight text-foreground truncate">
                  Borneo Etam CCTV & POS
                </span>
                <Badge className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 text-[9px] font-black px-1.5 py-0">
                  KALTIM
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Peta Portofolio Resmi & Layanan Instalasi Bergaransi 12 Bulan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() =>
                handleOpenSurveyForPackage(BORNEO_ETAM_PACKAGES[0].shortName, 'CCTV')
              }
              className="h-9 sm:h-10 rounded-xl text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-sm"
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>📅 Minta Jadwal Survei Gratis</span>
            </Button>
            <ThemeToggle />
            <Button
              size="sm"
              variant="outline"
              asChild
              className="hidden sm:inline-flex h-9 rounded-xl text-xs font-bold"
            >
              <Link to="/cctv-command">
                <Lock className="mr-1.5 h-3 w-3 text-muted-foreground" /> Admin
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1720px] space-y-5 px-3 sm:px-5 lg:px-6 py-4 pb-20">
        {/* Compact Top Filter & Title Bar */}
        <section className="rounded-2xl border border-border/80 bg-card px-4 py-3.5 sm:px-5 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Bukti Karya Terverifikasi Se-Kalimantan Timur
                </Badge>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  🛡️ Garansi Resmi 1 Tahun (12 Bulan) • {items.length}+ Titik Terpasang • 4.9★ Rating
                </Badge>
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground">
                Peta Titik Pemasangan CCTV & Komputer Kasir POS
              </h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center lg:w-[680px]">
              <div className="relative sm:col-span-5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari kota, minimarket, cafe, apotek..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 h-9 rounded-xl text-xs bg-background"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="sm:col-span-4">
                <Select
                  value={cityFilter}
                  onValueChange={(v) => setCityFilter(v as KaltimCityKey)}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-background">
                    <SelectValue placeholder="Pilih Kota Kaltim" />
                  </SelectTrigger>
                  <SelectContent>
                    {KALTIM_REGIONS.map((reg) => (
                      <SelectItem key={reg.key} value={reg.key}>
                        {reg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-3">
                <Select
                  value={serviceFilter}
                  onValueChange={(v) => setServiceFilter(v as 'ALL' | ServiceType)}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-background">
                    <SelectValue placeholder="Pilih Layanan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Layanan</SelectItem>
                    <SelectItem value="CCTV">📹 Instalasi CCTV</SelectItem>
                    <SelectItem value="POS">🖥️ Kasir POS</SelectItem>
                    <SelectItem value="BUNDLING">🏪 Bundling CCTV + POS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* FULL-WIDTH GIS MAP RIGHT AT THE TOP + DOCKED SHOWCASE PANEL */}
        <section className="w-full">
          <CCTVLeafletMap
            items={mapMarkers}
            selectedId={activeShowcase?.id || null}
            onSelectMarker={(id) => {
              setSelectedId(id);
              setIsDrawerOpen(true);
            }}
            activeCity={cityFilter}
            onCityQuickJump={(city) => setCityFilter(city)}
            isPublicPortfolio={true}
            heightClass="lg:h-[600px]"
            rightPanel={
              isDrawerOpen ? (
                <div className="flex flex-col justify-between h-full bg-card">
                  {activeShowcase ? (
                    <>
                      <div className="border-b border-border/70 bg-muted/25 p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 text-[10px] font-extrabold">
                            {activeShowcase.service_type} • {activeShowcase.city}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-black text-amber-500">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              {activeShowcase.rating.toFixed(1)}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 rounded-lg border-border/80 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted"
                              onClick={() => setIsDrawerOpen(false)}
                              title="Tutup Panel Detail"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-foreground leading-snug">
                          {activeShowcase.public_display_name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          📍 {activeShowcase.area_landmark}
                        </p>
                      </div>

                      <div className="flex-1 p-4 space-y-3.5 overflow-y-auto">
                        {/* Galeri Foto Hasil Instalasi */}
                        <InstallationPhotoGallery
                          photos={activeShowcase.photos || []}
                          projectTitle={activeShowcase.public_display_name}
                          editable={false}
                          compact={false}
                        />

                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                            {activeShowcase.progress === 100
                              ? '🟢 Terpasang & Beroperasi'
                              : `🟡 Pengerjaan Teknis (${activeShowcase.progress}%)`}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Garansi {activeShowcase.warranty_months} Bln
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Spesifikasi Perangkat Terpasang:
                          </div>
                          <div className="rounded-xl bg-muted/40 border border-border/60 p-3 text-xs font-semibold text-foreground">
                            🔧 {activeShowcase.hardware_specs}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Ulasan Pelanggan:
                          </div>
                          <blockquote className="rounded-xl border-l-4 border-teal-500 bg-muted/20 p-3 text-xs italic text-foreground/90">
                            "{activeShowcase.review_text}"
                          </blockquote>
                        </div>
                      </div>

                      <div className="border-t border-border/70 bg-muted/20 p-3.5">
                        <Button
                          onClick={() =>
                            handleOpenSurveyForPackage(
                              activeShowcase.package_name,
                              activeShowcase.service_type
                            )
                          }
                          className="w-full h-10 rounded-xl text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Minta Survei Paket Serupa di Lokasi Saya
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      Pilih titik di peta untuk melihat detail spesifikasi & ulasan pelanggan.
                    </div>
                  )}
                </div>
              ) : undefined
            }
          />
        </section>

        {/* Kalkulator & Katalog Paket Resmi Borneo Etam */}
        <section className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-teal-500" />
                Daftar Paket Pemasangan Resmi (Terima Beres + Garansi 12 Bulan)
              </h2>
              <p className="text-xs text-muted-foreground">
                Harga transparan sudah termasuk perangkat baru original, kabel, instalasi rapi, dan setting pantau HP.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map((pkg) => {
              const coverPhoto =
                Array.isArray(pkg.photos) && pkg.photos.length > 0 ? pkg.photos[0] : null;
              return (
                <Card
                  key={pkg.id}
                  className="group overflow-hidden rounded-2xl border border-border/80 bg-card hover:border-teal-500/60 transition-all flex flex-col justify-between shadow-xs"
                >
                  {coverPhoto && (
                    <div className="relative h-40 w-full overflow-hidden bg-muted/40 border-b border-border/60">
                      <img
                        src={coverPhoto}
                        alt={pkg.shortName}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />
                      <div className="absolute top-2.5 left-2.5">
                        <Badge className="bg-black/75 backdrop-blur-md text-teal-300 border-teal-400/40 text-[10px] font-extrabold">
                          {pkg.badge}
                        </Badge>
                      </div>
                      <div className="absolute bottom-2.5 right-2.5">
                        <span className="rounded-md bg-black/75 backdrop-blur-md border border-white/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          🛡️ Garansi {pkg.warrantyMonths || 12} Bln
                        </span>
                      </div>
                    </div>
                  )}

                  <CardHeader className="p-4 pb-2 space-y-1.5">
                    {!coverPhoto && (
                      <div className="flex items-center justify-between">
                        <Badge className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 text-[10px] font-extrabold">
                          {pkg.badge}
                        </Badge>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          🛡️ Garansi {pkg.warrantyMonths || 12} Bln
                        </span>
                      </div>
                    )}
                    <CardTitle className="text-base font-black text-foreground">
                      {pkg.shortName}
                    </CardTitle>
                    <div className="text-2xl font-black text-teal-600 dark:text-teal-400 tabular-nums">
                      {formatCurrency(pkg.totalPrice)}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {pkg.description}
                      </p>
                      <ul className="space-y-1 border-t border-border/60 pt-2 text-[11px] text-foreground/90">
                        {pkg.items
                          .filter((i) => i.quantity > 0)
                          .slice(0, 4)
                          .map((it, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{it.description}</span>
                            </li>
                          ))}
                      </ul>
                    </div>

                    <Button
                      onClick={() =>
                        handleOpenSurveyForPackage(pkg.shortName, pkg.service_type)
                      }
                      className="w-full h-10 rounded-xl text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                    >
                      <Crosshair className="h-3.5 w-3.5" />
                      Jadwalkan Survei Paket Ini
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};

export default PublicPortfolioMap;
