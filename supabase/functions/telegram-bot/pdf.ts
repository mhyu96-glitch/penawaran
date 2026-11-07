// Generator Dokumen PDF Resmi Borneo Etam CCTV & POS (A4 Standard Executive Design)
// Mendukung: Surat Penawaran Harga, Faktur Tagihan, Surat Jalan, dan Berita Acara Serah Terima (BAST).
// Desain modern, multi-line address wrapping, 3 kategori rapi, stempel digital resmi, tanpa ALL CAPS.
import { jsPDF } from 'https://esm.sh/jspdf@3.0.3';

export type DocType = 'quote' | 'invoice' | 'surat_jalan' | 'bast' | 'warranty';
export type ItemCategory = 'item_utama' | 'material_tambahan' | 'jasa_akomodasi';

export interface DocItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  cost_price?: number;
  category?: ItemCategory | string;
}

export interface QuotePdfData {
  type: DocType;
  docNumber: string;
  docTitle?: string;
  dateStr: string;
  validUntilOrDueDate?: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  companyName?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyAddress?: string;
  paymentInstructions?: string;
  terms?: string;
  items: DocItem[];
  discountAmount?: number;
  downPaymentAmount?: number;
  isPaid?: boolean;
  snNvr?: string;
  snHdd?: string;
  warrantyMonths?: number;
}

export const formatRupiah = (val: number): string => {
  return 'Rp ' + Math.round(val || 0).toLocaleString('id-ID');
};

export const formatDateIndo = (dateStr: string): string => {
  if (!dateStr) return '';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return `${d} ${months[m] || ''} ${y}`;
  }
  return dateStr;
};

// Klasifikasi otomatis jika kategori belum ditentukan eksplisit
export function classifyItem(item: DocItem): ItemCategory {
  if (item.category === 'item_utama' || item.category === 'material_tambahan' || item.category === 'jasa_akomodasi') {
    return item.category;
  }
  const d = (item.description || '').toLowerCase();
  
  // 1. Jasa dan Akomodasi
  if (
    d.includes('jasa') ||
    d.includes('instalasi') ||
    d.includes('setting') ||
    d.includes('penarikan') ||
    d.includes('tarik kabel') ||
    d.includes('akomodasi') ||
    d.includes('transport') ||
    d.includes('konfigurasi') ||
    d.includes('pelatihan') ||
    d.includes('training') ||
    d.includes('maintenance') ||
    d.includes('survei') ||
    d.includes('pasang')
  ) {
    return 'jasa_akomodasi';
  }

  // 2. Material Tambahan
  if (
    d.includes('kabel') ||
    d.includes('coaxial') ||
    d.includes('utp') ||
    d.includes('cat6') ||
    d.includes('cat5') ||
    d.includes('rg59') ||
    d.includes('rg-59') ||
    d.includes('bnc') ||
    d.includes('jack') ||
    d.includes('power supply') ||
    d.includes('psu') ||
    d.includes('adaptor') ||
    d.includes('box panel') ||
    d.includes('panel box') ||
    d.includes('pipa') ||
    d.includes('conduit') ||
    d.includes('klem') ||
    d.includes('steker') ||
    d.includes('stop kontak') ||
    d.includes('konektor') ||
    d.includes('connector') ||
    d.includes('rj45') ||
    d.includes('rj-45') ||
    d.includes('switch poe') ||
    d.includes('patch cord') ||
    d.includes('aksesoris') ||
    d.includes('thermal') ||
    d.includes('kertas') ||
    d.includes('perlengkapan') ||
    d.includes('material')
  ) {
    return 'material_tambahan';
  }

  // 3. Item Utama (Default: Kamera, NVR, DVR, HDD, PC Kasir, Printer, Scanner, dll)
  return 'item_utama';
}

function drawOfficialStamp(doc: jsPDF, x: number, y: number) {
  // Stempel Digital Resmi Borneo Etam (Warna Ungu/Merah Stempel Klasik)
  doc.saveGraphicsState();
  doc.setDrawColor(220, 38, 38); // Crimson Red Stamp
  doc.setTextColor(220, 38, 38);
  doc.setLineWidth(0.8);

  // Outer Oval
  doc.roundedRect(x - 22, y - 11, 44, 22, 5, 5, 'D');
  doc.setLineWidth(0.3);
  doc.roundedRect(x - 20.5, y - 9.5, 41, 19, 4, 4, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BORNEO ETAM CCTV', x, y - 4, { align: 'center' });

  doc.setFontSize(6.5);
  doc.text('★ SAMARINDA ★', x, y);

  doc.setFontSize(7);
  doc.text('DOKUMEN RESMI SAH', x, y + 5.5, { align: 'center' });
  doc.restoreGraphicsState();
}

function renderWarrantyCertificate(doc: jsPDF, data: QuotePdfData): Uint8Array {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const rightX = pageWidth - margin;

  // 1. Double Certificate Border (Border Ganda Sertifikat Resmi)
  doc.setDrawColor(15, 23, 42); // Slate-900 Outer Border
  doc.setLineWidth(1.2);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16, 'D');

  doc.setDrawColor(220, 38, 38); // Crimson Red Inner Border
  doc.setLineWidth(0.4);
  doc.rect(10.5, 10.5, pageWidth - 21, pageHeight - 21, 'D');

  // Top header accent band
  doc.setFillColor(220, 38, 38);
  doc.rect(11, 11, pageWidth - 22, 3, 'F');

  // Kop Surat
  let y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Borneo Etam', pageWidth / 2, y, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text('CCTV & Komputer Kasir', pageWidth / 2, y + 6, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Spesialis Pengadaan & Instalasi CCTV HD/IP PoE serta Komputer Kasir POS', pageWidth / 2, y + 11, { align: 'center' });
  doc.text('Samarinda - Kalimantan Timur • WhatsApp Hotline: 0822-5131-4646 • Website: Borneoetam.com', pageWidth / 2, y + 15, { align: 'center' });

  y += 20;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(margin + 5, y, rightX - 5, y);

  // Big Badge: Sertifikat Kartu Garansi Digital
  y += 7;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(pageWidth / 2 - 58, y, 116, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('SERTIFIKAT KARTU GARANSI DIGITAL', pageWidth / 2, y + 7.5, { align: 'center' });

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nomor Registrasi Garansi: ${data.docNumber}`, pageWidth / 2, y, { align: 'center' });

  // Box 1: Data Konsumen & Lokasi
  y += 7;
  const boxW = contentWidth;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, boxW, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38);
  doc.text('DATA PEMILIK & LOKASI PEMASANGAN:', margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.clientName || 'Pelanggan Terhormat', margin + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Kontak / WhatsApp : ${data.clientPhone || '-'}`, margin + 4, y + 16.5);
  const addrLines = doc.splitTextToSize(`Alamat Pemasangan: ${data.clientAddress || 'Samarinda, Kalimantan Timur'}`, boxW - 8);
  doc.text(addrLines.slice(0, 2), margin + 4, y + 21);

  // Box 2: Data Perangkat & Nomor Seri (SN) Terdaftar
  y += 31;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, boxW, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38);
  doc.text('PERANGKAT & NOMOR SERI RESMI TERDAFTAR:', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);

  doc.text('1. Unit NVR / DVR', margin + 4, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(`SN: ${data.snNvr || 'Tercatat di sistem distributor'}`, margin + 45, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.text('2. Harddisk CCTV (WD Purple)', margin + 4, y + 17.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`SN: ${data.snHdd || 'Tercatat di sistem distributor'}`, margin + 45, y + 17.5);

  doc.setFont('helvetica', 'normal');
  const mainItems = (data.items || []).filter(i => Number(i.quantity) > 0 && i.unit !== 'Header').map(i => `${i.description} (${i.quantity} ${i.unit || 'Unit'})`).slice(0, 3).join(', ');
  doc.text('3. Paket Kamera / Layanan', margin + 4, y + 23);
  doc.setFont('helvetica', 'bold');
  doc.text(mainItems.slice(0, 65) || 'Paket Sistem Keamanan CCTV', margin + 45, y + 23);

  // Box 3: Masa Berlaku Garansi & Status Aktif
  y += 35;
  doc.setFillColor(240, 253, 244); // Green-50
  doc.setDrawColor(187, 247, 208); // Green-200
  doc.roundedRect(margin, y, boxW, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 101, 52); // Green-800
  doc.text('PERIODE MASA GARANSI RESMI DISTRIBUTOR:', margin + 4, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(21, 128, 61);
  doc.text(`Tanggal Instalasi / Mulai Garansi : ${formatDateIndo(data.dateStr) || data.dateStr}`, margin + 4, y + 12.5);

  let expiryDate = data.validUntilOrDueDate;
  if (!expiryDate && data.dateStr) {
    const parts = data.dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const expY = parseInt(parts[0], 10) + 1;
      expiryDate = `${expY}-${parts[1]}-${parts[2]}`;
    }
  }
  doc.text(`Masa Berlaku Garansi Hardware     : 12 Bulan Penuh (Hingga ${formatDateIndo(expiryDate || '') || '1 Tahun ke Depan'})`, margin + 4, y + 17.5);

  doc.setFont('helvetica', 'bold');
  doc.text('STATUS : ✓ GARANSI RESMI TERVERIFIKASI AKTIF', margin + 4, y + 22.5);

  // Box 4: Ketentuan Klaim Garansi
  y += 31;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('KETENTUAN HAK & KLAIM JAMINAN GARANSI:', margin, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  const warrantyTerms = [
    '1. Garansi penggantian unit baru / servis distributor resmi berlaku 12 Bulan untuk DVR/NVR, Kamera & Harddisk.',
    '2. Gratis kunjungan teknis perbaikan & setting ulang pantau online via aplikasi HP berlaku selama 3 Bulan.',
    '3. Garansi tidak berlaku untuk kerusakan akibat bencana alam (banjir/petir), tegangan listrik ekstrem, atau kelalaian fisik.',
    '4. Cara klaim mudah: Cukup hubungi WhatsApp Layanan Servis Borneo Etam (0822-5131-4646) dengan menunjukkan nomor registrasi ini.'
  ];

  let ty = y + 8.5;
  for (const t of warrantyTerms) {
    doc.text(t, margin, ty);
    ty += 4.2;
  }

  // Tanda Tangan & Stempel Digital Sisi Kanan
  y = Math.max(y + 35, ty + 6);
  const signColX = rightX - 44;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Samarinda, ${formatDateIndo(data.dateStr) || data.dateStr}`, signColX, y, { align: 'center' });
  doc.text('Diterbitkan sah oleh,', signColX, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(220, 38, 38);
  doc.text('Borneo Etam CCTV & POS', signColX, y + 8, { align: 'center' });

  // Stempel Digital Resmi
  drawOfficialStamp(doc, signColX - 6, y + 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('( Muhammad Wahyu )', signColX, y + 27, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Owner / Technical Lead', signColX, y + 31, { align: 'center' });

  // Footer Certificate
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, pageHeight - 14, rightX, pageHeight - 14);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('Sertifikat Garansi Digital Resmi ini tersimpan permanen di Borneo Etam Cloud Command Center.', margin, pageHeight - 10);
  doc.text('Layanan Pelanggan: 0822-5131-4646', rightX, pageHeight - 10, { align: 'right' });

  const rawBytes = doc.output('arraybuffer');
  return new Uint8Array(rawBytes);
}

export function generateBorneoDocumentPdf(data: QuotePdfData): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  if (data.type === 'warranty') {
    return renderWarrantyCertificate(doc, data);
  }
  const isInvoice = data.type === 'invoice';
  const isSuratJalan = data.type === 'surat_jalan';
  const isBast = data.type === 'bast';

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  const rightX = pageWidth - margin;

  // =========================================================================
  // 1. TOP ACCENT BAR
  // =========================================================================
  doc.setFillColor(220, 38, 38); // Crimson Red
  doc.rect(0, 0, pageWidth, 3.5, 'F');

  // =========================================================================
  // 2. KOP SURAT / HEADER RESMI (CLEAN TITLE CASE & MODERN)
  // =========================================================================
  let y = 14;

  // Nama Perusahaan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('Borneo Etam', margin, y + 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(220, 38, 38);
  doc.text('CCTV & Komputer Kasir', margin, y + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('Spesialis Pengadaan & Instalasi CCTV HD/IP PoE serta Komputer Kasir POS', margin, y + 12);

  // Kontak Perusahaan di Sisi Kanan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('WhatsApp: 0822-5131-4646', rightX, y + 2, { align: 'right' });
  doc.text('Website: Borneoetam.com', rightX, y + 7, { align: 'right' });
  doc.text('Samarinda - Kalimantan Timur', rightX, y + 12, { align: 'right' });

  // Garis Pemisah Halus
  y += 17;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightX, y);

  // =========================================================================
  // 3. KARTU INFORMASI DOKUMEN & KLIEN (MULTI-LINE WRAPPING FOR ADDRESS)
  // =========================================================================
  y += 5.5;
  const cardHeight = 31;
  const colWidth = (contentWidth - 6) / 2; // 88mm

  // Card Kiri: Info Dokumen
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, colWidth, cardHeight, 2, 2, 'FD');

  // Badge Judul Dokumen
  let badgeTitle = 'Surat Penawaran Harga';
  let badgeColor = [15, 23, 42]; // Slate-900
  if (isInvoice) {
    badgeTitle = 'Faktur Tagihan';
    badgeColor = [220, 38, 38]; // Red
  } else if (isSuratJalan) {
    badgeTitle = 'Surat Jalan Pengeluaran Barang';
    badgeColor = [37, 99, 235]; // Blue
  } else if (isBast) {
    badgeTitle = 'Berita Acara Serah Terima (BAST)';
    badgeColor = [22, 101, 52]; // Green
  }

  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  const badgeWidth = isSuratJalan ? 62 : isBast ? 60 : isInvoice ? 36 : 50;
  doc.roundedRect(margin + 4, y + 3.5, badgeWidth, 5.8, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(badgeTitle, margin + 6, y + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`No: ${data.docNumber}`, margin + 4, y + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tanggal Terbit : ${formatDateIndo(data.dateStr) || data.dateStr}`, margin + 4, y + 19.5);
  const expiryLabel = isInvoice ? 'Jatuh Tempo    : 7 Hari Kalender' : isBast ? 'Masa Garansi   : 12 Bulan Penuh' : 'Masa Berlaku   : 14 Hari Kalender';
  doc.text(expiryLabel, margin + 4, y + 24.5);

  // Card Kanan: Klien Tujuan (Auto Wrapping Alamat Penuh)
  const cardRightX = margin + colWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(cardRightX, y, colWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Ditujukan Kepada:', cardRightX + 4, y + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.clientName || 'Pelanggan Terhormat', cardRightX + 4, y + 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Kontak/WhatsApp : ${data.clientPhone || '-'}`, cardRightX + 4, y + 18.5);

  // Multi-line address wrapping tanpa terpotong kaku
  const rawAddr = (data.clientAddress || 'Samarinda, Kalimantan Timur').trim();
  const wrappedAddressLines = doc.splitTextToSize(`Lokasi: ${rawAddr}`, colWidth - 8);
  doc.text(wrappedAddressLines.slice(0, 2), cardRightX + 4, y + 23);

  // =========================================================================
  // 4. PENGELOMPOKAN 3 KATEGORI ITEM
  // =========================================================================
  y += cardHeight + 6;

  const activeItems = (data.items || []).filter(
    (it) => it && it.description && Number(it.quantity) > 0 && it.unit !== 'Header'
  );

  const groups: Record<ItemCategory, DocItem[]> = {
    item_utama: [],
    material_tambahan: [],
    jasa_akomodasi: [],
  };

  for (const it of activeItems) {
    const cat = classifyItem(it);
    groups[cat].push(it);
  }

  const categoryConfigs: { key: ItemCategory; title: string }[] = [
    { key: 'item_utama', title: '1. Item Utama' },
    { key: 'material_tambahan', title: '2. Material Tambahan' },
    { key: 'jasa_akomodasi', title: '3. Jasa dan Akomodasi' },
  ];

  // Header Tabel
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(margin, y, contentWidth, 7.5, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);

  const colNo = margin + 3;                   // No
  const colDesc = margin + 14;                // Deskripsi
  const colQty = margin + (isSuratJalan || isBast ? 116 : 104); // Qty / Sat
  const colPrice = margin + 142;              // Harga Satuan
  const colTotal = margin + contentWidth - 4; // Jumlah Total

  doc.text('No', colNo, y + 5.2);
  doc.text('Deskripsi Perangkat & Layanan', colDesc, y + 5.2);
  doc.text('Qty / Sat', colQty, y + 5.2);

  if (!isSuratJalan && !isBast) {
    doc.text('Harga Satuan', colPrice, y + 5.2, { align: 'right' });
    doc.text('Jumlah Total', colTotal, y + 5.2, { align: 'right' });
  } else {
    doc.text('Kondisi Fisik', margin + 145, y + 5.2);
    doc.text('Status Uji Fungsi', colTotal, y + 5.2, { align: 'right' });
  }

  y += 7.5;

  let rowCounter = 1;
  let subtotal = 0;

  for (const cfg of categoryConfigs) {
    const itemsInCat = groups[cfg.key];
    if (itemsInCat.length === 0) continue;

    // Baris Header Kategori (Soft Slate Bar dengan Aksen Merah)
    const secH = 6.2;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, secH, 'F');

    doc.setFillColor(220, 38, 38);
    doc.rect(margin, y, 2.2, secH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(cfg.title, margin + 5, y + 4.3);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y + secH, rightX, y + secH);

    y += secH;

    for (const it of itemsInCat) {
      const lineTotal = Number(it.quantity) * Number(it.unit_price || 0);
      subtotal += lineTotal;

      const rowH = 6.8;
      if (rowCounter % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, y, contentWidth, rowH, 'F');
      }

      // No
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(String(rowCounter).padStart(2, '0'), colNo, y + 4.6);

      // Deskripsi
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const desc = it.description.length > 52 ? it.description.slice(0, 50) + '...' : it.description;
      doc.text(desc, colDesc, y + 4.6);

      // Qty
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`${it.quantity} ${it.unit || 'Unit'}`, colQty, y + 4.6);

      if (!isSuratJalan && !isBast) {
        doc.text(formatRupiah(it.unit_price), colPrice, y + 4.6, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(formatRupiah(lineTotal), colTotal, y + 4.6, { align: 'right' });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(22, 101, 52);
        doc.text('Baru & Lengkap', margin + 145, y + 4.6);
        doc.text('Siap Digunakan', colTotal, y + 4.6, { align: 'right' });
      }

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowH, rightX, y + rowH);

      y += rowH;
      rowCounter++;

      if (y > 214) break;
    }
  }

  // =========================================================================
  // 5. TOTALS SECTION & PAYMENT INFO BOX (HANYA UNTUK QUOTE & INVOICE)
  // =========================================================================
  y += 4.5;

  const discount = Number(data.discountAmount || 0);
  const grandTotal = Math.max(0, subtotal - discount);
  const dpAmount = Number(data.downPaymentAmount || 0);
  const remaining = Math.max(0, grandTotal - dpAmount);

  const leftBoxW = 96;
  const leftBoxH = 34;

  if (!isSuratJalan && !isBast) {
    // Box Kiri: Rekening Transfer & Garansi
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, leftBoxW, leftBoxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    doc.text('Pembayaran Resmi via Transfer Bank:', margin + 3.5, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(37, 99, 235); // Blue BCA
    doc.text('Bank BCA (014)', margin + 3.5, y + 11.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('5135400278', margin + 3.5, y + 17.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(71, 85, 105);
    doc.text('Atas Nama : Muhammad Wahyu', margin + 3.5, y + 22.5);

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin + 3.5, y + 25.5, leftBoxW - 7, 5.8, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(22, 101, 52);
    doc.text('Garansi Resmi Hardware 12 Bulan Distributor', margin + 6, y + 29.5);

    // Box Kanan: Rincian Angka & Grand Total
    const sumX = margin + leftBoxW + 6;
    const sumW = contentWidth - leftBoxW - 6;
    let sumY = y;

    if (discount > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Subtotal:', sumX + 2, sumY + 4.5);
      doc.text(formatRupiah(subtotal), rightX - 2, sumY + 4.5, { align: 'right' });

      doc.text('Diskon Khusus:', sumX + 2, sumY + 10);
      doc.setTextColor(220, 38, 38);
      doc.text(`- ${formatRupiah(discount)}`, rightX - 2, sumY + 10, { align: 'right' });
      sumY += 13;
    }

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(sumX, sumY, sumW, 10.5, 1.8, 1.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(isInvoice ? 'Total Tagihan' : 'Total Penawaran', sumX + 4, sumY + 6.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(formatRupiah(grandTotal), rightX - 4, sumY + 7.2, { align: 'right' });

    sumY += 13;

    if (isInvoice && dpAmount > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('DP (Telah Diterima):', sumX + 2, sumY + 2);
      doc.text(formatRupiah(dpAmount), rightX - 2, sumY + 2, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text('Sisa Pelunasan:', sumX + 2, sumY + 7.5);
      doc.text(formatRupiah(remaining), rightX - 2, sumY + 7.5, { align: 'right' });
      sumY += 11;
    }

    // Watermark LUNAS jika faktur sudah lunas
    if (isInvoice && (data.isPaid || remaining <= 0)) {
      doc.saveGraphicsState();
      doc.setDrawColor(22, 101, 52);
      doc.setTextColor(22, 101, 52);
      doc.setLineWidth(0.8);
      doc.roundedRect(sumX + 4, sumY + 1, 40, 9, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('✓ LUNAS / PAID', sumX + 24, sumY + 6.5, { align: 'center' });
      doc.restoreGraphicsState();
    }

    y = Math.max(y + leftBoxH + 5, sumY + 3);
  } else if (isBast) {
    // Box Khusus BAST: Pernyataan Serah Terima & Info SN
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('PERNYATAAN RESMI SERAH TERIMA & UJI FUNGSI:', margin + 4, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Pekerjaan instalasi telah selesai dilaksanakan, seluruh perangkat teruji menyala jernih, rekam aktif, dan terpantau online di aplikasi HP.', margin + 4, y + 10.5);
    doc.text(`No. Seri DVR/NVR : ${data.snNvr || 'Tercatat di sistem'}    •    No. Seri Harddisk (HDD) : ${data.snHdd || 'Tercatat di sistem'}`, margin + 4, y + 15.5);
    doc.text('Garansi resmi distributor berlaku 12 Bulan penuh sejak tanggal penandatanganan berita acara ini.', margin + 4, y + 19.5);

    y += 26;
  } else {
    // Surat Jalan Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('CATATAN PENGELUARAN BARANG & INSTALASI:', margin + 4, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Seluruh perangkat dan material di atas dikeluarkan dari toko Borneo Etam dalam kondisi baru, segel utuh, dan lengkap untuk dipasang di lokasi klien.', margin + 4, y + 10.5);

    y += 20;
  }

  // =========================================================================
  // 6. SYARAT KETENTUAN & TANDA TANGAN + STEMPEL DIGITAL RESMI
  // =========================================================================
  // Syarat Ketentuan Sisi Kiri
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text('Syarat & Ketentuan Layanan:', margin, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);

  const defaultTerms = [
    '1. Seluruh unit kamera, NVR/DVR & Harddisk WD Purple bergaransi resmi 12 Bulan.',
    '2. Gratis kunjungan pemeliharaan teknis & setting online pantau HP selama 3 Bulan.',
    '3. Penarikan kabel rapi menggunakan pelindung pipa klem standar instalasi kelistrikan.',
    '4. Pembayaran DP 50% saat jadwal disepakati, pelunasan 50% setelah uji coba selesai (BAST).'
  ];
  const termsList = data.terms ? data.terms.split('\n').filter(Boolean) : defaultTerms;

  let ty = y + 8.5;
  for (const t of termsList.slice(0, 4)) {
    doc.text(t.slice(0, 85), margin, ty);
    ty += 3.8;
  }

  // Kolom Tanda Tangan
  if (isSuratJalan) {
    // 3 Tanda Tangan: Gudang, Teknisi, Klien
    const tWidth = contentWidth / 3;
    const ySign = y + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);

    doc.text('Diserahkan Oleh (Gudang):', margin + 15, ySign);
    doc.text('Dibawa Oleh (Teknisi):', margin + tWidth + 15, ySign);
    doc.text('Diterima Oleh (Klien):', margin + tWidth * 2 + 15, ySign);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text('( ................................. )', margin + 15, ySign + 24);
    doc.text('( ................................. )', margin + tWidth + 15, ySign + 24);
    doc.text(`( ${data.clientName || '........................'} )`, margin + tWidth * 2 + 15, ySign + 24);
  } else if (isBast) {
    // 2 Tanda Tangan: Pihak Pertama (Borneo Etam) & Pihak Kedua (Klien)
    const ySign = y + 4;
    const colLeft = margin + 35;
    const colRight = rightX - 35;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    doc.text('Pihak Kedua (Konsumen / Klien)', colLeft, ySign, { align: 'center' });
    doc.text('Pihak Pertama (Borneo Etam CCTV)', colRight, ySign, { align: 'center' });

    // Stempel Digital Resmi di Pihak Pertama
    drawOfficialStamp(doc, colRight, ySign + 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`( ${data.clientName || 'Konsumen'} )`, colLeft, ySign + 25, { align: 'center' });
    doc.text('( Muhammad Wahyu )', colRight, ySign + 25, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text('Pemilik / Penanggung Jawab Lokasi', colLeft, ySign + 29, { align: 'center' });
    doc.text('Owner / Technical Lead', colRight, ySign + 29, { align: 'center' });
  } else {
    // Standar Quote & Invoice: Tanda Tangan Kanan + Stempel Resmi
    const signColX = rightX - 44;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Samarinda, ${formatDateIndo(data.dateStr) || data.dateStr}`, signColX, y + 4, { align: 'center' });
    doc.text('Hormat kami,', signColX, y + 8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(220, 38, 38);
    doc.text('Borneo Etam CCTV & POS', signColX, y + 12, { align: 'center' });

    // Stempel Digital Resmi
    drawOfficialStamp(doc, signColX - 6, y + 21);

    // Tanda tangan nama
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(15, 23, 42);
    doc.text('( Muhammad Wahyu )', signColX, y + 31, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text('Owner / Technical Lead', signColX, y + 35, { align: 'center' });
  }

  // =========================================================================
  // 7. FOOTER RESMI BORNEO ETAM
  // =========================================================================
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, pageHeight - 12, rightX, pageHeight - 12);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('Dokumen resmi ini diterbitkan secara sah melalui Borneo Etam AI Command Center.', margin, pageHeight - 8);
  doc.text('Halaman 1 dari 1', rightX, pageHeight - 8, { align: 'right' });

  const rawBytes = doc.output('arraybuffer');
  return new Uint8Array(rawBytes);
}
