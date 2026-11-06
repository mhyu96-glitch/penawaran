import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, addMonths, parseISO, isValid, format } from 'date-fns';

export type ServiceType = 'CCTV' | 'POS' | 'BUNDLING';

export type KaltimCityKey =
  | 'ALL'
  | 'Samarinda'
  | 'Balikpapan'
  | 'Tenggarong / Kukar'
  | 'Bontang'
  | 'Sangatta / Kutim'
  | 'IKN Sepaku / PPU'
  | 'Paser'
  | 'Kutai Barat';

export interface KaltimRegion {
  key: KaltimCityKey;
  label: string;
  shortLabel: string;
  lat: number;
  lng: number;
  zoom: number;
  badgeColor: string;
}

export const KALTIM_REGIONS: KaltimRegion[] = [
  { key: 'ALL', label: 'Seluruh Kaltim', shortLabel: 'Se-Kaltim', lat: -0.5021, lng: 116.8289, zoom: 7, badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
  { key: 'Samarinda', label: 'Samarinda', shortLabel: 'Samarinda', lat: -0.5022, lng: 117.1536, zoom: 13, badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  { key: 'Balikpapan', label: 'Balikpapan', shortLabel: 'Balikpapan', lat: -1.2379, lng: 116.8529, zoom: 13, badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { key: 'Tenggarong / Kukar', label: 'Tenggarong / Kukar', shortLabel: 'Kukar', lat: -0.4154, lng: 116.9814, zoom: 13, badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { key: 'Bontang', label: 'Bontang', shortLabel: 'Bontang', lat: 0.1333, lng: 117.4833, zoom: 13, badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { key: 'Sangatta / Kutim', label: 'Sangatta / Kutim', shortLabel: 'Sangatta', lat: 0.5038, lng: 117.5305, zoom: 13, badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  { key: 'IKN Sepaku / PPU', label: 'IKN Sepaku / PPU', shortLabel: 'IKN Sepaku', lat: -0.9733, lng: 116.7085, zoom: 12, badgeColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  { key: 'Paser', label: 'Tanah Grogot / Paser', shortLabel: 'Paser', lat: -1.9114, lng: 116.1956, zoom: 12, badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  { key: 'Kutai Barat', label: 'Sendawar / Kubar', shortLabel: 'Kubar', lat: -0.2333, lng: 115.7022, zoom: 12, badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
];

export interface CCTVInstallation {
  id: string;
  user_id?: string | null;
  quote_id?: string | null;
  project_id?: string | null;
  client_id?: string | null;
  project_name: string;
  public_display_name: string;
  client_name: string;
  client_phone: string;
  address_landmark: string;
  service_type: ServiceType;
  package_name: string;
  city: string;
  latitude: number;
  longitude: number;
  progress: number; // 0 = Antrean Survei, 1..99 = Sedang Pasang, 100 = Selesai & Garansi Aktif
  sn_nvr: string;
  sn_hdd: string;
  hardware_specs: string;
  installed_at: string | null; // YYYY-MM-DD
  warranty_months: number;
  rating: number;
  review_text: string;
  photos?: string[]; // Dokumentasi foto instalasi lapangan untuk admin & portofolio publik
  preferred_survey_date?: string | null;
  preferred_survey_time?: string | null;
  is_public_portfolio: boolean;
  notes: string;
  created_at: string;
}

export interface PublicPortfolioInstallation {
  id: string;
  public_display_name: string;
  service_type: ServiceType;
  package_name: string;
  city: string;
  area_landmark: string;
  fuzzy_lat: number;
  fuzzy_lng: number;
  progress: number;
  hardware_specs: string;
  installed_month: string;
  warranty_months: number;
  rating: number;
  review_text: string;
  photos: string[];
}

export interface WarrantyStatusInfo {
  status: 'active' | 'warning_h30' | 'expired' | 'pending';
  daysRemaining: number;
  totalDays: number;
  percentRemaining: number;
  expiryDateFormatted: string;
  badgeLabel: string;
  badgeClass: string;
  dotColor: string;
}

export interface PresetPackageItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  cost_price: number;
}

export interface BorneoPresetPackage {
  id: string;
  name: string;
  shortName: string;
  service_type: ServiceType;
  totalPrice: number;
  estimatedCost: number;
  badge: string;
  highlight: string;
  description: string;
  warrantyMonths: number;
  defaultTerms: string;
  photos?: string[];
  items: PresetPackageItem[];
}

// ============================================================================
// KOMPRESI FOTO OTOMATIS (CLIENT-SIDE CANVAS) AGAR UPLOAD RINGAN & CEPAT
// ============================================================================
export function compressInstallationPhoto(
  file: File,
  maxWidth = 1080,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(event.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Simpan sebagai WebP (jauh lebih ringan), fallback JPEG bila browser tidak mendukung
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = String(event.target?.result || '');
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// 4 PAKET PRESET RESMI BORNEO ETAM CCTV & POS (SESUAI PRD v3.0)
// ============================================================================
export const BORNEO_ETAM_PACKAGES: BorneoPresetPackage[] = [
  {
    id: 'paket-4-cctv',
    name: 'Paket 4 Titik CCTV Full HD 1080p (Siap Pantau HP)',
    shortName: 'Paket 4 Titik CCTV HD',
    service_type: 'CCTV',
    totalPrice: 3500000,
    estimatedCost: 2350000,
    badge: 'Terlaris Ruko & Rumah',
    highlight: 'Rp 3.500.000',
    description: '4 Kamera Hikvision/Hilook 2MP Indoor & Outdoor Night Vision, DVR 4Ch, Harddisk 500GB WD Purple, Kabel RG59 & Gratis Pasang + Setting HP.',
    warrantyMonths: 12,
    photos: [
      'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=900&q=80',
    ],
    defaultTerms: `Syarat & Ketentuan Pemasangan Borneo Etam CCTV:
1. Harga sudah termasuk perangkat baru bergaransi resmi 12 Bulan (DVR/NVR, Kamera & Harddisk WD Purple).
2. Garansi pemeliharaan instalasi & setting online aplikasi HP selama 3 Bulan.
3. Pembayaran DP 50% saat jadwal instalasi disepakati, pelunasan 50% setelah seluruh kamera menyala & serah terima (BAST).`,
    items: [
      { description: '=== PERANGKAT UTAMA CCTV 4 CHANNEL ===', quantity: 0, unit: 'Header', unit_price: 0, cost_price: 0 },
      { description: 'DVR 4 Channel H.265+ Full HD Smart Motion (Hikvision/Hilook)', quantity: 1, unit: 'Unit', unit_price: 750000, cost_price: 520000 },
      { description: 'Kamera CCTV Indoor Dome 2MP Full HD 1080p IR', quantity: 2, unit: 'Unit', unit_price: 275000, cost_price: 185000 },
      { description: 'Kamera CCTV Outdoor Bullet 2MP Weatherproof IP66', quantity: 2, unit: 'Unit', unit_price: 300000, cost_price: 205000 },
      { description: 'Harddisk Khusus CCTV WD Purple / Seagate SkyHawk 500GB', quantity: 1, unit: 'Unit', unit_price: 450000, cost_price: 310000 },
      { description: '=== MATERIAL INSTALASI & JASA TEKNISI ===', quantity: 0, unit: 'Header', unit_price: 0, cost_price: 0 },
      { description: 'Power Supply Box 12V 10A + Konektor BNC & Jack DC Lengkap', quantity: 1, unit: 'Paket', unit_price: 250000, cost_price: 150000 },
      { description: 'Kabel Coaxial RG59 + Power (Maks. 80 Meter) & Klem', quantity: 1, unit: 'Roll', unit_price: 300000, cost_price: 210000 },
      { description: 'Jasa Instalasi, Penarikan Kabel, Konfigurasi Cloud & Aplikasi HP', quantity: 4, unit: 'Titik', unit_price: 150000, cost_price: 95000 },
    ],
  },
  {
    id: 'paket-8-ipcam',
    name: 'Paket 8 Titik IP Camera PoE Digital 4MP ColorVu / Audio',
    shortName: 'Paket 8 Titik IP Cam PoE',
    service_type: 'CCTV',
    totalPrice: 7800000,
    estimatedCost: 5350000,
    badge: 'Standar Kantor & Gudang',
    highlight: 'Rp 7.800.000',
    description: '8 Unit IP Camera 4MP PoE Jernih + Rekam Suara, NVR 8Ch 4K, Switch PoE 8 Port, HDD 2TB WD Purple, Kabel UTP Cat6 & Instalasi Rapi.',
    warrantyMonths: 12,
    photos: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=900&q=80',
    ],
    defaultTerms: `Syarat & Ketentuan Pemasangan Borneo Etam CCTV:
1. Perangkat IP Camera PoE, NVR, dan Harddisk WD Purple 2TB bergaransi resmi distributor 12 Bulan.
2. Sistem PoE menggunakan 1 jalur kabel UTP Cat6 untuk data dan daya listrik yang stabil.
3. Pembayaran DP 50% saat material masuk lokasi, pelunasan 50% setelah uji fungsi & serah terima.`,
    items: [
      { description: '=== PERANGKAT UTAMA IP CAMERA POE 8 TITIK ===', quantity: 0, unit: 'Header', unit_price: 0, cost_price: 0 },
      { description: 'NVR 8 Channel 4K Ultra HD H.265+ (Hikvision/Dahua)', quantity: 1, unit: 'Unit', unit_price: 1350000, cost_price: 980000 },
      { description: 'IP Camera Indoor 4MP PoE Built-in Mic Audio & Smart IR', quantity: 4, unit: 'Unit', unit_price: 425000, cost_price: 295000 },
      { description: 'IP Camera Outdoor 4MP PoE ColorVu / Full Color 24 Jam IP67', quantity: 4, unit: 'Unit', unit_price: 475000, cost_price: 330000 },
      { description: 'Harddisk Surveillance WD Purple 2TB Original Garansi Resmi', quantity: 1, unit: 'Unit', unit_price: 1150000, cost_price: 860000 },
      { description: '=== JARINGAN POE, MATERIAL & JASA INSTALASI ===', quantity: 0, unit: 'Header', unit_price: 0, cost_price: 0 },
      { description: 'Switch PoE 8 Port + 2 Uplink Gigabit + Konektor RJ45 Metal', quantity: 1, unit: 'Set', unit_price: 550000, cost_price: 380000 },
      { description: 'Kabel LAN UTP Cat6 Murni (150 Meter) + Pipa Pelindung & Klem', quantity: 1, unit: 'Paket', unit_price: 650000, cost_price: 440000 },
      { description: 'Jasa Instalasi IP Cam, Terminasi RJ45, Setting NVR & Pantau HP', quantity: 8, unit: 'Titik', unit_price: 150000, cost_price: 90000 },
    ],
  },
  {
    id: 'paket-pos-retail',
    name: 'Paket Komputer Kasir Retail & Minimarket Siap Pakai (POS)',
    shortName: 'Paket Komputer Kasir POS',
    service_type: 'POS',
    totalPrice: 4900000,
    estimatedCost: 3400000,
    badge: 'Solusi Kasir Toko & Cafe',
    highlight: 'Rp 4.900.000',
    description: 'Set PC Kasir Core i3 SSD Ngebut, Monitor LED 19", Printer Struk Thermal Auto-Cutter, Scanner Barcode 2D, Laci Uang Otomatis & Training.',
    warrantyMonths: 12,
    photos: [
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1556742111-a301076d9d18?auto=format&fit=crop&w=900&q=80',
    ],
    defaultTerms: `Syarat & Ketentuan Sistem Kasir POS Borneo Etam:
1. Garansi hardware (PC Kasir, Monitor, Printer Thermal, Barcode Scanner & Cash Drawer) selama 12 Bulan.
2. Sudah termasuk instalasi Software Kasir Retail/F&B tanpa biaya bulanan + sesi pelatihan kasir sampai mahir.
3. Gratis pendampingan input sampel produk awal dan desain kop struk belanja toko.`,
    items: [
      { description: '=== HARDWARE KOMPUTER KASIR & PERIFERAL POS ===', quantity: 0, unit: 'Header', unit_price: 0, cost_price: 0 },
      { description: 'PC Rakitan / Mini PC Kasir Intel Core i3, RAM 8GB, SSD 256GB NVMe', quantity: 1, unit: 'Unit', unit_price: 2150000, cost_price: 1550000 },
      { description: 'Monitor LED 19 Inch HD Wide + Keyboard & Mouse Optik USB', quantity: 1, unit: 'Set', unit_price: 950000, cost_price: 680000 },
      { description: 'Printer Struk Kasir Thermal 58/80mm High Speed USB', quantity: 1, unit: 'Unit', unit_price: 450000, cost_price: 290000 },
      { description: 'Barcode Scanner Laser 1D/2D QR Omnidirectional Auto-Sense', quantity: 1, unit: 'Unit', unit_price: 450000, cost_price: 280000 },
      { description: 'Laci Uang Kasir (Cash Drawer) Besi 5 Slot RJ11 Otomatis Buka', quantity: 1, unit: 'Unit', unit_price: 450000, cost_price: 310000 },
      { description: '=== SOFTWARE KASIR & IMPLEMENTASI ===', quantity: 0, unit: 'Header', unit_price: 0, cost_price: 0 },
      { description: 'Lisensi Software Kasir POS Stok/Laba Rugi + Training Operator Toko + Kertas Thermal 10 Roll', quantity: 1, unit: 'Paket', unit_price: 450000, cost_price: 290000 },
    ],
  },
  {
    id: 'paket-bundling-toko',
    name: 'Paket Komplit Toko Bundling: 4 Titik CCTV HD + Set Komputer Kasir POS',
    shortName: 'Paket Bundling CCTV + Kasir',
    service_type: 'BUNDLING',
    totalPrice: 8200000,
    estimatedCost: 5600000,
    badge: 'Hemat Rp 200rb • All-in-One',
    highlight: 'Rp 8.200.000',
    description: 'Solusi Pembukaan Toko/Ruko Baru: Paket Lengkap 4 Kamera CCTV Pantau Meja Kasir & Area Toko + 1 Set Lengkap Komputer Kasir POS Siap Jualan.',
    warrantyMonths: 12,
    photos: [
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=900&q=80',
    ],
    defaultTerms: `Syarat & Ketentuan Paket Bundling Toko Borneo Etam:
1. Solusi terpadu keamanan CCTV (termasuk 1 kamera fokus di atas meja laci kasir) + Sistem Komputer Kasir POS siap operasional.
2. Garansi resmi perangkat keras CCTV & POS 12 Bulan penuh (1 Tahun).
3. Termasuk instalasi rapi di lokasi, setting pantau HP untuk Owner, dan training karyawan kasir.`,
    items: [
      { description: '=== BAGIAN 1: SISTEM KEAMANAN 4 TITIK CCTV HD ===', quantity: 0, unit: 'Header', unit_price: 0, cost_price: 0 },
      { description: 'DVR 4Ch H.265+ + 4 Kamera CCTV 2MP (Area Kasir, Etalase & Parkir) + HDD 500GB WD Purple', quantity: 1, unit: 'Paket', unit_price: 2550000, cost_price: 1750000 },
      { description: 'Material Kabel Coaxial RG59 80m, PSU 10A, Konektor & Jasa Pasang CCTV', quantity: 1, unit: 'Paket', unit_price: 850000, cost_price: 550000 },
      { description: '=== BAGIAN 2: SET LENGKAP KOMPUTER KASIR (POS) ===', quantity: 0, unit: 'Header', unit_price: 0, cost_price: 0 },
      { description: 'PC Kasir Core i3 RAM 8GB SSD 256GB + Monitor LED 19" + Keyboard Mouse', quantity: 1, unit: 'Set', unit_price: 3050000, cost_price: 2180000 },
      { description: 'Printer Thermal Struk + Barcode Scanner 2D + Cash Drawer Laci Uang Besi', quantity: 1, unit: 'Paket', unit_price: 1300000, cost_price: 870000 },
      { description: 'Software Kasir POS Full Version + Setup Master Barang & Training Karyawan', quantity: 1, unit: 'Paket', unit_price: 450000, cost_price: 250000 },
    ],
  },
];

// ============================================================================
// PERSISTENSI & MANAJEMEN PAKET PENAWARAN CEPAT (BISA DIEDIT & UPLOAD FOTO)
// ============================================================================
const LOCAL_PACKAGES_KEY = 'borneo_etam_preset_packages_v1';

export function loadBorneoPackages(): BorneoPresetPackage[] {
  try {
    const raw = localStorage.getItem(LOCAL_PACKAGES_KEY);
    if (!raw) return BORNEO_ETAM_PACKAGES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return BORNEO_ETAM_PACKAGES;
    const defaultMap = new Map(BORNEO_ETAM_PACKAGES.map((p) => [p.id, p]));
    return parsed.map((pkg: BorneoPresetPackage) => {
      const def = defaultMap.get(pkg.id);
      return {
        ...pkg,
        photos:
          Array.isArray(pkg.photos) && pkg.photos.length > 0
            ? pkg.photos
            : def?.photos || [],
        items:
          Array.isArray(pkg.items) && pkg.items.length > 0
            ? pkg.items
            : def?.items || [],
      };
    });
  } catch {
    return BORNEO_ETAM_PACKAGES;
  }
}

export function saveBorneoPackage(updatedPkg: BorneoPresetPackage): BorneoPresetPackage[] {
  const current = loadBorneoPackages();
  const formattedHighlight = `Rp ${Number(updatedPkg.totalPrice || 0).toLocaleString('id-ID')}`;
  const normalized: BorneoPresetPackage = {
    ...updatedPkg,
    highlight: formattedHighlight,
    photos: Array.isArray(updatedPkg.photos) ? updatedPkg.photos : [],
  };
  const idx = current.findIndex((p) => p.id === normalized.id);
  const next =
    idx >= 0
      ? current.map((p, i) => (i === idx ? normalized : p))
      : [...current, normalized];
  try {
    localStorage.setItem(LOCAL_PACKAGES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

export function deleteBorneoPackage(pkgId: string): BorneoPresetPackage[] {
  const current = loadBorneoPackages();
  const next = current.filter((p) => p.id !== pkgId);
  const finalList = next.length > 0 ? next : BORNEO_ETAM_PACKAGES;
  try {
    localStorage.setItem(LOCAL_PACKAGES_KEY, JSON.stringify(finalList));
  } catch {
    // ignore
  }
  return finalList;
}

export function resetBorneoPackagesToDefault(): BorneoPresetPackage[] {
  try {
    localStorage.removeItem(LOCAL_PACKAGES_KEY);
  } catch {
    // ignore
  }
  return BORNEO_ETAM_PACKAGES;
}

// ============================================================================
// ITEM KATALOG STANDAR UNTUK IMPOR 1-KLIK KE PUSTAKA BARANG & JASA
// ============================================================================
export const BORNEO_ETAM_CATALOG_ITEMS: PresetPackageItem[] = [
  { description: 'Kamera CCTV Hikvision Indoor 2MP DS-2CE76D0T-EXIPF', quantity: 1, unit: 'Unit', unit_price: 275000, cost_price: 185000 },
  { description: 'Kamera CCTV Hikvision Outdoor 2MP DS-2CE16D0T-EXIPF', quantity: 1, unit: 'Unit', unit_price: 300000, cost_price: 205000 },
  { description: 'IP Camera Hikvision 4MP PoE ColorVu Audio', quantity: 1, unit: 'Unit', unit_price: 475000, cost_price: 330000 },
  { description: 'DVR Hikvision 4 Channel Turbo HD H.265+', quantity: 1, unit: 'Unit', unit_price: 750000, cost_price: 520000 },
  { description: 'NVR 8 Channel 4K PoE H.265+ Original', quantity: 1, unit: 'Unit', unit_price: 1350000, cost_price: 980000 },
  { description: 'Harddisk WD Purple Surveillance 1TB Garansi Resmi', quantity: 1, unit: 'Unit', unit_price: 780000, cost_price: 590000 },
  { description: 'Harddisk WD Purple Surveillance 2TB Garansi Resmi', quantity: 1, unit: 'Unit', unit_price: 1150000, cost_price: 860000 },
  { description: 'Switch PoE 8 Port + 2 Uplink Gigabit', quantity: 1, unit: 'Unit', unit_price: 520000, cost_price: 360000 },
  { description: 'Kabel Coaxial RG59 + Power (Per Meter)', quantity: 1, unit: 'Meter', unit_price: 6500, cost_price: 4000 },
  { description: 'Kabel UTP Cat6 Belden / Hikvision (Per Meter)', quantity: 1, unit: 'Meter', unit_price: 7500, cost_price: 4800 },
  { description: 'Pipa Conduit Putih 20mm + Sok & Klem (Per Batang)', quantity: 1, unit: 'Batang', unit_price: 18000, cost_price: 11000 },
  { description: 'Jasa Tarik Kabel & Instalasi Titik Kamera CCTV', quantity: 1, unit: 'Titik', unit_price: 150000, cost_price: 85000 },
  { description: 'Printer Kasir Thermal 80mm Auto-Cutter USB/LAN', quantity: 1, unit: 'Unit', unit_price: 750000, cost_price: 510000 },
  { description: 'Barcode Scanner 2D QR Code Duduk / Handsfree', quantity: 1, unit: 'Unit', unit_price: 480000, cost_price: 310000 },
  { description: 'Laci Uang Kasir (Cash Drawer) RJ11 Metal 5 Slot', quantity: 1, unit: 'Unit', unit_price: 450000, cost_price: 310000 },
];

// ============================================================================
// DATA PORTOFOLIO & PROYEK AWAL KALIMANTAN TIMUR (DEFAULT SEED DENGAN FOTO)
// ============================================================================
// Data peta dimulai kosong. ID seed demo lama dipakai hanya untuk membersihkan cache browser.
export const INITIAL_KALTIM_INSTALLATIONS: CCTVInstallation[] = [];

const LEGACY_DEMO_IDS = new Set([
  'be-kaltim-001', 'be-kaltim-002', 'be-kaltim-003', 'be-kaltim-004',
  'be-kaltim-005', 'be-kaltim-006', 'be-kaltim-007', 'be-kaltim-008',
]);

const LOCAL_STORAGE_KEY = 'borneo_etam_cctv_installations_v1';

// ============================================================================
// FUNGSI UTILITAS PENOMORAN SURAT PENAWARAN RESMI (QUO/BE-CCTV/XI/2026/014)
// ============================================================================
export function generateBorneoQuoteNumber(sequenceNumber?: number): string {
  const now = new Date();
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const monthRoman = romanMonths[now.getMonth()] || 'XI';
  const year = now.getFullYear();
  const seq = sequenceNumber ?? Math.floor(10 + Math.random() * 89);
  const paddedSeq = String(seq).padStart(3, '0');
  return `QUO/BE-CCTV/${monthRoman}/${year}/${paddedSeq}`;
}

// ============================================================================
// FUNGSI KALKULASI COUNTDOWN GARANSI 12 BULAN (AFTER-SALES ENGINE)
// ============================================================================
export function calculateWarrantyStatus(
  installedAt: string | null | undefined,
  warrantyMonths = 12,
  progress = 100
): WarrantyStatusInfo {
  if (progress < 100 || !installedAt) {
    return {
      status: 'pending',
      daysRemaining: warrantyMonths * 30,
      totalDays: warrantyMonths * 30,
      percentRemaining: 100,
      expiryDateFormatted: 'Aktif Setelah 100%',
      badgeLabel: progress === 0 ? 'Antrean Survei' : `Instalasi ${progress}%`,
      badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      dotColor: 'bg-sky-500',
    };
  }

  const parsedStart = parseISO(installedAt);
  if (!isValid(parsedStart)) {
    return {
      status: 'pending',
      daysRemaining: 365,
      totalDays: 365,
      percentRemaining: 100,
      expiryDateFormatted: '-',
      badgeLabel: 'Belum Terjadwal',
      badgeClass: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
      dotColor: 'bg-slate-400',
    };
  }

  const expiryDate = addMonths(parsedStart, warrantyMonths);
  const today = new Date();
  const totalDays = Math.max(1, differenceInDays(expiryDate, parsedStart));
  const daysRemaining = differenceInDays(expiryDate, today);
  const percentRemaining = Math.max(0, Math.min(100, Math.round((daysRemaining / totalDays) * 100)));
  const expiryDateFormatted = format(expiryDate, 'dd MMM yyyy');

  if (daysRemaining <= 0) {
    return {
      status: 'expired',
      daysRemaining: 0,
      totalDays,
      percentRemaining: 0,
      expiryDateFormatted,
      badgeLabel: 'Garansi Habis (Skema Maintenance)',
      badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
      dotColor: 'bg-slate-400',
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: 'warning_h30',
      daysRemaining,
      totalDays,
      percentRemaining,
      expiryDateFormatted,
      badgeLabel: `Peringatan H-${daysRemaining} (${daysRemaining} Hari Lagi)`,
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      dotColor: 'bg-amber-500',
    };
  }

  return {
    status: 'active',
    daysRemaining,
    totalDays,
    percentRemaining,
    expiryDateFormatted,
    badgeLabel: `Garansi Aktif (${daysRemaining} Hari)`,
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dotColor: 'bg-emerald-500',
  };
}

// ============================================================================
// FUNGSI PRIVASI & ANONIMISASI MODE PORTOFOLIO PUBLIK (FUZZY GPS & SENSOR DATA)
// ============================================================================
function deterministicHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash >>> 0);
}

export function sanitizePublicAreaLandmark(rawAddress: string, city: string): string {
  if (!rawAddress) return `Kawasan Komersial ${city}`;
  // Hilangkan nomor rumah/ruko detail (No. 12, Blok A3, RT 05, dsb) demi privasi
  const cleaned = rawAddress
    .replace(/\b(no\.?|nomor|blok|rt\.?|rw\.?|gg\.?|gang)\s*[0-9a-zA-Z/-]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || `Area ${city}`;
}

export function toPublicPortfolioItem(item: CCTVInstallation): PublicPortfolioInstallation {
  const h = deterministicHash(item.id || item.project_name);
  // Geser koordinat sejauh ~250m - 450m secara konsisten agar titik persis rumah/toko terlindungi
  const latOffset = (((h % 17) - 8) || 5) * 0.00038;
  const lngOffset = ((((h >> 4) % 17) - 8) || -5) * 0.00038;

  const installedMonth = item.installed_at && isValid(parseISO(item.installed_at))
    ? format(parseISO(item.installed_at), 'MMM yyyy')
    : 'Terverifikasi';

  return {
    id: item.id,
    public_display_name: item.public_display_name || `${item.service_type === 'POS' ? 'Sistem Kasir POS' : 'Instalasi CCTV'} — Area ${item.city}`,
    service_type: item.service_type,
    package_name: item.package_name || 'Paket Custom Borneo Etam',
    city: item.city,
    area_landmark: sanitizePublicAreaLandmark(item.address_landmark, item.city),
    fuzzy_lat: Number((Number(item.latitude) + latOffset).toFixed(5)),
    fuzzy_lng: Number((Number(item.longitude) + lngOffset).toFixed(5)),
    progress: item.progress,
    hardware_specs: item.hardware_specs || 'Perangkat Original Bergaransi 12 Bulan',
    installed_month: installedMonth,
    warranty_months: item.warranty_months || 12,
    rating: Number(item.rating || 5.0),
    review_text: item.review_text || 'Instalasi rapi, perangkat berfungsi optimal, dan layanan after-sales responsif.',
    photos: Array.isArray(item.photos) ? item.photos : [],
  };
}

// ============================================================================
// STORAGE ENGINE (HYBRID SUPABASE + LOCALSTORAGE NON-DESTRUCTIVE)
// ============================================================================
function loadLocalInstallations(): CCTVInstallation[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Buang data demo lama dari cache browser, data asli tetap aman
    const clean = parsed.filter((item: CCTVInstallation) => !LEGACY_DEMO_IDS.has(item.id));
    if (clean.length !== parsed.length) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clean));
    }
    return clean.map((item: CCTVInstallation) => ({
      ...item,
      photos: Array.isArray(item.photos) ? item.photos : [],
    }));
  } catch {
    return [];
  }
}

function saveLocalInstallations(items: CCTVInstallation[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save local installations:', err);
  }
}

export async function fetchCCTVInstallations(userId?: string): Promise<CCTVInstallation[]> {
  const localItems = loadLocalInstallations();
  try {
    let query = supabase
      .from('cctv_installations')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      const normalized: CCTVInstallation[] = data.map((row: any) => {
        const localMatch = localItems.find((l) => l.id === row.id);
        return {
          id: row.id,
          user_id: row.user_id,
          quote_id: row.quote_id,
          project_id: row.project_id,
          client_id: row.client_id,
          project_name: row.project_name || 'Proyek CCTV/POS',
          public_display_name: row.public_display_name || `Instalasi ${row.service_type || 'CCTV'} — Area ${row.city || 'Kaltim'}`,
          client_name: row.client_name || '',
          client_phone: row.client_phone || '',
          address_landmark: row.address_landmark || '',
          service_type: (row.service_type as ServiceType) || 'CCTV',
          package_name: row.package_name || '',
          city: row.city || 'Samarinda',
          latitude: Number(row.latitude) || -0.5022,
          longitude: Number(row.longitude) || 117.1536,
          progress: Number(row.progress ?? 0),
          sn_nvr: row.sn_nvr || '',
          sn_hdd: row.sn_hdd || '',
          hardware_specs: row.hardware_specs || '',
          installed_at: row.installed_at || null,
          warranty_months: Number(row.warranty_months || 12),
          rating: Number(row.rating || 5.0),
          review_text: row.review_text || '',
          photos: Array.isArray(row.photos)
            ? row.photos
            : localMatch?.photos || [],
          preferred_survey_date: row.preferred_survey_date || null,
          preferred_survey_time: row.preferred_survey_time || null,
          is_public_portfolio: Boolean(row.is_public_portfolio ?? true),
          notes: row.notes || '',
          created_at: row.created_at || new Date().toISOString(),
        };
      });
      // Gabungkan dengan local items yang belum ter-sync
      const remoteIds = new Set(normalized.map((i) => i.id));
      const merged = [...normalized, ...localItems.filter((l) => !remoteIds.has(l.id))];
      saveLocalInstallations(merged);
      return merged;
    }
  } catch {
    // Gunakan fallback localStorage jika tabel Supabase belum dibuat
  }
  return localItems;
}

export async function fetchPublicPortfolioInstallations(): Promise<PublicPortfolioInstallation[]> {
  const all = await fetchCCTVInstallations();
  return all
    .filter((item) => item.is_public_portfolio && item.progress > 0)
    .map(toPublicPortfolioItem);
}

export async function saveCCTVInstallation(
  item: Omit<CCTVInstallation, 'id' | 'created_at'> & { id?: string },
  userId?: string
): Promise<CCTVInstallation> {
  const localItems = loadLocalInstallations();
  const isUpdate = Boolean(item.id && localItems.some((x) => x.id === item.id));
  const nowIso = new Date().toISOString();

  const record: CCTVInstallation = {
    ...item,
    photos: Array.isArray(item.photos) ? item.photos : [],
    id: item.id || `be-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId || item.user_id || null,
    created_at: isUpdate
      ? localItems.find((x) => x.id === item.id)?.created_at || nowIso
      : nowIso,
  };

  // Simpan di localStorage terlebih dahulu agar instan dan anti-gagal
  const updatedLocal = isUpdate
    ? localItems.map((x) => (x.id === record.id ? record : x))
    : [record, ...localItems];
  saveLocalInstallations(updatedLocal);

  // Coba sinkronkan ke Supabase secara non-blocking
  try {
    if (userId) {
      const payload = {
        user_id: userId,
        project_name: record.project_name,
        public_display_name: record.public_display_name,
        client_name: record.client_name,
        client_phone: record.client_phone,
        address_landmark: record.address_landmark,
        service_type: record.service_type,
        package_name: record.package_name,
        city: record.city,
        latitude: record.latitude,
        longitude: record.longitude,
        progress: record.progress,
        sn_nvr: record.sn_nvr,
        sn_hdd: record.sn_hdd,
        hardware_specs: record.hardware_specs,
        installed_at: record.installed_at,
        warranty_months: record.warranty_months,
        rating: record.rating,
        review_text: record.review_text,
        photos: record.photos || [],
        preferred_survey_date: record.preferred_survey_date || null,
        preferred_survey_time: record.preferred_survey_time || null,
        is_public_portfolio: record.is_public_portfolio,
        notes: record.notes,
      };

      if (isUpdate && !record.id.startsWith('be-')) {
        await supabase.from('cctv_installations').update(payload).eq('id', record.id);
      } else {
        await supabase.from('cctv_installations').insert(payload);
      }
    }
  } catch {
    // Aman diabaikan karena sudah tersimpan di localStorage
  }

  return record;
}

export async function deleteCCTVInstallation(id: string): Promise<void> {
  const localItems = loadLocalInstallations();
  saveLocalInstallations(localItems.filter((x) => x.id !== id));
  try {
    if (!id.startsWith('be-')) {
      await supabase.from('cctv_installations').delete().eq('id', id);
    }
  } catch {
    // Ignore
  }
}

export interface SurveyRequestPayload {
  client_name: string;
  client_phone: string;
  business_name: string;
  city: string;
  address_landmark: string;
  service_type: ServiceType;
  package_name: string;
  latitude: number;
  longitude: number;
  preferred_survey_date: string;
  preferred_survey_time: string;
  notes: string;
}

export async function submitPublicSurveyRequest(payload: SurveyRequestPayload): Promise<CCTVInstallation> {
  const newInstall = await saveCCTVInstallation({
    project_name: `Survei ${payload.service_type}: ${payload.business_name || payload.client_name} (${payload.city})`,
    public_display_name: `${payload.business_name || 'Calon Mitra'} — Area ${payload.city}`,
    client_name: payload.client_name,
    client_phone: payload.client_phone,
    address_landmark: payload.address_landmark,
    service_type: payload.service_type,
    package_name: payload.package_name,
    city: payload.city,
    latitude: payload.latitude,
    longitude: payload.longitude,
    progress: 0, // 0% = Merah (Antrean Survei)
    sn_nvr: '',
    sn_hdd: '',
    hardware_specs: `Permintaan Survei: ${payload.package_name}`,
    installed_at: null,
    warranty_months: 12,
    rating: 5.0,
    review_text: 'Antrean jadwal survei lokasi baru.',
    photos: [],
    preferred_survey_date: payload.preferred_survey_date,
    preferred_survey_time: payload.preferred_survey_time,
    is_public_portfolio: false, // Tidak tampil di publik sebelum disetujui admin
    notes: `Jadwal Survei: ${payload.preferred_survey_date} (${payload.preferred_survey_time}). Catatan: ${payload.notes || '-'}`,
  });

  return newInstall;
}

export function exportInstallationsToCSV(items: CCTVInstallation[]): void {
  const headers = [
    'ID Proyek',
    'Nama Proyek',
    'Nama Klien',
    'Telepon / WA',
    'Kota Wilayah',
    'Alamat / Patokan',
    'Jenis Layanan',
    'Paket',
    'Progres (%)',
    'SN NVR / PC',
    'SN Harddisk / SSD',
    'Tanggal Pasang',
    'Garansi (Bulan)',
    'Status Garansi',
    'Jumlah Foto',
    'Latitude',
    'Longitude',
  ];

  const rows = items.map((item) => {
    const w = calculateWarrantyStatus(item.installed_at, item.warranty_months, item.progress);
    return [
      item.id,
      `"${(item.project_name || '').replace(/"/g, '""')}"`,
      `"${(item.client_name || '').replace(/"/g, '""')}"`,
      `"${item.client_phone || ''}"`,
      `"${item.city || ''}"`,
      `"${(item.address_landmark || '').replace(/"/g, '""')}"`,
      item.service_type,
      `"${(item.package_name || '').replace(/"/g, '""')}"`,
      item.progress,
      `"${item.sn_nvr || '-'}"`,
      `"${item.sn_hdd || '-'}"`,
      item.installed_at || '-',
      item.warranty_months,
      `"${w.badgeLabel}"`,
      (item.photos || []).length,
      item.latitude,
      item.longitude,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Data_Proyek_Garansi_BorneoEtam_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
