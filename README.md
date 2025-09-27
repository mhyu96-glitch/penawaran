# QuoteApp - Aplikasi Manajemen Penawaran & Faktur

QuoteApp adalah aplikasi web yang dirancang untuk membantu para freelancer dan bisnis kecil mengelola penawaran, faktur, klien, dan pengeluaran mereka dengan mudah. Dibangun dengan tumpukan teknologi modern, aplikasi ini menyediakan alur kerja yang mulus dari pembuatan penawaran hingga pelacakan pembayaran.

## Fitur Utama

- **Manajemen Penawaran:** Buat, edit, dan lacak status penawaran profesional.
- **Manajemen Faktur:** Hasilkan faktur dari penawaran yang diterima atau buat faktur baru dari awal.
- **Portal Klien:** Berikan klien Anda akses ke portal khusus untuk melihat semua riwayat dokumen mereka.
- **Pelacakan Pembayaran:** Catat pembayaran yang diterima dan pantau sisa tagihan untuk setiap faktur.
- **Pustaka Item:** Simpan barang dan jasa yang sering digunakan untuk mempercepat pembuatan dokumen.
- **Manajemen Klien:** Kelola semua informasi kontak klien Anda di satu tempat.
- **Pelacakan Pengeluaran:** Catat pengeluaran bisnis untuk mendapatkan gambaran keuangan yang lebih jelas.
- **Laporan:** Dapatkan wawasan tentang kinerja bisnis Anda dengan laporan keuangan dan profitabilitas.
- **Notifikasi Real-time:** Dapatkan pemberitahuan saat klien menerima penawaran atau mengirimkan bukti pembayaran.

## Tumpukan Teknologi

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Komponen UI:** shadcn/ui
- **Backend & Database:** Supabase (Auth, Postgres, Storage, Edge Functions)
- **Routing:** React Router

## Menjalankan Proyek Secara Lokal

Untuk menjalankan proyek ini di lingkungan pengembangan Anda, ikuti langkah-langkah berikut:

1.  **Clone Repositori**
    ```bash
    git clone https://github.com/NAMA_PENGGUNA_ANDA/NAMA_REPOSITORI_ANDA.git
    cd NAMA_REPOSITORI_ANDA
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Siapkan Environment Variables**
    - Buat salinan dari file `.env.example` dan beri nama `.env`.
    - Buka file `.env` yang baru dibuat dan isi dengan kredensial proyek Supabase Anda. Anda bisa menemukannya di dasbor proyek Supabase Anda di bawah "Project Settings" > "API".

      ```env
      VITE_SUPABASE_URL="URL_PROYEK_SUPABASE_ANDA"
      VITE_SUPABASE_ANON_KEY="KUNCI_ANON_SUPABASE_ANDA"
      ```

4.  **Jalankan Aplikasi**
    ```bash
    npm run dev
    ```
    Aplikasi sekarang akan berjalan di `http://localhost:8080`.

---

Dibuat dengan [Dyad](https://www.dyad.sh).