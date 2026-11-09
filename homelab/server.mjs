/**
 * Borneo Etam Home Lab Server & AI Command Center Runner
 * Berjalan di PC / Server Kantor Borneo Etam (Storage 10TB)
 * Zero external dependencies - Murni Node.js 18+ native standard library.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper baca file .env tanpa dependency pihak ketiga
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

// Coba baca homelab/.env lalu .env root
loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '..', '.env'));

// Port server lokal
const PORT = parseInt(process.env.PORT || '8787', 10);

// Path penyimpanan di Storage 10TB
const STORAGE_ROOT = process.env.STORAGE_PATH || 'Z:\\Storage10T\\project aplikasi\\apps build\\penawaran\\storage';
const PHOTOS_DIR = path.join(STORAGE_ROOT, 'photos');
const DOCS_DIR = path.join(STORAGE_ROOT, 'documents');
const BACKUPS_DIR = path.join(STORAGE_ROOT, 'backups');

// Buat direktori jika belum ada
for (const dir of [STORAGE_ROOT, PHOTOS_DIR, DOCS_DIR, BACKUPS_DIR]) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.warn(`[STORAGE WARNING] Gagal membuat direktori ${dir}:`, err.message);
  }
}

// Konfigurasi Supabase & Telegram dari Environment
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://xukpisovkcflcwuhrzkx.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 BORNEO ETAM HOME LAB SERVER (HYBRID FAILOVER HUB)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`• Local Port    : http://localhost:${PORT}`);
console.log(`• Storage Target: ${STORAGE_ROOT}`);
console.log(`• Node.js Engine: ${process.version}`);
console.log(`• Supabase Host : ${SUPABASE_URL}`);
console.log(`• Failover Mode : Active (Cloud Singapore <-> Home Lab Samarinda)`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 1. Health Check Endpoint
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    let diskAvailable = false;
    let photoCount = 0;
    try {
      diskAvailable = fs.existsSync(STORAGE_ROOT);
      if (diskAvailable && fs.existsSync(PHOTOS_DIR)) {
        photoCount = fs.readdirSync(PHOTOS_DIR).length;
      }
    } catch (_) {}

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'online',
      server: 'Borneo Etam CCTV Home Lab',
      role: 'Local Master (10TB Storage)',
      location: 'Samarinda, Kalimantan Timur',
      storage_10tb_mounted: diskAvailable,
      storage_path: STORAGE_ROOT,
      archived_photos_count: photoCount,
      node_version: process.version,
      memory_rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }, null, 2));
  }

  // 2. Telegram Webhook Endpoint (Forwarded dari Cloud Gateway Supabase)
  if (req.method === 'POST' && url.pathname === '/webhook') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const update = JSON.parse(body || '{}');
        const fromId = update.message?.from?.id ?? update.callback_query?.from?.id;

        console.log(`[HOMELAB-RECV] Update Telegram diterima dari ID: ${fromId} | Jam: ${new Date().toLocaleTimeString('id-ID')}`);

        // Jika ada foto dikirim, simpan juga salinan fisik resolusi penuh ke Storage 10TB lokal
        if (update.message?.photo && update.message.photo.length > 0 && TELEGRAM_TOKEN) {
          const largestPhoto = update.message.photo[update.message.photo.length - 1];
          // Simpan di background tanpa memblokir response
          savePhotoTo10TB(largestPhoto.file_id, update.message.caption || '').catch(err => {
            console.warn('[STORAGE-10TB] Gagal simpan foto:', err.message);
          });
        }

        // Teruskan eksekusi ke Cloud Supabase dengan header x-borneo-source: homelab
        // agar logika bisnis, database Postgres, dan integrasi AI tetap sinkron
        const cloudRes = await fetch(`${SUPABASE_URL}/functions/v1/telegram-bot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
            'x-borneo-source': 'homelab',
          },
          body: JSON.stringify(update),
        });

        const cloudText = await cloudRes.text();
        res.writeHead(cloudRes.status, { 'Content-Type': 'text/plain' });
        return res.end(cloudText);
      } catch (err) {
        console.error('[HOMELAB-ERROR]', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('error');
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

async function savePhotoTo10TB(fileId, caption) {
  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    const filePath = fileData?.result?.file_path;
    if (!filePath) return;

    const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    const imgRes = await fetch(downloadUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const filename = `photo_${Date.now()}_${path.basename(filePath)}`;
    const dest = path.join(PHOTOS_DIR, filename);
    fs.writeFileSync(dest, buffer);
    console.log(`[STORAGE-10TB] Foto resolusi penuh tersimpan di: ${dest} (${Math.round(buffer.length / 1024)} KB)`);
  } catch (e) {
    console.warn('[STORAGE-10TB] Gagal mengarsipkan foto lokal:', e.message);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HOMELAB] Server siap mendengarkan di http://0.0.0.0:${PORT}`);
  console.log(`[HOMELAB] Health check URL: http://localhost:${PORT}/health`);
});
