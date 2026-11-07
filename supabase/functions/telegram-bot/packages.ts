// Katalog paket bawaan Borneo Etam CCTV & Komputer Kasir.
// Terbagi dalam 3 kategori standar: Item Utama, Material Tambahan, dan Jasa & Akomodasi.
// Bila tabel borneo_packages berisi data milik owner di Supabase, data tersebut yang akan diutamakan.

export const DEFAULT_PACKAGES: any[] = [
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
    defaultTerms: `Syarat & Ketentuan Pemasangan Borneo Etam CCTV:
1. Harga sudah termasuk perangkat baru bergaransi resmi 12 Bulan (DVR/NVR, Kamera & Harddisk WD Purple).
2. Garansi pemeliharaan instalasi & setting online aplikasi HP selama 3 Bulan.
3. Pembayaran DP 50% saat jadwal instalasi disepakati, pelunasan 50% setelah seluruh kamera menyala & serah terima (BAST).`,
    items: [
      // 1. Item Utama
      { description: 'DVR 4 Channel H.265+ Full HD Smart Motion (Hikvision/Hilook)', quantity: 1, unit: 'Unit', unit_price: 750000, cost_price: 520000, category: 'item_utama' },
      { description: 'Kamera CCTV Indoor Dome 2MP Full HD 1080p IR', quantity: 2, unit: 'Unit', unit_price: 275000, cost_price: 185000, category: 'item_utama' },
      { description: 'Kamera CCTV Outdoor Bullet 2MP Weatherproof IP66', quantity: 2, unit: 'Unit', unit_price: 300000, cost_price: 205000, category: 'item_utama' },
      { description: 'Harddisk Khusus CCTV WD Purple / Seagate SkyHawk 500GB', quantity: 1, unit: 'Unit', unit_price: 450000, cost_price: 310000, category: 'item_utama' },
      // 2. Material Tambahan
      { description: 'Power Supply Box 12V 10A + Konektor BNC & Jack DC Lengkap', quantity: 1, unit: 'Paket', unit_price: 250000, cost_price: 150000, category: 'material_tambahan' },
      { description: 'Kabel Coaxial RG59 + Power (Maks. 80 Meter) & Klem', quantity: 1, unit: 'Roll', unit_price: 300000, cost_price: 210000, category: 'material_tambahan' },
      // 3. Jasa dan Akomodasi
      { description: 'Jasa Instalasi, Penarikan Kabel, Konfigurasi Cloud & Setting HP', quantity: 4, unit: 'Titik', unit_price: 150000, cost_price: 95000, category: 'jasa_akomodasi' },
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
    defaultTerms: `Syarat & Ketentuan Pemasangan Borneo Etam CCTV:
1. Perangkat IP Camera PoE, NVR, dan Harddisk WD Purple 2TB bergaransi resmi distributor 12 Bulan.
2. Sistem PoE menggunakan 1 jalur kabel UTP Cat6 untuk data dan daya listrik yang stabil.
3. Pembayaran DP 50% saat material masuk lokasi, pelunasan 50% setelah uji fungsi & serah terima.`,
    items: [
      // 1. Item Utama
      { description: 'NVR 8 Channel 4K Ultra HD H.265+ (Hikvision/Dahua)', quantity: 1, unit: 'Unit', unit_price: 1350000, cost_price: 980000, category: 'item_utama' },
      { description: 'IP Camera Indoor 4MP PoE Built-in Mic Audio & Smart IR', quantity: 4, unit: 'Unit', unit_price: 425000, cost_price: 295000, category: 'item_utama' },
      { description: 'IP Camera Outdoor 4MP PoE ColorVu / Full Color 24 Jam IP67', quantity: 4, unit: 'Unit', unit_price: 475000, cost_price: 330000, category: 'item_utama' },
      { description: 'Harddisk Surveillance WD Purple 2TB Original Garansi Resmi', quantity: 1, unit: 'Unit', unit_price: 1150000, cost_price: 860000, category: 'item_utama' },
      // 2. Material Tambahan
      { description: 'Switch PoE 8 Port + 2 Uplink Gigabit + Konektor RJ45 Metal', quantity: 1, unit: 'Set', unit_price: 550000, cost_price: 380000, category: 'material_tambahan' },
      { description: 'Kabel LAN UTP Cat6 Murni (150 Meter) + Pipa Pelindung & Klem', quantity: 1, unit: 'Paket', unit_price: 650000, cost_price: 440000, category: 'material_tambahan' },
      // 3. Jasa dan Akomodasi
      { description: 'Jasa Instalasi IP Cam, Terminasi RJ45, Setting NVR & Pantau HP', quantity: 8, unit: 'Titik', unit_price: 150000, cost_price: 90000, category: 'jasa_akomodasi' },
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
    defaultTerms: `Syarat & Ketentuan Sistem Kasir POS Borneo Etam:
1. Garansi hardware (PC Kasir, Monitor, Printer Thermal, Barcode Scanner & Cash Drawer) selama 12 Bulan.
2. Sudah termasuk instalasi Software Kasir Retail/F&B tanpa biaya bulanan + sesi pelatihan kasir sampai mahir.
3. Gratis pendampingan input sampel produk awal dan desain kop struk belanja toko.`,
    items: [
      // 1. Item Utama
      { description: 'PC Rakitan / Mini PC Kasir Intel Core i3, RAM 8GB, SSD 256GB NVMe', quantity: 1, unit: 'Unit', unit_price: 2150000, cost_price: 1550000, category: 'item_utama' },
      { description: 'Monitor LED 19 Inch HD Wide + Keyboard & Mouse Optik USB', quantity: 1, unit: 'Set', unit_price: 950000, cost_price: 680000, category: 'item_utama' },
      { description: 'Printer Struk Kasir Thermal 58/80mm High Speed USB', quantity: 1, unit: 'Unit', unit_price: 450000, cost_price: 290000, category: 'item_utama' },
      { description: 'Barcode Scanner Laser 1D/2D QR Omnidirectional Auto-Sense', quantity: 1, unit: 'Unit', unit_price: 450000, cost_price: 280000, category: 'item_utama' },
      { description: 'Laci Uang Kasir (Cash Drawer) Besi 5 Slot RJ11 Otomatis Buka', quantity: 1, unit: 'Unit', unit_price: 450000, cost_price: 310000, category: 'item_utama' },
      // 2. Material Tambahan
      { description: 'Kertas Struk Kasir Thermal Roll 58/80mm (10 Roll) & Kabel Power/USB', quantity: 1, unit: 'Paket', unit_price: 150000, cost_price: 85000, category: 'material_tambahan' },
      // 3. Jasa dan Akomodasi
      { description: 'Setup Software Kasir POS, Import Database Produk & Training Kasir', quantity: 1, unit: 'Paket', unit_price: 300000, cost_price: 205000, category: 'jasa_akomodasi' },
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
    defaultTerms: `Syarat & Ketentuan Paket Bundling Toko Borneo Etam:
1. Solusi terpadu keamanan CCTV (termasuk 1 kamera fokus di atas meja laci kasir) + Sistem Komputer Kasir POS siap operasional.
2. Garansi resmi perangkat keras CCTV & POS 12 Bulan penuh (1 Tahun).
3. Termasuk instalasi rapi di lokasi, setting pantau HP untuk Owner, dan training karyawan kasir.`,
    items: [
      // 1. Item Utama
      { description: 'DVR 4Ch H.265+ + 4 Kamera CCTV 2MP + HDD 500GB WD Purple', quantity: 1, unit: 'Paket', unit_price: 2550000, cost_price: 1750000, category: 'item_utama' },
      { description: 'PC Kasir Core i3 RAM 8GB SSD 256GB + Monitor LED 19" + Keyboard Mouse', quantity: 1, unit: 'Set', unit_price: 3050000, cost_price: 2180000, category: 'item_utama' },
      { description: 'Printer Thermal Struk + Barcode Scanner 2D + Cash Drawer Laci Uang Besi', quantity: 1, unit: 'Paket', unit_price: 1300000, cost_price: 870000, category: 'item_utama' },
      // 2. Material Tambahan
      { description: 'Material Kabel Coaxial RG59 80m, PSU 10A, Konektor & Kertas Thermal 10 Roll', quantity: 1, unit: 'Paket', unit_price: 450000, cost_price: 280000, category: 'material_tambahan' },
      // 3. Jasa dan Akomodasi
      { description: 'Jasa Pemasangan CCTV, Setting Online HP, Setup Software POS & Training Kasir', quantity: 1, unit: 'Paket', unit_price: 850000, cost_price: 520000, category: 'jasa_akomodasi' },
    ],
  },
];
