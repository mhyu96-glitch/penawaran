// Bot Telegram Borneo Etam CCTV & Komputer Kasir (Executive Command Center)
// Sistem operasional cerdas lapangan: Penawaran -> Deal -> Proyek & Peta -> Pengeluaran -> BAST & Surat Jalan -> Faktur & Garansi.
// Dilengkapi multi-model fallback, auto-retry 503, pembaca angka fleksibel, voice note, foto dokumentasi, dan draf WhatsApp.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { DEFAULT_PACKAGES } from './packages.ts';
import {
  generateBorneoDocumentPdf,
  classifyItem,
  formatRupiah,
  formatDateIndo,
  ItemCategory,
  DocItem,
} from './pdf.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const TOKEN = env('TELEGRAM_BOT_TOKEN');
const WEBHOOK_SECRET = env('TELEGRAM_WEBHOOK_SECRET');
const ALLOWED_ID = Number(env('ALLOWED_TELEGRAM_ID'));
const OWNER_ID = env('OWNER_USER_ID');
const GEMINI_KEY = env('GEMINI_API_KEY');
const APP_URL = env('APP_BASE_URL').replace(/\/$/, '');

const CANDIDATE_MODELS = [
  env('GEMINI_MODEL') || 'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.5-pro',
].filter(Boolean);

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

// ------------------------------------------------------------------ util
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rp = formatRupiah;

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

const send = (chat_id: number, text: string, buttons?: { text: string; data: string }[][]) =>
  tg('sendMessage', {
    chat_id,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons.map((r) => r.map((b) => ({ text: b.text, callback_data: b.data }))) } } : {}),
  });

async function sendDocument(chat_id: number, bytes: Uint8Array, filename: string, caption?: string) {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const form = new FormData();
  form.append('chat_id', String(chat_id));
  form.append('document', blob, filename);
  if (caption) form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  return res.json().catch(() => ({}));
}

function nowParts() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = f.format(new Date()).split('-').map(Number);
  return { y, m, d, iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// ------------------------------------------------------------------ paket
async function loadPackages(): Promise<any[]> {
  const { data } = await db.from('borneo_packages').select('id,data').eq('user_id', OWNER_ID);
  if (data && data.length > 0) return data.map((r: any) => ({ ...r.data, id: r.id }));
  return DEFAULT_PACKAGES;
}

const cloneItems = (pkg: any) => (pkg?.items ?? []).map((i: any) => ({ ...i }));
const subtotal = (items: any[]) => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);

// ------------------------------------------------------------------ Gemini Schema & AI Core
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: {
      type: 'STRING',
      enum: [
        'create_quote',
        'deal_project',
        'add_expense',
        'add_item_master',
        'complete_project',
        'create_invoice',
        'add_project',
        'update_progress',
        'modify_pending',
        'get_pdf',
        'get_surat_jalan',
        'get_bast',
        'storage_calculator',
        'record_payment',
        'monthly_summary',
        'chat',
      ],
    },
    reply: { type: 'STRING', nullable: true },
    client_name: { type: 'STRING', nullable: true },
    client_phone: { type: 'STRING', nullable: true },
    client_address: { type: 'STRING', nullable: true },
    city: { type: 'STRING', nullable: true },
    package_id: { type: 'STRING', nullable: true },
    item_adjustments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER', nullable: true },
          item_keyword: { type: 'STRING', nullable: true },
          quantity: { type: 'NUMBER', nullable: true },
          unit_price: { type: 'NUMBER', nullable: true },
          cost_price: { type: 'NUMBER', nullable: true },
        },
      },
    },
    extra_items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          quantity: { type: 'NUMBER' },
          unit: { type: 'STRING', nullable: true },
          unit_price: { type: 'NUMBER' },
          cost_price: { type: 'NUMBER', nullable: true },
          category: { type: 'STRING', enum: ['item_utama', 'material_tambahan', 'jasa_akomodasi'], nullable: true },
        },
        required: ['description', 'quantity', 'unit_price'],
      },
    },
    cost_adjustments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          item_keyword: { type: 'STRING' },
          cost_price: { type: 'NUMBER' },
        },
        required: ['item_keyword', 'cost_price'],
      },
    },
    total_cost_override: { type: 'NUMBER', nullable: true },
    discount_amount: { type: 'NUMBER', nullable: true },
    down_payment_percent: { type: 'NUMBER', nullable: true },
    down_payment_amount: { type: 'NUMBER', nullable: true },
    target_text: { type: 'STRING', nullable: true },
    project_name: { type: 'STRING', nullable: true },
    service_type: { type: 'STRING', enum: ['CCTV', 'POS', 'BUNDLING'], nullable: true },
    progress: { type: 'INTEGER', nullable: true },
    installed_at: { type: 'STRING', nullable: true },
    sn_nvr: { type: 'STRING', nullable: true },
    sn_hdd: { type: 'STRING', nullable: true },
    expense_description: { type: 'STRING', nullable: true },
    expense_amount: { type: 'NUMBER', nullable: true },
    expense_category: { type: 'STRING', nullable: true },
    item_description: { type: 'STRING', nullable: true },
    item_unit: { type: 'STRING', nullable: true },
    item_unit_price: { type: 'NUMBER', nullable: true },
    item_cost_price: { type: 'NUMBER', nullable: true },
    proactive_note: { type: 'STRING', nullable: true },
  },
  required: ['intent'],
};

async function askGemini(text: string, packages: any[], pending: any | null, audioInline?: { mimeType: string; data: string }): Promise<any> {
  const catalog = packages
    .map((p) => `- id="${p.id}" | ${p.shortName} | ${p.service_type} | Jual: ${rp(p.totalPrice)} | Modal: ${rp(p.estimatedCost || 0)}\n` +
      (p.items ?? []).filter((it: any) => Number(it.quantity) > 0 && it.unit !== 'Header')
        .map((it: any, i: number) => `    [${i}] ${it.description} x${it.quantity} @${it.unit_price} (modal: ${it.cost_price || 0})`).join('\n'))
    .join('\n');

  const pendingInfo = pending
    ? `\nAKSI MENUNGGU KONFIRMASI (jenis=${pending.kind}): ${JSON.stringify(pending.payload).slice(0, 3500)}\n` +
      (pending.kind === 'quote'
        ? 'Daftar item saat ini:\n' + (pending.payload.items ?? []).filter((it: any) => Number(it.quantity) > 0 && it.unit !== 'Header')
            .map((it: any, i: number) => `    [${i}] ${it.description} x${it.quantity} @${it.unit_price} (modal: ${it.cost_price || 0})`).join('\n')
        : '')
    : '';

  const system = `Kamu adalah asisten AI operasional & partner bisnis terpercaya untuk Mas Wahyu (Owner Borneo Etam CCTV & Komputer Kasir) di Samarinda, Kalimantan Timur.

IDENTITAS & GAYA KOMUNIKASI:
- Yang chat denganmu adalah Mas Wahyu (Owner Borneo Etam), BUKAN pembeli/klien!
- Gaya bicara: santai, akrab, solutif, proaktif, dan bersahabat (panggil "bro" atau "Mas Wahyu").
- Jangan pernah kaku seperti robot customer service.
- Jika Mas Wahyu menyebut nama seseorang (contoh: "Pak Suhabuddin", "Haji Ismail", "Bu Ratna"), itu adalah nama KONSUMEN / KLIEN.
- JANGAN GUNAKAN HURUF BESAR SEMUA (ALL CAPS). Gunakan huruf kapital normal (Title Case atau Sentence case).

ATURAN MATA UANG & ANGKA INDONESIA (MUTLAK):
- "200rb", "200k", "200 ribu" -> 200000
- "2 jt", "2jt", "2 juta", "2.000.000" -> 2000000
- "1,5jt", "1.5jt", "1,5 juta" -> 1500000
- "500k", "500 rb" -> 500000
- "25rb", "15rb", "75k" -> 25000, 15000, 75000
Semua nilai nominal harus selalu diekstrak sebagai NUMBER integer murni!

PANDUAN INTENT & ALUR KERJA:
1. create_quote: Mas Wahyu ingin buat penawaran baru.
   - PENTING: Periksa apakah Mas Wahyu sudah menyebutkan ALAMAT LENGKAP klien. Jika belum ada alamatnya, beritahu ramah di proactive_note agar alamat lengkap diinput (supaya nanti saat deal langsung otomatis tertera di PDF dan masuk titik peta).
   - Ekstrak: client_name, client_phone, client_address, package_id, item_adjustments, extra_items (dengan cost_price & category), discount_amount, total_cost_override.
2. deal_project: Mas Wahyu menyatakan penawaran DEAL / disepakati (misal: "deal ya", "penawaran ini deal", "lanjut buat proyek", "proyek Pak Suhabuddin deal"). target_text = nama klien.
3. add_expense: Mas Wahyu melapor belanja / pengeluaran lapangan (misal: "sudah beli pipa conduit 10 btg 150rb untuk proyek Pak Suhabuddin", "beli bensin 50rb proyek Suhabuddin").
   - Ekstrak: target_text (nama klien/proyek), expense_amount, expense_description, expense_category ('Material Lapangan', 'Transportasi', 'Konsumsi', 'Lainnya').
4. add_item_master: Mas Wahyu ingin menambah barang/jasa baru ke master pustaka (misal: "tolong masukkan barang ini di barang dan jasa: Kamera ColorVu 4MP jual 450rb modal 320rb satuan Unit").
   - Ekstrak: item_description, item_unit, item_unit_price, item_cost_price.
5. complete_project: Proyek dinyatakan sudah selesai (misal: "proyek Pak Suhabuddin sudah selesai pasang", "proyek Suhabuddin tuntas SN NVR 123 SN HDD 456").
   - Ekstrak: target_text, progress: 100, installed_at, sn_nvr, sn_hdd.
6. get_surat_jalan: Minta cetak Surat Jalan (misal: "cetak surat jalan Pak Suhabuddin", "minta surat jalan"). target_text = nama klien.
7. get_bast: Minta cetak Berita Acara Serah Terima (misal: "cetak BAST Pak Suhabuddin", "minta berita acara"). target_text = nama klien.
8. storage_calculator: Mas Wahyu tanya kapasitas / lama hari rekaman CCTV (misal: "4 kamera 2MP HDD 1TB tahan rekam berapa hari bro?", "8 kamera 4MP harddisk 2TB").
   - Jawab secara teknis presisi di field reply: sebutkan kompresi H.265+, estimasi hari rekaman 24 jam non-stop, dan perkiraan jika pakai motion detection.
9. record_payment: Pembayaran DP / Pelunasan (misal: "Pak Suhabuddin sudah transfer DP 1.5jt", "Pak Suhabuddin sudah lunas").
10. monthly_summary: Tanya rekap performa keuangan bulanan (misal: "rekap performa bulan ini bro", "laporan bulan ini").
11. get_pdf: Minta file PDF penawaran / faktur.
12. modify_pending: Revisi penawaran yang sedang menunggu konfirmasi (misal: "diskon 200rb", "modal kamera jadi 190rb", "tambah pipa 5 batang").
13. chat: Obrolan santai, konsultasi nego harga klien, atau pertanyaan teknis lain.

KATALOG PAKET:
${catalog}${pendingInfo}`;

  const parts: any[] = [];
  if (audioInline) {
    parts.push({ inlineData: audioInline });
    parts.push({ text: text || 'Ekstrak maksud pesan suara di atas dan jalankan instruksinya sesuai skema JSON.' });
  } else {
    parts.push({ text });
  }

  const payloadBody = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1 },
  });

  let lastError: Error | null = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
          body: payloadBody,
        });

        if (res.status === 503 || res.status === 429) {
          console.warn(`Gemini ${model} status ${res.status}. Attempt ${attempt}...`);
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
        }

        const json = await res.json();
        const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
        return JSON.parse(raw);
      } catch (err: any) {
        lastError = err;
        console.warn(`Error on model ${model}:`, err.message);
        if (attempt === 1) await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError || new Error('Gagal menghubungi AI Google.');
}

// ------------------------------------------------------------------ geocode
async function geocode(address: string, city?: string | null): Promise<{ lat: number; lng: number } | null> {
  const q = [address, city, 'Kalimantan Timur', 'Indonesia'].filter(Boolean).join(', ');
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'BorneoEtamBot/1.0 (penawaran app)' },
    });
    const arr = await res.json();
    if (Array.isArray(arr) && arr[0]) return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
  } catch (_) { /* abaikan */ }
  return null;
}

// ------------------------------------------------------------------ pending
async function savePending(chat_id: number, kind: string, payload: any, status = 'pending') {
  const { data, error } = await db.from('telegram_pending_actions').insert({ chat_id, kind, payload, status }).select('id').single();
  if (error) throw new Error('Gagal menyimpan aksi: ' + error.message);
  return data.id as string;
}

async function latestPending(chat_id: number, statuses = ['pending', 'need_location']) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await db.from('telegram_pending_actions').select('*')
    .eq('chat_id', chat_id).in('status', statuses).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

// ------------------------------------------------------------------ ringkasan
function quoteSummary(p: any): string {
  const activeItems = (p.items ?? []).filter((i: any) => Number(i.quantity) > 0 && i.unit !== 'Header');

  const groups: Record<ItemCategory, any[]> = {
    item_utama: [],
    material_tambahan: [],
    jasa_akomodasi: [],
  };

  for (const it of activeItems) {
    const cat = classifyItem(it);
    groups[cat].push(it);
  }

  const sections: string[] = [];
  const catNames: { key: ItemCategory; title: string }[] = [
    { key: 'item_utama', title: '1. Item Utama' },
    { key: 'material_tambahan', title: '2. Material Tambahan' },
    { key: 'jasa_akomodasi', title: '3. Jasa dan Akomodasi' },
  ];

  let calculatedModal = 0;
  for (const c of catNames) {
    const items = groups[c.key];
    if (items.length === 0) continue;
    const lines = items.map((i: any) => {
      const q = Number(i.quantity);
      const pr = Number(i.unit_price) || 0;
      const cp = Number(i.cost_price) || 0;
      calculatedModal += q * cp;
      const modalText = cp > 0 ? ` | Modal: ${rp(cp)}` : ' | Modal: -';
      return `  • ${esc(i.description)} ×${q} ${esc(i.unit || 'Unit')} (Jual: ${rp(pr)}${modalText})`;
    }).join('\n');
    sections.push(`<b>${c.title}:</b>\n${lines}`);
  }

  const sub = subtotal(p.items ?? []);
  const discount = Number(p.discount_amount || 0);
  const total = Math.max(0, sub - discount);
  const totalModal = p.total_cost_override != null ? Number(p.total_cost_override) : calculatedModal;
  const laba = total - totalModal;
  const margin = total > 0 ? Math.round((laba / total) * 100) : 0;

  // Analisis proaktif
  const questions: string[] = [];
  if (!p.client_address || p.client_address.length < 5) {
    questions.push('• 💡 <b>Alamat lengkap pemasangan belum ada bro</b>. Mau diisi sekarang biar pas deal langsung masuk Peta & Garansi?');
  }
  if (groups.material_tambahan.length === 0) {
    questions.push('• 💡 Belum ada material tambahan (kabel/pipa/konektor), sudah include paket atau suplai toko?');
  }
  if (groups.jasa_akomodasi.length === 0) {
    questions.push('• 💡 Belum ada jasa instalasi/setting online HP, mau ditambahkan atau beli putus unit?');
  }
  const zeroCostCount = activeItems.filter((i: any) => !i.cost_price || Number(i.cost_price) === 0).length;
  if (zeroCostCount > 0 && !p.total_cost_override) {
    questions.push('• 💡 Ada item yang belum ada harga modalnya, mau diisi sekalian biar hitungan laba presisi?');
  }

  let text = `<b>📄 Konfirmasi Penawaran Baru</b>\n` +
    `Klien: <b>${esc(p.client_name)}</b>\n` +
    `WhatsApp: ${esc(p.client_phone || '-')}\n` +
    `Alamat Pemasangan: ${esc(p.client_address || '<i>(Belum diisi)</i>')}\n` +
    `Paket: <b>${esc(p.package_name || 'Custom Sesuai Kebutuhan')}</b>\n\n` +
    sections.join('\n\n') + '\n\n' +
    `───────────────────────\n` +
    (discount > 0 ? `Subtotal: ${rp(sub)}\nDiskon Khusus: -${rp(discount)}\n` : '') +
    `Total Penawaran : <b>${rp(total)}</b>\n` +
    `Total Modal (HPP) : <b>${rp(totalModal)}</b>\n` +
    `💰 <b>Estimasi Laba Bersih : ${rp(laba)}</b> (Margin: <b>${margin}%</b>)\n` +
    `───────────────────────\n`;

  if (p.proactive_note) {
    text += `\n💬 <i>${esc(p.proactive_note)}</i>\n`;
  }

  if (questions.length > 0) {
    text += `\n<b>Catatan Pengecekan:</b>\n${questions.join('\n')}\n`;
  }

  text += `\n<i>Revisi? Balas misal: "diskon 200rb", "tambah pipa 10 btg modal 15rb", atau "modal kamera 190rb".</i>\n\n<b>Sudah pas dan mau dibuatkan PDF resminya?</b>`;

  return text;
}

function invoiceSummary(p: any): string {
  const sisa = p.total - p.dp_amount;
  return `<b>🧾 Konfirmasi Faktur Tagihan</b>\n` +
    `Nomor Penawaran: <code>${esc(p.quote_number)}</code>\n` +
    `Klien: <b>${esc(p.client_name)}</b>\n` +
    `Total Tagihan: <b>${rp(p.total)}</b>\n` +
    `DP (Uang Muka): <b>${rp(p.dp_amount)}</b>\n` +
    `Sisa Pelunasan: <b>${rp(sisa)}</b>\n\n` +
    `<i>Ada biaya tambahan atau DP yang mau disesuaikan bro? Balas misal: "DP 2jt" atau "DP 50%".</i>\n\n` +
    `<b>Terbitkan faktur dan kirim PDF sekarang?</b>`;
}

function projectSummary(p: any): string {
  const stat = p.progress === 100 ? '100% Selesai' : p.progress > 0 ? `${p.progress}% Pengerjaan` : '0% Antrean Survei';
  return `<b>📍 Konfirmasi Proyek &amp; Titik Peta</b>\n` +
    `Proyek: <b>${esc(p.project_name)}</b>\n` +
    `Klien: ${esc(p.client_name || '-')} • ${esc(p.client_phone || '-')}\n` +
    `Layanan: ${esc(p.service_type)}${p.package_name ? ' • ' + esc(p.package_name) : ''}\n` +
    `Alamat: ${esc(p.address_landmark || '-')}, ${esc(p.city)}\n` +
    `Koordinat: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)} <i>(${esc(p.geo_source)})</i>\n` +
    `Progres: <b>${stat}</b>${p.installed_at ? ' • Tgl Pasang: ' + esc(p.installed_at) : ''}\n` +
    (p.sn_nvr ? `SN NVR: ${esc(p.sn_nvr)}\n` : '') +
    (p.sn_hdd ? `SN HDD: ${esc(p.sn_hdd)}\n` : '') +
    `Portofolio Publik: <b>${p.is_public ? 'Ya' : 'Tidak'}</b>\n\n` +
    `<b>Simpan dan tampilkan di peta sekarang?</b>`;
}

async function showPending(chat_id: number, id: string, kind: string, p: any) {
  if (kind === 'quote') {
    return send(chat_id, quoteSummary(p), [
      [{ text: '✅ Ya, Buat & Cetak PDF', data: `ok:${id}` }, { text: '❌ Batal', data: `no:${id}` }],
    ]);
  }
  if (kind === 'invoice') {
    return send(chat_id, invoiceSummary(p), [
      [{ text: '✅ Ya, Terbitkan Faktur & PDF', data: `ok:${id}` }, { text: '❌ Batal', data: `no:${id}` }],
    ]);
  }
  if (kind === 'project') {
    return send(chat_id, projectSummary(p), [
      [{ text: '✅ Ya, Simpan ke Peta', data: `ok:${id}` }, { text: p.is_public ? '🔒 Jadikan Privat' : '🌐 Jadikan Publik', data: `pub:${id}` }],
      [{ text: '❌ Batal', data: `no:${id}` }],
    ]);
  }
  return send(chat_id,
    `<b>🔄 Konfirmasi Update Proyek</b>\nProyek: <b>${esc(p.project_name)}</b>\n` +
    (p.progress != null ? `Progres: <b>${p.progress}%</b>\n` : '') +
    (p.sn_nvr ? `SN NVR: ${esc(p.sn_nvr)}\n` : '') +
    (p.sn_hdd ? `SN HDD: ${esc(p.sn_hdd)}\n` : '') +
    (p.installed_at ? `Tgl Pasang: ${esc(p.installed_at)}\n` : '') +
    '\n<b>Simpan perubahan sekarang?</b>',
    [[{ text: '✅ Ya, Simpan', data: `ok:${id}` }, { text: '❌ Batal', data: `no:${id}` }]]);
}

// ------------------------------------------------------------------ helper pengantar whatsapp
function makeWhatsAppText(type: 'quote' | 'invoice', docNumber: string, clientName: string, total: number, dp = 0): string {
  if (type === 'quote') {
    return `📲 <b>Draf Pesan WhatsApp Siap Forward ke Klien:</b>\n` +
      `<code>Yth. ${clientName || 'Bapak/Ibu'},\n\n` +
      `Berikut kami lampirkan Surat Penawaran Resmi pemasangan sistem keamanan CCTV dari Borneo Etam CCTV (No: ${docNumber}).\n\n` +
      `Total Penawaran: ${rp(total)}\n` +
      `(Sudah termasuk seluruh perangkat baru bergaransi resmi 12 Bulan, instalasi kabel rapi, dan gratis setting pantau online via HP).\n\n` +
      `Dokumen penawaran resmi berstempel terlampir dalam file PDF di atas.\nTerima kasih atas kepercayaannya.\n\n` +
      `Salam hangat,\nMuhammad Wahyu\nBorneo Etam CCTV & Komputer Kasir\nWhatsApp: 0822-5131-4646</code>`;
  }
  const sisa = Math.max(0, total - dp);
  return `📲 <b>Draf Pesan WhatsApp Siap Forward ke Klien:</b>\n` +
    `<code>Yth. ${clientName || 'Bapak/Ibu'},\n\n` +
    `Pekerjaan instalasi CCTV telah selesai dilaksanakan dengan baik, seluruh kamera berfungsi normal dan bergaransi 12 Bulan.\n\n` +
    `Berikut kami lampirkan Faktur Tagihan resmi (No: ${docNumber}).\n` +
    `Total: ${rp(total)}\n` +
    (dp > 0 ? `DP Diterima: ${rp(dp)}\nSisa Pelunasan: ${rp(sisa)}\n\n` : '\n') +
    `Pembayaran resmi via Transfer Bank:\nBank BCA: 5135400278 a.n Muhammad Wahyu\n\n` +
    `Dokumen Faktur PDF terlampir. Terima kasih banyak atas kerjasamanya!\n\n` +
    `Salam hormat,\nBorneo Etam CCTV & Komputer Kasir\n0822-5131-4646</code>`;
}

// ------------------------------------------------------------------ eksekusi intent
async function handleText(chat_id: number, text: string, audioInline?: any) {
  const packages = await loadPackages();
  const pending = await latestPending(chat_id);
  const r = await askGemini(text, packages, pending, audioInline);

  switch (r.intent) {
    // ---------------------------------------------------- DEAL PROYEK (OTOMATIS PROYEK & PETA)
    case 'deal_project': {
      const t = (r.target_text || r.client_name || '').trim();
      let q = db.from('quotes').select('*, quote_items(*), clients(*)').eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(1);
      if (t) q = q.or(`quote_number.ilike.%${t}%,to_client.ilike.%${t}%`);
      const { data } = await q;
      const quote: any = data?.[0];

      if (!quote) {
        return send(chat_id, `Penawaran untuk klien "${esc(t || 'terakhir')}" belum ditemukan bro. Pastikan penawarannya sudah dibuat dulu ya.`);
      }

      // 1. Update status quote jadi Diterima
      await db.from('quotes').update({ status: 'Diterima' }).eq('id', quote.id);

      // 2. Buat entri di tabel Proyek (projects)
      const tot = (quote.quote_items ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(quote.discount_amount || 0);
      const projName = `Proyek ${quote.to_client || 'CCTV'}`;

      let projectId: string | null = null;
      const { data: exProj } = await db.from('projects').select('id').eq('user_id', OWNER_ID).ilike('name', projName).limit(1).maybeSingle();
      if (exProj?.id) {
        projectId = exProj.id;
        await db.from('projects').update({ status: 'Ongoing', budget: tot }).eq('id', projectId);
      } else {
        const { data: newProj } = await db.from('projects').insert({
          user_id: OWNER_ID,
          name: projName,
          client_id: quote.client_id || null,
          description: `Pemasangan dari Penawaran ${quote.quote_number}`,
          status: 'Ongoing',
          budget: tot,
        }).select('id').single();
        projectId = newProj?.id ?? null;
      }

      // 3. Geocode & Masukkan ke Peta Command Center (cctv_installations)
      const clientAddr = quote.to_address || 'Samarinda, Kalimantan Timur';
      const geo = await geocode(clientAddr, 'Samarinda');
      const lat = geo ? geo.lat : -0.502106;
      const lng = geo ? geo.lng : 117.153709;

      const { data: exInst } = await db.from('cctv_installations').select('id').eq('quote_id', quote.id).limit(1).maybeSingle();
      if (!exInst) {
        await db.from('cctv_installations').insert({
          user_id: OWNER_ID,
          quote_id: quote.id,
          project_id: projectId,
          client_id: quote.client_id,
          project_name: projName,
          public_display_name: `Instalasi CCTV - Area ${quote.to_address ? quote.to_address.slice(0, 30) : 'Samarinda'}`,
          client_name: quote.to_client,
          client_phone: quote.to_phone,
          address_landmark: clientAddr,
          service_type: 'CCTV',
          city: 'Samarinda',
          latitude: lat,
          longitude: lng,
          progress: 15,
          is_public_portfolio: true,
          notes: `Dari penawaran ${quote.quote_number}`,
          photos: [],
        });
      }

      return send(
        chat_id,
        `🎉 <b>Penawaran DEAL! Proyek &amp; Peta Berhasil Dibuat!</b>\n` +
        `Klien: <b>${esc(quote.to_client)}</b>\n` +
        `No Penawaran: <code>${esc(quote.quote_number)}</code>\n` +
        `Total Nilai Proyek: <b>${rp(tot)}</b>\n` +
        `Status: <b>Ongoing (Antrean Pasang 15%)</b>\n` +
        `Lokasi Peta: <code>${lat.toFixed(5)}, ${lng.toFixed(5)}</code> (${geo ? 'Akurat' : 'Perkiraan Samarinda'})\n\n` +
        `📋 <b>Checklist Teknisi Sebelum Berangkat:</b>\n` +
        `• [ ] Kabel Coaxial/LAN tester & konektor BNC/DC/RJ45 (+5 cadangan)\n` +
        `• [ ] Pipa conduit, klem & isolasi listrik\n` +
        `• [ ] Tangga & peralatan bor kelistrikan\n` +
        `• [ ] Kabel HDMI/VGA untuk tes monitor TV klien\n` +
        `• [ ] Mouse & Adaptor unit DVR/NVR\n\n` +
        `<i>Klik tombol di bawah jika butuh cetak Surat Jalan untuk teknisi:</i>`,
        [
          [{ text: '📦 Cetak Surat Jalan', data: `sj:${quote.id}` }, { text: '📄 Cetak Penawaran', data: `pdf:${quote.id}` }],
        ]
      );
    }

    // ---------------------------------------------------- CATAT PENGELUARAN LAPANGAN (EXPENSES)
    case 'add_expense': {
      const amount = Number(r.expense_amount || 0);
      if (!amount || amount <= 0) {
        return send(chat_id, 'Berapa jumlah pengeluarannya bro? Contoh: <i>beli pipa conduit 150rb untuk proyek Pak Suhabuddin</i>');
      }

      const t = (r.target_text || r.client_name || r.project_name || '').trim();
      let projectId: string | null = null;
      let projName = 'Operasional Umum';

      if (t) {
        const { data: pList } = await db.from('projects').select('id, name')
          .eq('user_id', OWNER_ID).ilike('name', `%${t}%`).order('created_at', { ascending: false }).limit(1);
        if (pList && pList[0]) {
          projectId = pList[0].id;
          projName = pList[0].name;
        }
      }

      const desc = r.expense_description || `Belanja lapangan untuk ${t || 'operasional'}`;
      const cat = r.expense_category || (desc.toLowerCase().includes('bensin') || desc.toLowerCase().includes('bbm') ? 'Transportasi' : 'Material Lapangan');

      const { error: expErr } = await db.from('expenses').insert({
        user_id: OWNER_ID,
        project_id: projectId,
        description: desc,
        amount,
        category: cat,
        expense_date: nowParts().iso,
        notes: 'Dicatat via bot Telegram',
      });

      if (expErr) throw new Error('Gagal mencatat pengeluaran: ' + expErr.message);

      // Hitung total pengeluaran untuk proyek ini
      let totalExpProyek = amount;
      if (projectId) {
        const { data: allExp } = await db.from('expenses').select('amount').eq('project_id', projectId);
        totalExpProyek = (allExp ?? []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      }

      return send(
        chat_id,
        `✅ <b>Pengeluaran Berhasil Dicatat ke Buku Beban!</b>\n` +
        `Proyek: <b>${esc(projName)}</b>\n` +
        `Deskripsi: ${esc(desc)}\n` +
        `Nominal: <b>${rp(amount)}</b>\n` +
        `Kategori: <b>${esc(cat)}</b>\n` +
        (projectId ? `Total Biaya Beban Proyek Ini: <b>${rp(totalExpProyek)}</b>\n` : '') +
        `\n<i>Laba proyek di aplikasi otomatis terpotong rapi secara real-time bro!</i>`
      );
    }

    // ---------------------------------------------------- INPUT MASTER BARANG & JASA (ITEMS)
    case 'add_item_master': {
      const desc = (r.item_description || r.target_text || '').trim();
      const unitPrice = Number(r.item_unit_price || 0);
      const costPrice = Number(r.item_cost_price || 0);
      const unit = r.item_unit || 'Unit';

      if (!desc || unitPrice <= 0) {
        return send(chat_id, 'Format input barang/jasa baru: <i>tolong masukkan barang ini: Kamera ColorVu 4MP jual 450rb modal 320rb satuan Unit</i>');
      }

      const { error: itErr } = await db.from('items').insert({
        user_id: OWNER_ID,
        description: desc,
        unit,
        unit_price: unitPrice,
        cost_price: costPrice,
        stock: 0,
        track_stock: false,
      });

      if (itErr) throw new Error('Gagal menambah item ke pustaka: ' + itErr.message);

      return send(
        chat_id,
        `✅ <b>Barang/Jasa Berhasil Ditambahkan ke Master Pustaka!</b>\n` +
        `Item: <b>${esc(desc)}</b>\n` +
        `Harga Jual: <b>${rp(unitPrice)}</b>\n` +
        `Harga Modal (HPP): <b>${rp(costPrice)}</b>\n` +
        `Satuan: <b>${esc(unit)}</b>\n\n` +
        `Item ini sudah langsung aktif di database aplikasi dan bisa dipilih saat membuat penawaran!`
      );
    }

    // ---------------------------------------------------- PROYEK SELESAI (FAKTUR & GARANSI & REKAP LABA)
    case 'complete_project': {
      const t = (r.target_text || r.client_name || r.project_name || '').trim();
      let q = db.from('cctv_installations').select('*, quotes(*, quote_items(*))')
        .eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(1);
      if (t) q = q.or(`project_name.ilike.%${t}%,client_name.ilike.%${t}%`);
      const { data } = await q;
      const inst: any = data?.[0];

      if (!inst) {
        return send(chat_id, `Data proyek "${esc(t || 'terakhir')}" tidak ditemukan bro.`);
      }

      const snNvr = r.sn_nvr || inst.sn_nvr || 'SN-NVR-TERCATAT';
      const snHdd = r.sn_hdd || inst.sn_hdd || 'SN-HDD-TERCATAT';
      const tglPasang = nowParts().iso;

      // 1. Update cctv_installations
      await db.from('cctv_installations').update({
        progress: 100,
        installed_at: tglPasang,
        sn_nvr: snNvr,
        sn_hdd: snHdd,
        warranty_months: 12,
      }).eq('id', inst.id);

      // 2. Update projects
      if (inst.project_id) {
        await db.from('projects').update({ status: 'Completed' }).eq('id', inst.project_id);
      }

      // 3. Hitung Rekap Laba Bersih Riil (Omset - HPP - Pengeluaran Lapangan)
      const quote = inst.quotes;
      const items = quote?.quote_items || [];
      const omset = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(quote?.discount_amount || 0);
      const modalHpp = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.cost_price || 0), 0);

      let totalExpenses = 0;
      if (inst.project_id) {
        const { data: exps } = await db.from('expenses').select('amount').eq('project_id', inst.project_id);
        totalExpenses = (exps ?? []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      }

      const labaBersihRiil = omset - modalHpp - totalExpenses;
      const marginRiil = omset > 0 ? Math.round((labaBersihRiil / omset) * 100) : 0;

      // 4. Otomatis Terbitkan Faktur Tagihan
      const { y } = nowParts();
      const { data: lastInv } = await db.from('invoices').select('invoice_number').eq('user_id', OWNER_ID).like('invoice_number', `INV-${y}-%`).order('created_at', { ascending: false }).limit(1);
      const lastNum = parseInt(String(lastInv?.[0]?.invoice_number || '').split('-').pop() || '0', 10) || 0;
      const invNumber = `INV-${y}-${String(lastNum + 1).padStart(3, '0')}`;

      const { data: newInv } = await db.from('invoices').insert({
        user_id: OWNER_ID,
        quote_id: quote?.id || null,
        client_id: inst.client_id || null,
        project_id: inst.project_id || null,
        from_company: 'Borneo Etam CCTV & Komputer Kasir',
        to_client: inst.client_name,
        to_address: inst.address_landmark,
        to_phone: inst.client_phone,
        title: `Faktur Pemasangan CCTV - ${inst.client_name}`,
        discount_amount: quote?.discount_amount || 0,
        status: 'Draf',
        invoice_number: invNumber,
        invoice_date: new Date().toISOString(),
      }).select('id, invoice_number').single();

      if (newInv && items.length > 0) {
        const invRows = items.map((i: any) => ({
          invoice_id: newInv.id,
          description: i.description || '',
          quantity: Number(i.quantity) || 0,
          unit: i.unit || 'Unit',
          unit_price: Number(i.unit_price) || 0,
          cost_price: Number(i.cost_price) || 0,
        }));
        await db.from('invoice_items').insert(invRows);
      }

      // 5. Generate PDF Faktur Resmi
      const pdfBytes = generateBorneoDocumentPdf({
        type: 'invoice',
        docNumber: invNumber,
        dateStr: tglPasang,
        clientName: inst.client_name,
        clientPhone: inst.client_phone,
        clientAddress: inst.address_landmark,
        companyName: 'Borneo Etam CCTV & Komputer Kasir',
        items,
        discountAmount: quote?.discount_amount || 0,
      });

      const safeName = `Faktur-${inst.client_name.replace(/[^a-zA-Z0-9]/g, '_')}-${invNumber}.pdf`;

      // 6. Kirim PDF Faktur ke Telegram
      await sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `🧾 <b>Faktur Tagihan Resmi: <code>${invNumber}</code></b>\nKlien: <b>${esc(inst.client_name)}</b>\nTotal: <b>${rp(omset)}</b>`
      );

      // 7. Kirim Kartu Rekap Finansial & Teks WA
      const waText = makeWhatsAppText('invoice', invNumber, inst.client_name, omset, 0);

      return send(
        chat_id,
        `🏁 <b>Proyek Selesai &amp; Monitor Garansi 12 Bulan Aktif!</b>\n` +
        `Proyek: <b>${esc(inst.project_name)}</b>\n` +
        `SN NVR: <code>${esc(snNvr)}</code> | SN HDD: <code>${esc(snHdd)}</code>\n` +
        `Tanggal Pasang: <b>${formatDateIndo(tglPasang)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 <b>Laporan Finansial Riil Proyek:</b>\n` +
        `• Total Nilai Proyek (Omset) : <b>${rp(omset)}</b>\n` +
        `• Total Modal Alat (HPP)     : <b>${rp(modalHpp)}</b>\n` +
        `• Biaya Operasional Lapangan : <b>${rp(totalExpenses)}</b>\n` +
        `• 💰 <b>Laba Bersih Aktual : ${rp(labaBersihRiil)}</b> (Margin: <b>${marginRiil}%</b>)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${waText}`,
        [
          [{ text: '📜 Cetak BAST Resmi', data: `bast:${quote?.id || inst.id}` }],
        ]
      );
    }

    // ---------------------------------------------------- CETAK SURAT JALAN
    case 'get_surat_jalan': {
      const t = (r.target_text || '').trim();
      let q = db.from('quotes').select('*, quote_items(*)').eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(1);
      if (t) q = q.or(`quote_number.ilike.%${t}%,to_client.ilike.%${t}%`);
      const { data } = await q;
      const quote: any = data?.[0];
      if (!quote) return send(chat_id, `Data penawaran/proyek untuk "${esc(t || 'terakhir')}" tidak ditemukan bro.`);

      const sjNumber = `SJ/BE-CCTV/${nowParts().y}/${String(quote.quote_number).split('/').pop() || '001'}`;
      const pdfBytes = generateBorneoDocumentPdf({
        type: 'surat_jalan',
        docNumber: sjNumber,
        dateStr: nowParts().iso,
        clientName: quote.to_client,
        clientPhone: quote.to_phone,
        clientAddress: quote.to_address,
        companyName: 'Borneo Etam CCTV & Komputer Kasir',
        items: quote.quote_items || [],
      });

      const safeName = `Surat_Jalan-${quote.to_client.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      return sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `📦 <b>Surat Jalan Pengeluaran Barang Resmi</b>\nNo: <code>${sjNumber}</code>\nKlien: <b>${esc(quote.to_client)}</b>\n\n<i>Daftar perangkat & material tanpa harga, siap dibawa teknisi ke lokasi!</i>`
      );
    }

    // ---------------------------------------------------- CETAK BAST (BERITA ACARA SERAH TERIMA)
    case 'get_bast': {
      const t = (r.target_text || '').trim();
      let q = db.from('quotes').select('*, quote_items(*)').eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(1);
      if (t) q = q.or(`quote_number.ilike.%${t}%,to_client.ilike.%${t}%`);
      const { data } = await q;
      const quote: any = data?.[0];
      if (!quote) return send(chat_id, `Data proyek untuk "${esc(t || 'terakhir')}" tidak ditemukan bro.`);

      // Ambil SN dari cctv_installations jika ada
      const { data: inst } = await db.from('cctv_installations').select('sn_nvr, sn_hdd').eq('quote_id', quote.id).maybeSingle();

      const bastNumber = `BAST/BE-CCTV/${nowParts().y}/${String(quote.quote_number).split('/').pop() || '001'}`;
      const pdfBytes = generateBorneoDocumentPdf({
        type: 'bast',
        docNumber: bastNumber,
        dateStr: nowParts().iso,
        clientName: quote.to_client,
        clientPhone: quote.to_phone,
        clientAddress: quote.to_address,
        companyName: 'Borneo Etam CCTV & Komputer Kasir',
        items: quote.quote_items || [],
        snNvr: inst?.sn_nvr || r.sn_nvr || 'Tercatat di sistem',
        snHdd: inst?.sn_hdd || r.sn_hdd || 'Tercatat di sistem',
      });

      const safeName = `BAST-${quote.to_client.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      return sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `📜 <b>Berita Acara Serah Terima (BAST) Resmi</b>\nNo: <code>${bastNumber}</code>\nKlien: <b>${esc(quote.to_client)}</b>\n\n<i>Lengkap dengan pernyataan serah terima, nomor seri unit, dan stempel resmi!</i>`
      );
    }

    // ---------------------------------------------------- KALKULATOR HARDDISK (STORAGE CALCULATOR)
    case 'storage_calculator': {
      return send(
        chat_id,
        `💾 <b>Kalkulator Penyimpanan Rekaman CCTV (H.265+ Smart Codec):</b>\n\n` +
        `• <b>4 Kamera 2MP (1080p Full HD):</b>\n` +
        `  - HDD 500GB : ~18 - 22 Hari (24 Jam non-stop)\n` +
        `  - HDD 1TB   : ~38 - 42 Hari (~1.5 Bulan)\n` +
        `  - HDD 2TB   : ~75 - 85 Hari (~2.5 Bulan)\n\n` +
        `• <b>8 Kamera 2MP / 4 Kamera 4MP PoE:</b>\n` +
        `  - HDD 1TB   : ~18 - 21 Hari\n` +
        `  - HDD 2TB   : ~38 - 45 Hari\n` +
        `  - HDD 4TB   : ~80 - 90 Hari (~3 Bulan)\n\n` +
        `💡 <i>Tips untuk Konsumen: Kalau diaktifkan fitur Smart Motion Detection (hanya rekam saat ada pergerakan orang/kendaraan), durasinya bisa bertambah hingga 1.5x lipat lebih lama bro!</i>`
      );
    }

    // ---------------------------------------------------- REKAP BULANAN (CEO BRIEFING)
    case 'monthly_summary': {
      const { y, m } = nowParts();
      const monthStr = `${y}-${String(m).padStart(2, '0')}`;

      const { data: quotesData } = await db.from('quotes').select('id, discount_amount, quote_items(quantity, unit_price, cost_price)')
        .eq('user_id', OWNER_ID).gte('created_at', `${monthStr}-01`);

      const { data: instData } = await db.from('cctv_installations').select('id, progress')
        .eq('user_id', OWNER_ID).gte('created_at', `${monthStr}-01`);

      const { data: expData } = await db.from('expenses').select('amount')
        .eq('user_id', OWNER_ID).gte('expense_date', `${monthStr}-01`);

      let totalOmset = 0;
      let totalModal = 0;

      for (const q of quotesData ?? []) {
        const sub = (q.quote_items ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0);
        const cost = (q.quote_items ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.cost_price || 0), 0);
        totalOmset += Math.max(0, sub - Number(q.discount_amount || 0));
        totalModal += cost;
      }

      const totalBeban = (expData ?? []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const labaBersih = totalOmset - totalModal - totalBeban;
      const totalProyek = instData?.length || 0;
      const selesai = (instData ?? []).filter((i: any) => i.progress === 100).length;

      return send(
        chat_id,
        `📊 <b>Rekap Kinerja Bisnis Borneo Etam (${formatDateIndo(`${monthStr}-01`).slice(3)}):</b>\n\n` +
        `• Total Proyek Masuk : <b>${totalProyek} Titik</b> (${selesai} Selesai 100%)\n` +
        `• Total Penjualan (Omset) : <b>${rp(totalOmset)}</b>\n` +
        `• Total Modal Alat (HPP) : <b>${rp(totalModal)}</b>\n` +
        `• Biaya Operasional Lapangan : <b>${rp(totalBeban)}</b>\n` +
        `───────────────────────\n` +
        `💰 <b>Laba Bersih Aktual Bulan Ini: ${rp(labaBersih)}</b>\n` +
        `───────────────────────\n\n` +
        `<i>Tetap semangat dan jaga kualitas instalasi rapi khas Borneo Etam, bro! 🚀</i>`
      );
    }

    // ---------------------------------------------------- BUAT PENAWARAN (CREATE QUOTE)
    case 'create_quote': {
      if (!r.client_name) {
        return send(
          chat_id,
          'Kliennya atas nama siapa bro? Contoh: <i>buatkan penawaran Pak Hendra, Jl. P. Hidayatullah Samarinda, paket 4 titik CCTV diskon 200rb</i>'
        );
      }
      const pkg = packages.find((p) => p.id === r.package_id) ?? null;
      const items = cloneItems(pkg);

      for (const a of r.item_adjustments ?? []) {
        if (a.index != null && items[a.index]) {
          if (a.quantity != null) items[a.index].quantity = a.quantity;
          if (a.unit_price != null) items[a.index].unit_price = a.unit_price;
          if (a.cost_price != null) items[a.index].cost_price = a.cost_price;
        } else if (a.item_keyword) {
          const kw = a.item_keyword.toLowerCase();
          const target = items.find((i: any) => (i.description || '').toLowerCase().includes(kw));
          if (target) {
            if (a.quantity != null) target.quantity = a.quantity;
            if (a.unit_price != null) target.unit_price = a.unit_price;
            if (a.cost_price != null) target.cost_price = a.cost_price;
          }
        }
      }

      for (const c of r.cost_adjustments ?? []) {
        if (!c.item_keyword) continue;
        const kw = c.item_keyword.toLowerCase();
        for (const it of items) {
          if ((it.description || '').toLowerCase().includes(kw)) it.cost_price = c.cost_price;
        }
      }

      for (const e of r.extra_items ?? []) {
        items.push({
          description: e.description,
          quantity: e.quantity,
          unit: e.unit || 'Unit',
          unit_price: e.unit_price,
          cost_price: e.cost_price || 0,
          category: e.category || classifyItem(e),
        });
      }

      if (items.filter((i: any) => Number(i.quantity) > 0 && i.unit !== 'Header').length === 0) {
        return send(
          chat_id,
          `Mau pakai paket yang mana bro?\n${packages.map((p) => `• ${esc(p.shortName)} (${rp(p.totalPrice)})`).join('\n')}`
        );
      }

      const payload = {
        client_name: r.client_name,
        client_phone: r.client_phone || '',
        client_address: r.client_address || '',
        package_id: pkg?.id ?? null,
        package_name: pkg?.shortName ?? null,
        terms: pkg?.defaultTerms ?? '',
        items,
        discount_amount: r.discount_amount || 0,
        total_cost_override: r.total_cost_override || null,
        proactive_note: r.proactive_note || '',
      };

      const id = await savePending(chat_id, 'quote', payload);
      return showPending(chat_id, id, 'quote', payload);
    }

    // ---------------------------------------------------- REVISI AKSI MENUNGGU (MODIFY PENDING)
    case 'modify_pending': {
      if (!pending || pending.kind !== 'quote') {
        if (pending && pending.kind === 'invoice') {
          const p = pending.payload;
          if (r.down_payment_percent != null) p.dp_amount = Math.round(p.total * r.down_payment_percent / 100);
          if (r.down_payment_amount != null) p.dp_amount = r.down_payment_amount;
          await db.from('telegram_pending_actions').update({ payload: p }).eq('id', pending.id);
          return showPending(chat_id, pending.id, 'invoice', p);
        }
        return send(chat_id, 'Belum ada aksi yang menunggu konfirmasi bro. Mau buat penawaran atau catat proyek baru?');
      }

      const p = pending.payload;

      for (const a of r.item_adjustments ?? []) {
        let targetItem: any = null;
        if (a.index != null && p.items[a.index]) {
          targetItem = p.items[a.index];
        } else if (a.item_keyword) {
          const kw = a.item_keyword.toLowerCase();
          targetItem = p.items.find((i: any) => (i.description || '').toLowerCase().includes(kw));
        }
        if (targetItem) {
          if (a.quantity != null) targetItem.quantity = a.quantity;
          if (a.unit_price != null) targetItem.unit_price = a.unit_price;
          if (a.cost_price != null) targetItem.cost_price = a.cost_price;
        }
      }

      for (const c of r.cost_adjustments ?? []) {
        if (!c.item_keyword) continue;
        const kw = c.item_keyword.toLowerCase();
        for (const it of p.items) {
          if ((it.description || '').toLowerCase().includes(kw)) it.cost_price = c.cost_price;
        }
      }

      if (r.total_cost_override != null) p.total_cost_override = r.total_cost_override;

      for (const e of r.extra_items ?? []) {
        p.items.push({
          description: e.description,
          quantity: e.quantity,
          unit: e.unit || 'Unit',
          unit_price: e.unit_price,
          cost_price: e.cost_price || 0,
          category: e.category || classifyItem(e),
        });
      }

      if (r.discount_amount != null) p.discount_amount = r.discount_amount;
      if (r.client_name) p.client_name = r.client_name;
      if (r.client_phone) p.client_phone = r.client_phone;
      if (r.client_address) p.client_address = r.client_address;
      if (r.proactive_note) p.proactive_note = r.proactive_note;

      await db.from('telegram_pending_actions').update({ payload: p }).eq('id', pending.id);
      return showPending(chat_id, pending.id, 'quote', p);
    }

    // ---------------------------------------------------- GET PDF
    case 'get_pdf': {
      const t = (r.target_text || '').trim();
      let q = db.from('quotes').select('*, quote_items(*)').eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(1);
      if (t) q = q.or(`quote_number.ilike.%${t}%,to_client.ilike.%${t}%`);
      const { data } = await q;
      const quote: any = data?.[0];
      if (!quote) return send(chat_id, `Dokumen penawaran untuk "${esc(t || 'terakhir')}" tidak ditemukan bro.`);

      const pdfBytes = generateBorneoDocumentPdf({
        type: 'quote',
        docNumber: quote.quote_number,
        dateStr: quote.created_at ? quote.created_at.slice(0, 10) : nowParts().iso,
        clientName: quote.to_client,
        clientPhone: quote.to_phone,
        clientAddress: quote.to_address,
        companyName: 'Borneo Etam CCTV & Komputer Kasir',
        companyPhone: '082251314646',
        companyWebsite: 'Borneoetam.com',
        paymentInstructions: 'Bank BCA\n5135400278\na.n Muhammad Wahyu',
        terms: quote.terms,
        items: quote.quote_items || [],
        discountAmount: quote.discount_amount || 0,
      });

      const safeName = `Penawaran-${(quote.to_client || 'Klien').replace(/[^a-zA-Z0-9]/g, '_')}-${quote.quote_number.replace(/\//g, '-')}.pdf`;
      const tot = (quote.quote_items || []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(quote.discount_amount || 0);

      await sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `📄 <b>Surat Penawaran Resmi: <code>${esc(quote.quote_number)}</code></b>\nKlien: <b>${esc(quote.to_client)}</b>\nTotal: <b>${rp(tot)}</b>`
      );

      const waDraft = makeWhatsAppText('quote', quote.quote_number, quote.to_client, tot);
      return send(chat_id, waDraft);
    }

    default:
      return send(chat_id, esc(r.reply || 'Siap bro! Saya bisa bantu buat penawaran, proses deal ke proyek & peta, catat belanja lapangan, buatkan faktur & BAST, cek durasi rekam harddisk, serta input master barang/jasa. Ada yang mau dikerjakan?'));
  }
}

// ------------------------------------------------------------------ eksekusi konfirmasi database
async function nextQuoteNumber(): Promise<string> {
  const { y, m } = nowParts();
  const prefix = `QUO/BE-CCTV/${ROMAN[m - 1]}/${y}/`;
  const { data } = await db.from('quotes').select('quote_number').eq('user_id', OWNER_ID).like('quote_number', `${prefix}%`);
  const max = (data ?? []).reduce((mx: number, r: any) => Math.max(mx, parseInt(String(r.quote_number).split('/').pop() || '0', 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

async function execQuote(chat_id: number, p: any): Promise<void> {
  const { data: profile } = await db.from('profiles').select('*').eq('id', OWNER_ID).maybeSingle();
  let clientId: string | null = null;
  const name = p.client_name.trim();
  const { data: ex } = await db.from('clients').select('id').eq('user_id', OWNER_ID).ilike('name', name).limit(1).maybeSingle();
  if (ex?.id) clientId = ex.id;
  else {
    const { data: nc } = await db.from('clients').insert({ user_id: OWNER_ID, name, address: p.client_address || '', phone: p.client_phone || '' }).select('id').single();
    clientId = nc?.id ?? null;
  }
  const number = await nextQuoteNumber();
  const valid = new Date(Date.now() + 14 * 86400000).toISOString();
  const { data: quote, error } = await db.from('quotes').insert({
    user_id: OWNER_ID, quote_number: number, status: 'Draf', client_id: clientId,
    from_company: profile?.company_name || 'Borneo Etam', from_address: profile?.company_address || '', from_website: profile?.company_website || '',
    to_client: name, to_address: p.client_address || '', to_phone: p.client_phone || '',
    title: `Penawaran ${p.package_name || 'Custom'} - ${name}`,
    discount_amount: p.discount_amount || 0, tax_amount: 0,
    terms: p.terms || profile?.default_terms || '', attachments: [],
    created_at: new Date().toISOString(), valid_until: valid,
  }).select('id').single();
  if (error || !quote) throw new Error('Gagal membuat penawaran: ' + (error?.message ?? ''));
  const rows = p.items.filter((i: any) => i.description?.trim()).map((i: any) => ({
    quote_id: quote.id, description: i.description.trim(), quantity: Number(i.quantity) || 0,
    unit: i.unit || '', unit_price: Number(i.unit_price) || 0, cost_price: Number(i.cost_price) || 0,
  }));
  const { error: ie } = await db.from('quote_items').insert(rows);
  if (ie) { await db.from('quotes').delete().eq('id', quote.id); throw new Error('Gagal menyimpan item: ' + ie.message); }

  const tot = subtotal(p.items) - (p.discount_amount || 0);
  const totalModal = p.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.cost_price) || 0), 0);
  const laba = tot - totalModal;

  // Generate PDF Resmi
  const pdfBytes = generateBorneoDocumentPdf({
    type: 'quote',
    docNumber: number,
    dateStr: nowParts().iso,
    clientName: name,
    clientPhone: p.client_phone,
    clientAddress: p.client_address,
    companyName: profile?.company_name || 'Borneo Etam CCTV & Komputer Kasir',
    companyPhone: profile?.company_phone || '082251314646',
    companyWebsite: profile?.company_website || 'Borneoetam.com',
    paymentInstructions: profile?.payment_instructions || 'Bank BCA\n5135400278\na.n Muhammad Wahyu',
    terms: p.terms || profile?.default_terms,
    items: p.items,
    discountAmount: p.discount_amount || 0,
  });

  const safeName = `Penawaran-${name.replace(/[^a-zA-Z0-9]/g, '_')}-${number.replace(/\//g, '-')}.pdf`;
  await sendDocument(
    chat_id,
    pdfBytes,
    safeName,
    `📄 <b>Surat Penawaran Resmi: <code>${esc(number)}</code></b>\nKlien: <b>${esc(name)}</b>\nTotal: <b>${rp(tot)}</b>\nEstimasi Laba: <b>${rp(laba)}</b>`
  );

  const waDraft = makeWhatsAppText('quote', number, name, tot);
  await send(
    chat_id,
    `<b>✅ Penawaran Berhasil Dibuat &amp; Tersimpan!</b>\n\n${waDraft}\n\n<i>Kalau konsumen sudah konfirmasi deal, cukup balas: <b>"Deal bro, lanjut buat proyek"</b></i>`,
    [
      [{ text: '🤝 Konfirmasi Deal & Buat Proyek', data: `deal:${quote.id}` }],
    ]
  );
}

async function handleCallback(cb: any) {
  const chat_id = cb.message.chat.id;
  const [action, id] = String(cb.data).split(':');
  await tg('answerCallbackQuery', { callback_query_id: cb.id });

  if (action === 'sj') {
    // Tombol cetak surat jalan langsung
    await handleText(chat_id, `cetak surat jalan ${id}`);
    return;
  }
  if (action === 'bast') {
    await handleText(chat_id, `cetak BAST ${id}`);
    return;
  }
  if (action === 'pdf') {
    await handleText(chat_id, `get pdf ${id}`);
    return;
  }
  if (action === 'deal') {
    await handleText(chat_id, `penawaran ini deal bro`);
    return;
  }

  const { data: row } = await db.from('telegram_pending_actions').select('*').eq('id', id).maybeSingle();
  if (!row || row.chat_id !== chat_id) return;

  await tg('editMessageReplyMarkup', { chat_id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });

  if (action === 'no') {
    await db.from('telegram_pending_actions').update({ status: 'cancelled' }).eq('id', id).in('status', ['pending', 'need_location']);
    return send(chat_id, 'Siap bro, dibatalkan. Tidak ada data yang tersimpan.');
  }

  if (action === 'ok') {
    const { data: claimed } = await db.from('telegram_pending_actions').update({ status: 'done' }).eq('id', id).eq('status', 'pending').select('id');
    if (!claimed || claimed.length === 0) return send(chat_id, 'Aksi ini sudah diproses atau kedaluwarsa bro.');
    try {
      if (row.kind === 'quote') {
        await execQuote(chat_id, row.payload);
      }
    } catch (e) {
      await db.from('telegram_pending_actions').update({ status: 'pending' }).eq('id', id);
      return send(chat_id, `⚠️ ${esc((e as Error).message)}\nTekan tombol di bawah untuk coba simpan ulang ya bro.`, [
        [{ text: '✅ Coba Lagi', data: `ok:${id}` }, { text: '❌ Batal', data: `no:${id}` }],
      ]);
    }
  }
}

// ------------------------------------------------------------------ webhook
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  if (!WEBHOOK_SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 401 });
  }
  let update: any;
  try { update = await req.json(); } catch { return new Response('ok'); }

  const from = update.message?.from?.id ?? update.callback_query?.from?.id;
  if (!ALLOWED_ID || from !== ALLOWED_ID) return new Response('ok');

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      const m = update.message;
      const chat_id = m.chat.id;

      // 1. Tangani Foto Dokumentasi Lapangan
      if (m.photo && m.photo.length > 0) {
        const photo = m.photo[m.photo.length - 1]; // Resolusi tertinggi
        const cap = (m.caption || '').trim();

        // Cari proyek aktif terdekat
        let q = db.from('cctv_installations').select('id, project_name, photos').eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(1);
        if (cap) q = q.or(`project_name.ilike.%${cap}%,client_name.ilike.%${cap}%`);
        const { data: instList } = await q;
        const targetInst = instList?.[0];

        if (targetInst) {
          const fileInfo = await tg('getFile', { file_id: photo.file_id });
          const filePath = fileInfo?.result?.file_path;
          const photoUrl = filePath ? `https://api.telegram.org/file/bot${TOKEN}/${filePath}` : photo.file_id;

          const currentPhotos = Array.isArray(targetInst.photos) ? targetInst.photos : [];
          currentPhotos.push({
            url: photoUrl,
            caption: cap || 'Dokumentasi instalasi lapangan',
            uploaded_at: new Date().toISOString(),
          });

          await db.from('cctv_installations').update({ photos: currentPhotos }).eq('id', targetInst.id);
          await send(chat_id, `📸 <b>Foto Dokumentasi Berhasil Disimpan!</b>\nProyek: <b>${esc(targetInst.project_name)}</b>\nFoto sudah otomatis muncul di Peta Command Center dan Portofolio Publik.`);
        } else {
          await send(chat_id, 'Foto diterima bro! Kalau mau disimpan ke proyek tertentu, sertakan caption nama proyeknya ya (misal: <i>Foto proyek Pak Suhabuddin</i>).');
        }
      }
      // 2. Tangani Pesan Teks
      else if (m.text) {
        const t = String(m.text).trim();
        if (t === '/start' || t === '/help') {
          await send(
            chat_id,
            '<b>Borneo Etam AI Command Center</b>\n' +
            'Halo Mas Wahyu! Sistem operasional CCTV & POS siap melayani:\n\n' +
            '<b>Contoh Perintah Operasional:</b>\n' +
            '• <i>buatkan penawaran Pak Suhabuddin paket 4 titik diskon 200rb</i>\n' +
            '• <i>deal bro, lanjut buat proyek</i> (otomatis masuk Peta & Proyek)\n' +
            '• <i>sudah beli pipa conduit 150rb untuk proyek Pak Suhabuddin</i> (catat pengeluaran)\n' +
            '• <i>proyek Pak Suhabuddin sudah selesai pasang</i> (otomatis Faktur, BAST & Garansi)\n' +
            '• <i>cetak surat jalan Pak Suhabuddin</i>\n' +
            '• <i>cetak BAST Pak Suhabuddin</i>\n' +
            '• <i>4 kamera 2MP HDD 1TB tahan berapa hari bro?</i>\n' +
            '• <i>tolong masukkan barang ini: Kamera ColorVu 4MP jual 450rb modal 320rb</i>\n' +
            '• <i>rekap performa bulan ini bro</i>'
          );
        } else if (t === '/batal') {
          const row = await latestPending(chat_id);
          if (row) await db.from('telegram_pending_actions').update({ status: 'cancelled' }).eq('id', row.id);
          await send(chat_id, row ? 'Aksi dibatalkan bro.' : 'Tidak ada aksi yang menunggu konfirmasi.');
        } else {
          await handleText(chat_id, t);
        }
      }
      // 3. Tangani Pesan Suara (Voice Note)
      else if (m.voice || m.audio) {
        const voiceObj = m.voice || m.audio;
        await send(chat_id, '🎙️ <i>Mendengarkan pesan suara Mas Wahyu...</i>');
        try {
          const fileInfo = await tg('getFile', { file_id: voiceObj.file_id });
          const filePath = fileInfo?.result?.file_path;
          if (filePath) {
            const voiceRes = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${filePath}`);
            const buf = await voiceRes.arrayBuffer();
            const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
            await handleText(chat_id, '', { mimeType: 'audio/ogg', data: b64 });
          } else {
            await send(chat_id, 'Gagal mengunduh audio dari Telegram bro, coba ketik via teks ya.');
          }
        } catch (vErr: any) {
          console.error('voice error', vErr);
          await send(chat_id, `⚠️ Gagal memproses audio: ${esc(vErr.message)}`);
        }
      }
    }
  } catch (e) {
    console.error('bot error', e);
    const chat = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
    if (chat) {
      const msg = (e as Error).message || '';
      if (/503|UNAVAILABLE|high demand|overloaded/i.test(msg)) {
        await send(chat, '⚠️ Server AI Google sedang mengalami lonjakan trafik sesaat bro. Coba kirim ulang pesan kamu ya!');
      } else {
        await send(chat, `⚠️ Ada kendala: ${esc(msg.slice(0, 200))}`);
      }
    }
  }
  return new Response('ok');
});
