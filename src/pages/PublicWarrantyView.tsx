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
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();

      // Outer Red Border & Inner Dark Border
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(1.5);
      doc.rect(8, 8, w - 16, h - 16);

      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.5);
      doc.rect(10, 10, w - 20, h - 20);

      // Red Top Accent Header
      doc.setFillColor(220, 38, 38);
      doc.rect(10, 10, w - 20, 22, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('BORNEO ETAM CCTV & KOMPUTER KASIR', w / 2, 21, { align: 'center' });

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Spesialis Kamera CCTV HD/IP PoE & Komputer Kasir • Samarinda, Kaltim • 0822-5131-4646', w / 2, 27, { align: 'center' });

      // Title & Reg Number
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('SERTIFIKAT JAMINAN GARANSI DIGITAL RESMI', w / 2, 42, { align: 'center' });

      const regNo = `WAR/BE-CCTV/${data.id.slice(0, 8).toUpperCase()}`;
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Nomor Registrasi Unit: ${regNo}`, w / 2, 48, { align: 'center' });

      // Status Badge
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(w / 2 - 45, 52, 90, 7.5, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('GARANSI 12 BULAN AKTIF PENUH', w / 2, 57, { align: 'center' });

      // Client Details Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(16, 64, w - 32, 34, 3, 3, 'FD');

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8.5);
      doc.text('Nama Pemilik / Klien', 22, 71);
      doc.text('Lokasi Instalasi', 22, 79);
      doc.text('Tanggal Pemasangan', 22, 87);
      doc.text('Masa Perlindungan', 22, 95);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(`:  ${data.client_name}`, 62, 71);
      doc.text(`:  ${data.address_landmark || data.city || 'Samarinda'}`, 62, 79);
      doc.text(`:  ${data.installed_at || safeFormat(new Date(), 'dd MMMM yyyy')}`, 62, 87);
      doc.text(`:  ${data.warranty_months || 12} Bulan Penuh (Jaminan Penggantian Hardware)`, 62, 95);

      // Hardware Serials Box
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(16, 102, w - 32, 22, 3, 3, 'FD');

      doc.setTextColor(185, 28, 28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('NOMOR SERI PERANGKAT RESMI TERDAFTAR (HARDWARE IDENTIFICATION)', 22, 108);

      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`• Serial Number NVR/DVR : ${data.sn_nvr || 'Tercatat di sistem distributor'}`, 22, 115);
      doc.text(`• Serial Number Harddisk : ${data.sn_hdd || 'Tercatat di sistem distributor'}`, 22, 121);

      // Installed Units Table
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('DAFTAR PERANGKAT YANG DILINDUNGI GARANSI', 16, 132);

      // Table header
      doc.setFillColor(30, 41, 59);
      doc.rect(16, 135, w - 32, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text('No', 20, 140);
      doc.text('Deskripsi Perangkat / Material', 32, 140);
      doc.text('Jumlah', 140, 140);
      doc.text('Masa Garansi', 165, 140);

      let curY = 142;
      const displayItems = items.length > 0 ? items : [
        { description: 'Paket Kamera CCTV HD/IP PoE Borneo Etam', quantity: 1, unit: 'Paket' },
        { description: 'Digital Video Recorder / Network Video Recorder', quantity: 1, unit: 'Unit' },
        { description: 'Harddisk Khusus CCTV Surveillance', quantity: 1, unit: 'Unit' },
        { description: 'Power Supply / Adaptor CCTV & Aksesoris Instalasi', quantity: 1, unit: 'Set' }
      ];

      displayItems.slice(0, 7).forEach((it: any, idx: number) => {
        curY += 7;
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(16, curY - 5, w - 32, 7, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.line(16, curY + 2, w - 16, curY + 2);

        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(String(idx + 1), 20, curY);
        doc.text(String(it.description || '').slice(0, 52), 32, curY);
        doc.text(`${it.quantity} ${it.unit || 'Unit'}`, 140, curY);
        doc.text('12 Bulan', 165, curY);
      });

      // Terms Box
      curY += 9;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(16, curY, w - 32, 36, 3, 3, 'FD');

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('KETENTUAN JAMINAN & KLAIM GARANSI RESMI:', 22, curY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('1. Garansi mencakup kerusakan fungsi hardware internal perangkat (NVR/DVR, Kamera, Harddisk).', 22, curY + 12);
      doc.text('2. Garansi tidak berlaku untuk kerusakan akibat petir hebat, kebakaran, bencana alam, atau modifikasi pihak ketiga.', 22, curY + 18);
      doc.text('3. Klaim garansi dapat dilakukan dengan menunjukkan sertifikat ini atau menyebutkan No. Registrasi di atas.', 22, curY + 24);
      doc.text('4. Layanan bantuan darurat & teknisi resmi WhatsApp: 0822-5131-4646 (Borneo Etam Samarinda).', 22, curY + 30);

      // Signature and Stamp
      curY += 42;
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Samarinda, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, w - 65, curY);
      doc.text('Borneo Etam CCTV & Komputer Kasir', w - 65, curY + 4.5);

      // Digital Stamp Box
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.8);
      doc.rect(w - 65, curY + 8, 44, 18);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('BORNEO ETAM', w - 43, curY + 13.5, { align: 'center' });
      doc.setFontSize(6);
      doc.text('OFFICIAL DIGITAL STAMP', w - 43, curY + 17.5, { align: 'center' });
      doc.text('VERIFIED & SECURED', w - 43, curY + 21.5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Muhammad Wahyu', w - 65, curY + 32);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Owner / Technical Lead', w - 65, curY + 36);

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
