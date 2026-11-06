// Generator Dokumen PDF Resmi Borneo Etam CCTV & POS (A4 Standard Executive Design)
// Tampilan modern, bersih, proporsional, dan sangat profesional untuk dicetak atau dikirim ke klien.
import { jsPDF } from 'https://esm.sh/jspdf@3.0.3';

export interface DocItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
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

  // =========================================================================
  // 1. TOP BRANDING BAR (MODERN DARK SLATE WITH RED ACCENT)
  // =========================================================================
  // Baris aksen merah tipis di paling atas
  doc.setFillColor(220, 38, 38); // Crimson Red #dc2626
  doc.rect(0, 0, pageWidth, 3.5, 'F');

  // Header Box
  let y = 14;

  // Nama Perusahaan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('BORNEO ETAM', margin, y + 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(220, 38, 38);
  doc.text('CCTV & KOMPUTER KASIR', margin, y + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('Spesialis Pengadaan & Instalasi CCTV HD/IP PoE serta Komputer Kasir POS', margin, y + 12);

  // Kontak Perusahaan di Kanan
  const rightX = pageWidth - margin;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('WhatsApp: 0822-5131-4646', rightX, y + 2, { align: 'right' });
  doc.text('Website: Borneoetam.com', rightX, y + 7, { align: 'right' });
  doc.text('Samarinda - Kalimantan Timur', rightX, y + 12, { align: 'right' });

  // Garis pemisah halus
  y += 17;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.6);
  doc.line(margin, y, rightX, y);

  // =========================================================================
  // 2. DOKUMEN INFO & KLIEN TUJUAN (2 CARDS BERSEBELAHAN ELEGAN)
  // =========================================================================
  y += 6;
  const cardHeight = 27;
  const colWidth = (contentWidth - 6) / 2; // 88mm

  // Card Kiri: Info Dokumen
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, colWidth, cardHeight, 2, 2, 'FD');

  // Badge Judul Dokumen
  doc.setFillColor(isInvoice ? 220 : 15, isInvoice ? 38 : 118, isInvoice ? 38 : 110); // Red or Teal
  doc.roundedRect(margin + 4, y + 3.5, isInvoice ? 45 : 55, 6, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(isInvoice ? 'FAKTUR TAGIHAN' : 'SURAT PENAWARAN HARGA', margin + 6, y + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`No: ${data.docNumber}`, margin + 4, y + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tanggal Terbit : ${data.dateStr}`, margin + 4, y + 19.5);
  doc.text(`Masa Berlaku : 14 Hari Kalender`, margin + 4, y + 24);

  // Card Kanan: Klien Tujuan
  const cardRightX = margin + colWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(cardRightX, y, colWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DITUJUKAN KEPADA:', cardRightX + 4, y + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text((data.clientName || 'Pelanggan').toUpperCase(), cardRightX + 4, y + 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Kontak/WA : ${data.clientPhone || '-'}`, cardRightX + 4, y + 19);
  doc.text(`Alamat/Lokasi : ${(data.clientAddress || 'Kalimantan Timur').slice(0, 42)}`, cardRightX + 4, y + 23.5);

  // =========================================================================
  // 3. TABEL ITEM (SLEEK MODERN DATA TABLE)
  // =========================================================================
  y += cardHeight + 8;

  // Header Tabel Dark Slate
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  const col1 = margin + 3;          // No
  const col2 = margin + 14;         // Deskripsi
  const col3 = margin + 104;        // Qty
  const col4 = margin + 124;        // Harga Satuan
  const col5 = margin + contentWidth - 4; // Total (Right aligned)

  doc.text('NO', col1, y + 5.5);
  doc.text('DESKRIPSI PERANGKAT / LAYANAN JASA', col2, y + 5.5);
  doc.text('QTY / SAT', col3, y + 5.5);
  doc.text('HARGA SATUAN', col4 + 18, y + 5.5, { align: 'right' });
  doc.text('JUMLAH TOTAL', col5, y + 5.5, { align: 'right' });

  y += 8;

  // Rows Data
  let rowIdx = 1;
  let subtotal = 0;

  for (const it of data.items) {
    if (!it.description || Number(it.quantity) <= 0) continue;

    const lineTotal = Number(it.quantity) * Number(it.unit_price || 0);
    subtotal += lineTotal;

    const rowH = 7.5;
    // Striping baris
    if (rowIdx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowH, 'F');
    }

    // Nomor
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(String(rowIdx).padStart(2, '0'), col1, y + 5);

    // Deskripsi
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59); // Slate-800
    const desc = it.description.length > 50 ? it.description.slice(0, 48) + '...' : it.description;
    doc.text(desc, col2, y + 5);

    // Qty & Satuan
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`${it.quantity} ${it.unit || 'Unit'}`, col3, y + 5);

    // Harga Satuan
    doc.text(formatRupiah(it.unit_price), col4 + 18, y + 5, { align: 'right' });

    // Total Baris
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatRupiah(lineTotal), col5, y + 5, { align: 'right' });

    // Garis batas bawah
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(margin, y + rowH, rightX, y + rowH);

    y += rowH;
    rowIdx++;

    // Safety limit jika item banyak
    if (y > 210) break;
  }

  // =========================================================================
  // 4. TOTALS SECTION & PAYMENT INFO BOX (SIDE BY SIDE)
  // =========================================================================
  y += 5;

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
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('PEMBAYARAN RESMI VIA TRANSFER BANK:', margin + 3.5, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(37, 99, 235); // Blue-600 BCA
  doc.text('BANK BCA (014)', margin + 3.5, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('5135400278', margin + 3.5, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Atas Nama : Muhammad Wahyu', margin + 3.5, y + 23);

  // Badge Garansi Resmi 12 Bulan
  doc.setFillColor(240, 253, 244); // Green-50
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin + 3.5, y + 26, leftBoxW - 7, 6, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52); // Green-800
  doc.text('Garansi Hardware 12 Bulan Resmi Distributor', margin + 6, y + 30.5);

  // Box Kanan: Rincian Angka & Grand Total
  const sumX = margin + leftBoxW + 6;
  const sumW = contentWidth - leftBoxW - 6;

  let sumY = y;

  if (discount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal:', sumX + 2, sumY + 5);
    doc.text(formatRupiah(subtotal), rightX - 2, sumY + 5, { align: 'right' });

    doc.text('Diskon Khusus:', sumX + 2, sumY + 11);
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${formatRupiah(discount)}`, rightX - 2, sumY + 11, { align: 'right' });
    sumY += 14;
  }

  // Highlight Box Total
  doc.setFillColor(15, 23, 42); // Slate-900 Luxury Accent
  doc.roundedRect(sumX, sumY, sumW, 11, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL TAGIHAN', sumX + 4, sumY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(formatRupiah(grandTotal), rightX - 4, sumY + 7.5, { align: 'right' });

  sumY += 14;

  if (isInvoice && dpAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('DP (Telah Diterima):', sumX + 2, sumY + 2);
    doc.text(formatRupiah(dpAmount), rightX - 2, sumY + 2, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(220, 38, 38);
    doc.text('Sisa Pelunasan:', sumX + 2, sumY + 8);
    doc.text(formatRupiah(remaining), rightX - 2, sumY + 8, { align: 'right' });
    sumY += 12;
  }

  // =========================================================================
  // 5. SYARAT KETENTUAN & TANDA TANGAN RESMI
  // =========================================================================
  y = Math.max(y + leftBoxH + 6, sumY + 4);

  // Syarat Ketentuan Kiri
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('KETENTUAN LAYANAN & JAMINAN MUTU:', margin, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  const defaultTerms = [
    '1. Seluruh unit kamera, NVR/DVR, Harddisk WD Purple & PC Kasir bergaransi resmi 12 Bulan.',
    '2. Gratis kunjungan pemeliharaan teknis & setting online pantau HP selama 3 Bulan.',
    '3. Penarikan kabel rapi menggunakan pelindung pipa klem standar instalasi kelistrikan.',
    '4. Pembayaran DP 50% saat jadwal disepakati, pelunasan 50% setelah uji coba selesai (BAST).'
  ];
  const termsList = data.terms ? data.terms.split('\n').filter(Boolean) : defaultTerms;

  let ty = y + 9;
  for (const t of termsList.slice(0, 4)) {
    doc.text(t.slice(0, 85), margin, ty);
    ty += 4;
  }

  // Tanda Tangan Kanan
  const signColX = rightX - 45;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Samarinda, ' + data.dateStr, signColX, y + 4, { align: 'center' });
  doc.text('Hormat kami,', signColX, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(220, 38, 38);
  doc.text('Borneo Etam CCTV & POS', signColX, y + 12, { align: 'center' });

  // Tanda tangan nama
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('( Muhammad Wahyu )', signColX, y + 33, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Owner / Technical Lead', signColX, y + 37, { align: 'center' });

  // =========================================================================
  // 6. FOOTER RESMI BORNEO ETAM
  // =========================================================================
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, pageHeight - 12, rightX, pageHeight - 12);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Dokumen penawaran resmi ini digenerate secara sah melalui Borneo Etam AI Command Center.', margin, pageHeight - 8);
  doc.text('Halaman 1 dari 1', rightX, pageHeight - 8, { align: 'right' });

  const rawBytes = doc.output('arraybuffer');
  return new Uint8Array(rawBytes);
}
