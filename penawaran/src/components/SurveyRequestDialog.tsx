import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BORNEO_ETAM_PACKAGES,
  KALTIM_REGIONS,
  ServiceType,
  submitPublicSurveyRequest,
  CCTVInstallation,
} from '@/services/cctvCommandService';
import { showError, showSuccess } from '@/utils/toast';
import {
  Calendar,
  CheckCircle2,
  Crosshair,
  Loader2,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { format, addDays } from 'date-fns';

interface SurveyRequestDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  defaultPackageName?: string;
  defaultServiceType?: ServiceType;
  adminWhatsAppNumber?: string;
  onSuccessCreated?: (created: CCTVInstallation) => void;
}

export const SurveyRequestDialog: React.FC<SurveyRequestDialogProps> = ({
  isOpen,
  setIsOpen,
  defaultPackageName,
  defaultServiceType = 'CCTV',
  adminWhatsAppNumber = '6281254008899',
  onSuccessCreated,
}) => {
  const [clientName, setClientName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [city, setCity] = useState('Samarinda');
  const [serviceType, setServiceType] = useState<ServiceType>(defaultServiceType);
  const [packageName, setPackageName] = useState(
    defaultPackageName || BORNEO_ETAM_PACKAGES[0].shortName
  );
  const [addressLandmark, setAddressLandmark] = useState('');
  const [surveyDate, setSurveyDate] = useState(() =>
    format(addDays(new Date(), 1), 'yyyy-MM-dd')
  );
  const [surveyTime, setSurveyTime] = useState('Pagi (09:00 - 12:00 WITA)');
  const [notes, setNotes] = useState('');

  // Coordinates state
  const [latitude, setLatitude] = useState<number>(-0.5022);
  const [longitude, setLongitude] = useState<number>(117.1536);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (defaultPackageName) setPackageName(defaultPackageName);
    if (defaultServiceType) setServiceType(defaultServiceType);
  }, [defaultPackageName, defaultServiceType]);

  // Update default city coordinates if GPS isn't locked manually
  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    if (!gpsLocked) {
      const reg = KALTIM_REGIONS.find((r) => r.key === newCity);
      if (reg) {
        setLatitude(reg.lat);
        setLongitude(reg.lng);
      }
    }
  };

  const handleCaptureGPS = () => {
    if (!('geolocation' in navigator)) {
      showError('Browser perangkat Anda tidak mendukung sensor lokasi GPS.');
      return;
    }

    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setGpsLocked(true);
        setLocatingGps(false);
        showSuccess(`Lokasi GPS presisi berhasil dikunci (${lat}, ${lng})!`);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocatingGps(false);
        showError('Gagal mengambil lokasi GPS otomatis. Pastikan izin lokasi diaktifkan.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim() || !addressLandmark.trim()) {
      showError('Mohon lengkapi Nama, Nomor WhatsApp, dan Alamat/Patokan lokasi.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitPublicSurveyRequest({
        client_name: clientName.trim(),
        business_name: businessName.trim() || clientName.trim(),
        client_phone: clientPhone.trim(),
        city,
        address_landmark: addressLandmark.trim(),
        service_type: serviceType,
        package_name: packageName,
        latitude,
        longitude,
        preferred_survey_date: surveyDate,
        preferred_survey_time: surveyTime,
        notes: notes.trim(),
      });

      if (onSuccessCreated) {
        onSuccessCreated(created);
      }

      showSuccess('Jadwal survei tercatat! Membuka WhatsApp Admin Borneo Etam...');

      const gmapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
      const waText = [
        `Halo Admin *Borneo Etam CCTV & POS*, saya ingin mengajukan *Jadwal Survei Lokasi Gratis*:`,
        ``,
        `👤 *Nama:* ${clientName.trim()}`,
        `🏪 *Tempat Usaha/Rumah:* ${businessName.trim() || '-'}`,
        `📱 *No. WA:* ${clientPhone.trim()}`,
        `🏙️ *Wilayah:* ${city}`,
        `📍 *Alamat/Patokan:* ${addressLandmark.trim()}`,
        `📦 *Kebutuhan:* ${serviceType} — ${packageName}`,
        `📅 *Tanggal Survei:* ${surveyDate} (${surveyTime})`,
        `🎯 *Titik GPS Maps:* ${gmapsLink}`,
        notes.trim() ? `📝 *Catatan:* ${notes.trim()}` : '',
        ``,
        `Mohon konfirmasi jadwal teknisi lapangan. Terima kasih!`,
      ]
        .filter(Boolean)
        .join('\n');

      const cleanAdminPhone = adminWhatsAppNumber.replace(/\D/g, '') || '6281254008899';
      window.open(
        `https://wa.me/${cleanAdminPhone}?text=${encodeURIComponent(waText)}`,
        '_blank'
      );

      setIsOpen(false);
    } catch {
      showError('Gagal mengirim pengajuan survei.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xl">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-teal-600 dark:text-teal-400">
              <Sparkles className="h-3 w-3" /> Gratis Survei & Konsultasi Kaltim
            </span>
          </div>
          <DialogTitle className="text-xl font-black tracking-tight text-foreground">
            📅 Ajukan Jadwal Survei Lokasi & Estimasi
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Tim teknisi Borneo Etam CCTV & POS siap melakukan pengecekan titik kamera & jalur kabel langsung di lokasi Anda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nama Lengkap Anda *</Label>
              <Input
                required
                placeholder="Contoh: Bpk. Budi Santoso"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nama Toko / Ruko / Rumah</Label>
              <Input
                placeholder="Contoh: Toko Berkah / Rumah Pribadi"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nomor WhatsApp Aktif *</Label>
              <Input
                required
                inputMode="tel"
                placeholder="Contoh: 081254001234"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Kota / Kabupaten Kaltim *</Label>
              <Select value={city} onValueChange={handleCityChange}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Pilih Kota" />
                </SelectTrigger>
                <SelectContent>
                  {KALTIM_REGIONS.filter((r) => r.key !== 'ALL').map((reg) => (
                    <SelectItem key={reg.key} value={reg.key}>
                      {reg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Jenis Layanan</Label>
              <Select
                value={serviceType}
                onValueChange={(v) => setServiceType(v as ServiceType)}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CCTV">📹 Instalasi Kamera CCTV</SelectItem>
                  <SelectItem value="POS">🖥️ Komputer Kasir (POS)</SelectItem>
                  <SelectItem value="BUNDLING">🏪 Bundling CCTV + Kasir Toko</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Pilihan Paket / Estimasi</Label>
              <Select value={packageName} onValueChange={setPackageName}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BORNEO_ETAM_PACKAGES.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.shortName}>
                      {pkg.shortName} ({pkg.highlight})
                    </SelectItem>
                  ))}
                  <SelectItem value="Konsultasi / Custom Sesuai Lokasi">
                    ✨ Konsultasi Custom Sesuai Titik Lokasi
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Auto-GPS Geolocation Box */}
          <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-3 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-teal-500" />
                  <span>Deteksi Titik Koordinat Lokasi Survei</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Klik tombol GPS agar teknisi kami mendapat rute akurat ke lokasi Anda.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={gpsLocked ? 'outline' : 'default'}
                onClick={handleCaptureGPS}
                disabled={locatingGps}
                className="h-9 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shrink-0"
              >
                {locatingGps ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Mengambil GPS...
                  </>
                ) : gpsLocked ? (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Perbarui Titik GPS
                  </>
                ) : (
                  <>
                    <Crosshair className="mr-1.5 h-3.5 w-3.5" /> 🎯 Ambil Lokasi Saya Sekarang
                  </>
                )}
              </Button>
            </div>

            {gpsLocked && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span>
                  ✅ Koordinat GPS Terkunci: {latitude}, {longitude}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:opacity-80"
                >
                  Cek Maps
                </a>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-bold">Alamat Lengkap & Patokan Lokasi *</Label>
              <Textarea
                required
                rows={2}
                placeholder="Contoh: Jl. Ahmad Yani Ruko No. 4 (Samping Indomaret / Seberang Bank BRI)..."
                value={addressLandmark}
                onChange={(e) => setAddressLandmark(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-teal-500" /> Rencana Tanggal Survei
              </Label>
              <Input
                type="date"
                value={surveyDate}
                onChange={(e) => setSurveyDate(e.target.value)}
                className="h-10 rounded-xl text-xs font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Preferensi Waktu Kunjungan</Label>
              <Select value={surveyTime} onValueChange={setSurveyTime}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pagi (09:00 - 12:00 WITA)">
                    ☀️ Pagi (09:00 - 12:00 WITA)
                  </SelectItem>
                  <SelectItem value="Siang (13:00 - 15:30 WITA)">
                    🌤️ Siang (13:00 - 15:30 WITA)
                  </SelectItem>
                  <SelectItem value="Sore (15:30 - 17:30 WITA)">
                    🌅 Sore (15:30 - 17:30 WITA)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Catatan Kebutuhan (Opsional)</Label>
            <Input
              placeholder="Contoh: Ruko 2 lantai, butuh kamera menghadap parkiran & meja kasir..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-teal-500 shrink-0" />
            <span>
              Privasi Anda aman. Koordinat GPS & nomor telepon hanya digunakan oleh tim teknisi resmi Borneo Etam untuk keperluan survei.
            </span>
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="rounded-xl text-xs font-bold h-10"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-xl text-xs font-bold h-10 bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Memproses...' : 'Kirim Jadwal Survei & Buka WhatsApp'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
