// Generator Dokumen PDF Resmi Borneo Etam CCTV & POS (A4 Standard Executive Design)
// Tampilan modern, bersih, proporsional, dan sangat profesional untuk dicetak atau dikirim ke klien.
// Menggunakan gaya penulisan rapi (Title Case / Sentence case, tanpa ALL CAPS).
import { jsPDF } from 'https://esm.sh/jspdf@3.0.3';

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
  type: 'quote' | 'invoice';
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
}

const formatRupiah = (val: number): string => {
  return 'Rp ' + Math.round(val || 0).toLocaleString('id-ID');
};

const formatDateIndo = (dateStr: string): string => {
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
  // Jasa dan Akomodasi
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
    d.includes('pasang')
  ) {
    return 'jasa_akomodasi';
  }
  // Material Tambahan
  if (
    d.includes('kabel') ||
    d.includes('coaxial') ||
    d.includes('utp') ||
    d.includes('cat6') ||
    d.includes('cat5') ||
    d.includes('rg59') ||
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
    d.includes('rj45') ||
    d.includes('switch poe') ||
    d.includes('patch cord') ||
    d.includes('perlengkapan') ||
    d.includes('material')
  ) {
    return 'material_tambahan';
  }
  // Item Utama (Kamera, NVR, DVR, HDD, PC Kasir, Printer, Scanner, dll)
  return 'item_utama';
}

export function generateBorneoDocumentPdf(data: QuotePdfData): Uint8Array {
  const isInvoice = data.type === 'invoice';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  const rightX = pageWidth - margin;

  // =========================================================================
  // 1. TOP ACCENT BAR
  // =========================================================================
  // Garis aksen merah khas Borneo Etam di paling atas
  doc.setFillColor(220, 38, 38); // Crimson Red
  doc.rect(0, 0, pageWidth, 3.5, 'F');

  // =========================================================================
  // 2. KOP SURAT / HEADER RESMI (TITLE CASE, BERSIH & MODERN)
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
  // 3. KARTU INFORMASI DOKUMEN & KLIEN (SIDE-BY-SIDE)
  // =========================================================================
  y += 5.5;
  const cardHeight = 28;
  const colWidth = (contentWidth - 6) / 2; // 88mm

  // Card Kiri: Info Dokumen
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, colWidth, cardHeight, 2, 2, 'FD');

  // Badge Jenis Dokumen
  doc.setFillColor(isInvoice ? 220 : 15, isInvoice ? 38 : 23, isInvoice ? 38 : 42); // Red or Slate-900
  doc.roundedRect(margin + 4, y + 3.5, isInvoice ? 38 : 52, 5.8, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(isInvoice ? 'Faktur Tagihan' : 'Surat Penawaran Harga', margin + 6, y + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`No: ${data.docNumber}`, margin + 4, y + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tanggal Terbit : ${formatDateIndo(data.dateStr) || data.dateStr}`, margin + 4, y + 19.5);
  doc.text(isInvoice ? `Jatuh Tempo    : 7 Hari Kalender` : `Masa Berlaku   : 14 Hari Kalender`, margin + 4, y + 24);

  // Card Kanan: Klien Tujuan
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
  // Tulisan nama klien tidak uppercase paksa
  doc.text(data.clientName || 'Pelanggan Terhormat', cardRightX + 4, y + 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Kontak/WhatsApp : ${data.clientPhone || '-'}`, cardRightX + 4, y + 19);
  doc.text(`Lokasi Pemasangan: ${(data.clientAddress || 'Samarinda, Kalimantan Timur').slice(0, 42)}`, cardRightX + 4, y + 23.5);

  // =========================================================================
  // 4. PENGELOMPOKAN ITEM: ITEM UTAMA, MATERIAL TAMBAHAN, JASA & AKOMODASI
  // =========================================================================
  y += cardHeight + 6;

  // Filter item yang valid (quantity > 0)
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

  const colNo = margin + 3;               // No
  const colDesc = margin + 14;            // Deskripsi
  const colQty = margin + 104;            // Qty / Sat
  const colPrice = margin + 142;          // Harga Satuan (Right-align)
  const colTotal = margin + contentWidth - 4; // Jumlah Total (Right-align)

  doc.text('No', colNo, y + 5.2);
  doc.text('Deskripsi Perangkat & Layanan', colDesc, y + 5.2);
  doc.text('Qty / Sat', colQty, y + 5.2);
  doc.text('Harga Satuan', colPrice, y + 5.2, { align: 'right' });
  doc.text('Jumlah Total', colTotal, y + 5.2, { align: 'right' });

  y += 7.5;

  let rowCounter = 1;
  let subtotal = 0;

  for (const cfg of categoryConfigs) {
    const itemsInCat = groups[cfg.key];
    if (itemsInCat.length === 0) continue;

    // Baris Header Kategori (Soft Slate Bar dengan Aksen Merah di Kiri)
    const secH = 6.2;
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.rect(margin, y, contentWidth, secH, 'F');

    // Aksen merah vertikal di samping kiri
    doc.setFillColor(220, 38, 38);
    doc.rect(margin, y, 2.2, secH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(cfg.title, margin + 5, y + 4.3);

    // Garis batas bawah header kategori
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y + secH, rightX, y + secH);

    y += secH;

    // Baris Item dalam Kategori Ini
    for (const it of itemsInCat) {
      const lineTotal = Number(it.quantity) * Number(it.unit_price || 0);
      subtotal += lineTotal;

      const rowH = 6.8;
      // Zebra striping lembut
      if (rowCounter % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, y, contentWidth, rowH, 'F');
      }

      // No urut
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(String(rowCounter).padStart(2, '0'), colNo, y + 4.6);

      // Deskripsi Barang / Jasa
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59); // Slate-800
      const desc = it.description.length > 52 ? it.description.slice(0, 50) + '...' : it.description;
      doc.text(desc, colDesc, y + 4.6);

      // Qty & Satuan
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`${it.quantity} ${it.unit || 'Unit'}`, colQty, y + 4.6);

      // Harga Satuan
      doc.text(formatRupiah(it.unit_price), colPrice, y + 4.6, { align: 'right' });

      // Total Baris
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatRupiah(lineTotal), colTotal, y + 4.6, { align: 'right' });

      // Garis batas bawah
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowH, rightX, y + rowH);

      y += rowH;
      rowCounter++;

      // Safety limit agar tidak meluber
      if (y > 214) break;
    }
  }

  // =========================================================================
  // 5. TOTALS SECTION & PAYMENT INFO BOX (SIDE BY SIDE)
  // =========================================================================
  y += 4.5;

  const discount = Number(data.discountAmount || 0);
  const grandTotal = Math.max(0, subtotal - discount);
  const dpAmount = Number(data.downPaymentAmount || 0);
  const remaining = Math.max(0, grandTotal - dpAmount);

  // Box Kiri: Rekening Transfer & Garansi
  const leftBoxW = 96;
  const leftBoxH = 34;

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
  doc.setTextColor(37, 99, 235); // Blue-600 BCA
  doc.text('Bank BCA (014)', margin + 3.5, y + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('5135400278', margin + 3.5, y + 17.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Atas Nama : Muhammad Wahyu', margin + 3.5, y + 22.5);

  // Badge Garansi Resmi 12 Bulan
  doc.setFillColor(240, 253, 244); // Green-50
  doc.setDrawColor(187, 247, 208); // Green-200
  doc.roundedRect(margin + 3.5, y + 25.5, leftBoxW - 7, 5.8, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52); // Green-800
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

  // Highlight Box Total
  doc.setFillColor(15, 23, 42); // Slate-900 Accent
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

  // =========================================================================
  // 6. SYARAT KETENTUAN & TANDA TANGAN RESMI
  // =========================================================================
  y = Math.max(y + leftBoxH + 5, sumY + 3);

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

  // Kolom Tanda Tangan Sisi Kanan
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

  // Tanda tangan nama
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('( Muhammad Wahyu )', signColX, y + 31, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Owner / Technical Lead', signColX, y + 35, { align: 'center' });

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
