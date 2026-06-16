# PRD: Redesign UI/UX QuoteApp dengan Standar Impeccable

## 1. Ringkasan

QuoteApp akan dirombak total dari sisi UI/UX menjadi aplikasi manajemen penawaran, faktur, klien, proyek, pengeluaran, dan laporan yang terasa modern, rapi, cepat, dan profesional. Target redesign ini bukan sekadar mengganti warna atau komponen, tetapi membangun pengalaman kerja yang lebih jelas, lebih efisien, dan lebih meyakinkan untuk freelancer serta bisnis kecil.

Standar desain yang digunakan adalah **Impeccable UI/UX**: antarmuka harus presisi, konsisten, ringan dipakai harian, mudah dipahami tanpa banyak instruksi, dan terasa premium tanpa mengorbankan produktivitas.

## 2. Latar Belakang

Versi saat ini sudah memiliki fitur yang luas, termasuk:

- Dashboard
- Penawaran
- Faktur
- Faktur berulang
- Portal klien
- Manajemen klien
- Barang dan jasa
- Proyek
- Kalender
- Pengeluaran
- Laporan
- Otomatisasi
- Pencarian global
- Notifikasi
- Profil dan pengaturan

Karena cakupan fitur sudah besar, UI/UX perlu dirapikan agar pengguna tidak merasa aplikasinya padat, terpisah-pisah, atau sulit dipahami. Redesign harus menyatukan seluruh modul menjadi pengalaman produk yang koheren.

## 3. Tujuan Produk

1. Membuat QuoteApp terasa seperti aplikasi bisnis profesional yang siap dipakai harian.
2. Mempercepat workflow utama: membuat penawaran, mengubah penawaran menjadi faktur, mencatat pembayaran, dan memantau performa bisnis.
3. Mengurangi kebingungan navigasi antar modul.
4. Menjadikan data penting mudah dipindai dalam 5 detik pertama.
5. Meningkatkan kepercayaan pengguna dan klien melalui tampilan dokumen publik yang lebih premium.
6. Menyediakan fondasi design system yang konsisten untuk pengembangan fitur berikutnya.

## 4. Non-Goals

- Tidak mengubah model bisnis aplikasi.
- Tidak mengganti stack utama React, Vite, TypeScript, Tailwind CSS, shadcn/ui, dan Supabase.
- Tidak melakukan redesign sebagai landing page marketing saja.
- Tidak menghapus fitur besar yang sudah ada tanpa keputusan produk terpisah.
- Tidak membuat visual yang dekoratif berlebihan sampai mengganggu fungsi aplikasi bisnis.

## 5. Persona Pengguna

### Freelancer

Membutuhkan cara cepat membuat penawaran dan faktur yang terlihat profesional, melacak pembayaran, serta melihat pemasukan dan pengeluaran.

### Pemilik Bisnis Kecil

Mengelola banyak klien, proyek, dokumen, invoice, tim kecil, dan laporan keuangan sederhana.

### Klien

Menerima tautan penawaran atau faktur, melihat detail dokumen, menyetujui penawaran, dan mengirim bukti pembayaran dengan mudah.

## 6. Prinsip Impeccable UI/UX

### Clear Before Clever

Setiap layar harus langsung menjawab: pengguna sedang berada di mana, apa status datanya, dan tindakan utama apa yang bisa dilakukan.

### Work-Focused, Not Decorative

Tampilan harus rapi, tenang, dan produktif. Elemen visual digunakan untuk membantu scanning, prioritas, dan rasa profesional.

### Consistent Interaction Language

Pola tombol, tabel, filter, dialog, form, empty state, dan badge status harus konsisten di seluruh aplikasi.

### Fast Path for Repeated Work

Workflow yang sering dipakai harus bisa dicapai dengan sedikit klik, terutama buat penawaran, buat faktur, tambah klien, tambah item, dan catat pembayaran.

### Mobile Is Operational

Versi mobile bukan hanya responsif, tetapi nyaman untuk melihat status, mencari data, membuat aksi cepat, dan membuka dokumen klien.

## 7. Information Architecture

Navigasi utama disederhanakan menjadi:

- Dashboard
- Dokumen
- Klien
- Proyek
- Keuangan
- Laporan
- Otomatisasi
- Pengaturan

Rincian:

- Dokumen berisi Penawaran, Faktur, dan Faktur Berulang.
- Keuangan berisi Pembayaran, Pengeluaran, dan ringkasan arus kas.
- Laporan berisi laporan keuangan, profitabilitas, laba rugi, dan pengeluaran.
- Proyek berisi daftar proyek, detail proyek, tugas, waktu, dan kalender.

## 8. Scope Redesign

### 8.1 Layout Aplikasi

Kebutuhan:

- Ganti layout header-heavy menjadi layout aplikasi yang lebih stabil.
- Desktop menggunakan sidebar atau rail navigation yang jelas.
- Topbar digunakan untuk pencarian global, aksi cepat, notifikasi, dan akun.
- Mobile menggunakan bottom navigation atau drawer yang lebih ergonomis.
- Area konten memiliki spacing konsisten dan hierarki yang kuat.

Acceptance criteria:

- Pengguna bisa mencapai modul utama maksimal dalam 2 klik.
- Navigasi aktif terlihat jelas.
- Pencarian global tetap mudah dijangkau.
- Tidak ada elemen navigasi yang terasa penuh atau saling berebut perhatian.

### 8.2 Dashboard

Kebutuhan:

- Tampilkan ringkasan bisnis utama: total penawaran aktif, faktur belum dibayar, pendapatan bulan ini, pengeluaran bulan ini, dan profit estimasi.
- Tampilkan daftar aktivitas terbaru.
- Tampilkan dokumen yang butuh perhatian: overdue, draft lama, penawaran menunggu persetujuan, pembayaran menunggu verifikasi.
- Berikan quick actions untuk membuat penawaran, faktur, klien, item, dan pengeluaran.

Acceptance criteria:

- Dalam 5 detik, pengguna memahami kondisi bisnisnya.
- Dashboard tidak dipenuhi kartu dekoratif yang tidak actionable.
- Data penting memiliki status, angka, dan konteks pembanding.

### 8.3 Penawaran

Kebutuhan:

- List penawaran harus mendukung search, filter status, filter tanggal, sort, dan aksi cepat.
- Detail penawaran harus menampilkan status, nilai, klien, timeline, item, lampiran, dan aksi utama.
- Generator penawaran dibuat seperti workflow bertahap: detail klien, item, biaya, catatan, preview, kirim.
- Status penawaran dibuat konsisten: draft, terkirim, dilihat, diterima, ditolak, kedaluwarsa.

Acceptance criteria:

- Pengguna bisa membuat penawaran profesional tanpa berpindah konteks berlebihan.
- Preview dokumen terlihat dekat dengan hasil akhir.
- Aksi penting seperti kirim, duplikasi, konversi ke faktur, dan download mudah ditemukan.

### 8.4 Faktur

Kebutuhan:

- List faktur menonjolkan status pembayaran.
- Detail faktur menampilkan jumlah total, sudah dibayar, sisa tagihan, tanggal jatuh tempo, timeline pembayaran, dan bukti pembayaran.
- Form faktur dapat dibuat dari nol atau dari penawaran diterima.
- Faktur berulang memiliki pengalaman setup yang jelas: frekuensi, tanggal mulai, tanggal selesai, dan template.

Acceptance criteria:

- Pengguna bisa membedakan faktur lunas, sebagian dibayar, overdue, draft, dan terkirim dengan cepat.
- Aksi catat pembayaran dan kirim reminder mudah dijangkau.
- Tidak ada status pembayaran yang ambigu.

### 8.5 Klien

Kebutuhan:

- List klien menampilkan nama, kontak utama, total nilai dokumen, outstanding invoice, dan aktivitas terakhir.
- Detail klien menjadi hub untuk profil, dokumen, proyek, pembayaran, dan portal.
- Form klien sederhana, tetapi mendukung informasi bisnis penting.

Acceptance criteria:

- Pengguna bisa melihat hubungan bisnis dengan satu klien dalam satu halaman.
- Riwayat dokumen dan pembayaran mudah dipindai.
- Portal klien bisa diakses atau dibagikan dari detail klien.

### 8.6 Proyek dan Kalender

Kebutuhan:

- List proyek menampilkan status, progres, deadline, klien, nilai, dan profitabilitas.
- Detail proyek menggabungkan tugas, timeline, waktu kerja, dokumen terkait, dan biaya.
- Kalender mendukung tampilan agenda kerja, deadline penawaran, jatuh tempo faktur, dan jadwal proyek.

Acceptance criteria:

- Pengguna memahami prioritas proyek yang harus dikerjakan.
- Tugas dan waktu kerja tidak terasa terpisah dari nilai bisnis proyek.
- Kalender membantu operasional, bukan hanya tampilan tanggal.

### 8.7 Pengeluaran dan Keuangan

Kebutuhan:

- Pengeluaran bisa dicatat cepat dengan kategori, tanggal, nominal, vendor, catatan, dan lampiran.
- List pengeluaran mendukung filter kategori dan periode.
- Ringkasan keuangan menampilkan pemasukan, pengeluaran, profit, overdue, dan pembayaran masuk.

Acceptance criteria:

- Pengguna bisa mencatat pengeluaran dalam waktu singkat.
- Pengeluaran dapat dikaitkan ke proyek bila relevan.
- Angka keuangan konsisten dengan laporan.

### 8.8 Laporan

Kebutuhan:

- Laporan memiliki landing internal yang menjelaskan pilihan laporan melalui data preview, bukan teks panjang.
- Setiap laporan menyediakan filter periode, export, dan visualisasi ringkas.
- Grafik harus membantu keputusan, bukan memenuhi layar.

Acceptance criteria:

- Pengguna bisa memilih laporan yang tepat tanpa bingung.
- Angka utama selalu disertai konteks periode.
- Export laporan tetap tersedia.

### 8.9 Portal Klien dan Public View

Kebutuhan:

- Tampilan public quote dan invoice harus terasa premium, bersih, dan terpercaya.
- Klien dapat melihat item, total, status, catatan, lampiran, serta aksi persetujuan atau pembayaran.
- Portal klien menampilkan riwayat dokumen dan status pembayaran secara jelas.

Acceptance criteria:

- Klien memahami apa yang harus dilakukan tanpa akun atau penjelasan tambahan.
- Tampilan mobile public view sangat rapi.
- CTA utama tidak tenggelam oleh detail dokumen.

## 9. Design System

### Warna

Gunakan palet yang profesional dan kontras:

- Primary: warna brand untuk CTA utama dan navigasi aktif.
- Neutral: latar, border, teks, dan permukaan data.
- Success: diterima, lunas, berhasil.
- Warning: menunggu, jatuh tempo dekat.
- Danger: overdue, gagal, ditolak.
- Info: draft, dilihat, otomatisasi.

Hindari tampilan yang terlalu didominasi satu warna. Aplikasi harus terasa bisnis, bukan template generik.

### Tipografi

- Heading ringkas dan informatif.
- Body text mudah dibaca.
- Angka keuangan memakai alignment dan ukuran yang konsisten.
- Label form jelas, tanpa copy yang bertele-tele.

### Komponen

Komponen wajib distandarkan:

- App shell
- Sidebar
- Topbar
- Page header
- Data table
- Filter bar
- Status badge
- Empty state
- Loading skeleton
- Error state
- Form section
- Dialog
- Drawer mobile
- Document preview
- KPI card
- Timeline
- Activity feed
- Quick action button

### Spacing dan Radius

- Gunakan spacing konsisten berbasis token.
- Card untuk item berulang atau panel data, bukan untuk membungkus semua section.
- Radius maksimal 8px kecuali komponen existing membutuhkan lain.
- Border dan shadow digunakan halus, tidak berlebihan.

## 10. UX Writing

Prinsip:

- Singkat.
- Spesifik.
- Berorientasi aksi.
- Bahasa Indonesia natural dan profesional.

Contoh:

- "Buat Penawaran"
- "Catat Pembayaran"
- "Kirim ke Klien"
- "Konversi ke Faktur"
- "Belum ada faktur untuk klien ini"
- "Pembayaran menunggu verifikasi"

## 11. Responsiveness

Breakpoint minimal:

- Mobile: 360px sampai 767px
- Tablet: 768px sampai 1023px
- Desktop: 1024px ke atas
- Wide desktop: 1440px ke atas

Kebutuhan:

- Tabel berubah menjadi list/card operasional di mobile bila kolom terlalu banyak.
- Aksi utama selalu terlihat atau mudah dijangkau.
- Form panjang dapat dibagi menjadi section atau step.
- Public document view harus nyaman dibaca di mobile.

## 12. Accessibility

Kebutuhan:

- Semua tombol icon memiliki label aksesibel.
- Kontras teks memenuhi standar WCAG AA.
- Fokus keyboard terlihat jelas.
- Dialog dan drawer dapat digunakan via keyboard.
- Status tidak hanya bergantung pada warna.
- Form error jelas dan dekat dengan field terkait.

## 13. Performance

Target:

- UI terasa responsif saat membuka list dan detail.
- Loading menggunakan skeleton yang sesuai konten.
- Hindari render ulang besar pada tabel dan form panjang.
- Chart dan komponen berat dimuat hanya saat diperlukan.

Acceptance criteria:

- Build production berhasil.
- Tidak ada layar blank saat data loading.
- State kosong, error, dan loading tersedia di modul utama.

## 14. Data dan Integrasi

Tetap gunakan Supabase untuk:

- Auth
- Database
- Storage lampiran dan bukti pembayaran
- Realtime notification bila sudah tersedia
- Edge functions bila diperlukan

Redesign tidak boleh memutus kompatibilitas data existing tanpa migrasi yang jelas.

## 15. Prioritas Implementasi

### Phase 1: Foundation

- Audit UI existing
- Finalisasi design tokens
- App shell baru
- Navigasi desktop dan mobile
- Page header pattern
- Table, filter, badge, empty state, dan loading state

### Phase 2: Core Workflow

- Dashboard
- Penawaran list, detail, generator, public quote
- Faktur list, detail, generator, public invoice
- Klien list dan detail

### Phase 3: Business Operations

- Proyek
- Kalender
- Pengeluaran
- Laporan
- Faktur berulang
- Otomatisasi

### Phase 4: Polish

- Micro-interaction
- Accessibility pass
- Mobile refinement
- Visual QA
- Performance pass
- Copywriting pass

## 16. Success Metrics

Product metrics:

- Waktu membuat penawaran baru berkurang.
- Waktu mencatat pembayaran berkurang.
- Pengguna lebih sering memakai dashboard dan pencarian global.
- Lebih sedikit dokumen draft yang tertinggal.
- Lebih banyak penawaran dikonversi menjadi faktur.

Quality metrics:

- Tidak ada regression pada workflow utama.
- Build dan lint berhasil.
- UI konsisten di semua modul utama.
- Mobile tidak memiliki overflow horizontal.
- Public quote dan invoice dapat dibaca nyaman tanpa login.

## 17. Risiko

- Redesign terlalu visual tetapi tidak memperbaiki workflow.
- Komponen baru tidak konsisten dengan data dan state existing.
- Scope melebar karena semua modul ingin diperbaiki sekaligus.
- Form generator penawaran dan faktur menjadi terlalu kompleks.
- Mobile table/list tidak dirancang sejak awal.

Mitigasi:

- Mulai dari design system dan app shell.
- Prioritaskan workflow utama sebelum polish visual.
- Setiap modul harus punya acceptance criteria.
- QA dilakukan per breakpoint.
- Hindari perubahan data model kecuali benar-benar dibutuhkan.

## 18. Definition of Done

Redesign dianggap selesai jika:

- Semua halaman utama menggunakan app shell dan design system baru.
- Workflow penawaran ke faktur berjalan lancar.
- Status dokumen dan pembayaran konsisten di seluruh aplikasi.
- Public quote, public invoice, dan portal klien tampil premium dan jelas.
- Desktop, tablet, dan mobile sudah diverifikasi.
- Build production berhasil.
- Tidak ada error visual besar seperti overlap, overflow, atau text clipping.
- Komponen reusable terdokumentasi secara cukup untuk pengembangan berikutnya.

