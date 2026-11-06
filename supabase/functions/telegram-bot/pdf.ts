// Generator Dokumen PDF Resmi Borneo Etam CCTV & POS (A4 Standard)
// Berjalan langsung di runtime Deno / Supabase Edge Functions tanpa ketergantungan browser eksternal.
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
  companyName: string;
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

  // --- HEADER PERUSAHAAN (BORNEO ETAM) ---
  // Aksen Warna Merah Borneo Etam (#dc2626)
  doc.setFillColor(220, 38, 38);
  doc.rect(margin, 12, 4, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39); // Slate-900
  doc.text((data.companyName || 'BORNEO ETAM CCTV & KOMPUTER KASIR').toUpperCase(), margin + 8, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99); // Gray-600
  const subline = [
    data.companyPhone ? `WhatsApp: ${data.companyPhone}` : 'WA: 0822-5131-4646',
    data.companyWebsite ? `Web: ${data.companyWebsite}` : 'Borneoetam.com',
    'Spesialis CCTV & Sistem Kasir POS Kaltim'
  ].join('  •  ');
  doc.text(subline, margin + 8, 24);

  // Garis pemisah Header
  doc.setDrawColor(229, 231, 235); // Gray-200
  doc.setLineWidth(0.5);
  doc.line(margin, 34, pageWidth - margin, 34);

  // --- JUDUL & METADATA DOKUMEN ---
  let y = 42;

  // Badge Status Dokumen
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, y - 5, contentWidth, 22, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(220, 38, 38);
  doc.text(isInvoice ? 'FAKTUR TAGIHAN (INVOICE)' : 'SURAT PENAWARAN HARGA', margin + 4, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text(`No: ${data.docNumber}`, margin + 4, y + 8);
  doc.text(`Tanggal: ${data.dateStr}`, margin + 4, y + 13);

  // Kolom Kanan: Klien Tujuan
  const rightColX = margin + 100;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('KEPADA YTH:', rightColX, y + 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 118, 110); // Teal-700
  doc.text(data.clientName || 'Pelanggan Terhormat', rightColX, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  const clientContact = [
    data.clientPhone ? `Telp/WA: ${data.clientPhone}` : null,
    data.clientAddress ? data.clientAddress : null,
  ].filter(Boolean).join('  |  ');
  if (clientContact) {
    doc.text(clientContact.slice(0, 50), rightColX, y + 13);
  }

  // --- TABEL RINCIAN BARANG & JASA ---
  y = 70;

  // Header Tabel
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(margin, y, contentWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);

  const colNo = margin + 3;
  const colDesc = margin + 12;
  const colQty = margin + 105;
  const colPrice = margin + 135;
  const colTotal = margin + 180;

  doc.text('NO', colNo, y + 5.5);
  doc.text('DESKRIPSI BARANG & JASA LAYANAN', colDesc, y + 5.5);
  doc.text('QTY / SAT', colQty, y + 5.5);
  doc.text('HARGA SATUAN', colPrice, y + 5.5, { align: 'right' });
  doc.text('TOTAL', colTotal, y + 5.5, { align: 'right' });

  y += 8;

  // Rows Item
  let rowNo = 1;
  let subtotal = 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  for (const it of data.items) {
    if (!it.description || Number(it.quantity) <= 0) continue;

    const lineTotal = Number(it.quantity) * Number(it.unit_price || 0);
    subtotal += lineTotal;

    // Zebra striping background
    if (rowNo % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, contentWidth, 7, 'F');
    }

    doc.setTextColor(75, 85, 99);
    doc.text(String(rowNo), colNo, y + 5);

    doc.setTextColor(17, 24, 39);
    // Potong deskripsi jika kepanjangan agar tidak keluar batas
    const descText = it.description.length > 52 ? it.description.slice(0, 50) + '...' : it.description;
    doc.text(descText, colDesc, y + 5);

    doc.setTextColor(75, 85, 99);
    const qtyText = `${it.quantity} ${it.unit || 'Unit'}`;
    doc.text(qtyText, colQty, y + 5);

    doc.text(formatRupiah(it.unit_price), colPrice, y + 5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(formatRupiah(lineTotal), colTotal, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    // Bottom border tipis
    doc.setDrawColor(243, 244, 246);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);

    y += 7;

    // Safety page limit check
    if (y > 215) break;
  }

  // --- BOX TOTAL & KALKULASI ---
  y += 4;
  const discount = Number(data.discountAmount || 0);
  const grandTotal = Math.max(0, subtotal - discount);
  const dpAmount = Number(data.downPaymentAmount || 0);
  const remaining = Math.max(0, grandTotal - dpAmount);

  const calcBoxX = margin + 95;
  const calcBoxWidth = contentWidth - 95;

  if (discount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(75, 85, 99);
    doc.text('Subtotal:', calcBoxX, y + 4);
    doc.text(formatRupiah(subtotal), margin + contentWidth, y + 4, { align: 'right' });

    doc.text('Diskon Khusus:', calcBoxX, y + 9);
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${formatRupiah(discount)}`, margin + contentWidth, y + 9, { align: 'right' });
    y += 10;
  }

  // Highlight Box Total
  doc.setFillColor(15, 118, 110); // Teal-700
  doc.roundedRect(calcBoxX, y, calcBoxWidth, 9, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL AKHIR:', calcBoxX + 4, y + 6);
  doc.text(formatRupiah(grandTotal), margin + contentWidth - 3, y + 6, { align: 'right' });

  y += 12;

  if (isInvoice && dpAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text('DP (Uang Muka Diterima):', calcBoxX, y + 3);
    doc.text(formatRupiah(dpAmount), margin + contentWidth, y + 3, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('Sisa Tagihan Pelunasan:', calcBoxX, y + 8);
    doc.text(formatRupiah(remaining), margin + contentWidth, y + 8, { align: 'right' });
    y += 10;
  }

  // --- INSTRUKSI PEMBAYARAN & SYARAT KETENTUAN (KIRI) ---
  const leftBoxY = y - (isInvoice && dpAmount > 0 ? 18 : 8);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, leftBoxY, 85, 34, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text('INSTRUKSI PEMBAYARAN TRANSFER:', margin + 3, leftBoxY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  const payLines = (data.paymentInstructions || 'Bank BCA\nNo. Rek: 5135400278\na.n Muhammad Wahyu').split('\n');
  let py = leftBoxY + 10;
  for (const pl of payLines) {
    doc.text(pl.trim(), margin + 3, py);
    py += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 118, 110);
  doc.text('Garansi Hardware Resmi 12 Bulan (1 Tahun)', margin + 3, leftBoxY + 30);

  // --- SYARAT & KETENTUAN ---
  let termsY = Math.max(y + 8, leftBoxY + 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(17, 24, 39);
  doc.text('SYARAT & KETENTUAN PENAWARAN:', margin, termsY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);

  const defaultTerms = [
    '1. Penawaran berlaku selama 14 hari sejak tanggal dokumen ini diterbitkan.',
    '2. Perangkat CCTV, NVR, Harddisk WD Purple & Kasir bergaransi resmi hardware selama 12 Bulan.',
    '3. Garansi pemeliharaan instalasi & setting online pantau HP aktif selama 3 bulan.',
    '4. Pembayaran DP 50% saat kesepakatan jadwal dan pelunasan 50% setelah uji coba selesai (BAST).'
  ];
  const termsToUse = data.terms ? data.terms.split('\n').filter(Boolean) : defaultTerms;

  termsY += 4;
  for (const tl of termsToUse.slice(0, 4)) {
    doc.text(tl.slice(0, 85), margin, termsY);
    termsY += 3.8;
  }

  // --- TANDA TANGAN RESMI ---
  const signX = pageWidth - margin - 50;
  const signY = termsY + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text('Samarinda, ' + data.dateStr, signX, signY, { align: 'center' });
  doc.text('Hormat kami,', signX, signY + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(220, 38, 38);
  doc.text('Borneo Etam CCTV & POS', signX, signY + 8, { align: 'center' });

  // Space tanda tangan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('( Muhammad Wahyu )', signX, signY + 28, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Owner / Technical Lead', signX, signY + 32, { align: 'center' });

  // Footer baris bawah
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('Dokumen ini diterbitkan secara sah dan otomatis oleh Borneo Etam AI Command Center.', margin, pageHeight - 8);

  const rawBytes = doc.output('arraybuffer');
  return new Uint8Array(rawBytes);
}
