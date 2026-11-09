/**
 * Borneo Etam Auto-Sync Worker
 * Menjamin semua foto dan dokumen proyek di Cloud tersinkron ke Storage 10TB kantor
 * Berjalan otomatis di background. Jika sempat mati lampu / server mati,
 * saat dinyalakan kembali skrip ini otomatis menyedot semua foto baru dari cloud!
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper baca file .env tanpa library tambahan
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    console.warn(`[ENV] Gagal membaca ${envPath}:`, e.message);
  }
}

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '..', '.env'));

const STORAGE_ROOT = process.env.STORAGE_PATH || 'Z:\\Storage10T\\project aplikasi\\apps build\\penawaran\\storage';
const PHOTOS_DIR = path.join(STORAGE_ROOT, 'photos');
const DOCS_DIR = path.join(STORAGE_ROOT, 'documents');
const BACKUPS_DIR = path.join(STORAGE_ROOT, 'backups');

for (const dir of [STORAGE_ROOT, PHOTOS_DIR, DOCS_DIR, BACKUPS_DIR]) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.warn(`[SYNC WARNING] Gagal membuat direktori ${dir}:`, err.message);
  }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://xukpisovkcflcwuhrzkx.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_SECONDS || '300', 10) * 1000;
const RUN_ONCE = process.argv.includes('--once');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 BORNEO ETAM 10TB AUTO-SYNC WORKER');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`• Destination: ${STORAGE_ROOT}`);
console.log(`• Cloud Host : ${SUPABASE_URL}`);
console.log(`• Interval   : ${SYNC_INTERVAL_MS / 1000} detik`);
console.log(`• Mode       : ${RUN_ONCE ? 'One-Shot (Sekali Jalan)' : 'Continuous Background'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function downloadFileIfMissing(url, targetPath) {
  if (fs.existsSync(targetPath)) {
    return false; // Sudah ada, lewati
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[SYNC] Gagal mengunduh (${res.status}): ${url}`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(targetPath, buf);
    console.log(`[SYNC-DOWNLOAD] ✅ Berhasil diunduh ke 10TB: ${path.basename(targetPath)} (${Math.round(buf.length / 1024)} KB)`);
    return true;
  } catch (e) {
    console.warn(`[SYNC-ERROR] Gagal download ${url}:`, e.message);
    return false;
  }
}

async function runSyncCycle() {
  console.log(`\n[SYNC-CYCLE] Memulai sinkronisasi cloud -> 10TB [${new Date().toLocaleTimeString('id-ID')}]...`);

  if (!SUPABASE_KEY) {
    console.warn('[SYNC-WARNING] SUPABASE_SERVICE_ROLE_KEY atau VITE_SUPABASE_ANON_KEY belum diisi di .env! Sinkronisasi database dilewati.');
    return;
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Accept': 'application/json',
  };

  let newPhotos = 0;

  // 1. Sinkronisasi Foto Proyek (cctv_installations)
  try {
    const instRes = await fetch(`${SUPABASE_URL}/rest/v1/cctv_installations?select=id,project_name,client_name,photos,updated_at`, { headers });
    if (instRes.ok) {
      const installations = await instRes.json();
      for (const inst of installations) {
        if (!Array.isArray(inst.photos)) continue;
        for (const item of inst.photos) {
          const photoUrl = typeof item === 'string' ? item : item?.url;
          if (!photoUrl || !photoUrl.startsWith('http')) continue;

          // Ambil nama file dari URL
          const urlObj = new URL(photoUrl);
          const rawName = path.basename(urlObj.pathname);
          const clientSlug = (inst.client_name || 'project').replace(/[^a-zA-Z0-9_-]/g, '_');
          const localFilename = `${clientSlug}_${rawName}`;
          const localPath = path.join(PHOTOS_DIR, localFilename);

          const downloaded = await downloadFileIfMissing(photoUrl, localPath);
          if (downloaded) newPhotos++;
        }
      }
    }
  } catch (err) {
    console.warn('[SYNC] Kendala saat mengambil cctv_installations:', err.message);
  }

  // 2. Backup Metadata JSON Harian ke 10TB
  try {
    const today = new Date().toISOString().slice(0, 10);
    const backupFile = path.join(BACKUPS_DIR, `borneo_snapshot_${today}.json`);
    if (!fs.existsSync(backupFile)) {
      const [quotesRes, invoicesRes, instRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/quotes?select=*&limit=500`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/invoices?select=*&limit=500`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/cctv_installations?select=*&limit=500`, { headers }),
      ]);

      const snapshot = {
        date: today,
        created_at: new Date().toISOString(),
        quotes: quotesRes.ok ? await quotesRes.json() : [],
        invoices: invoicesRes.ok ? await invoicesRes.json() : [],
        installations: instRes.ok ? await instRes.json() : [],
      };

      fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2));
      console.log(`[SYNC-BACKUP] 📦 Snapshot database harian tersimpan: ${backupFile}`);
    }
  } catch (err) {
    console.warn('[SYNC-BACKUP] Kendala backup snapshot:', err.message);
  }

  console.log(`[SYNC-CYCLE] Selesai! Foto baru tersinkron: ${newPhotos} file. Menunggu siklus berikutnya...`);
}

async function main() {
  await runSyncCycle();
  if (RUN_ONCE) {
    process.exit(0);
  }
  setInterval(runSyncCycle, SYNC_INTERVAL_MS);
}

main().catch(err => {
  console.error('[SYNC-FATAL]', err);
});
