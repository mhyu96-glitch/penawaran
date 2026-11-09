# 🚀 Panduan Arsitektur Hybrid Failover Borneo Etam CCTV

Sistem ini menggabungkan **kecepatan & keandalan Cloud Supabase (Singapore)** dengan **kapasitas raksasa Harddisk 10TB Server Kantor (Samarinda)**.

---

## ⚡ Cara Kerja Sistem Hybrid (Zero Downtime)

```mermaid
flowchart TD
    User([Mas Wahyu via Telegram]) -->|Kirim Pesan / Foto| Gateway[Cloud Supabase Gateway]
    
    Gateway -->|Cek Status Server Kantor (Timeout 1.8s)| Check{Server Kantor Aktif?}
    
    Check -->|YA (Normal / Listrik Nyala)| HomeLab[Home Lab Server Kantor :8787]
    HomeLab -->|Arsip Resolusi Penuh| HDD[(Harddisk 10TB Z:\Storage10T)]
    HomeLab -->|Eksekusi AI & DB| SupabaseDB[(PostgreSQL Database)]
    
    Check -->|TIDAK (Mati Lampu / Offline)| Fallback[Auto Failover ke Cloud Singapore]
    Fallback -->|Langsung Dikerjakan Cloud| SupabaseDB
    
    HDD -.->|Saat Kantor Nyala Kembali| SyncWorker[Sync Worker Otomatis Unduh Foto Baru ke 10TB]
```

### 🎯 Keunggulan Utama:
1. **Kebal Mati Lampu**: Jika PLN padam atau internet kantor putus, bot **TIDAK AKAN PERNAH MATI**. Gateway Cloud Supabase otomatis mengambil alih eksekusi dalam **1.8 detik**.
2. **Kapasitas Penyimpanan Tak Terbatas**: Foto dokumentasi proyek, rekaman, dan stiker SN tersimpan aman di `Z:\Storage10T` tanpa khawatir kuota cloud membengkak.
3. **Sinkronisasi Otomatis**: Ketika server kantor dinyalakan kembali, `sync-worker.mjs` langsung mendeteksi dan mengunduh semua foto atau invoice yang dibuat saat mati lampu.

---

## 🛠️ Langkah Menjalankan Server Kantor (3 Langkah Mudah)

### Langkah 1: Jalankan Server Lokal
Klik ganda file:
```text
homelab\start-homelab.bat
```
Server akan berjalan di port `http://localhost:8787` dan background sync worker otomatis aktif.

### Langkah 2: Aktifkan Tunnel Aman (Cloudflare)
Klik ganda file:
```text
homelab\setup-tunnel.bat
```
*(Skrip otomatis mengunduh `cloudflared.exe` resmi jika belum ada)*.
Tunggu beberapa detik hingga muncul link publik, contoh:
```text
https://xxx-xxx-xxx.trycloudflare.com
```

### Langkah 3: Daftarkan URL ke Supabase (Sekali Saja)
Jalankan perintah ini di PowerShell / Command Prompt:
```powershell
supabase secrets set BORNEO_HOMELAB_URL="https://xxx-xxx-xxx.trycloudflare.com"
```
*Atau masukkan via Supabase Dashboard -> Project Settings -> Edge Functions -> Secrets.*

Selesai! Sekarang status bot otomatis menjadi:
**`mode: Hybrid Gateway (Failover Ready)`**.

---

## 📁 Struktur Penyimpanan Harddisk 10TB
Semua berkas tersimpan rapi di:
- `Z:\Storage10T\project aplikasi\apps build\penawaran\storage\photos`: Foto instalasi, foto survei, foto cover, dan stiker SN.
- `Z:\Storage10T\project aplikasi\apps build\penawaran\storage\documents`: Salinan PDF faktur, penawaran, kwitansi, dan BAST.
- `Z:\Storage10T\project aplikasi\apps build\penawaran\storage\backups`: Snapshot JSON harian seluruh data klien dan proyek.

---

## 🔍 Cek Status Kesehatan Sistem Kapan Saja
- **Health Check Cloud Gateway**: Buka browser ke `https://xukpisovkcflcwuhrzkx.supabase.co/functions/v1/telegram-bot`
- **Health Check Server Lokal**: Buka browser di PC kantor ke `http://localhost:8787/health`
