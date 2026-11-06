import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SessionContext';
import {
  BORNEO_ETAM_PACKAGES,
  BorneoPresetPackage,
  CCTVInstallation,
  KALTIM_REGIONS,
  KaltimCityKey,
  PresetPackageItem,
  ServiceType,
  calculateWarrantyStatus,
  deleteBorneoPackage,
  deleteCCTVInstallation,
  exportInstallationsToCSV,
  fetchCCTVInstallations,
  loadBorneoPackages,
  resetBorneoPackagesToDefault,
  saveBorneoPackage,
  saveCCTVInstallation,
  toPublicPortfolioItem,
} from '@/services/cctvCommandService';
import { CCTVLeafletMap, MapMarkerItem } from '@/components/CCTVLeafletMap';
import { InstallationPhotoGallery } from '@/components/InstallationPhotoGallery';
import { SurveyRequestDialog } from '@/components/SurveyRequestDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { cn, formatCurrency } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import {
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Download,
  Edit3,
  ExternalLink,
  FilePlus2,
  FileText,
  HardDrive,
  ImagePlus,
  MapPin,
  Navigation,
  PanelRightClose,
  PanelRightOpen,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

const CCTVCommandCenter: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [installations, setInstallations] = useState<CCTVInstallation[]>([]);
  const [loading, setLoading] = useState(true);

  // Dual-Mode Experience toggle inside Command Center
  const [viewMode, setViewMode] = useState<'admin' | 'public_preview'>('admin');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<KaltimCityKey>('ALL');
  const [serviceFilter, setServiceFilter] = useState<'ALL' | ServiceType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DONE' | 'WORKING' | 'SURVEY'>('ALL');

  // Selected project & Floating Inspector Drawer state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  // Inspector inline edit state
  const [editProgress, setEditProgress] = useState<number>(100);
  const [editSnNvr, setEditSnNvr] = useState<string>('');
  const [editSnHdd, setEditSnHdd] = useState<string>('');
  const [editInstalledAt, setEditInstalledAt] = useState<string>('');
  const [editIsPublic, setEditIsPublic] = useState<boolean>(true);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [savingInspector, setSavingInspector] = useState(false);

  // Modals state
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CCTVInstallation | null>(null);

  // Add/Edit Form state
  const [formProjectName, setFormProjectName] = useState('');
  const [formPublicName, setFormPublicName] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formClientPhone, setFormClientPhone] = useState('');
  const [formCity, setFormCity] = useState('Samarinda');
  const [formAddress, setFormAddress] = useState('');
  const [formServiceType, setFormServiceType] = useState<ServiceType>('CCTV');
  const [formPackageName, setFormPackageName] = useState(BORNEO_ETAM_PACKAGES[0].shortName);
  const [formLat, setFormLat] = useState('-0.5022');
  const [formLng, setFormLng] = useState('117.1536');
  const [formProgress, setFormProgress] = useState(100);
  const [formSnNvr, setFormSnNvr] = useState('');
  const [formSnHdd, setFormSnHdd] = useState('');
  const [formSpecs, setFormSpecs] = useState('');
  const [formInstalledAt, setFormInstalledAt] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [formWarrantyMonths, setFormWarrantyMonths] = useState(12);
  const [formReviewText, setFormReviewText] = useState('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [formIsPublic, setFormIsPublic] = useState(true);

  // Preset Packages State & Edit Modal
  const [packages, setPackages] = useState<BorneoPresetPackage[]>(() => loadBorneoPackages());
  const [isEditPackageOpen, setIsEditPackageOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [pkgShortName, setPkgShortName] = useState('');
  const [pkgFullName, setPkgFullName] = useState('');
  const [pkgServiceType, setPkgServiceType] = useState<ServiceType>('CCTV');
  const [pkgBadge, setPkgBadge] = useState('');
  const [pkgTotalPrice, setPkgTotalPrice] = useState<number>(0);
  const [pkgEstimatedCost, setPkgEstimatedCost] = useState<number>(0);
  const [pkgWarrantyMonths, setPkgWarrantyMonths] = useState<number>(12);
  const [pkgDescription, setPkgDescription] = useState('');
  const [pkgDefaultTerms, setPkgDefaultTerms] = useState('');
  const [pkgPhotos, setPkgPhotos] = useState<string[]>([]);
  const [pkgItems, setPkgItems] = useState<PresetPackageItem[]>([]);

  const handleOpenEditPackage = (pkg?: BorneoPresetPackage | null) => {
    if (pkg) {
      setEditingPackageId(pkg.id);
      setPkgShortName(pkg.shortName);
      setPkgFullName(pkg.name);
      setPkgServiceType(pkg.service_type);
      setPkgBadge(pkg.badge);
      setPkgTotalPrice(pkg.totalPrice);
      setPkgEstimatedCost(pkg.estimatedCost);
      setPkgWarrantyMonths(pkg.warrantyMonths || 12);
      setPkgDescription(pkg.description);
      setPkgDefaultTerms(pkg.defaultTerms || '');
      setPkgPhotos(Array.isArray(pkg.photos) ? pkg.photos : []);
      setPkgItems(Array.isArray(pkg.items) ? pkg.items.map((it) => ({ ...it })) : []);
    } else {
      setEditingPackageId(null);
      setPkgShortName('Paket Custom Baru');
      setPkgFullName('Paket Instalasi CCTV / Kasir POS Borneo Etam');
      setPkgServiceType('CCTV');
      setPkgBadge('Paket Rekomendasi');
      setPkgTotalPrice(4500000);
      setPkgEstimatedCost(3100000);
      setPkgWarrantyMonths(12);
      setPkgDescription('Deskripsi singkat perangkat utama, jumlah titik kamera / set kasir, kabel & jasa instalasi.');
      setPkgDefaultTerms(BORNEO_ETAM_PACKAGES[0].defaultTerms);
      setPkgPhotos([]);
      setPkgItems([
        { description: '=== PERANGKAT UTAMA & JASA INSTALASI ===', quantity: 0, unit: 'Header', unit_price: 0, cost_price: 0 },
        { description: 'Paket Perangkat Utama + Instalasi Terima Beres', quantity: 1, unit: 'Paket', unit_price: 4500000, cost_price: 3100000 },
      ]);
    }
    setIsEditPackageOpen(true);
  };

  const handleRecalculatePackageFromItems = () => {
    const regularItems = pkgItems.filter((it) => Number(it.quantity) > 0);
    if (regularItems.length === 0) return;
    const calcPrice = regularItems.reduce(
      (sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price || 0),
      0
    );
    const calcCost = regularItems.reduce(
      (sum, it) => sum + Number(it.quantity || 0) * Number(it.cost_price || 0),
      0
    );
    setPkgTotalPrice(calcPrice);
    setPkgEstimatedCost(calcCost);
    showSuccess('Harga jual & HPP dihitung otomatis dari rincian item!');
  };

  const handleSavePackageForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgShortName.trim()) {
      showError('Nama paket wajib diisi.');
      return;
    }
    const id = editingPackageId || `paket-custom-${Date.now().toString(36)}`;
    const updatedList = saveBorneoPackage({
      id,
      shortName: pkgShortName.trim(),
      name: pkgFullName.trim() || pkgShortName.trim(),
      service_type: pkgServiceType,
      badge: pkgBadge.trim() || 'Paket Resmi',
      totalPrice: Number(pkgTotalPrice) || 0,
      estimatedCost: Number(pkgEstimatedCost) || 0,
      highlight: `Rp ${(Number(pkgTotalPrice) || 0).toLocaleString('id-ID')}`,
      description: pkgDescription.trim(),
      warrantyMonths: Number(pkgWarrantyMonths) || 12,
      defaultTerms: pkgDefaultTerms,
      photos: pkgPhotos,
      items: pkgItems,
    });
    setPackages(updatedList);
    setIsEditPackageOpen(false);
    showSuccess(`Paket "${pkgShortName}" & foto berhasil disimpan!`);
  };

  const handleDeletePackageItem = (pkgId: string, pkgName: string) => {
    if (!window.confirm(`Hapus paket "${pkgName}" dari daftar?`)) return;
    const next = deleteBorneoPackage(pkgId);
    setPackages(next);
    setIsEditPackageOpen(false);
    showSuccess(`Paket "${pkgName}" dihapus.`);
  };

  const handleResetPackages = () => {
    if (!window.confirm('Kembalikan ke 4 Paket Standar awal Borneo Etam?')) return;
    const def = resetBorneoPackagesToDefault();
    setPackages(def);
    showSuccess('Daftar paket dikembalikan ke pengaturan awal.');
  };

  const loadData = async () => {
    setLoading(true);
    const data = await fetchCCTVInstallations(user?.id);
    setInstallations(data);
    if (data.length > 0 && !selectedId) {
      setSelectedId(data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const selectedProject = useMemo(
    () => installations.find((i) => i.id === selectedId) || installations[0] || null,
    [installations, selectedId]
  );

  useEffect(() => {
    if (selectedProject) {
      setEditProgress(selectedProject.progress);
      setEditSnNvr(selectedProject.sn_nvr || '');
      setEditSnHdd(selectedProject.sn_hdd || '');
      setEditInstalledAt(
        selectedProject.installed_at || format(new Date(), 'yyyy-MM-dd')
      );
      setEditIsPublic(selectedProject.is_public_portfolio);
      setEditNotes(selectedProject.notes || '');
      setEditPhotos(Array.isArray(selectedProject.photos) ? selectedProject.photos : []);
    }
  }, [selectedProject]);

  // Filtered Installations
  const filteredInstallations = useMemo(() => {
    return installations.filter((item) => {
      if (viewMode === 'public_preview' && (!item.is_public_portfolio || item.progress === 0)) {
        return false;
      }
      if (cityFilter !== 'ALL' && item.city !== cityFilter) {
        return false;
      }
      if (serviceFilter !== 'ALL' && item.service_type !== serviceFilter) {
        return false;
      }
      if (statusFilter === 'DONE' && item.progress !== 100) return false;
      if (statusFilter === 'WORKING' && (item.progress <= 0 || item.progress >= 100)) return false;
      if (statusFilter === 'SURVEY' && item.progress !== 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = [
          item.project_name,
          item.public_display_name,
          item.client_name,
          item.client_phone,
          item.city,
          item.address_landmark,
          item.sn_nvr,
          item.sn_hdd,
          item.hardware_specs,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [installations, viewMode, cityFilter, serviceFilter, statusFilter, searchQuery]);

  // Convert to Map Markers
  const mapMarkers: MapMarkerItem[] = useMemo(() => {
    return filteredInstallations.map((item) => {
      if (viewMode === 'public_preview') {
        const pub = toPublicPortfolioItem(item);
        return {
          id: pub.id,
          title: pub.public_display_name,
          subtitle: pub.area_landmark,
          city: pub.city,
          service_type: pub.service_type,
          package_name: pub.package_name,
          lat: pub.fuzzy_lat,
          lng: pub.fuzzy_lng,
          progress: pub.progress,
          installed_at: item.installed_at,
          warranty_months: pub.warranty_months,
          rating: pub.rating,
          review_text: pub.review_text,
          hardware_specs: pub.hardware_specs,
          photos: pub.photos,
          isPublicMode: true,
        };
      }
      return {
        id: item.id,
        title: item.project_name,
        subtitle: `${item.client_name} • ${item.address_landmark}`,
        city: item.city,
        service_type: item.service_type,
        package_name: item.package_name,
        lat: item.latitude,
        lng: item.longitude,
        progress: item.progress,
        installed_at: item.installed_at,
        warranty_months: item.warranty_months,
        rating: item.rating,
        review_text: item.review_text,
        hardware_specs: item.hardware_specs,
        photos: item.photos || [],
        isPublicMode: false,
      };
    });
  }, [filteredInstallations, viewMode]);

  // KPI Metrics
  const kpiStats = useMemo(() => {
    const total = installations.length;
    const done = installations.filter((i) => i.progress === 100).length;
    const working = installations.filter((i) => i.progress > 0 && i.progress < 100).length;
    const survey = installations.filter((i) => i.progress === 0).length;

    let activeWarranty = 0;
    let warningH30 = 0;
    let expiredWarranty = 0;

    installations.forEach((i) => {
      const w = calculateWarrantyStatus(i.installed_at, i.warranty_months, i.progress);
      if (w.status === 'active') activeWarranty++;
      else if (w.status === 'warning_h30') warningH30++;
      else if (w.status === 'expired') expiredWarranty++;
    });

    return {
      total,
      done,
      working,
      survey,
      activeWarranty,
      warningH30,
      expiredWarranty,
    };
  }, [installations]);

  const handleInspectorPhotosChange = async (newPhotos: string[]) => {
    setEditPhotos(newPhotos);
    if (!selectedProject) return;
    const updated = await saveCCTVInstallation(
      {
        ...selectedProject,
        photos: newPhotos,
      },
      user?.id
    );
    setInstallations((prev) =>
      prev.map((x) => (x.id === updated.id ? updated : x))
    );
  };

  const handleSaveInspector = async () => {
    if (!selectedProject) return;
    setSavingInspector(true);
    try {
      const updated = await saveCCTVInstallation(
        {
          ...selectedProject,
          progress: editProgress,
          sn_nvr: editSnNvr.trim(),
          sn_hdd: editSnHdd.trim(),
          installed_at:
            editProgress === 100
              ? editInstalledAt || format(new Date(), 'yyyy-MM-dd')
              : selectedProject.installed_at,
          is_public_portfolio: editIsPublic,
          notes: editNotes,
          photos: editPhotos,
        },
        user?.id
      );

      setInstallations((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x))
      );
      showSuccess('Progres, Foto, Serial Number & Garansi berhasil diperbarui!');
    } catch {
      showError('Gagal menyimpan perubahan.');
    } finally {
      setSavingInspector(false);
    }
  };

  const handleOpenAddModal = (item?: CCTVInstallation) => {
    if (item) {
      setEditingItem(item);
      setFormProjectName(item.project_name);
      setFormPublicName(item.public_display_name);
      setFormClientName(item.client_name);
      setFormClientPhone(item.client_phone);
      setFormCity(item.city);
      setFormAddress(item.address_landmark);
      setFormServiceType(item.service_type);
      setFormPackageName(item.package_name);
      setFormLat(String(item.latitude));
      setFormLng(String(item.longitude));
      setFormProgress(item.progress);
      setFormSnNvr(item.sn_nvr);
      setFormSnHdd(item.sn_hdd);
      setFormSpecs(item.hardware_specs);
      setFormInstalledAt(item.installed_at || format(new Date(), 'yyyy-MM-dd'));
      setFormWarrantyMonths(item.warranty_months || 12);
      setFormReviewText(item.review_text || '');
      setFormPhotos(Array.isArray(item.photos) ? item.photos : []);
      setFormIsPublic(item.is_public_portfolio);
    } else {
      setEditingItem(null);
      setFormProjectName('');
      setFormPublicName('');
      setFormClientName('');
      setFormClientPhone('');
      setFormCity('Samarinda');
      setFormAddress('');
      setFormServiceType('CCTV');
      setFormPackageName(BORNEO_ETAM_PACKAGES[0].shortName);
      setFormLat('-0.5022');
      setFormLng('117.1536');
      setFormProgress(100);
      setFormSnNvr('');
      setFormSnHdd('');
      setFormSpecs('4Ch / 8Ch Kamera Full HD + Harddisk WD Purple');
      setFormInstalledAt(format(new Date(), 'yyyy-MM-dd'));
      setFormWarrantyMonths(12);
      setFormReviewText('Instalasi rapi, gambar jernih, dan teknisi sangat komunikatif.');
      setFormPhotos([]);
      setFormIsPublic(true);
    }
    setIsAddEditOpen(true);
  };

  const handleSaveModalForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectName.trim() || !formClientName.trim()) {
      showError('Nama proyek dan nama klien wajib diisi.');
      return;
    }

    const saved = await saveCCTVInstallation(
      {
        id: editingItem?.id,
        project_name: formProjectName.trim(),
        public_display_name:
          formPublicName.trim() || `Instalasi ${formServiceType} — Area ${formCity}`,
        client_name: formClientName.trim(),
        client_phone: formClientPhone.trim(),
        address_landmark: formAddress.trim(),
        service_type: formServiceType,
        package_name: formPackageName,
        city: formCity,
        latitude: parseFloat(formLat) || -0.5022,
        longitude: parseFloat(formLng) || 117.1536,
        progress: Number(formProgress),
        sn_nvr: formSnNvr.trim(),
        sn_hdd: formSnHdd.trim(),
        hardware_specs: formSpecs.trim(),
        installed_at: Number(formProgress) === 100 ? formInstalledAt : null,
        warranty_months: Number(formWarrantyMonths) || 12,
        rating: 5.0,
        review_text: formReviewText.trim(),
        photos: formPhotos,
        is_public_portfolio: formIsPublic,
        notes: editingItem?.notes || '',
      },
      user?.id
    );

    if (editingItem) {
      setInstallations((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      showSuccess('Data proyek berhasil diperbarui!');
    } else {
      setInstallations((prev) => [saved, ...prev]);
      setSelectedId(saved.id);
      setIsInspectorOpen(true);
      showSuccess('Titik proyek baru berhasil ditambahkan ke Peta Kaltim!');
    }
    setIsAddEditOpen(false);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteCCTVInstallation(id);
    setInstallations((prev) => prev.filter((x) => x.id !== id));
    showSuccess('Titik proyek dihapus.');
  };

  const handleCreateQuoteFromProject = (item: CCTVInstallation) => {
    const matchedPkg =
      BORNEO_ETAM_PACKAGES.find(
        (p) =>
          p.shortName.toLowerCase() === (item.package_name || '').toLowerCase() ||
          p.service_type === item.service_type
      ) || BORNEO_ETAM_PACKAGES[0];

    const params = new URLSearchParams({
      preset: matchedPkg.id,
      clientName: item.client_name,
      clientPhone: item.client_phone,
      clientAddress: `${item.address_landmark}, ${item.city}`,
      docTitle: `Penawaran ${item.project_name}`,
    });

    navigate(`/quote/new?${params.toString()}`);
  };

  const handleSendWarrantyWA = (item: CCTVInstallation) => {
    if (!item.client_phone) {
      showError('Nomor WhatsApp klien belum diisi.');
      return;
    }
    let cleanPhone = item.client_phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);

    const w = calculateWarrantyStatus(item.installed_at, item.warranty_months, item.progress);
    
    // Pesan murni koordinasi proyek & pengerjaan lapangan (bukan penawaran/sales)
    const isDone = item.progress === 100;
    const isSurvey = item.progress === 0;

    const msg = isDone
      ? [
          `Halo Bpk/Ibu *${item.client_name}*,`,
          `Kami dari tim teknisi *Borneo Etam CCTV & POS* ingin menginformasikan status serah terima proyek & garansi resmi perangkat Anda:`,
          ``,
          `📌 *Nama Proyek:* ${item.project_name}`,
          `📍 *Lokasi:* ${item.address_landmark || item.city}`,
          `📦 *Paket Terpasang:* ${item.package_name}`,
          `✅ *Status Progres:* Selesai 100% & Beroperasi Aktif`,
          item.sn_nvr ? `🔢 *SN NVR/DVR/Kasir:* ${item.sn_nvr}` : '',
          item.sn_hdd ? `💾 *SN Harddisk:* ${item.sn_hdd}` : '',
          item.installed_at ? `🗓️ *Tgl Pasang:* ${item.installed_at}` : '',
          `🛡️ *Garansi Resmi:* 12 Bulan (Masa aktif s/d ${w.expiryDateFormatted})`,
          ``,
          `Jika ada kendala jaringan, rekaman, atau butuh bantuan teknis, silakan langsung hubungi nomor ini. Terima kasih!`,
        ]
      : isSurvey
        ? [
            `Halo Bpk/Ibu *${item.client_name}*,`,
            `Kami dari tim teknisi *Borneo Etam CCTV & POS* terkait koordinasi jadwal survei lokasi & konsultasi titik pemasangan:`,
            ``,
            `📌 *Rencana Proyek:* ${item.project_name}`,
            `📍 *Lokasi:* ${item.address_landmark || item.city}`,
            `📋 *Kebutuhan Layanan:* ${item.service_type} (${item.package_name})`,
            item.preferred_survey_date ? `📅 *Jadwal Survei:* ${item.preferred_survey_date} ${item.preferred_survey_time || ''}` : '',
            ``,
            `Apakah lokasi siap untuk kami lakukan peninjauan jalur kabel & kebutuhan perangkat? Terima kasih!`,
          ]
        : [
            `Halo Bpk/Ibu *${item.client_name}*,`,
            `Kami dari tim teknisi *Borneo Etam CCTV & POS* mengabarkan update progres pengerjaan lapangan:`,
            ``,
            `📌 *Proyek:* ${item.project_name}`,
            `📍 *Lokasi:* ${item.address_landmark || item.city}`,
            `🔧 *Progres Lapangan:* ${item.progress}% (Sedang dalam tahap penarikan kabel & setting unit)`,
            `📦 *Layanan:* ${item.service_type} - ${item.package_name}`,
            ``,
            `Tim kami sedang melanjutkan instalasi agar unit segera aktif & siap digunakan. Terima kasih!`,
          ];

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg.filter(Boolean).join('\n'))}`, '_blank');
  };

  return (
    <div className="mx-auto w-full max-w-[1720px] space-y-4 px-3 py-3 sm:px-5 lg:px-6 pb-28 sm:pb-10">
      {/* Dialog Jadwal Survei Lokasi Gratis */}
      <SurveyRequestDialog
        isOpen={isSurveyModalOpen}
        setIsOpen={setIsSurveyModalOpen}
        onSuccessCreated={(created) => {
          setInstallations((prev) => [created, ...prev]);
          setSelectedId(created.id);
          setIsInspectorOpen(true);
        }}
      />

      {/* ========================================================================= */}
      {/* BAGIAN 1 (PALING ATAS & LEBAR PENUH): HEADER COMPACT + PETA GIS KALTIM    */}
      {/* ========================================================================= */}
      <section className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-sm space-y-3">
        {/* Baris 1: Judul Ringkas, Mode Switcher & Tombol Aksi */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-500">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
                  Peta Proyek CCTV, POS & Garansi Kaltim
                </h1>
                <div className="inline-flex items-center rounded-lg border border-border/80 bg-muted/50 p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('admin')}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all',
                      viewMode === 'admin'
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Admin Operasional
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('public_preview')}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all',
                      viewMode === 'public_preview'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Pratinjau Publik
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Klik titik lokasi di peta untuk mengelola progres pemasangan, foto dokumentasi, Serial Number NVR/HDD, dan surat penawaran A4.
              </p>
            </div>
          </div>

          {/* Tombol Aksi Utama */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => navigate('/quote/new?preset=paket-4-cctv')}
              className="h-9 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-2xs"
            >
              <FilePlus2 className="h-3.5 w-3.5" /> Buat Penawaran
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenAddModal()}
              className="h-9 rounded-xl text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Proyek
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportInstallationsToCSV(filteredInstallations)}
              className="h-9 rounded-xl text-xs font-semibold gap-1.5"
              title="Ekspor ke CSV"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              asChild
              className="h-9 rounded-xl text-xs font-bold gap-1.5 border border-border"
            >
              <Link to="/portfolio" target="_blank">
                <ExternalLink className="h-3.5 w-3.5 text-teal-500" /> Portofolio Publik
              </Link>
            </Button>
          </div>
        </div>

        {/* Baris 2: Pencarian Global, Filter Kota, Layanan, Status Pills & Toggle Drawer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-center">
          <div className="relative lg:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari toko, klien, SN NVR, SN HDD, kota..."
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

          <div className="lg:col-span-2">
            <Select
              value={cityFilter}
              onValueChange={(v) => setCityFilter(v as KaltimCityKey)}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-background">
                <SelectValue placeholder="Pilih Kota" />
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

          <div className="lg:col-span-2">
            <Select
              value={serviceFilter}
              onValueChange={(v) => setServiceFilter(v as 'ALL' | ServiceType)}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-background">
                <SelectValue placeholder="Jenis Layanan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Layanan</SelectItem>
                <SelectItem value="CCTV">📹 Kamera CCTV</SelectItem>
                <SelectItem value="POS">🖥️ Kasir POS</SelectItem>
                <SelectItem value="BUNDLING">🏪 Bundling CCTV+POS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="lg:col-span-4 flex flex-wrap items-center gap-1 justify-start lg:justify-end">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all',
                statusFilter === 'ALL'
                  ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                  : 'bg-background text-muted-foreground border-border/70 hover:text-foreground'
              )}
            >
              Semua ({installations.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('DONE')}
              className={cn(
                'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all',
                statusFilter === 'DONE'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              )}
            >
              🟢 100% ({kpiStats.done})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('WORKING')}
              className={cn(
                'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all',
                statusFilter === 'WORKING'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              )}
            >
              🟡 Proses ({kpiStats.working})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('SURVEY')}
              className={cn(
                'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all',
                statusFilter === 'SURVEY'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              )}
            >
              🔴 Survei ({kpiStats.survey})
            </button>
          </div>
        </div>

        {/* KANVAS PETA LEBAR PENUH (100% FULL WIDTH) + DOCKED INSPECTOR PANEL */}
        <div className="w-full">
          <CCTVLeafletMap
            items={mapMarkers}
            selectedId={selectedProject?.id || null}
            onSelectMarker={(id) => {
              setSelectedId(id);
              setIsInspectorOpen(true);
            }}
            activeCity={cityFilter}
            onCityQuickJump={(city) => setCityFilter(city)}
            isPublicPortfolio={viewMode === 'public_preview'}
            heightClass="lg:h-[620px]"
            rightPanel={
              isInspectorOpen && selectedProject ? (
                <div className="flex flex-col justify-between h-full bg-card">
                  {/* Top Header of Docked Panel */}
                  <div className="flex items-start justify-between gap-2 border-b border-border/70 bg-muted/25 px-3.5 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Badge className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 text-[9.5px] font-extrabold px-2 py-0">
                          {selectedProject.service_type} • {selectedProject.city}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-black leading-snug text-foreground line-clamp-1">
                        {viewMode === 'public_preview'
                          ? selectedProject.public_display_name
                          : selectedProject.project_name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        📍{' '}
                        {viewMode === 'public_preview'
                          ? `Area ${selectedProject.city}`
                          : selectedProject.address_landmark}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => handleOpenAddModal(selectedProject)}
                        title="Edit Detail Lengkap"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-lg text-rose-500 hover:text-rose-600"
                        onClick={() => handleDeleteProject(selectedProject.id)}
                        title="Hapus Proyek"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 rounded-lg border-border/80 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => setIsInspectorOpen(false)}
                        title="Tutup Panel Detail"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Middle Body */}
                  <div className="flex-1 p-3.5 space-y-2.5 overflow-y-auto">
                    {/* Galeri & Upload Foto Dokumentasi Instalasi */}
                    <InstallationPhotoGallery
                      photos={editPhotos}
                      projectTitle={
                        viewMode === 'public_preview'
                          ? selectedProject.public_display_name
                          : selectedProject.project_name
                      }
                      editable={viewMode === 'admin'}
                      compact={true}
                      onChangePhotos={handleInspectorPhotosChange}
                    />

                    {/* Digital Warranty Countdown */}
                    {(() => {
                      const w = calculateWarrantyStatus(
                        editInstalledAt || selectedProject.installed_at,
                        selectedProject.warranty_months,
                        editProgress
                      );
                      return (
                        <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5 text-teal-500" /> Garansi 12 Bln
                            </span>
                            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', w.badgeClass)}>
                              {w.badgeLabel}
                            </span>
                          </div>
                          {editProgress === 100 && (
                            <div className="text-[10.5px] text-muted-foreground flex items-center justify-between">
                              <span>
                                s/d <strong className="text-foreground">{w.expiryDateFormatted}</strong>
                              </span>
                              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                                {w.percentRemaining}% masa aktif
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Quick Navigation & WA */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 rounded-xl text-xs font-bold border-border justify-center"
                      >
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${selectedProject.latitude},${selectedProject.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Navigation className="mr-1.5 h-3.5 w-3.5 text-sky-500" /> Rute Maps
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendWarrantyWA(selectedProject)}
                        className="h-8 rounded-xl text-xs font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 justify-center"
                      >
                        <Phone className="mr-1.5 h-3.5 w-3.5" /> WA Klien
                      </Button>
                    </div>

                    {/* Progress Slider */}
                    <div className="space-y-1.5 rounded-xl border border-border/70 px-3 py-2 bg-background">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-extrabold">
                          Progres Lapangan
                        </Label>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums',
                            editProgress === 100
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : editProgress > 0
                                ? 'bg-amber-500/15 text-amber-600'
                                : 'bg-rose-500/15 text-rose-600'
                          )}
                        >
                          {editProgress}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={editProgress}
                        onChange={(e) => setEditProgress(Number(e.target.value))}
                        className="w-full accent-teal-600 cursor-pointer"
                      />
                      <div className="grid grid-cols-5 gap-1">
                        {[0, 25, 50, 80, 100].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setEditProgress(val)}
                            className={cn(
                              'py-1 rounded-lg text-[9.5px] font-bold border transition-all',
                              editProgress === val
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground'
                            )}
                          >
                            {val}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hardware Serial Numbers */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10.5px] font-bold flex items-center gap-1">
                            <Cpu className="h-3 w-3 text-teal-500" /> SN NVR / DVR / PC Kasir
                          </Label>
                          <Input
                            placeholder="HIK-NVR8K-..."
                            value={editSnNvr}
                            onChange={(e) => setEditSnNvr(e.target.value)}
                            className="h-8 rounded-xl text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10.5px] font-bold flex items-center gap-1">
                            <HardDrive className="h-3 w-3 text-sky-500" /> SN Harddisk (WD Purple)
                          </Label>
                          <Input
                            placeholder="WDP-2TB-..."
                            value={editSnHdd}
                            onChange={(e) => setEditSnHdd(e.target.value)}
                            className="h-8 rounded-xl text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <div className="space-y-1">
                          <Label className="text-[10.5px] font-bold">Tgl Pasang</Label>
                          <Input
                            type="date"
                            value={editInstalledAt}
                            onChange={(e) => setEditInstalledAt(e.target.value)}
                            className="h-8 rounded-xl text-[11px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10.5px] font-bold">Portofolio</Label>
                          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-2.5 h-8">
                            <span className="text-[10px] font-bold text-muted-foreground">Publik</span>
                            <Switch
                              checked={editIsPublic}
                              onCheckedChange={setEditIsPublic}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Docked Action Bar — "Buat Penawaran" hanya untuk proyek yang belum selesai */}
                  <div
                    className={cn(
                      'grid gap-2 border-t border-border/70 bg-muted/20 p-3',
                      selectedProject.progress === 100 ? 'grid-cols-1' : 'grid-cols-2'
                    )}
                  >
                    {selectedProject.progress !== 100 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleCreateQuoteFromProject(selectedProject)}
                        className="h-9 rounded-xl text-xs font-bold border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" /> Buat Penawaran
                      </Button>
                    )}
                    <Button
                      type="button"
                      disabled={savingInspector}
                      onClick={handleSaveInspector}
                      className="h-9 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      {savingInspector ? 'Menyimpan...' : '💾 Simpan Data'}
                    </Button>
                  </div>
                </div>
              ) : undefined
            }
          />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* BAGIAN 2: RINGKASAN KPI (1 PANEL TERPADU, 4 SEGMEN)                       */}
      {/* ========================================================================= */}
      {(() => {
        const cctvCount = installations.filter((i) => i.service_type === 'CCTV').length;
        const posCount = installations.filter((i) => i.service_type === 'POS').length;
        const bundlingCount = installations.filter((i) => i.service_type === 'BUNDLING').length;
        const total = Math.max(1, kpiStats.total);
        const doneRate = kpiStats.total > 0 ? Math.round((kpiStats.done / kpiStats.total) * 100) : 0;
        const warrantyTotal = Math.max(
          1,
          kpiStats.activeWarranty + kpiStats.warningH30 + kpiStats.expiredWarranty
        );

        const Segment = ({
          active,
          onClick,
          icon,
          label,
          value,
          unit,
          valueClass,
          bar,
          legend,
        }: {
          active: boolean;
          onClick: () => void;
          icon: React.ReactNode;
          label: string;
          value: React.ReactNode;
          unit: string;
          valueClass?: string;
          bar: { pct: number; color: string }[];
          legend: { label: string; dot: string }[];
        }) => (
          <button
            type="button"
            onClick={onClick}
            className={cn(
              'group relative flex flex-col justify-between gap-3 p-4 sm:p-5 text-left transition-colors',
              active ? 'bg-teal-50 dark:bg-teal-950/40' : 'bg-card hover:bg-accent'
            )}
          >
            {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-teal-500" />}
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span className="text-muted-foreground/80">{icon}</span>
              {label}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={cn('text-3xl font-black tabular-nums tracking-tight text-foreground', valueClass)}>
                {value}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">{unit}</span>
            </div>
            <div className="space-y-2">
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {bar.map((b, i) => (
                  <div
                    key={i}
                    className={cn('h-full transition-all duration-500', b.color)}
                    style={{ width: `${b.pct}%` }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground">
                {legend.map((l, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className={cn('h-1.5 w-1.5 rounded-full', l.dot)} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          </button>
        );

        return (
          <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border/70">
              <Segment
                active={statusFilter === 'ALL'}
                onClick={() => setStatusFilter('ALL')}
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Total Titik Kaltim"
                value={kpiStats.total}
                unit="lokasi"
                bar={[
                  { pct: (cctvCount / total) * 100, color: 'bg-sky-500' },
                  { pct: (posCount / total) * 100, color: 'bg-indigo-500' },
                  { pct: (bundlingCount / total) * 100, color: 'bg-teal-500' },
                ]}
                legend={[
                  { label: `${cctvCount} CCTV`, dot: 'bg-sky-500' },
                  { label: `${posCount} Kasir POS`, dot: 'bg-indigo-500' },
                  { label: `${bundlingCount} Bundling`, dot: 'bg-teal-500' },
                ]}
              />
              <Segment
                active={statusFilter === 'DONE'}
                onClick={() => setStatusFilter('DONE')}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Selesai & Aktif"
                value={kpiStats.done}
                unit={`dari ${kpiStats.total} (${doneRate}%)`}
                valueClass="text-emerald-600 dark:text-emerald-400"
                bar={[{ pct: doneRate, color: 'bg-emerald-500' }]}
                legend={[{ label: 'Beroperasi & tampil di portofolio', dot: 'bg-emerald-500' }]}
              />
              <Segment
                active={statusFilter === 'WORKING' || statusFilter === 'SURVEY'}
                onClick={() => setStatusFilter('WORKING')}
                icon={<Wrench className="h-3.5 w-3.5" />}
                label="Proses & Antrean"
                value={kpiStats.working + kpiStats.survey}
                unit="proyek berjalan"
                valueClass="text-amber-600 dark:text-amber-400"
                bar={[
                  { pct: (kpiStats.working / total) * 100, color: 'bg-amber-500' },
                  { pct: (kpiStats.survey / total) * 100, color: 'bg-rose-500' },
                ]}
                legend={[
                  { label: `${kpiStats.working} Sedang pasang`, dot: 'bg-amber-500' },
                  { label: `${kpiStats.survey} Antre survei`, dot: 'bg-rose-500' },
                ]}
              />
              <Segment
                active={false}
                onClick={() => setStatusFilter('DONE')}
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                label="Monitor Garansi 12 Bln"
                value={kpiStats.activeWarranty}
                unit="garansi aktif"
                valueClass="text-sky-600 dark:text-sky-400"
                bar={[
                  { pct: (kpiStats.activeWarranty / warrantyTotal) * 100, color: 'bg-sky-500' },
                  { pct: (kpiStats.warningH30 / warrantyTotal) * 100, color: 'bg-amber-500' },
                  { pct: (kpiStats.expiredWarranty / warrantyTotal) * 100, color: 'bg-rose-500' },
                ]}
                legend={[
                  { label: `${kpiStats.activeWarranty} Aktif`, dot: 'bg-sky-500' },
                  { label: `${kpiStats.warningH30} Segera habis (H-30)`, dot: 'bg-amber-500' },
                  { label: `${kpiStats.expiredWarranty} Habis`, dot: 'bg-rose-500' },
                ]}
              />
            </div>
          </section>
        );
      })()}


      {/* ========================================================================= */}
      {/* BAGIAN 3: TABEL INVENTARIS PROYEK, SERIAL NUMBER & COUNTDOWN GARANSI      */}
      {/* ========================================================================= */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:px-6 sm:py-4 border-b border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-500">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-black text-foreground">
                Daftar Proyek, Serial Number Hardware & Monitor Garansi 12 Bulan
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Menampilkan {filteredInstallations.length} titik lokasi di Kalimantan Timur. Klik baris untuk menyorot lokasi di peta atas.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10.5px] font-bold px-2.5 py-1 bg-background">
              Total Ditampilkan: {filteredInstallations.length} Proyek
            </Badge>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/70">
                <TableHead className="w-[27%] px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground pl-4">
                  Proyek & Pelanggan
                </TableHead>
                <TableHead className="w-[10%] px-2 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Wilayah
                </TableHead>
                <TableHead className="w-[16%] px-2.5 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Layanan & Paket
                </TableHead>
                <TableHead className="w-[9%] px-2 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Progres
                </TableHead>
                <TableHead className="w-[15%] px-2.5 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  SN NVR & Harddisk
                </TableHead>
                <TableHead className="w-[13%] px-2.5 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Garansi 12 Bln
                </TableHead>
                <TableHead className="w-[10%] px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground text-right pr-4">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInstallations.map((item) => {
                const w = calculateWarrantyStatus(
                  item.installed_at,
                  item.warranty_months,
                  item.progress
                );
                const isSelected = item.id === selectedProject?.id;
                const coverPhoto =
                  Array.isArray(item.photos) && item.photos.length > 0 ? item.photos[0] : null;
                const photoCount = Array.isArray(item.photos) ? item.photos.length : 0;

                return (
                  <TableRow
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setIsInspectorOpen(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={cn(
                      'cursor-pointer transition-colors border-b border-border/50 align-middle',
                      isSelected
                        ? 'bg-teal-500/10 hover:bg-teal-500/15'
                        : 'hover:bg-muted/35'
                    )}
                  >
                    {/* Kolom 1: Thumbnail Foto + Nama Proyek & Klien (Semua Terbaca Tanpa Terpotong) */}
                    <TableCell className="px-3 py-2.5 pl-4">
                      <div className="flex items-start gap-2.5">
                        <div className="relative h-9 w-11 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted/40 flex items-center justify-center mt-0.5">
                          {coverPhoto ? (
                            <>
                              <img
                                src={coverPhoto}
                                alt={item.project_name}
                                className="h-full w-full object-cover"
                              />
                              {photoCount > 1 && (
                                <span className="absolute bottom-0 right-0 rounded-tl bg-black/80 px-1 text-[8px] font-bold text-white leading-tight">
                                  +{photoCount - 1}
                                </span>
                              )}
                            </>
                          ) : (
                            <Shield className="h-3.5 w-3.5 text-teal-500/70" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-bold text-[11.5px] leading-snug text-foreground break-words">
                            {item.project_name}
                          </div>
                          <div className="text-[10.5px] leading-snug text-muted-foreground break-words">
                            <span>{item.client_name}</span>
                            {item.client_phone ? (
                              <span className="font-mono font-semibold text-teal-600 dark:text-teal-400">
                                {' '}• {item.client_phone}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Kolom 2: Wilayah */}
                    <TableCell className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/30 px-2 py-0.5 text-[10px] font-bold text-foreground leading-tight">
                        <MapPin className="h-2.5 w-2.5 text-teal-500 shrink-0" />
                        <span>{item.city}</span>
                      </span>
                    </TableCell>

                    {/* Kolom 3: Layanan & Paket (Semua Terbaca) */}
                    <TableCell className="px-2.5 py-2.5">
                      <div className="space-y-0.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-wider border',
                            item.service_type === 'BUNDLING'
                              ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25'
                              : item.service_type === 'CCTV'
                                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25'
                                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25'
                          )}
                        >
                          {item.service_type}
                        </span>
                        <div className="text-[10.5px] leading-snug font-medium text-muted-foreground break-words">
                          {item.package_name}
                        </div>
                      </div>
                    </TableCell>

                    {/* Kolom 4: Progres Lapangan */}
                    <TableCell className="px-2 py-2.5 whitespace-nowrap">
                      <div className="w-20 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-extrabold">
                          <span className="inline-flex items-center gap-1">
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                item.progress === 100
                                  ? 'bg-emerald-500'
                                  : item.progress > 0
                                    ? 'bg-amber-500 animate-pulse'
                                    : 'bg-rose-500'
                              )}
                            />
                            <span
                              className={cn(
                                item.progress === 100
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : item.progress > 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-rose-600 dark:text-rose-400'
                              )}
                            >
                              {item.progress === 100
                                ? 'Selesai'
                                : item.progress > 0
                                  ? 'Proses'
                                  : 'Survei'}
                            </span>
                          </span>
                          <span className="tabular-nums text-foreground">{item.progress}%</span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              item.progress === 100
                                ? 'bg-emerald-500'
                                : item.progress > 0
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500 w-1.5'
                            )}
                            style={{ width: `${Math.max(8, item.progress)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    {/* Kolom 5: SN NVR & Harddisk (Ringkas & Utuh) */}
                    <TableCell className="px-2.5 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <div className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/35 px-1.5 py-0.5 font-mono text-[9.5px] whitespace-nowrap w-fit">
                          <span className="text-muted-foreground">NVR:</span>
                          <strong className="text-foreground">{item.sn_nvr || '-'}</strong>
                        </div>
                        <div className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/35 px-1.5 py-0.5 font-mono text-[9.5px] whitespace-nowrap w-fit">
                          <span className="text-muted-foreground">HDD:</span>
                          <strong className="text-foreground">{item.sn_hdd || '-'}</strong>
                        </div>
                      </div>
                    </TableCell>

                    {/* Kolom 6: Status Garansi 12 Bulan */}
                    <TableCell className="px-2.5 py-2.5 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold border whitespace-nowrap',
                            w.badgeClass
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', w.dotColor)} />
                          {w.badgeLabel}
                        </span>
                        <div className="text-[9.5px] text-muted-foreground leading-tight">
                          {item.installed_at ? (
                            <span>
                              Pasang: <strong className="text-foreground/85">{item.installed_at}</strong> • s/d {w.expiryDateFormatted}
                            </span>
                          ) : (
                            <span>Aktif setelah 100%</span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Kolom 7: Aksi Cepat (Ringkas & Tidak Terpotong) */}
                    <TableCell className="px-3 py-2.5 pr-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendWarrantyWA(item)}
                          className="h-7 rounded-lg text-[10px] font-bold px-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                          title={item.progress === 100 ? 'Kirim Info Serah Terima & Garansi via WhatsApp' : 'Kirim Update Progres via WhatsApp'}
                        >
                          <Phone className="h-2.5 w-2.5 mr-1" /> WA
                        </Button>
                        {item.progress !== 100 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateQuoteFromProject(item)}
                            className="h-7 rounded-lg text-[10px] font-bold px-2"
                            title="Buat Surat Penawaran A4"
                          >
                            <FileText className="h-2.5 w-2.5 mr-1 text-teal-500" /> Quote
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenAddModal(item)}
                          className="h-7 w-7 rounded-lg"
                          title="Edit Proyek"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* BAGIAN 4: PRESET TEMPLATE PAKET PENAWARAN CEPAT (BISA EDIT & UPLOAD FOTO) */}
      {/* ========================================================================= */}
      <section className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-500" />
              Paket Penawaran Cepat Borneo Etam CCTV & POS
            </h2>
            <p className="text-xs text-muted-foreground">
              Klik paket untuk menerbitkan Surat Penawaran Resmi A4, atau klik <strong className="text-foreground">Edit & Foto</strong> untuk mengubah harga, rincian & mengunggah foto paket.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleResetPackages}
              className="h-8 rounded-xl text-xs font-bold border-border/80 text-muted-foreground hover:text-foreground gap-1.5"
              title="Kembalikan ke 4 Paket Standar"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Default
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenEditPackage(null)}
              className="h-8 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Paket
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {packages.map((pkg) => {
            const coverPhoto =
              Array.isArray(pkg.photos) && pkg.photos.length > 0 ? pkg.photos[0] : null;
            const photoCount = Array.isArray(pkg.photos) ? pkg.photos.length : 0;
            const estMargin = Math.max(0, Number(pkg.totalPrice || 0) - Number(pkg.estimatedCost || 0));

            return (
              <Card
                key={pkg.id}
                className="group overflow-hidden rounded-2xl border border-border/80 bg-card hover:border-teal-500/60 transition-all flex flex-col justify-between shadow-xs"
              >
                {/* Cover Photo Banner */}
                <div
                  onClick={() => handleOpenEditPackage(pkg)}
                  className="relative h-40 w-full overflow-hidden bg-muted/40 border-b border-border/60 cursor-pointer"
                  title="Klik untuk mengedit paket atau mengunggah foto"
                >
                  {coverPhoto ? (
                    <>
                      <img
                        src={coverPhoto}
                        alt={pkg.shortName}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-teal-500/10 via-muted/30 to-sky-500/10 text-muted-foreground">
                      <ImagePlus className="h-7 w-7 text-teal-500/80" />
                      <span className="text-[11px] font-bold">Klik untuk Upload Foto Paket</span>
                    </div>
                  )}

                  {/* Top-left Badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="rounded-lg bg-black/75 backdrop-blur-md border border-teal-400/40 px-2.5 py-0.5 text-[10px] font-extrabold text-teal-300 shadow-xs">
                      {pkg.badge}
                    </span>
                  </div>

                  {/* Top-right Edit & Photo Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditPackage(pkg);
                    }}
                    className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-lg bg-black/75 hover:bg-teal-600 backdrop-blur-md border border-white/20 px-2.5 py-1 text-[10.5px] font-bold text-white transition-colors shadow-sm"
                    title="Edit Harga, Deskripsi & Foto Paket"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit & Foto</span>
                  </button>

                  {/* Bottom overlay info */}
                  <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white/90 border border-white/15">
                      <ShieldCheck className="h-3 w-3 text-teal-400" />
                      Garansi {pkg.warrantyMonths} Bln
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white/90 border border-white/15">
                      <Camera className="h-3 w-3 text-teal-400" />
                      {photoCount} Foto
                    </span>
                  </div>
                </div>

                {/* Card Header & Price */}
                <CardHeader className="p-4 pb-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                      Layanan {pkg.service_type}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                      Margin ±{formatCurrency(estMargin)}
                    </span>
                  </div>
                  <CardTitle className="text-sm sm:text-[15px] font-black text-foreground leading-snug line-clamp-1">
                    {pkg.shortName}
                  </CardTitle>
                  <div className="text-xl font-black text-teal-600 dark:text-teal-400 tabular-nums tracking-tight">
                    {formatCurrency(pkg.totalPrice)}
                  </div>
                </CardHeader>

                {/* Card Description & Actions */}
                <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between space-y-3.5">
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed line-clamp-3">
                    {pkg.description}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/quote/new?preset=${pkg.id}`)}
                      className="flex-1 h-9 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    >
                      <FilePlus2 className="h-3.5 w-3.5" /> Buat Penawaran Paket Ini
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => handleOpenEditPackage(pkg)}
                      className="h-9 w-9 shrink-0 rounded-xl border-border/80 hover:border-teal-500/50 hover:text-teal-500"
                      title="Edit Paket & Upload Foto"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODAL TAMBAH / EDIT TITIK PROYEK KALTIM                                   */}
      {/* ========================================================================= */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[92vh] overflow-y-auto rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">
              {editingItem ? 'Edit Data Proyek & Garansi' : 'Tambah Titik Proyek CCTV / POS Baru'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Catat titik koordinat proyek, nomor seri perangkat keras (NVR & Harddisk), dan pengaturan visibilitas portofolio publik.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveModalForm} className="space-y-3.5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Nama Proyek (Internal Admin) *</Label>
                <Input
                  required
                  placeholder="Contoh: Instalasi 8 IP Cam Toko Berkah"
                  value={formProjectName}
                  onChange={(e) => setFormProjectName(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Nama Tampil di Portofolio Publik</Label>
                <Input
                  placeholder="Contoh: Minimarket & Retail — Area Samarinda Ulu"
                  value={formPublicName}
                  onChange={(e) => setFormPublicName(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Nama Klien / Pemilik *</Label>
                <Input
                  required
                  placeholder="Nama Pemilik / PIC"
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Nomor WhatsApp</Label>
                <Input
                  placeholder="0812..."
                  value={formClientPhone}
                  onChange={(e) => setFormClientPhone(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Kota Wilayah Kaltim</Label>
                <Select
                  value={formCity}
                  onValueChange={(val) => {
                    setFormCity(val);
                    const reg = KALTIM_REGIONS.find((r) => r.key === val);
                    if (reg && !editingItem) {
                      setFormLat(String(reg.lat));
                      setFormLng(String(reg.lng));
                    }
                  }}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KALTIM_REGIONS.filter((r) => r.key !== 'ALL').map((reg) => (
                      <SelectItem key={reg.key} value={reg.key}>
                        {reg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Jenis Layanan</Label>
                <Select
                  value={formServiceType}
                  onValueChange={(v) => setFormServiceType(v as ServiceType)}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CCTV">📹 Instalasi Kamera CCTV</SelectItem>
                    <SelectItem value="POS">🖥️ Komputer Kasir (POS)</SelectItem>
                    <SelectItem value="BUNDLING">🏪 Bundling CCTV + Kasir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Paket Terpasang</Label>
                <Input
                  value={formPackageName}
                  onChange={(e) => setFormPackageName(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Alamat Lengkap & Patokan</Label>
              <Input
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Jl. ..."
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Latitude</Label>
                <Input
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Longitude</Label>
                <Input
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Progres (0-100%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formProgress}
                  onChange={(e) => setFormProgress(Number(e.target.value))}
                  className="h-9 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Serial Number NVR / DVR / PC</Label>
                <Input
                  placeholder="SN NVR..."
                  value={formSnNvr}
                  onChange={(e) => setFormSnNvr(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Serial Number Harddisk (WD Purple)</Label>
                <Input
                  placeholder="SN HDD..."
                  value={formSnHdd}
                  onChange={(e) => setFormSnHdd(e.target.value)}
                  className="h-9 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Spesifikasi Perangkat</Label>
                <Input
                  value={formSpecs}
                  onChange={(e) => setFormSpecs(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Tanggal Selesai Instalasi</Label>
                <Input
                  type="date"
                  value={formInstalledAt}
                  onChange={(e) => setFormInstalledAt(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Testimoni / Catatan Hasil Kerja (Tampil di Portofolio)</Label>
              <Textarea
                rows={2}
                value={formReviewText}
                onChange={(e) => setFormReviewText(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/15 p-3">
              <InstallationPhotoGallery
                photos={formPhotos}
                projectTitle={formProjectName || 'Dokumentasi Proyek'}
                editable={true}
                compact={true}
                onChangePhotos={(next) => setFormPhotos(next)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddEditOpen(false)}
                className="rounded-xl text-xs font-bold h-9"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="rounded-xl text-xs font-bold h-9 bg-teal-600 hover:bg-teal-700 text-white"
              >
                Simpan Data Proyek
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL EDIT / TAMBAH PAKET PENAWARAN CEPAT & UPLOAD FOTO PAKET             */}
      {/* ========================================================================= */}
      <Dialog open={isEditPackageOpen} onOpenChange={setIsEditPackageOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-500" />
              {editingPackageId ? `Edit Paket & Foto: ${pkgShortName}` : 'Tambah Paket Penawaran Cepat Baru'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ubah nama paket, harga jual, estimasi HPP, deskripsi, rincian perangkat, serta unggah foto brosur/instalasi paket. Perubahan otomatis tampil di Command Center, Portofolio Publik & Pembuat Surat Penawaran A4.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePackageForm} className="space-y-4 py-2">
            {/* 1. Upload & Galeri Foto Paket */}
            <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-3.5">
              <InstallationPhotoGallery
                photos={pkgPhotos}
                projectTitle={pkgShortName || 'Foto Paket Penawaran'}
                editable={true}
                compact={false}
                onChangePhotos={(next) => setPkgPhotos(next)}
              />
            </div>

            {/* 2. Identitas & Label Paket */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Nama Singkat Kartu Paket *</Label>
                <Input
                  required
                  placeholder="Contoh: Paket 4 Titik CCTV HD"
                  value={pkgShortName}
                  onChange={(e) => setPkgShortName(e.target.value)}
                  className="h-9 rounded-xl text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Label Badge Sorotan</Label>
                <Input
                  placeholder="Contoh: Terlaris Ruko & Rumah"
                  value={pkgBadge}
                  onChange={(e) => setPkgBadge(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Judul Lengkap di Surat Penawaran A4</Label>
              <Input
                placeholder="Contoh: Paket 4 Titik CCTV Full HD 1080p (Siap Pantau HP)"
                value={pkgFullName}
                onChange={(e) => setPkgFullName(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            {/* 3. Layanan, Harga Jual, HPP & Garansi */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Kategori Layanan</Label>
                <Select
                  value={pkgServiceType}
                  onValueChange={(v) => setPkgServiceType(v as ServiceType)}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CCTV">📹 CCTV</SelectItem>
                    <SelectItem value="POS">🖥️ Kasir POS</SelectItem>
                    <SelectItem value="BUNDLING">🏪 Bundling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Harga Jual (Rp) *</Label>
                <Input
                  type="number"
                  required
                  value={pkgTotalPrice}
                  onChange={(e) => setPkgTotalPrice(Number(e.target.value) || 0)}
                  className="h-9 rounded-xl text-xs font-black text-teal-600 dark:text-teal-400 tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Estimasi HPP (Rp)</Label>
                <Input
                  type="number"
                  value={pkgEstimatedCost}
                  onChange={(e) => setPkgEstimatedCost(Number(e.target.value) || 0)}
                  className="h-9 rounded-xl text-xs font-semibold tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Garansi (Bulan)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={pkgWarrantyMonths}
                  onChange={(e) => setPkgWarrantyMonths(Number(e.target.value) || 12)}
                  className="h-9 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            {/* 4. Deskripsi Singkat Paket */}
            <div className="space-y-1">
              <Label className="text-xs font-bold">Deskripsi Ringkas Perangkat & Fasilitas</Label>
              <Textarea
                rows={2}
                value={pkgDescription}
                onChange={(e) => setPkgDescription(e.target.value)}
                placeholder="Rincian kamera, DVR/NVR, harddisk, kabel, dan layanan instalasi..."
                className="rounded-xl text-xs"
              />
            </div>

            {/* 5. Rincian Item Penawaran Otomatis */}
            <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-xs font-extrabold">
                    Rincian Item Otomatis Saat Buat Penawaran ({pkgItems.filter((i) => i.quantity > 0).length} Item)
                  </Label>
                  <p className="text-[10.5px] text-muted-foreground">
                    Baris dengan Qty = 0 dianggap sebagai Judul Bagian (Header).
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRecalculatePackageFromItems}
                    className="h-7 rounded-lg text-[10.5px] font-bold px-2.5 border-teal-500/30 text-teal-600 dark:text-teal-400"
                  >
                    Hitung Total dari Item
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPkgItems((prev) => [
                        ...prev,
                        { description: 'Perangkat / Jasa Tambahan', quantity: 1, unit: 'Unit', unit_price: 250000, cost_price: 175000 },
                      ])
                    }
                    className="h-7 rounded-lg text-[10.5px] font-bold px-2.5"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Baris Item
                  </Button>
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {pkgItems.map((it, idx) => {
                  const isHeader = Number(it.quantity) === 0;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'grid grid-cols-12 gap-1.5 items-center rounded-xl p-1.5 border',
                        isHeader
                          ? 'bg-teal-500/10 border-teal-500/25'
                          : 'bg-background border-border/70'
                      )}
                    >
                      <div className={isHeader ? 'col-span-11' : 'col-span-5'}>
                        <Input
                          value={it.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPkgItems((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, description: val } : row))
                            );
                          }}
                          placeholder="Deskripsi item"
                          className={cn(
                            'h-7 rounded-lg text-[11px] px-2',
                            isHeader && 'font-extrabold text-teal-600 dark:text-teal-400'
                          )}
                        />
                      </div>
                      {!isHeader && (
                        <>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              value={it.quantity}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setPkgItems((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, quantity: val } : row))
                                );
                              }}
                              placeholder="Qty"
                              className="h-7 rounded-lg text-[11px] px-1.5 text-center font-bold"
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              value={it.unit_price}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setPkgItems((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, unit_price: val } : row))
                                );
                              }}
                              placeholder="Harga Jual"
                              title="Harga Jual Satuan"
                              className="h-7 rounded-lg text-[11px] px-2 text-right tabular-nums"
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              value={it.cost_price}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setPkgItems((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, cost_price: val } : row))
                                );
                              }}
                              placeholder="HPP"
                              title="Harga Modal (HPP)"
                              className="h-7 rounded-lg text-[11px] px-2 text-right tabular-nums text-muted-foreground"
                            />
                          </div>
                        </>
                      )}
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setPkgItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-500/10"
                          title="Hapus Baris"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6. Syarat & Ketentuan Default */}
            <div className="space-y-1">
              <Label className="text-xs font-bold">Syarat & Ketentuan Default Paket</Label>
              <Textarea
                rows={3}
                value={pkgDefaultTerms}
                onChange={(e) => setPkgDefaultTerms(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
              <div>
                {editingPackageId && packages.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleDeletePackageItem(editingPackageId, pkgShortName)}
                    className="rounded-xl text-xs font-bold h-9 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Hapus Paket Ini
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditPackageOpen(false)}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl text-xs font-bold h-9 bg-teal-600 hover:bg-teal-700 text-white"
                >
                  💾 Simpan Paket & Foto
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CCTVCommandCenter;
