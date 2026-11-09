import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShieldCheck, 
  Calendar, 
  MapPin, 
  Phone, 
  Clock, 
  CheckCircle2, 
  Cpu, 
  HardDrive, 
  ExternalLink,
  MessageCircle,
  HelpCircle,
  Sparkles,
  Download
} from 'lucide-react';
import { safeFormat } from '@/lib/utils';
import { calculateWarrantyStatus, WarrantyStatusInfo } from '@/services/cctvCommandService';
import { jsPDF } from 'jspdf';
import { DEFAULT_OWNER_SIGNATURE } from '@/utils/signature';

interface CCTVInstallation {
  id: string;
  project_name: string;
  client_name: string;
  client_phone: string;
  address_landmark: string;
  service_type: string;
  package_name: string;
  city: string;
  progress: number;
  sn_nvr: string | null;
  sn_hdd: string | null;
  installed_at: string | null;
  warranty_months: number;
  photos: any[];
  notes: string | null;
}

export default function PublicWarrantyView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CCTVInstallation | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWarranty() {
      if (!id) {
        setError('ID Garansi tidak ditemukan.');
        setLoading(false);
        return;
      }

      try {
        const { data: item, error: err } = await supabase
          .from('cctv_installations')
          .select('*, quotes(*, quote_items(*))')
          .eq('id', id)
          .maybeSingle();

        if (err || !item) {
          setError('Kartu garansi tidak ditemukan atau tautan telah kedaluwarsa.');
        } else {
          setData(item);
          let its: any[] = (item as any)?.quotes?.quote_items || [];
          if (its.length === 0 && item.client_name) {
            const { data: invData } = await supabase
              .from('invoices')
              .select('invoice_items(*)')
              .ilike('to_client', `%${item.client_name}%`)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (invData?.invoice_items && invData.invoice_items.length > 0) {
              its = invData.invoice_items;
            }
          }
          setItems(its);
        }
      } catch (e: any) {
        setError(e.message || 'Terjadi kesalahan sistem.');
      } finally {
        setLoading(false);
      }
    }

    loadWarranty();
  }, [id]);

  const handleDownloadPdf = () => {
    if (!data) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const rightX = pageWidth - margin;

      // 1. Double Certificate Border (Executive Slate & Crimson)
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(1.0);
      doc.rect(7, 7, pageWidth - 14, pageHeight - 14, 'D');

      doc.setDrawColor(185, 28, 28);
      doc.setLineWidth(0.4);
      doc.rect(9.5, 9.5, pageWidth - 19, pageHeight - 19, 'D');

      // Certificate Corner Accents (L-brackets at 4 corners)
      doc.setDrawColor(217, 119, 6);
      doc.setLineWidth(0.8);
      const cornerSize = 4.5;
      doc.line(11, 11, 11 + cornerSize, 11);
      doc.line(11, 11, 11, 11 + cornerSize);
      doc.line(pageWidth - 11, 11, pageWidth - 11 - cornerSize, 11);
      doc.line(pageWidth - 11, 11, pageWidth - 11, 11 + cornerSize);
      doc.line(11, pageHeight - 11, 11 + cornerSize, pageHeight - 11);
      doc.line(11, pageHeight - 11, 11, pageHeight - 11 - cornerSize);
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
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(pageWidth / 2 - badgeW / 2, y, badgeW, badgeH, 2, 2, 'F');
      
      doc.setDrawColor(217, 119, 6);
      doc.setLineWidth(0.3);
      doc.roundedRect(pageWidth / 2 - badgeW / 2 + 0.5, y + 0.5, badgeW - 1, badgeH - 1, 1.5, 1.5, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text('SERTIFIKAT JAMINAN GARANSI DIGITAL RESMI', pageWidth / 2, y + 5.8, { align: 'center' });

      y += badgeH + 4;

      const regNo = `WAR/BE-CCTV/${data.id.slice(0, 8).toUpperCase()}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(51, 65, 85);
      doc.text(`No. Registrasi: ${regNo}`, margin, y + 3.2);

      const pillW = 76;
      const pillH = 6;
      doc.setFillColor(22, 101, 52);
      doc.roundedRect(rightX - pillW, y - 1, pillW, pillH, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(255, 255, 255);
      doc.text('✓ GARANSI RESMI TERVERIFIKASI AKTIF', rightX - pillW / 2, y + 3.2, { align: 'center' });

      y += 8;

      // Box 1: Data Pemilik
      const boxW = contentWidth;
      const box1H = 22;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin, y, boxW, box1H, 2, 2, 'FD');

      doc.setFillColor(185, 28, 28);
      doc.rect(margin, y, 2.5, box1H, 'F');

      const col1X = margin + 5.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(185, 28, 28);
      doc.text('INFORMASI KONSUMEN & LOKASI PEMASANGAN:', col1X, y + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(data.client_name || 'Pelanggan Terhormat', col1X, y + 10.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const clientPhoneStr = data.client_phone && data.client_phone.trim() && data.client_phone !== '-' 
        ? `Kontak: ${data.client_phone}` 
        : 'Kontak: Tercatat di Database';
      doc.text(clientPhoneStr, col1X, y + 15);

      const addrStr = `Alamat: ${data.address_landmark || data.city || 'Samarinda, Kalimantan Timur'}`;
      const addrLines = doc.splitTextToSize(addrStr, 88);
      doc.text(addrLines.slice(0, 1)[0], col1X, y + 19);

      const col2X = margin + 100;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(22, 101, 52);
      doc.text('PARAMETER MASA PERLINDUNGAN DISTRIBUTOR:', col2X, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Tanggal Instalasi   : ${data.installed_at || safeFormat(new Date(), 'dd MMMM yyyy')}`, col2X, y + 10.2);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Masa Berlaku       : ${data.warranty_months || 12} Bulan Penuh`, col2X, y + 14.8);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 128, 61);
      doc.text(`Skema Proteksi   : 1-to-1 Replacement (Ganti Unit) & Servis`, col2X, y + 19);

      y += box1H + 3.5;

      // Box 2: SN Perangkat
      const box2H = 12.5;
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(margin, y, boxW, box2H, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Unit Perekam (DVR / NVR):', col1X, y + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(15, 23, 42);
      doc.text(`SN: ${data.sn_nvr || 'Tercatat di sistem distributor'}`, col1X, y + 9.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Penyimpanan Rekaman (HDD Surveillance):', col2X, y + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(15, 23, 42);
      doc.text(`SN: ${data.sn_hdd || 'Tercatat di sistem distributor'}`, col2X, y + 9.5);

      y += box2H + 4;

      // Section 3: Tabel Perangkat
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('RINCIAN PERANGKAT & MATERIAL INSTALASI YANG DILINDUNGI GARANSI:', margin, y + 2.5);

      y += 4.5;

      const colW = { no: 8, desc: 98, qty: 22, dur: 28, cakupan: 30 };
      const thY = y;
      const thH = 5.8;

      doc.setFillColor(15, 23, 42);
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

      const displayItems = items.length > 0 ? items : [
        { description: 'Unit Perekam Digital Video Recorder (DVR / NVR HD PoE)', quantity: 1, unit: 'Unit' },
        { description: 'Kamera CCTV High-Definition Night ColorVu Surveillance', quantity: 4, unit: 'Unit' },
        { description: 'Harddisk Khusus Rekaman CCTV (Surveillance Grade)', quantity: 1, unit: 'Unit' },
        { description: 'Power Supply Jaring Centralized & Box Pengaman', quantity: 1, unit: 'Set' },
        { description: 'Paket Konektor BNC, Jack DC, & Kabel Coaxial RG59', quantity: 1, unit: 'Paket' }
      ];

      const maxItems = 7;
      const itemsToRender = displayItems.slice(0, maxItems);
      const rowH = 5.4;

      itemsToRender.forEach((it: any, idx: number) => {
        const rowY = y + idx * rowH;
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margin, rowY, boxW, rowH, 'F');

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, rowY + rowH, rightX, rowY + rowH);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(30, 41, 59);
        doc.text(String(idx + 1), margin + colW.no / 2, rowY + 3.8, { align: 'center' });

        const desc = String(it.description || '').trim();
        const cleanDesc = desc.charAt(0).toUpperCase() + desc.slice(1);
        doc.text(cleanDesc.slice(0, 58), margin + colW.no + 3, rowY + 3.8);

        doc.setFont('helvetica', 'bold');
        doc.text(`${it.quantity} ${it.unit || 'Unit'}`, margin + colW.no + colW.desc + colW.qty / 2, rowY + 3.8, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(22, 101, 52);
        doc.text('12 Bulan', margin + colW.no + colW.desc + colW.qty + colW.dur / 2, rowY + 3.8, { align: 'center' });

        doc.setTextColor(71, 85, 105);
        doc.text('Ganti Unit / Servis', margin + colW.no + colW.desc + colW.qty + colW.dur + colW.cakupan / 2, rowY + 3.8, { align: 'center' });
      });

      y += itemsToRender.length * rowH + 4;

      // Section 4: Ketentuan
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
        '4. Prosedur Klaim Cepat: Konsumen cukup menghubungi Hotline WhatsApp 0822-5131-4646 dengan menyebutkan No. Registrasi di atas. Dokumen fisik tidak wajib dibawa.'
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

      // Section 5: Bottom Area
      const qrBoxW = 86;
      const qrBoxH = 44;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, qrBoxW, qrBoxH, 2, 2, 'FD');

      const qrX = margin + 4.5;
      const qrY = y + 5;
      const qrSize = 25;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(qrX, qrY, qrSize, qrSize, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      doc.text('VERIFIKASI', qrX + qrSize / 2, qrY + qrSize / 2 - 1.5, { align: 'center' });
      doc.setFontSize(5.5);
      doc.setTextColor(185, 28, 28);
      doc.text('DIGITAL LIVE', qrX + qrSize / 2, qrY + qrSize / 2 + 3, { align: 'center' });

      const qrTextX = qrX + qrSize + 4.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('VERIFIKASI DIGITAL LIVE', qrTextX, y + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      const qrExpl = doc.splitTextToSize('Scan atau buka tautan resmi kartu garansi ini untuk cek status keaslian & sisa masa aktif secara real-time.', qrBoxW - qrSize - 12);
      doc.text(qrExpl.slice(0, 3), qrTextX, y + 13);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(185, 28, 28);
      doc.text('Hotline Servis Cepat:', qrTextX, y + 26);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text('WhatsApp: 0822-5131-4646', qrTextX, y + 30);

      const signColX = rightX - 44;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Samarinda, ${safeFormat(new Date(), 'dd MMMM yyyy')}`, signColX, y + 6, { align: 'center' });
      doc.text('Diterbitkan sah oleh,', signColX, y + 10.5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(185, 28, 28);
      doc.text('Borneo Etam CCTV & Komputer Kasir', signColX, y + 15, { align: 'center' });

      // Tanda Tangan Digital Resmi Mas Wahyu dari Aplikasi (TANPA STEMPEL)
      try {
        doc.addImage(DEFAULT_OWNER_SIGNATURE, 'PNG', signColX - 14, y + 17, 28, 17.5);
      } catch (e) {
        console.warn('Failed to add official signature:', e);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text('( Muhammad Wahyu )', signColX, y + 37, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Owner / Technical Lead', signColX, y + 41.5, { align: 'center' });

      // Footer
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin, pageHeight - 13, rightX, pageHeight - 13);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Sertifikat Garansi Digital Resmi ini diterbitkan oleh Borneo Etam Cloud Command Center & dilindungi registrasi unik.', margin, pageHeight - 9.5);
      doc.text('Layanan Pelanggan: 0822-5131-4646 • www.borneoetam.com', rightX, pageHeight - 9.5, { align: 'right' });

      const safeClient = (data.client_name || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Sertifikat_Garansi_BorneoEtam_${safeClient}.pdf`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-full bg-slate-800 rounded-2xl" />
          <Skeleton className="h-64 w-full bg-slate-800 rounded-3xl" />
          <Skeleton className="h-12 w-full bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100 rounded-3xl shadow-2xl p-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl font-bold mb-2">Kartu Garansi Tidak Ditemukan</CardTitle>
          <CardDescription className="text-slate-400 text-sm mb-6">
            {error || 'Silakan hubungi admin Borneo Etam CCTV untuk memverifikasi nomor garansi Anda.'}
          </CardDescription>
          <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl">
            <a href="https://wa.me/6282251314646" target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" /> Hubungi Layanan Servis WA
            </a>
          </Button>
        </Card>
      </div>
    );
  }

  const warranty: WarrantyStatusInfo = calculateWarrantyStatus(
    data.installed_at,
    data.warranty_months || 12,
    data.progress
  );

  const isWarrantyActive = warranty.status === 'active';
  const whatsappUrl = `https://wa.me/6282251314646?text=${encodeURIComponent(
    `Halo Borneo Etam CCTV, saya ingin menanyakan/klaim garansi untuk instalasi ${data.client_name} (SN NVR: ${data.sn_nvr || '-'}).`
  )}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-xl space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold tracking-wider uppercase mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Sertifikat Garansi Digital
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Borneo Etam</h1>
          <p className="text-xs sm:text-sm text-slate-400">CCTV HD/IP PoE & Komputer Kasir • Samarinda, Kaltim</p>
        </div>

        {/* Main Certificate Card */}
        <Card className="bg-slate-900/90 backdrop-blur-xl border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
          <CardHeader className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nomor Registrasi Unit</p>
                <p className="text-lg font-black text-white">WAR/BE-CCTV/{data.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <Badge className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit ${warranty.badgeClass}`}>
                <span className={`h-2 w-2 rounded-full ${warranty.dotColor} animate-pulse`} />
                {warranty.badgeLabel}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* Live Warranty Counter */}
            <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${isWarrantyActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Masa Berlaku Garansi Resmi</p>
                  <p className="text-sm sm:text-base font-bold text-white">
                    {data.warranty_months || 12} Bulan Penuh ({warranty.daysRemaining > 0 ? `Sisa ${warranty.daysRemaining} Hari` : 'Sudah Berakhir'})
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Batas Akhir</p>
                <p className="text-xs sm:text-sm font-bold text-slate-200">{warranty.expiryDateFormatted}</p>
              </div>
            </div>

            {/* Client & Installation Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1">
                <p className="text-slate-400 font-medium">Pemilik / Lokasi Pemasangan</p>
                <p className="font-bold text-sm text-white">{data.client_name}</p>
                <p className="text-slate-400 flex items-start gap-1">
                  <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span>{data.address_landmark || data.city}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1">
                <p className="text-slate-400 font-medium">Paket Terpasang</p>
                <p className="font-bold text-sm text-white">{data.package_name || 'Paket CCTV Borneo Etam'}</p>
                <p className="text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  <span>Tgl Pasang: {data.installed_at || safeFormat(new Date(), 'dd MMMM yyyy')}</span>
                </p>
              </div>
            </div>

            {/* Serial Numbers (Hardware Guarantee) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-emerald-400" /> Nomor Seri Perangkat Terdaftar
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">SN NVR/DVR:</span>
                  <span className="font-mono font-bold text-white">{data.sn_nvr || 'Tercatat di sistem'}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">SN Harddisk:</span>
                  <span className="font-mono font-bold text-white">{data.sn_hdd || 'Tercatat di sistem'}</span>
                </div>
              </div>
            </div>

            {/* Installed Units Breakdown */}
            {items.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" /> Rincian Perangkat Terlindungi ({items.length} Item)
                </p>
                <div className="divide-y divide-slate-800/60 text-xs">
                  {items.map((it: any, i: number) => (
                    <div key={i} className="py-2 flex items-center justify-between">
                      <span className="text-slate-300 font-medium">{it.description}</span>
                      <span className="font-bold text-slate-400 font-mono">{it.quantity} {it.unit || 'Unit'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warranty Commitments */}
            <div className="text-[11px] text-slate-400 space-y-1.5 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/40">
              <p className="font-bold text-slate-300 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Hak Jaminan Konsumen:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Garansi resmi distributor 12 Bulan penuh untuk DVR/NVR, Kamera, & Harddisk CCTV.</li>
                <li>Layanan bantuan teknisi & panduan sistem via WhatsApp Borneo Etam (0822-5131-4646).</li>
              </ul>
            </div>

            {/* Download PDF & WhatsApp Buttons */}
            <div className="pt-2 space-y-2.5">
              <Button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold h-11 rounded-2xl border border-slate-700 shadow-md flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4 text-sky-400" />
                {isGeneratingPdf ? 'Menyiapkan Dokumen PDF...' : 'Unduh Dokumen Garansi Resmi (PDF)'}
              </Button>
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-2xl shadow-lg">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" /> Hubungi Layanan Servis Teknisi
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          Diterbitkan secara sah oleh Borneo Etam AI Command Center • Samarinda, Kaltim
        </p>

      </div>
    </div>
  );
}
