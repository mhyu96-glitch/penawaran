// Generator Dokumen PDF Resmi Borneo Etam CCTV & POS (A4 Standard Executive Design)
// Mendukung: Surat Penawaran Harga, Faktur Tagihan, Surat Jalan, dan Berita Acara Serah Terima (BAST).
// Desain modern, multi-line address wrapping, 3 kategori rapi, stempel digital resmi, tanpa ALL CAPS.
import { jsPDF } from 'https://esm.sh/jspdf@3.0.3';
// @ts-ignore
import qrcode from 'https://esm.sh/qrcode-generator@1.4.4';

export type DocType = 'quote' | 'invoice' | 'surat_jalan' | 'bast' | 'warranty' | 'kwitansi';
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
  docCategory?: 'standard' | 'partner_service';
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
  paymentAmount?: number;
  paymentFor?: string;
  receiptNumber?: string;
  isPaid?: boolean;
  snNvr?: string;
  snHdd?: string;
  warrantyMonths?: number;
  warrantyUrl?: string;
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

export function terbilang(n: number): string {
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const num = Math.floor(Math.abs(n));
  if (num === 0) return '';
  if (num < 12) return bilangan[num];
  if (num < 20) return (terbilang(num - 10) + ' Belas').trim();
  if (num < 100) return (terbilang(Math.floor(num / 10)) + ' Puluh ' + terbilang(num % 10)).replace(/\s+/g, ' ').trim();
  if (num < 200) return ('Seratus ' + terbilang(num - 100)).replace(/\s+/g, ' ').trim();
  if (num < 1000) return (terbilang(Math.floor(num / 100)) + ' Ratus ' + terbilang(num % 100)).replace(/\s+/g, ' ').trim();
  if (num < 2000) return ('Seribu ' + terbilang(num - 1000)).replace(/\s+/g, ' ').trim();
  if (num < 1000000) return (terbilang(Math.floor(num / 1000)) + ' Ribu ' + terbilang(num % 1000)).replace(/\s+/g, ' ').trim();
  if (num < 1000000000) return (terbilang(Math.floor(num / 1000000)) + ' Juta ' + terbilang(num % 1000000)).replace(/\s+/g, ' ').trim();
  if (num < 1000000000000) return (terbilang(Math.floor(num / 1000000000)) + ' Miliar ' + terbilang(num % 1000000000)).replace(/\s+/g, ' ').trim();
  return String(n);
}

export function angkaKeKata(n: number): string {
  if (!n || n === 0) return 'Nol Rupiah';
  return (terbilang(n) + ' Rupiah').replace(/\s+/g, ' ').trim();
}

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

function getItemWarrantyInfo(desc: string, defaultMonths = 12): { period: string; coverage: string } {
  const d = (desc || '').toLowerCase();
  if (/dvr|nvr|perekam/i.test(d)) {
    return { period: `${defaultMonths} Bulan`, coverage: 'Ganti Unit / Servis' };
  }
  if (/kamera|camera|cam|colorvu|bullet|dome|ptz/i.test(d)) {
    return { period: `${defaultMonths} Bulan`, coverage: 'Ganti Unit / Servis' };
  }
  if (/hdd|harddisk|hard disk|seagate|wd|purple/i.test(d)) {
    return { period: `${defaultMonths} Bulan`, coverage: 'Ganti Baru Resmi' };
  }
  if (/power supply|powersupply|adaptor|trafo|switch|poe/i.test(d)) {
    return { period: '6 - 12 Bulan', coverage: 'Servis / Part' };
  }
  if (/panel|box|rack|tiang|bracket|klem/i.test(d)) {
    return { period: `${defaultMonths} Bulan`, coverage: 'Garansi Fisik' };
  }
  if (/kabel|coaxial|rg59|rg6|utp|bnc|jack dc|konektor/i.test(d)) {
    return { period: '3 Bulan', coverage: 'Garansi Pasang' };
  }
  if (/jasa|instalasi|setting|pemasangan|penarikan/i.test(d)) {
    return { period: `${defaultMonths} Bulan`, coverage: 'Dukungan Teknisi' };
  }
  return { period: `${defaultMonths} Bulan`, coverage: 'Garansi Resmi' };
}

function drawOfficialStamp(doc: jsPDF, x: number, y: number) {
  // Stempel Digital Resmi Borneo Etam (Warna Crimson Red Stempel Klasik)
  doc.saveGraphicsState();
  doc.setDrawColor(190, 24, 24); // Rich Crimson Red Stamp
  doc.setTextColor(190, 24, 24);
  doc.setLineWidth(0.8);

  // Outer Oval
  doc.roundedRect(x - 22, y - 11, 44, 22, 5, 5, 'D');
  doc.setLineWidth(0.3);
  doc.roundedRect(x - 20.5, y - 9.5, 41, 19, 4, 4, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('BORNEO ETAM CCTV', x, y - 3.8, { align: 'center' });

  doc.setFontSize(6.2);
  doc.text('* SAMARINDA *', x, y + 0.2, { align: 'center' });

  doc.setFontSize(6.8);
  doc.text('DOKUMEN RESMI SAH', x, y + 5.2, { align: 'center' });
  doc.restoreGraphicsState();
}

function drawQrCode(doc: jsPDF, text: string, x: number, y: number, size: number) {
  try {
    // @ts-ignore
    const qrFn = typeof qrcode === 'function' ? qrcode : (qrcode as any)?.default || qrcode;
    if (typeof qrFn === 'function') {
      const qr = qrFn(0, 'M');
      qr.addData(text || 'https://borneoetam.com');
      qr.make();
      const count = qr.getModuleCount();
      const cellSize = size / count;
      doc.setFillColor(15, 23, 42); // Slate-900 Navy dots
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            doc.rect(x + c * cellSize, y + r * cellSize, cellSize, cellSize, 'F');
          }
        }
      }
      return true;
    }
  } catch (err) {
    console.error('QR generation fallback:', err);
  }

  // Fallback: draw stylish tech security placeholder
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, size, size, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text('VERIFIKASI', x + size / 2, y + size / 2 - 1.5, { align: 'center' });
  doc.setFontSize(5.5);
  doc.setTextColor(185, 28, 28);
  doc.text('DIGITAL LIVE', x + size / 2, y + size / 2 + 3, { align: 'center' });
  return false;
}

function renderWarrantyCertificate(doc: jsPDF, data: QuotePdfData): Uint8Array {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm
  const rightX = pageWidth - margin; // 198mm

  // 1. Double Certificate Border (Executive Slate & Crimson)
  doc.setDrawColor(15, 23, 42); // Slate-900 Outer Border
  doc.setLineWidth(1.0);
  doc.rect(7, 7, pageWidth - 14, pageHeight - 14, 'D');

  doc.setDrawColor(185, 28, 28); // Crimson Inner Border
  doc.setLineWidth(0.4);
  doc.rect(9.5, 9.5, pageWidth - 19, pageHeight - 19, 'D');

  // Certificate Corner Accents (L-brackets at 4 corners for security certificate prestige)
  doc.setDrawColor(217, 119, 6); // Amber-600 Gold
  doc.setLineWidth(0.8);
  const cornerSize = 4.5;
  // Top-Left
  doc.line(11, 11, 11 + cornerSize, 11);
  doc.line(11, 11, 11, 11 + cornerSize);
  // Top-Right
  doc.line(pageWidth - 11, 11, pageWidth - 11 - cornerSize, 11);
  doc.line(pageWidth - 11, 11, pageWidth - 11, 11 + cornerSize);
  // Bottom-Left
  doc.line(11, pageHeight - 11, 11 + cornerSize, pageHeight - 11);
  doc.line(11, pageHeight - 11, 11, pageHeight - 11 - cornerSize);
  // Bottom-Right
  doc.line(pageWidth - 11, pageHeight - 11, pageWidth - 11 - cornerSize, pageHeight - 11);
  doc.line(pageWidth - 11, pageHeight - 11, pageWidth - 11, pageHeight - 11 - cornerSize);

  // Top header accent ribbon
  doc.setFillColor(185, 28, 28);
  doc.rect(10, 10, pageWidth - 20, 2.5, 'F');

  // Kop Surat Eksekutif
  let y = 17.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(15, 23, 42);
  doc.text('BORNEO ETAM CCTV & KOMPUTER KASIR', pageWidth / 2, y, { align: 'center' });

  y += 5.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(185, 28, 28);
  doc.text('PUSAT PENGADAAN & INSTALASI CCTV HD/IP PoE SERTA SISTEM KASIR POS', pageWidth / 2, y, { align: 'center' });

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Samarinda - Kalimantan Timur • Hotline Layanan: 0822-5131-4646 • Website: borneoetam.com', pageWidth / 2, y, { align: 'center' });

  y += 3.5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightX, y);

  // Big Badge: Sertifikat Jaminan Garansi Digital Resmi
  y += 4;
  const badgeW = 126;
  const badgeH = 8.5;
  doc.setFillColor(15, 23, 42); // Navy Slate-900
  doc.roundedRect(pageWidth / 2 - badgeW / 2, y, badgeW, badgeH, 2, 2, 'F');
  
  // Inner gold border on badge
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth / 2 - badgeW / 2 + 0.5, y + 0.5, badgeW - 1, badgeH - 1, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SERTIFIKAT JAMINAN GARANSI DIGITAL RESMI', pageWidth / 2, y + 5.8, { align: 'center' });

  y += badgeH + 4;

  // Subheader: No Registrasi (Kiri) & Status Pill Garansi Aktif (Kanan)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  doc.text(`No. Registrasi: ${data.docNumber}`, margin, y + 3.2);

  const pillW = 76;
  const pillH = 6;
  doc.setFillColor(22, 101, 52); // Emerald-800
  doc.roundedRect(rightX - pillW, y - 1, pillW, pillH, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('✓ GARANSI RESMI TERVERIFIKASI AKTIF', rightX - pillW / 2, y + 3.2, { align: 'center' });

  y += 8;

  // Box 1: Data Pemilik & Parameter Masa Perlindungan (Card 2 Kolom)
  const boxW = contentWidth;
  const box1H = 22;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, boxW, box1H, 2, 2, 'FD');

  // Left vertical red accent bar
  doc.setFillColor(185, 28, 28);
  doc.rect(margin, y, 2.5, box1H, 'F');

  // Kolom Kiri: Pemilik & Alamat
  const col1X = margin + 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(185, 28, 28);
  doc.text('INFORMASI KONSUMEN & LOKASI PEMASANGAN:', col1X, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(data.clientName || 'Pelanggan Terhormat', col1X, y + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const clientPhoneStr = data.clientPhone && data.clientPhone.trim() && data.clientPhone !== '-' 
    ? `Kontak: ${data.clientPhone}` 
    : 'Kontak: Tercatat di Database';
  doc.text(clientPhoneStr, col1X, y + 15);

  const addrStr = `Alamat: ${data.clientAddress || 'Samarinda, Kalimantan Timur'}`;
  const addrLines = doc.splitTextToSize(addrStr, 88);
  doc.text(addrLines.slice(0, 1)[0], col1X, y + 19);

  // Kolom Kanan: Periode Garansi
  const col2X = margin + 100;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(22, 101, 52);
  doc.text('PARAMETER MASA PERLINDUNGAN DISTRIBUTOR:', col2X, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tanggal Instalasi   : ${formatDateIndo(data.dateStr) || data.dateStr}`, col2X, y + 10.2);

  let expiryDate = data.validUntilOrDueDate;
  if (!expiryDate && data.dateStr) {
    const parts = data.dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const expY = parseInt(parts[0], 10) + 1;
      expiryDate = `${expY}-${parts[1]}-${parts[2]}`;
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Berlaku Hingga     : ${formatDateIndo(expiryDate || '') || '12 Bulan ke Depan'}`, col2X, y + 14.8);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61);
  doc.text(`Skema Proteksi   : 1-to-1 Replacement (Ganti Unit) & Servis`, col2X, y + 19);

  y += box1H + 3.5;

  // Box 2: Identifikasi Nomor Seri Perangkat Utama (DVR/NVR & HDD)
  const box2H = 12.5;
  doc.setFillColor(254, 242, 242); // Soft Red
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin, y, boxW, box2H, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Unit Perekam (DVR / NVR):', col1X, y + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(`SN: ${data.snNvr || 'Tercatat di sistem distributor'}`, col1X, y + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Penyimpanan Rekaman (HDD Surveillance):', col2X, y + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(`SN: ${data.snHdd || 'Tercatat di sistem distributor'}`, col2X, y + 9.5);

  y += box2H + 4;

  // Section 3: TABEL DAFTAR PERANGKAT & MATERIAL YANG DILINDUNGI GARANSI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('RINCIAN PERANGKAT & MATERIAL INSTALASI YANG DILINDUNGI GARANSI:', margin, y + 2.5);

  y += 4.5;

  // Table Dimensions
  // Cols: No (8mm), Description (98mm), Qty (22mm), Durasi Garansi (28mm), Cakupan (30mm) -> Total = 186mm
  const colW = { no: 8, desc: 98, qty: 22, dur: 28, cakupan: 30 };
  const thY = y;
  const thH = 5.8;

  // Header Table
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(margin, thY, boxW, thH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('NO', margin + colW.no / 2, thY + 4, { align: 'center' });
  doc.text('DESKRIPSI PERANGKAT / MATERIAL', margin + colW.no + 3, thY + 4);
  doc.text('JUMLAH', margin + colW.no + colW.desc + colW.qty / 2, thY + 4, { align: 'center' });
  doc.text('MASA GARANSI', margin + colW.no + colW.desc + colW.qty + colW.dur / 2, thY + 4, { align: 'center' });
  doc.text('CAKUPAN JAMINAN', margin + colW.no + colW.desc + colW.qty + colW.dur + colW.cakupan / 2, thY + 4, { align: 'center' });

  y += thH;

  // Filter Items
  let validItems = (data.items || []).filter(i => {
    const q = Number(i.quantity);
    const isHeader = String(i.unit || '').toLowerCase() === 'header';
    return !isHeader && !isNaN(q) && q > 0;
  });

  if (validItems.length === 0) {
    validItems = [
      { description: 'Unit Perekam Digital Video Recorder (DVR / NVR HD PoE)', quantity: 1, unit: 'Unit', unit_price: 0 },
      { description: 'Kamera CCTV High-Definition Night ColorVu Surveillance', quantity: 4, unit: 'Unit', unit_price: 0 },
      { description: 'Harddisk Khusus Rekaman CCTV (Surveillance Grade)', quantity: 1, unit: 'Unit', unit_price: 0 },
      { description: 'Power Supply Jaring Centralized & Box Pengaman', quantity: 1, unit: 'Set', unit_price: 0 },
      { description: 'Paket Konektor BNC, Jack DC, & Kabel Coaxial RG59', quantity: 1, unit: 'Paket', unit_price: 0 }
    ];
  }

  // Render max 7 items to fit single page perfectly
  const maxItemsToShow = 7;
  const itemsToRender = validItems.slice(0, maxItemsToShow);
  const rowH = 5.4;

  itemsToRender.forEach((it, idx) => {
    const rowY = y + idx * rowH;
    // Zebra Stripe
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, rowY, boxW, rowH, 'F');

    // Bottom hairline
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, rowY + rowH, rightX, rowY + rowH);

    // Columns
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 41, 59);

    // No
    doc.text(String(idx + 1), margin + colW.no / 2, rowY + 3.8, { align: 'center' });

    // Description (cleanly formatted, capitalized, truncated safely)
    const desc = String(it.description || '').trim();
    const cleanDesc = desc.charAt(0).toUpperCase() + desc.slice(1);
    doc.text(cleanDesc.slice(0, 58), margin + colW.no + 3, rowY + 3.8);

    // Qty
    doc.setFont('helvetica', 'bold');
    doc.text(`${it.quantity} ${it.unit || 'Unit'}`, margin + colW.no + colW.desc + colW.qty / 2, rowY + 3.8, { align: 'center' });

    // Warranty Info
    const info = getItemWarrantyInfo(desc, data.warrantyMonths || 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(22, 101, 52); // Green
    doc.text(info.period, margin + colW.no + colW.desc + colW.qty + colW.dur / 2, rowY + 3.8, { align: 'center' });

    doc.setTextColor(71, 85, 105);
    doc.text(info.coverage, margin + colW.no + colW.desc + colW.qty + colW.dur + colW.cakupan / 2, rowY + 3.8, { align: 'center' });
  });

  // If there were more items, show summary row
  if (validItems.length > maxItemsToShow) {
    const remainingCount = validItems.length - maxItemsToShow;
    const summaryRowY = y + itemsToRender.length * rowH;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, summaryRowY, boxW, rowH, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`+ ${remainingCount} item material pendukung lainnya tercatat resmi dalam paket instalasi bergaransi.`, margin + 12, summaryRowY + 3.8);
    y += (itemsToRender.length + 1) * rowH;
  } else {
    y += itemsToRender.length * rowH;
  }

  y += 4;

  // Section 4: Ketentuan Hak Konsumen & Standar Pelayanan (SLA)
  const box3H = 30;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, boxW, box3H, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(185, 28, 28);
  doc.text('KETENTUAN JAMINAN & STANDAR LAYANAN PURNA JUAL (SLA RESMI):', margin + 4, y + 5);

  const warrantyClauses = [
    '1. Cakupan Garansi Hardware: Berlaku 12 Bulan penuh untuk DVR/NVR, Kamera, & Harddisk. Mencakup penggantian unit baru (1-to-1 replacement) atau servis distributor resmi apabila terjadi cacat fungsi pabrik.',
    '2. SLA Respon Teknisi Lapangan: Borneo Etam menyediakan dukungan teknisi tanggap darurat dengan SLA respon maksimal 1x24 jam kerja untuk troubleshooting & perbaikan di lokasi pelanggan Samarinda & sekitarnya.',
    '3. Batasan Jaminan: Garansi tidak berlaku apabila segel fisik dirusak/dimodifikasi pihak luar, kerusakan akibat sambaran petir langsung, bencana alam banjir, atau lonjakan arus listrik PLN ekstrem tanpa stavolt/grounding.',
    '4. Prosedur Klaim Cepat: Konsumen cukup menghubungi Hotline WhatsApp 0822-5131-4646 dengan menyebutkan No. Registrasi di atas atau memindai QR Code di samping. Dokumen fisik tidak wajib dibawa.'
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(71, 85, 105);

  let cY = y + 9.5;
  for (const clause of warrantyClauses) {
    const wrapped = doc.splitTextToSize(clause, boxW - 8);
    doc.text(wrapped.slice(0, 2), margin + 4, cY);
    cY += 4.8;
  }

  y += box3H + 4;

  // Section 5: Bottom Area - QR Code Verifikasi Live (Kiri) & Pengesahan Resmi (Kanan)
  const qrBoxW = 86;
  const qrBoxH = 44;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, qrBoxW, qrBoxH, 2, 2, 'FD');

  // Left QR Code
  const qrSize = 25;
  const qrX = margin + 4.5;
  const qrY = y + 5;
  const targetWarrantyUrl = data.warrantyUrl || `https://penawaran.pages.dev/garansi/${data.docNumber.replace(/[^a-zA-Z0-9]/g, '')}`;
  
  // Draw QR Code
  drawQrCode(doc, targetWarrantyUrl, qrX, qrY, qrSize);

  // QR Details & Instructions
  const qrTextX = qrX + qrSize + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('VERIFIKASI DIGITAL LIVE', qrTextX, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const qrExpl = doc.splitTextToSize('Scan QR Code ini untuk cek status keaslian sertifikat & sisa hari masa garansi secara real-time via smartphone.', qrBoxW - qrSize - 12);
  doc.text(qrExpl.slice(0, 3), qrTextX, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(185, 28, 28);
  doc.text('Hotline Servis Cepat:', qrTextX, y + 26);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text('WhatsApp: 0822-5131-4646', qrTextX, y + 30);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.8);
  doc.setTextColor(148, 163, 184);
  doc.text(`ID: ${data.docNumber.slice(-12)}`, qrTextX, y + 36);

  // Right Side: Tanda Tangan & Stempel Resmi
  const signColX = rightX - 44;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Samarinda, ${formatDateIndo(data.dateStr) || data.dateStr}`, signColX, y + 6, { align: 'center' });
  doc.text('Diterbitkan sah oleh,', signColX, y + 10.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(185, 28, 28);
  doc.text('Borneo Etam CCTV & Komputer Kasir', signColX, y + 15, { align: 'center' });

  // Stempel Digital Resmi: positioned authentically overlapping on the left without blocking text
  drawOfficialStamp(doc, signColX - 16, y + 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('( Muhammad Wahyu )', signColX, y + 37, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Owner / Technical Lead', signColX, y + 41.5, { align: 'center' });

  // Bottom Certificate Security Strip
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, pageHeight - 13, rightX, pageHeight - 13);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Sertifikat Garansi Digital Resmi ini diterbitkan oleh Borneo Etam Cloud Command Center & dilindungi registrasi unik.', margin, pageHeight - 9.5);
  doc.text('Layanan Pelanggan: 0822-5131-4646 • www.borneoetam.com', rightX, pageHeight - 9.5, { align: 'right' });

  const rawBytes = doc.output('arraybuffer');
  return new Uint8Array(rawBytes);
}

function renderKwitansi(doc: jsPDF, data: QuotePdfData): Uint8Array {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  const rightX = pageWidth - margin;

  // 1. Double Border
  doc.setDrawColor(15, 23, 42); // Slate-900 Outer Border
  doc.setLineWidth(1.0);
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

  // Big Badge: KWITANSI RESMI PEMBAYARAN
  y += 7;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(pageWidth / 2 - 58, y, 116, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('KWITANSI PEMBAYARAN RESMI', pageWidth / 2, y + 7.5, { align: 'center' });

  // Receipt Number & Date
  y += 18;
  const kwNum = data.receiptNumber || (data.docNumber ? `KW/${data.docNumber}` : `KW/${Date.now().toString().slice(-6)}`);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`No. Kwitansi : ${kwNum}`, margin + 4, y);
  doc.text(`Tanggal : ${formatDateIndo(data.dateStr) || data.dateStr}`, rightX - 4, y, { align: 'right' });

  // Calculate Amount
  let amount = data.paymentAmount;
  if (!amount || amount <= 0) {
    const rawTotal = (data.items || []).reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
    amount = Math.max(0, rawTotal - (data.discountAmount || 0));
  }

  // Kwitansi Form Box
  y += 6;
  const boxW = contentWidth;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, boxW, 88, 2, 2, 'FD');

  let rowY = y + 10;
  const colLabelX = margin + 8;
  const colColonX = margin + 48;
  const colValX = margin + 52;
  const valMaxWidth = boxW - 60;

  // Row 1: Telah Diterima Dari
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Telah Diterima Dari', colLabelX, rowY);
  doc.text(':', colColonX, rowY);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(data.clientName || 'Pelanggan Terhormat', colValX, rowY);

  if (data.clientAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const addrLines = doc.splitTextToSize(data.clientAddress, valMaxWidth);
    doc.text(addrLines.slice(0, 2), colValX, rowY + 5);
  }

  // Row 2: Uang Sejumlah (Terbilang)
  rowY += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Uang Sejumlah', colLabelX, rowY);
  doc.text(':', colColonX, rowY);

  // Terbilang in shaded box
  const terbilangText = `# ${angkaKeKata(amount)} #`;
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(colValX, rowY - 5, valMaxWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38);
  const terbLines = doc.splitTextToSize(terbilangText, valMaxWidth - 6);
  doc.text(terbLines.slice(0, 2), colValX + 3, rowY + 1);

  // Row 3: Untuk Pembayaran
  rowY += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Untuk Pembayaran', colLabelX, rowY);
  doc.text(':', colColonX, rowY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const purpose = data.paymentFor || `Pelunasan Pembayaran Tagihan / Faktur No. ${data.docNumber || '-'}`;
  const purposeLines = doc.splitTextToSize(purpose, valMaxWidth);
  doc.text(purposeLines.slice(0, 2), colValX, rowY);

  // Row 4: Referensi Faktur / Status
  rowY += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('No. Referensi / Status', colLabelX, rowY);
  doc.text(':', colColonX, rowY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52); // Green
  doc.text(`${data.docNumber || '-'} (LUNAS / SAH)`, colValX, rowY);

  // Nominal Box (Terbilang Angka Besar)
  y = y + 88 + 10;
  const bottomY = y;

  // Box 1: Jumlah Pembayaran
  doc.setFillColor(15, 23, 42); // Dark slate
  doc.roundedRect(margin, bottomY, 76, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text('JUMLAH PEMBAYARAN:', margin + 6, bottomY + 7);

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(formatRupiah(amount), margin + 6, bottomY + 17);

  // Box 2: Status Lunas Badge (Vector Checkmark + LUNAS)
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin + 80, bottomY, 36, 24, 2, 2, 'FD');

  // Vector checkmark (sharp & clean, rendering presisi di semua viewer)
  const checkX = margin + 89;
  const checkY = bottomY + 12;
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(1.4);
  doc.line(checkX - 3.2, checkY, checkX - 0.8, checkY + 2.8);
  doc.line(checkX - 0.8, checkY + 2.8, checkX + 3.8, checkY - 3.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(22, 101, 52);
  doc.text('LUNAS', checkX + 6.5, checkY + 1.2, { align: 'left' });

  // Tanda Tangan & Stempel Resmi (Sisi Kanan)
  const signColX = rightX - 34;
  const signY = bottomY - 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Samarinda, ${formatDateIndo(data.dateStr) || data.dateStr}`, signColX, signY, { align: 'center' });
  doc.text('Penerima Pembayaran,', signColX, signY + 4.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(190, 24, 24);
  doc.text('Borneo Etam CCTV & POS', signColX, signY + 9.5, { align: 'center' });

  // Stempel Digital Resmi: digeser proporsional ke kiri agar tidak menabrak teks nama & jabatan
  drawOfficialStamp(doc, signColX - 20, signY + 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('( Muhammad Wahyu )', signColX, signY + 34, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Owner / Technical Lead', signColX, signY + 38.5, { align: 'center' });

  // Box Informasi Perhatian
  const infoY = bottomY + 46;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, infoY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CATATAN PENTING & JAMINAN:', margin + 4, infoY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('1. Kwitansi ini merupakan bukti pembayaran sah yang dikeluarkan secara digital oleh Borneo Etam.', margin + 4, infoY + 10.5);
  doc.text('2. Harap simpan kwitansi ini untuk kelengkapan administrasi dan klaim garansi produk / instalasi.', margin + 4, infoY + 15);
  doc.text('3. Pembayaran via transfer sah bila masuk ke rekening resmi atas nama Muhammad Wahyu (BCA / Mandiri).', margin + 4, infoY + 19.5);

  // Footer Certificate
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, pageHeight - 14, rightX, pageHeight - 14);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('Dokumen Kwitansi Digital Resmi - Borneo Etam Cloud Command Center', margin, pageHeight - 10);
  doc.text('Hotline Layanan Pelanggan: 0822-5131-4646', rightX, pageHeight - 10, { align: 'right' });

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
  if (data.type === 'kwitansi') {
    return renderKwitansi(doc, data);
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
  let badgeWidth = 50;

  if (data.docCategory === 'partner_service') {
    badgeTitle = isInvoice ? 'Faktur Jasa & Subkon (Toko)' : 'Penawaran Jasa & Subkon (Toko)';
    badgeColor = [109, 40, 217]; // Violet-700
    badgeWidth = isInvoice ? 58 : 60;
  } else if (isInvoice) {
    badgeTitle = 'Faktur Tagihan';
    badgeColor = [220, 38, 38]; // Red
    badgeWidth = 36;
  } else if (isSuratJalan) {
    badgeTitle = 'Surat Jalan Pengeluaran Barang';
    badgeColor = [37, 99, 235]; // Blue
    badgeWidth = 62;
  } else if (isBast) {
    badgeTitle = 'Berita Acara Serah Terima (BAST)';
    badgeColor = [22, 101, 52]; // Green
    badgeWidth = 60;
  }

  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
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
  const clientCardTitle = data.docCategory === 'partner_service' ? 'Toko / Partner Penerima:' : 'Ditujukan Kepada:';
  doc.text(clientCardTitle, cardRightX + 4, y + 7.5);

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
        if (data.docCategory === 'partner_service' && Number(it.unit_price) === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.2);
          doc.setTextColor(148, 163, 184);
          doc.text('(Bawaan Toko)', colPrice, y + 4.6, { align: 'right' });
          doc.text('Non-Tagihan', colTotal, y + 4.6, { align: 'right' });
        } else {
          doc.text(formatRupiah(it.unit_price), colPrice, y + 4.6, { align: 'right' });
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(formatRupiah(lineTotal), colTotal, y + 4.6, { align: 'right' });
        }
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

  const partnerTerms = [
    '1. Penawaran/Faktur ini khusus mencakup jasa instalasi teknis, konfigurasi, dan biaya akomodasi lapangan.',
    '2. Seluruh unit/material utama disediakan langsung oleh pihak Toko/Pemberi Kerja.',
    '3. Pembayaran diselesaikan setelah serah terima pekerjaan (BAST).'
  ];
  const standardTerms = [
    '1. Seluruh unit kamera, NVR/DVR & Harddisk WD Purple bergaransi resmi 12 Bulan.',
    '2. Penarikan kabel rapi menggunakan pelindung pipa klem standar instalasi kelistrikan.',
    '3. Pembayaran DP 50% saat jadwal disepakati, pelunasan 50% setelah uji coba selesai (BAST).'
  ];
  const defaultTerms = data.docCategory === 'partner_service' ? partnerTerms : standardTerms;
  const rawTerms = (data.terms || '').replace(/\[CATEGORY:[a-zA-Z0-9_-]+\]/g, '').trim();
  const termsList = rawTerms ? rawTerms.split('\n').filter(Boolean) : defaultTerms;

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
    drawOfficialStamp(doc, colRight - 16, ySign + 17);

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
    drawOfficialStamp(doc, signColX - 16, y + 21);

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
