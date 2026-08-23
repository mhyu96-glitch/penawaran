# Setup Environment Variables di Cloudflare Pages

## Langkah-langkah:

1. **Buka Cloudflare Pages Dashboard**
   - Login ke https://dash.cloudflare.com/
   - Pilih project "penawaran"

2. **Konfigurasi Environment Variables**
   - Klik tab "Settings"
   - Scroll ke bagian "Environment variables"
   - Klik "Add variable"

3. **Tambahkan Variables Berikut:**

   **Variable 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://xukpisovkcflcwuhrzkx.supabase.co`
   - Environment: Production

   **Variable 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`  
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0`
   - Environment: Production

4. **Save & Redeploy**
   - Klik "Save"
   - Trigger deployment baru (atau tunggu auto-deploy dari Git push berikutnya)

## Alternatif: Buat file `_headers` untuk debugging

Jika environment variables tidak terbaca, kita akan hardcode sementara untuk memastikan aplikasi berfungsi.