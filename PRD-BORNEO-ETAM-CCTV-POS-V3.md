# Product Requirements Document (PRD) & Workflow
## Proyek: Borneo Etam CCTV & POS Command Center + Sistem Penawaran & Portofolio Kaltim
**Wilayah Operasional Utama:** Kalimantan Timur (Samarinda, Balikpapan, Kukar/Tenggarong, Bontang, Kutim/Sangatta, PPU/IKN, Paser, Kubar)  
**Versi Dokumen:** 3.0 (Production-Ready Architecture)  
**Status:** Implemented & Integrated  

---

## 1. Pendahuluan & Latar Belakang Masalah

### 1.1 Konteks Bisnis
Borneo Etam CCTV adalah unit usaha instalasi sistem keamanan (CCTV IP & Analog) dan sistem otomasi kasir (*Point of Sale* / POS) di Kalimantan Timur.

### 1.2 Tujuan Produk (Product Goals)
Membangun platform terpadu (*All-in-One Command Center*) di dalam ekosistem `penawaran` yang menggabungkan:
* **Sistem Penawaran Resmi (Quotation Generator):** Mempercepat pembuatan dan pencetakan dokumen penawaran harga A4 (`QUO/BE-CCTV/...`) serta kirim instan ke WhatsApp dengan format ringkas anti-terpotong.
* **Peta Geospasial Interaktif (GIS Mapping):** Memvisualisasikan persebaran titik proyek se-Kalimantan Timur dengan status progres (*Traffic Light System*).
* **Dual-Mode Experience & Privasi Klien:** Memisahkan mode **Admin Operasional** (`/cctv-command`) dengan mode **Portofolio Publik** (`/portfolio`) yang menyamarkan koordinat presisi (fuzzy offset 250–450m) dan menyembunyikan nomor telepon serta detail rumah klien.
* **Mesin Penjaring Prospek (Lead Magnet Survei):** Menyediakan formulir pengajuan jadwal survei gratis dengan tombol deteksi GPS otomatis (`🎯 Ambil Lokasi Saya Sekarang`) untuk calon pelanggan baru.
* **Manajemen Garansi Digital 12 Bulan & Serial Number:** Melacak otomatis hitung mundur masa aktif garansi unit (`🟢 Aktif`, `🟡 Peringatan H-30`, `⚪ Habis`) beserta pencatatan `SN NVR` dan `SN Harddisk`.

---

## 2. Daftar Modul & Route yang Telah Diimplementasikan

| Modul | Lokasi File / Route | Deskripsi Fitur |
|---|---|---|
| **GIS Command Center Admin** | `/cctv-command` (`src/pages/CCTVCommandCenter.tsx`) | Peta interaktif Kaltim (Satelit HD, Jalanan, Dark GIS), Two-Tier Anti-Overlap Header, 4 Bento KPI Cards, Inspector Progres (0-100%), Input SN NVR & HDD, Countdown Garansi 12 Bulan, & Ekspor CSV. |
| **Portofolio Publik & Lead Magnet** | `/portfolio` (`src/pages/PublicPortfolioMap.tsx`) | Halaman publik tanpa login, peta dengan koordinat tersensor (fuzzy GPS), katalog 4 Paket Resmi Borneo Etam, testimoni bintang 5, dan form Minta Jadwal Survei Gratis + Auto-GPS. |
| **Preset Paket Cepat Penawaran** | `/quote/new` (`src/components/DocumentGenerator.tsx`) | 4 tombol preset paket resmi Borneo Etam (Paket 4 CCTV HD Rp 3.5 Jt, Paket 8 IP Cam PoE Rp 7.8 Jt, Paket Kasir POS Rp 4.9 Jt, Paket Bundling Toko Rp 8.2 Jt) + penomoran `QUO/BE-CCTV/...`. |
| **Import Katalog Standar 1-Klik** | `/items` (`src/pages/ItemList.tsx`) | Tombol *"Muat Katalog CCTV & POS"* untuk menambahkan 15 item standar kamera, NVR, HDD WD Purple, kabel, pipa conduit, dan perangkat POS tanpa mengganggu item lama. |
| **WhatsApp Ringkas & Elegan** | `src/components/SendDocumentDialog.tsx` | Format pesan WhatsApp resmi Borneo Etam (No. Dokumen, Perihal, Total Investasi, Garansi 12 Bulan & Link Publik). |
| **Skema Database Non-Destruktif** | `supabase/migrations/20261106000000_cctv_pos_command_center.sql` | Tabel ekstensi `cctv_installations` dengan kebijakan RLS ketat без mengubah/menghapus tabel `quotes`, `invoices`, `clients`, atau `items` yang sudah ada. |

