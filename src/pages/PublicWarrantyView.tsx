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
  Sparkles
} from 'lucide-react';
import { safeFormat } from '@/lib/utils';
import { calculateWarrantyStatus, WarrantyStatusInfo } from '@/services/cctvCommandService';

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
  const [loading, setLoading] = useState(true);
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
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (err || !item) {
          setError('Kartu garansi tidak ditemukan atau tautan telah kedaluwarsa.');
        } else {
          setData(item);
        }
      } catch (e: any) {
        setError(e.message || 'Terjadi kesalahan sistem.');
      } finally {
        setLoading(false);
      }
    }

    loadWarranty();
  }, [id]);

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

            {/* Warranty Commitments */}
            <div className="text-[11px] text-slate-400 space-y-1.5 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/40">
              <p className="font-bold text-slate-300 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Hak Jaminan Konsumen:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Garansi resmi distributor 12 Bulan untuk DVR/NVR, Kamera, & Harddisk CCTV.</li>
                <li>Gratis kunjungan pemeliharaan teknis & setting online HP selama 3 Bulan.</li>
                <li>Bantuan teknisi darurat langsung via WhatsApp Borneo Etam (0822-5131-4646).</li>
              </ul>
            </div>

            {/* WhatsApp Claim Button */}
            <div className="pt-2 space-y-2">
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
