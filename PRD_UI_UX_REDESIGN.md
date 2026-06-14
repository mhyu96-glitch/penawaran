# PRD UI/UX Redesign QuoteApp

## 1. Ringkasan

QuoteApp adalah aplikasi manajemen penawaran, faktur, klien, pembayaran, proyek, pengeluaran, laporan, dan portal klien. Redesign ini bertujuan merapikan pengalaman pengguna tanpa menghapus data existing di folder proyek maupun di Supabase.

Prinsip utama: perubahan hanya pada tampilan, alur interaksi, dan struktur navigasi frontend. Data, schema, file dokumen, storage, edge functions, serta record Supabase yang sudah ada harus tetap aman.

## 2. Tujuan Produk

- Membuat aplikasi terasa lebih profesional, rapi, cepat dipakai, dan mudah dipahami.
- Mempercepat workflow utama: buat penawaran, ubah penawaran menjadi invoice, catat pembayaran, dan pantau status.
- Mengurangi kebingungan pada halaman yang padat data seperti dashboard, daftar penawaran, invoice, klien, proyek, dan laporan.
- Memastikan UI mobile nyaman untuk operasional lapangan.
- Menjaga kompatibilitas penuh dengan data existing di Supabase.

## 3. Non-Goals

- Tidak menghapus file apa pun di folder proyek, termasuk PDF, gambar, `dist`, `public`, dan folder lain.
- Tidak menghapus, truncate, reset, atau overwrite data Supabase.
- Tidak mengganti project Supabase, URL, anon key, table, bucket, RLS, atau edge function tanpa rencana migrasi tertulis.
- Tidak melakukan refactor backend besar kecuali benar-benar diperlukan untuk mendukung tampilan.
- Tidak mengubah nomor dokumen, status transaksi, histori pembayaran, attachment, atau data klien existing.

## 4. Aturan Proteksi Data

### 4.1 File Lokal

- Semua file existing di root, `src`, `public`, `supabase`, dan folder lain harus dipertahankan.
- File baru boleh ditambahkan untuk redesign, tetapi file lama hanya boleh diubah jika diperlukan untuk UI.
- Dilarang menjalankan perintah destructive seperti `rm`, `Remove-Item`, `git reset --hard`, atau cleanup massal tanpa persetujuan eksplisit.
- Sebelum perubahan besar, cek `git status` dan pastikan perubahan unrelated tidak disentuh.

### 4.2 Supabase

- Dilarang menjalankan query `DELETE`, `TRUNCATE`, `DROP`, destructive migration, atau reset database.
- Jika perlu migration, wajib bersifat additive: tambah kolom/table/index/policy tanpa merusak data lama.
- Jika ada perubahan schema, wajib ada backup/export dan rollback plan.
- Gunakan query read-only untuk audit data sebelum mengubah UI yang bergantung pada struktur data.
- Public routes seperti `/quote/public/:id`, `/invoice/public/:id`, dan `/portal/:accessKey` harus tetap kompatibel.

### 4.3 Storage dan Dokumen

- Attachment, PDF penawaran, PDF faktur, bukti pembayaran, tanda tangan, dan file pendukung tidak boleh dihapus.
- Redesign preview/download dokumen harus memakai file/link existing.
- Jika menambah tampilan attachment, gunakan referensi data yang sudah ada.

## 5. Pengguna Utama

- Admin/pemilik usaha: memantau bisnis, membuat dokumen, melihat laporan, mengatur data master.
- Staf operasional: membuat penawaran/invoice, update status, input pembayaran dan pengeluaran.
- Klien: membuka penawaran/faktur publik, menyetujui penawaran, mengirim bukti pembayaran, melihat portal klien.

## 6. Workflow Prioritas

1. Login ke aplikasi.
2. Melihat dashboard ringkas.
3. Membuat penawaran baru dari data klien dan item.
4. Mengirim atau membagikan penawaran publik.
5. Mengubah penawaran accepted menjadi invoice.
6. Mencatat pembayaran dan melihat sisa tagihan.
7. Melihat histori klien dan dokumen terkait.
8. Melihat laporan penjualan, profit/loss, expense, dan profitability.
9. Mengelola proyek, tugas, waktu, dan biaya.
10. Klien membuka portal atau link publik untuk melihat dokumen.

## 7. Scope Halaman

### 7.1 Dashboard

- Tampilkan ringkasan utama: total penawaran, invoice unpaid/overdue, pembayaran masuk, expense, profit.
- Berikan quick action: buat penawaran, buat invoice, tambah klien, tambah expense.
- Tampilkan aktivitas terbaru dan dokumen yang perlu tindakan.
- Visual harus padat, scan-friendly, dan tidak seperti landing page.

### 7.2 Penawaran

- Daftar penawaran harus mudah difilter berdasarkan status, klien, tanggal, dan nilai.
- Detail penawaran harus menonjolkan status, total, client info, item, attachment, dan action utama.
- Generator penawaran harus memudahkan pilih klien, tambah item dari library, diskon/pajak, preview, dan simpan draft.
- Status existing tidak boleh berubah karena redraw UI.

### 7.3 Faktur

- Daftar invoice harus menonjolkan status paid, partial, unpaid, overdue.
- Detail invoice harus jelas untuk total, pembayaran, sisa tagihan, due date, dan riwayat pembayaran.
- Payment form harus tetap kompatibel dengan Midtrans dan pembayaran manual.
- Public invoice view harus tetap ringan dan mudah dibuka klien.

### 7.4 Klien

- Client list harus mudah dicari dan difilter.
- Client detail harus menjadi pusat histori: penawaran, faktur, pembayaran, proyek, attachment, dan catatan.
- Portal klien harus mempertahankan `accessKey` lama.

### 7.5 Item Library

- Item/jasa harus mudah dicari, ditambah, diedit, dan dipakai ulang.
- Jangan mengubah struktur harga existing secara otomatis.

### 7.6 Expense dan Laporan

- Expense list harus mudah input cepat dan filter kategori/tanggal.
- Reports harus menampilkan insight yang mudah dibaca, bukan sekadar tabel.
- Profit/loss dan profitability report harus menjaga formula existing kecuali ada requirement baru.

### 7.7 Proyek

- Project list dan detail harus mendukung status proyek, task, time tracker, expense, dan profit.
- Kanban/task list harus nyaman untuk update progres.

### 7.8 Settings dan Profile

- Settings harus memisahkan pengaturan bisnis, dokumen, template, pajak, notifikasi, dan integrasi.
- Profile harus fokus pada informasi user/account.

## 8. Prinsip UX

- UI bersifat operational dashboard: rapi, dense, mudah discan, bukan marketing page.
- Navigasi utama harus konsisten di desktop dan mobile.
- Action primer selalu jelas: buat, simpan, kirim, download, catat pembayaran.
- Gunakan icon dari `lucide-react` untuk tombol aksi.
- Gunakan komponen existing shadcn/ui dan Tailwind CSS.
- Hindari perubahan layout yang menyebabkan teks terpotong di mobile.
- Setiap form harus punya loading state, empty state, error state, dan success feedback.
- Tabel harus mendukung pencarian/filter/sort bila datanya banyak.

## 9. Prinsip UI

- Gunakan radius kecil sampai sedang, maksimal mengikuti pola shadcn existing.
- Warna harus profesional dan tidak terlalu didominasi satu hue.
- Status harus punya warna konsisten:
  - Draft/neutral: abu-abu
  - Sent/pending: biru
  - Accepted/paid/success: hijau
  - Partial/warning: amber
  - Rejected/overdue/error: merah
- Komponen kartu hanya untuk item berulang, ringkasan metrik, atau panel yang memang perlu framing.
- Hindari nested card.
- Typography harus proporsional: heading besar hanya untuk area utama, bukan panel kecil.

## 10. Kebutuhan Teknis

- Stack tetap: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router, Supabase.
- Routes tetap dikelola di `src/App.tsx`.
- Pages tetap di `src/pages`.
- Components baru di `src/components`.
- Jangan edit komponen dasar `src/components/ui` kecuali sangat diperlukan.
- Query Supabase harus tetap memakai client di `src/integrations/supabase/client.ts`.
- Public route dan protected route harus tetap berfungsi.

## 11. Data Contract yang Harus Dipertahankan

- ID dokumen existing tetap menjadi referensi utama.
- Nomor quote/invoice existing tidak diubah otomatis.
- Relasi klien, item, payment, expense, project, dan attachment tidak diputus.
- Field status existing harus tetap terbaca oleh UI baru.
- Link public dokumen existing harus tetap valid.
- Edge functions existing tetap dipakai:
  - `create-midtrans-transaction`
  - `get-public-invoice-details`
  - `global-search`
  - `handle-client-action`
  - `invoice-overdue-check`
  - `midtrans-webhook`
  - `process-scheduled-reports`
  - `quote-expiry-check`
  - `send-document-email`
  - `submit-payment`
  - `update-quote-status`

## 12. Acceptance Criteria

- Semua halaman existing tetap bisa diakses sesuai route saat ini.
- Login dan protected route tetap berjalan.
- Data existing dari Supabase tampil di UI baru tanpa perlu input ulang.
- Public quote, public invoice, dan portal klien tetap bisa dibuka.
- Pengguna bisa membuat, melihat, mengedit, dan memproses quote/invoice tanpa kehilangan data.
- Payment, expense, client, item, project, dan reports tetap bekerja.
- Tidak ada file existing yang terhapus selama redesign.
- Tidak ada query destructive ke Supabase selama redesign.
- Build berhasil dengan `npm run build`.
- UI lolos pengecekan desktop dan mobile untuk halaman utama.

## 13. Rencana Implementasi Bertahap

### Phase 1: Audit dan Design Foundation

- Audit route, data flow, komponen shared, dan halaman prioritas.
- Buat design token ringan untuk warna, spacing, status, typography, dan layout.
- Rapikan `SharedLayout` sebagai dasar navigasi.
- Pastikan tidak ada perubahan data.

### Phase 2: Core Workflow

- Redesign dashboard.
- Redesign quote list, quote generator, dan quote detail.
- Redesign invoice list, invoice detail, dan payment flow.
- Validasi semua action utama dengan data existing.

### Phase 3: Supporting Workflow

- Redesign clients, client detail, items, expenses, reports, projects, automation, settings, profile.
- Tambahkan empty/loading/error state yang konsisten.
- Perbaiki mobile experience.

### Phase 4: Public Experience

- Redesign public quote view.
- Redesign public invoice view.
- Redesign client portal.
- Pastikan link lama tetap berjalan.

### Phase 5: QA dan Stabilization

- Jalankan build dan lint.
- Test manual workflow utama.
- Cek responsive desktop/mobile.
- Cek tidak ada data Supabase yang berubah tanpa action user.
- Dokumentasikan perubahan dan risiko tersisa.

## 14. Risiko dan Mitigasi

- Risiko: UI baru salah membaca status lama.
  - Mitigasi: mapping status harus diaudit dari data existing dan diberi fallback.

- Risiko: form baru overwrite field yang tidak terlihat.
  - Mitigasi: update payload hanya field yang diedit, bukan seluruh record tanpa merge.

- Risiko: public link rusak.
  - Mitigasi: jangan ubah route public dan tetap gunakan parameter existing.

- Risiko: migration merusak data.
  - Mitigasi: hindari migration destructive; jika perlu, buat additive migration dengan backup.

- Risiko: tampilan mobile sulit dipakai.
  - Mitigasi: test viewport mobile untuk dashboard, list, detail, dan form panjang.

## 15. Checklist Sebelum Mulai Coding Redesign

- [ ] Backup/export Supabase jika akan menyentuh schema atau migration.
- [ ] Cek `git status`.
- [ ] Catat file yang akan diubah.
- [ ] Jangan hapus file PDF/gambar/document existing.
- [ ] Jangan hapus folder `supabase`.
- [ ] Jangan jalankan query destructive.
- [ ] Pastikan perubahan pertama fokus pada layout/component, bukan data.

## 16. Definition of Done

Redesign dianggap selesai ketika UI baru sudah mencakup workflow utama, data existing aman, seluruh route penting berjalan, build berhasil, dan pengguna bisa menjalankan proses bisnis dari quote sampai invoice dan pembayaran tanpa kehilangan data lama.
