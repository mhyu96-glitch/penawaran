// Bot Telegram Borneo Etam: buat penawaran, faktur, proyek + titik peta, cek modal & laba.
// Dilengkapi asisten proaktif yang mengecek kelengkapan penawaran & pembaca angka fleksibel (200rb, 2jt, dll).
// File PDF resmi otomatis di-generate (format Executive A4) dan dikirim langsung ke chat Telegram.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { DEFAULT_PACKAGES } from './packages.ts';
import { generateBorneoDocumentPdf, classifyItem, ItemCategory } from './pdf.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const TOKEN = env('TELEGRAM_BOT_TOKEN');
const WEBHOOK_SECRET = env('TELEGRAM_WEBHOOK_SECRET');
const ALLOWED_ID = Number(env('ALLOWED_TELEGRAM_ID'));
const OWNER_ID = env('OWNER_USER_ID');
const GEMINI_KEY = env('GEMINI_API_KEY');
const CANDIDATE_MODELS = [
  env('GEMINI_MODEL') || 'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.5-pro',
].filter(Boolean);
const APP_URL = env('APP_BASE_URL').replace(/\/$/, '');

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

// ------------------------------------------------------------------ util
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rp = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

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

// ------------------------------------------------------------------ Gemini
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: { type: 'STRING', enum: ['create_quote', 'create_invoice', 'add_project', 'update_progress', 'modify_pending', 'get_pdf', 'chat'] },
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
    proactive_note: { type: 'STRING', nullable: true },
  },
  required: ['intent'],
};

async function askGemini(text: string, packages: any[], pending: any | null): Promise<any> {
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

  const system = `Kamu adalah asisten pribadi AI & partner kerja setia untuk Mas Wahyu (Owner Borneo Etam CCTV & Komputer Kasir) di Kalimantan Timur.

PENTING TENTANG PENGGUNA:
- Yang sedang chat denganmu adalah Mas Wahyu (Owner / Bos Borneo Etam), BUKAN pembeli/klien!
- Gaya bicaramu: santai, akrab, solutif, proaktif, dan bersahabat (panggil "bro" atau "Mas Wahyu").
- Jangan pernah kaku seperti robot customer service!
- Jika Mas Wahyu menyebut nama seseorang (contoh: "Pak Suhabuddin", "Bu Linda", "Haji Ismail"), itu adalah nama KONSUMEN / KLIEN Mas Wahyu.
- JANGAN GUNAKAN HURUF BESAR SEMUA (ALL CAPS). Selalu gunakan gaya penulisan normal yang rapi (Title Case atau Sentence case).

ATURAN PENGURAIAN ANGKA & MATA UANG INDONESIA (MUTLAK):
User sering mengetik angka dalam bahasa sehari-hari:
- "200rb", "200 rb", "200k", "200ribu" -> 200000
- "2 jt", "2jt", "2juta", "2.000.000", "2,000,000" -> 2000000
- "1,5jt", "1.5 jt", "1.5jt", "1,5 juta" -> 1500000
- "2,2jt", "2.2 jt", "2.200.000" -> 2200000
- "500k", "500 rb" -> 500000
- "75rb", "75 k" -> 75000
- "15rb", "25rb" -> 15000, 25000
Semua nilai uang/harga harus selalu diekstrak sebagai NUMBER integer murni!

FITUR MODAL & PERHITUNGAN LABA:
- Mas Wahyu butuh memasukkan harga modal (HPP) agar bisa memantau laba bersih proyek.
- Jika Mas Wahyu menyebut harga modal untuk barang tertentu (contoh: "modal kamera 200rb", "modal dvr jadi 500rb", "kabel modal 180rb"):
  isi cost_adjustments: [{ item_keyword: "kamera", cost_price: 200000 }] atau item_adjustments.cost_price.
- Jika Mas Wahyu menambahkan barang ekstra dengan harga jual & modal (contoh: "tambah pipa conduit 10 btg harga 25rb modal 15rb"):
  isi extra_items dengan unit_price=25000, cost_price=15000, category='material_tambahan'.
- Jika Mas Wahyu menyebut total modal borongan (contoh: "total modal 2,3jt"):
  isi total_cost_override = 2300000.

STRUKTUR LAPORAN 3 KATEGORI:
Setiap laporan Borneo Etam terdiri dari 3 kelompok:
1. Item Utama: Kamera, NVR, DVR, Harddisk, PC Kasir, Printer, Scanner, Cash Drawer.
2. Material Tambahan: Kabel Coaxial/LAN, BNC, Jack DC, Power Supply, Pipa Conduit, Klem, Steker, Box Panel.
3. Jasa dan Akomodasi: Jasa instalasi kabel, konfigurasi cloud & setting HP, akomodasi luar kota, training kasir.

KOMUNIKASI PROAKTIF (CEK KELENGKAPAN):
- Perhatikan apakah ada yang kurang dari draf penawaran Mas Wahyu (misal: belum ada kabel, belum ada pipa pelindung, jasa pasang belum masuk, atau nomor WA klien belum ada).
- Berikan saran atau pertanyaan ramah di field proactive_note (misal: "Bro, jasa pasang dan kabelnya sudah termasuk atau supply unit saja?").

Hari ini: ${nowParts().iso}. Tugasmu mengekstrak maksud pesan menjadi JSON sesuai skema.
Intent:
- get_pdf: Minta file PDF penawaran/faktur yang sudah dibuat (misal "mana penawarannya pdf", "kirim pdf Pak Suhabuddin", "minta pdf terakhir"). target_text = nama klien atau nomor dokumen.
- create_quote: Minta dibuatkan penawaran baru. Isi client_name, client_phone, client_address, package_id dari katalog, item_adjustments, extra_items (dengan cost_price & category jika ada), discount_amount, total_cost_override, proactive_note.
- create_invoice: Minta dibuatkan faktur dari penawaran. target_text = nama klien atau nomor penawaran. Isi down_payment_percent atau down_payment_amount jika ada DP.
- add_project: Catat proyek baru & titik koordinat peta. Isi project_name, client_name, client_phone, client_address, city, service_type, progress, installed_at, sn_nvr, sn_hdd.
- update_progress: Update progres proyek yang ada. target_text = nama proyek/klien. Isi progress/sn_nvr/sn_hdd/installed_at.
- modify_pending: Pesan merevisi aksi yang MENUNGGU KONFIRMASI (misal "diskon 200rb", "tambah pipa 10 btg harga 25rb modal 15rb", "modal kamera jadi 190rb", "DP 2jt").
- chat: Obrolan santai lain; isi field reply dengan gaya partner kerja yang santai, akrab, dan tawarkan bantuan operasional.

KATALOG PAKET:
${catalog}${pendingInfo}`;

  const payloadBody = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text }] }],
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
          console.warn(`Gemini ${model} returned ${res.status} on attempt ${attempt}. Retrying/fallback...`);
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
        console.warn(`Error with model ${model} (attempt ${attempt}):`, err.message);
        if (attempt === 1) await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError || new Error('Gagal menghubungi layanan AI setelah beberapa percobaan.');
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

  // Kelompokkan dalam 3 kategori standar
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

  // Analisis proaktif: cek apakah ada komponen yang kurang
  const questions: string[] = [];
  if (groups.material_tambahan.length === 0) {
    questions.push('• <i>Belum ada material tambahan (kabel/pipa/konektor), sudah include atau supply sendiri bro?</i>');
  }
  if (groups.jasa_akomodasi.length === 0) {
    questions.push('• <i>Belum ada jasa instalasi/setting HP, mau ditambahkan atau beli putus unit?</i>');
  }
  const zeroCostCount = activeItems.filter((i: any) => !i.cost_price || Number(i.cost_price) === 0).length;
  if (zeroCostCount > 0 && !p.total_cost_override) {
    questions.push('• <i>Ada item yang belum ada harga modalnya, mau diisi sekalian biar hitungan laba presisi?</i>');
  }
  if (!p.client_phone || !p.client_address) {
    questions.push('• <i>Kontak WA atau alamat klien belum lengkap, mau dimasukkan sekalian biar tertera di PDF?</i>');
  }

  let text = `<b>📄 Konfirmasi Penawaran Baru</b>\n` +
    `Klien: <b>${esc(p.client_name)}</b>\n` +
    `Alamat: ${esc(p.client_address || '-')}\n` +
    `WhatsApp: ${esc(p.client_phone || '-')}\n` +
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

  text += `\n<i>Kira-kira ada yang kurang gak bro? Kalau mau ubah misal balas: "diskon 200rb", "tambah pipa 10 btg modal 15rb", atau "modal kamera 190rb".</i>\n\n<b>Sudah pas dan mau dibuatkan PDF resminya?</b>`;

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

// ------------------------------------------------------------------ intent -> pending
async function handleText(chat_id: number, text: string) {
  const packages = await loadPackages();
  const pending = await latestPending(chat_id);
  const r = await askGemini(text, packages, pending);

  switch (r.intent) {
    case 'get_pdf': {
      const t = (r.target_text || '').trim();
      let q = db.from('quotes').select('*, quote_items(*)')
        .eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(1);
      if (t) q = q.or(`quote_number.ilike.%${t}%,to_client.ilike.%${t}%`);
      const { data } = await q;
      const quote: any = data?.[0];
      if (!quote) return send(chat_id, `Dokumen penawaran untuk "${esc(t || 'terakhir')}" tidak ditemukan bro.`);

      const { data: profile } = await db.from('profiles').select('*').eq('id', OWNER_ID).maybeSingle();
      const pdfBytes = generateBorneoDocumentPdf({
        type: 'quote',
        docNumber: quote.quote_number,
        dateStr: quote.created_at ? quote.created_at.slice(0, 10) : nowParts().iso,
        clientName: quote.to_client,
        clientPhone: quote.to_phone,
        clientAddress: quote.to_address,
        companyName: profile?.company_name || quote.from_company || 'Borneo Etam CCTV & Komputer Kasir',
        companyPhone: profile?.company_phone || '082251314646',
        companyWebsite: profile?.company_website || 'Borneoetam.com',
        paymentInstructions: profile?.payment_instructions || 'Bank BCA\n5135400278\na.n Muhammad Wahyu',
        terms: quote.terms,
        items: quote.quote_items || [],
        discountAmount: quote.discount_amount || 0,
      });

      const safeName = `Penawaran-${(quote.to_client || 'Klien').replace(/[^a-zA-Z0-9]/g, '_')}-${quote.quote_number.replace(/\//g, '-')}.pdf`;
      const tot = (quote.quote_items || []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(quote.discount_amount || 0);
      return sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `📄 <b>Surat Penawaran Resmi</b>: <code>${esc(quote.quote_number)}</code>\nKlien: <b>${esc(quote.to_client)}</b>\nTotal: <b>${rp(tot)}</b>\n\nDesain Executive A4 siap dibagikan ke klien!`
      );
    }

    case 'create_quote': {
      if (!r.client_name) {
        return send(
          chat_id,
          'Kliennya atas nama siapa bro? Contoh: <i>buatkan penawaran Pak Hendra, Jl. Ahmad Yani Samarinda, paket 4 titik CCTV diskon 200rb</i>'
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
          if ((it.description || '').toLowerCase().includes(kw)) {
            it.cost_price = c.cost_price;
          }
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

    case 'modify_pending': {
      if (!pending || pending.kind !== 'quote') {
        if (pending && pending.kind === 'invoice') {
          const p = pending.payload;
          if (r.down_payment_percent != null) p.dp_amount = Math.round(p.total * r.down_payment_percent / 100);
          if (r.down_payment_amount != null) p.dp_amount = r.down_payment_amount;
          await db.from('telegram_pending_actions').update({ payload: p }).eq('id', pending.id);
          return showPending(chat_id, pending.id, 'invoice', p);
        }
        if (pending && pending.kind === 'project') {
          const p = pending.payload;
          for (const k of ['project_name', 'client_name', 'client_phone', 'city', 'progress', 'installed_at', 'sn_nvr', 'sn_hdd', 'service_type']) {
            if (r[k] != null) p[k] = r[k];
          }
          if (r.client_address) p.address_landmark = r.client_address;
          await db.from('telegram_pending_actions').update({ payload: p }).eq('id', pending.id);
          return showPending(chat_id, pending.id, 'project', p);
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
          if ((it.description || '').toLowerCase().includes(kw)) {
            it.cost_price = c.cost_price;
          }
        }
      }

      if (r.total_cost_override != null) {
        p.total_cost_override = r.total_cost_override;
      }

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

    case 'create_invoice': {
      const t = (r.target_text || '').trim();
      let q = db.from('quotes').select('id, quote_number, to_client, discount_amount, quote_items(quantity, unit_price)')
        .eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(1);
      if (t) q = q.or(`quote_number.ilike.%${t}%,to_client.ilike.%${t}%`);
      const { data } = await q;
      const quote: any = data?.[0];
      if (!quote) return send(chat_id, `Penawaran untuk "${esc(t || 'terakhir')}" tidak ketemu bro.`);
      const total = (quote.quote_items ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(quote.discount_amount || 0);
      let dp = 0;
      if (r.down_payment_amount != null) dp = r.down_payment_amount;
      else if (r.down_payment_percent != null) dp = Math.round(total * r.down_payment_percent / 100);
      const payload = { quote_id: quote.id, quote_number: quote.quote_number, client_name: quote.to_client, total, dp_amount: dp };
      const id = await savePending(chat_id, 'invoice', payload);
      return showPending(chat_id, id, 'invoice', payload);
    }

    case 'add_project': {
      if (!r.project_name && !r.client_name) return send(chat_id, 'Nama proyek atau kliennya apa bro?');
      const pkg = packages.find((p) => p.id === r.package_id) ?? null;
      const payload: any = {
        project_name: r.project_name || `Proyek ${r.client_name}`,
        client_name: r.client_name || '', client_phone: r.client_phone || '',
        address_landmark: r.client_address || '', city: r.city || 'Samarinda',
        service_type: r.service_type || pkg?.service_type || 'CCTV',
        package_name: pkg?.shortName ?? '', warranty_months: pkg?.warrantyMonths ?? 12,
        progress: r.progress ?? 0, installed_at: r.installed_at || null,
        sn_nvr: r.sn_nvr || '', sn_hdd: r.sn_hdd || '', is_public: false,
        latitude: null, longitude: null, geo_source: '',
      };
      if (payload.progress === 100 && !payload.installed_at) payload.installed_at = nowParts().iso;
      const geo = payload.address_landmark ? await geocode(payload.address_landmark, payload.city) : null;
      if (geo) {
        Object.assign(payload, { latitude: geo.lat, longitude: geo.lng, geo_source: 'dari alamat, cek akurasi' });
        const id = await savePending(chat_id, 'project', payload);
        return showPending(chat_id, id, 'project', payload);
      }
      await savePending(chat_id, 'project', payload, 'need_location');
      return send(chat_id, `Titik "<b>${esc(payload.project_name)}</b>" belum ketemu otomatis dari alamat. Kirim <b>pin lokasi Telegram</b> (📎 → Lokasi) ya bro.`);
    }

    case 'update_progress': {
      const t = (r.target_text || r.project_name || r.client_name || '').trim();
      if (!t) return send(chat_id, 'Proyek yang mana bro?');
      const { data } = await db.from('cctv_installations').select('id, project_name')
        .eq('user_id', OWNER_ID).or(`project_name.ilike.%${t}%,client_name.ilike.%${t}%`)
        .order('created_at', { ascending: false }).limit(3);
      if (!data || data.length === 0) return send(chat_id, `Proyek "${esc(t)}" tidak ketemu bro.`);
      const payload: any = { installation_id: data[0].id, project_name: data[0].project_name, progress: r.progress ?? null, sn_nvr: r.sn_nvr || '', sn_hdd: r.sn_hdd || '', installed_at: r.installed_at || null };
      if (payload.progress === 100 && !payload.installed_at) payload.installed_at = nowParts().iso;
      const id = await savePending(chat_id, 'progress', payload);
      return showPending(chat_id, id, 'progress', payload);
    }

    default:
      return send(chat_id, esc(r.reply || 'Siap bro! Saya bisa bantu buat penawaran, cek estimasi laba/HPP, kirim PDF resmi, buat faktur tagihan, serta catat proyek ke peta. Mau ngerjain apa sekarang?'));
  }
}

// ------------------------------------------------------------------ eksekusi
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
  const link = APP_URL ? `\n📄 Web: ${APP_URL}/quote/public/${quote.id}` : '';
  await send(
    chat_id,
    `<b>✅ Penawaran Berhasil Dibuat &amp; Tersimpan!</b>\n` +
    `No: <code>${esc(number)}</code>\n` +
    `Klien: <b>${esc(name)}</b>\n` +
    `Total Penawaran: <b>${rp(tot)}</b>\n` +
    `Total Modal (HPP): <b>${rp(totalModal)}</b>\n` +
    `💰 Estimasi Laba Bersih: <b>${rp(laba)}</b>\n` +
    `Status: Draf${link}`
  );

  // Otomatis generate & kirim file PDF resmi ke chat Telegram
  try {
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
      `📄 <b>Surat Penawaran Resmi</b> untuk <b>${esc(name)}</b>\nNo: <code>${esc(number)}</code>\nTotal: <b>${rp(tot)}</b>\n\nFormat Executive A4 siap dicetak atau dikirimkan ke klien!`
    );
  } catch (err) {
    console.error('Failed generating PDF in execQuote:', err);
  }
}

async function execInvoice(chat_id: number, p: any): Promise<void> {
  const { data: quote } = await db.from('quotes').select('*, quote_items(*)').eq('id', p.quote_id).single();
  if (!quote) throw new Error('Penawaran sumber tidak ditemukan.');
  const { data: existing } = await db.from('invoices').select('id, invoice_number').eq('quote_id', quote.id).limit(1);
  if (existing && existing.length > 0) {
    await send(chat_id, `Faktur untuk penawaran ini sudah ada: <code>${esc(existing[0].invoice_number)}</code>.`);
    return;
  }
  const { y } = nowParts();
  const { data: last } = await db.from('invoices').select('invoice_number').eq('user_id', OWNER_ID).like('invoice_number', `INV-${y}-%`).order('created_at', { ascending: false }).limit(1);
  const lastNum = parseInt(String(last?.[0]?.invoice_number || '').split('-').pop() || '0', 10) || 0;
  const number = `INV-${y}-${String(lastNum + 1).padStart(3, '0')}`;
  let payload: Record<string, any> = {
    user_id: OWNER_ID, quote_id: quote.id, client_id: quote.client_id || null, project_id: quote.project_id || null,
    from_company: quote.from_company || '', from_address: quote.from_address || '', from_website: quote.from_website || '',
    to_client: quote.to_client || '', to_address: quote.to_address || '', to_phone: quote.to_phone || '',
    title: quote.title || `Faktur dari ${quote.quote_number}`, discount_amount: quote.discount_amount || 0, tax_amount: quote.tax_amount || 0,
    terms: quote.terms || '', status: 'Draf', invoice_number: number, invoice_date: new Date().toISOString(),
    due_date: quote.valid_until || null, down_payment_amount: p.dp_amount || 0, attachments: quote.attachments || [],
  };
  let res = await db.from('invoices').insert(payload).select('id, invoice_number').single();
  for (const drop of ['invoice_date', 'project_id', 'down_payment_amount']) {
    if (!res.error || !/column/i.test(res.error.message)) break;
    delete payload[drop];
    res = await db.from('invoices').insert(payload).select('id, invoice_number').single();
  }
  if (res.error || !res.data) throw new Error('Gagal membuat faktur: ' + (res.error?.message ?? ''));
  const rows = (quote.quote_items ?? []).map((i: any) => ({
    invoice_id: res.data.id, description: i.description || '', quantity: Number(i.quantity) || 0,
    unit: i.unit || 'Unit', unit_price: Number(i.unit_price) || 0, cost_price: Number(i.cost_price) || 0,
  }));
  if (rows.length) {
    const { error: ie } = await db.from('invoice_items').insert(rows);
    if (ie) { await db.from('invoices').delete().eq('id', res.data.id); throw new Error('Gagal menyalin item faktur: ' + ie.message); }
  }
  await db.from('quotes').update({ status: 'Diterima' }).eq('id', quote.id);

  const { data: profile } = await db.from('profiles').select('*').eq('id', OWNER_ID).maybeSingle();
  const link = APP_URL ? `\n🧾 Web: ${APP_URL}/invoice/public/${res.data.id}` : '';
  await send(
    chat_id,
    `<b>✅ Faktur Berhasil Diterbitkan!</b>\n` +
    `No: <code>${esc(res.data.invoice_number)}</code>\n` +
    `DP: ${rp(p.dp_amount)} • Sisa: ${rp(p.total - p.dp_amount)}\n` +
    `Penawaran ${esc(quote.quote_number)} ditandai Diterima.${link}`
  );

  // Otomatis buatkan & kirimkan file PDF Faktur resmi ke chat Telegram
  try {
    const pdfBytes = generateBorneoDocumentPdf({
      type: 'invoice',
      docNumber: res.data.invoice_number,
      dateStr: nowParts().iso,
      clientName: quote.to_client,
      clientPhone: quote.to_phone,
      clientAddress: quote.to_address,
      companyName: profile?.company_name || 'Borneo Etam CCTV & Komputer Kasir',
      companyPhone: profile?.company_phone || '082251314646',
      companyWebsite: profile?.company_website || 'Borneoetam.com',
      paymentInstructions: profile?.payment_instructions || 'Bank BCA\n5135400278\na.n Muhammad Wahyu',
      terms: quote.terms,
      items: quote.quote_items || [],
      discountAmount: quote.discount_amount || 0,
      downPaymentAmount: p.dp_amount || 0,
    });
    const safeName = `Faktur-${quote.to_client.replace(/[^a-zA-Z0-9]/g, '_')}-${res.data.invoice_number.replace(/\//g, '-')}.pdf`;
    await sendDocument(
      chat_id,
      pdfBytes,
      safeName,
      `🧾 <b>PDF Faktur Resmi</b> untuk <b>${esc(quote.to_client)}</b>\nNo: <code>${esc(res.data.invoice_number)}</code>\nTotal Tagihan: <b>${rp(p.total)}</b>`
    );
  } catch (err) {
    console.error('Failed generating PDF in execInvoice:', err);
  }
}

async function execProject(p: any): Promise<string> {
  const { error } = await db.from('cctv_installations').insert({
    user_id: OWNER_ID, project_name: p.project_name,
    public_display_name: `Instalasi ${p.service_type} - Area ${p.city}`,
    client_name: p.client_name, client_phone: p.client_phone, address_landmark: p.address_landmark,
    service_type: p.service_type, package_name: p.package_name, city: p.city,
    latitude: p.latitude, longitude: p.longitude, progress: p.progress,
    sn_nvr: p.sn_nvr, sn_hdd: p.sn_hdd, installed_at: p.installed_at, warranty_months: p.warranty_months,
    is_public_portfolio: !!p.is_public, notes: 'Dibuat via bot Telegram', photos: [],
  });
  if (error) throw new Error('Gagal menyimpan proyek: ' + error.message);
  return `<b>✅ Titik Proyek Masuk Peta!</b>\n${esc(p.project_name)} sudah muncul di Command Center${p.progress === 100 ? ' dan Monitor Garansi' : ''}.`;
}

async function execProgress(p: any): Promise<string> {
  const patch: Record<string, any> = {};
  if (p.progress != null) patch.progress = p.progress;
  if (p.sn_nvr) patch.sn_nvr = p.sn_nvr;
  if (p.sn_hdd) patch.sn_hdd = p.sn_hdd;
  if (p.installed_at) patch.installed_at = p.installed_at;
  if (Object.keys(patch).length === 0) return 'Tidak ada perubahan yang disebutkan.';
  patch.updated_at = new Date().toISOString();
  const { error } = await db.from('cctv_installations').update(patch).eq('id', p.installation_id).eq('user_id', OWNER_ID);
  if (error) throw new Error('Gagal update proyek: ' + error.message);
  return `<b>✅ Proyek Berhasil Diperbarui!</b>\n${esc(p.project_name)}`;
}

async function handleCallback(cb: any) {
  const chat_id = cb.message.chat.id;
  const [action, id] = String(cb.data).split(':');
  await tg('answerCallbackQuery', { callback_query_id: cb.id });

  const { data: row } = await db.from('telegram_pending_actions').select('*').eq('id', id).maybeSingle();
  if (!row || row.chat_id !== chat_id) return;

  if (action === 'pub' && row.status === 'pending') {
    row.payload.is_public = !row.payload.is_public;
    await db.from('telegram_pending_actions').update({ payload: row.payload }).eq('id', id);
    await tg('editMessageReplyMarkup', { chat_id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });
    return showPending(chat_id, id, 'project', row.payload);
  }

  await tg('editMessageReplyMarkup', { chat_id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });

  if (action === 'no') {
    await db.from('telegram_pending_actions').update({ status: 'cancelled' }).eq('id', id).in('status', ['pending', 'need_location']);
    return send(chat_id, 'Siap bro, dibatalkan. Tidak ada data yang tersimpan.');
  }

  if (action === 'ok') {
    // klaim atomik agar klik ganda / retry tidak membuat data dobel
    const { data: claimed } = await db.from('telegram_pending_actions').update({ status: 'done' }).eq('id', id).eq('status', 'pending').select('id');
    if (!claimed || claimed.length === 0) return send(chat_id, 'Aksi ini sudah diproses atau kedaluwarsa bro.');
    try {
      if (row.kind === 'quote') {
        await execQuote(chat_id, row.payload);
      } else if (row.kind === 'invoice') {
        await execInvoice(chat_id, row.payload);
      } else if (row.kind === 'project') {
        const msg = await execProject(row.payload);
        await send(chat_id, msg);
      } else {
        const msg = await execProgress(row.payload);
        await send(chat_id, msg);
      }
    } catch (e) {
      await db.from('telegram_pending_actions').update({ status: 'pending' }).eq('id', id);
      return send(chat_id, `⚠️ ${esc((e as Error).message)}\nTekan tombol di bawah untuk coba simpan ulang ya bro.`, [
        [{ text: '✅ Coba Lagi', data: `ok:${id}` }, { text: '❌ Batal', data: `no:${id}` }],
      ]);
    }
  }
}

async function handleLocation(chat_id: number, loc: { latitude: number; longitude: number }) {
  const row = await latestPending(chat_id, ['need_location', 'pending']);
  if (!row || row.kind !== 'project') return send(chat_id, 'Lokasi diterima, tapi belum ada proyek yang menunggu titik bro. Ketik dulu: <i>tambah proyek ...</i>');
  const p = row.payload;
  Object.assign(p, { latitude: loc.latitude, longitude: loc.longitude, geo_source: 'dari pin Telegram' });
  await db.from('telegram_pending_actions').update({ payload: p, status: 'pending' }).eq('id', row.id);
  return showPending(chat_id, row.id, 'project', p);
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
  if (!ALLOWED_ID || from !== ALLOWED_ID) return new Response('ok'); // diam untuk orang lain

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      const m = update.message;
      const chat_id = m.chat.id;
      if (m.location) await handleLocation(chat_id, m.location);
      else if (m.text) {
        const t = String(m.text).trim();
        if (t === '/start' || t === '/help') {
          await send(
            chat_id,
            '<b>Borneo Etam AI Assistant</b>\n' +
            'Halo Mas Wahyu! Saya siap bantu operasional CCTV & POS:\n\n' +
            '<b>Contoh Perintah Cepat:</b>\n' +
            '• <i>buatkan penawaran Pak Suhabuddin paket 4 titik CCTV diskon 200rb</i>\n' +
            '• <i>tambah pipa conduit 10 btg harga 25rb modal 15rb</i>\n' +
            '• <i>modal kamera jadi 190rb</i> (cek laba otomatis)\n' +
            '• <i>mana penawarannya pdf ya</i> (atau <i>kirim pdf Pak Suhabuddin</i>)\n' +
            '• <i>buatkan faktur Pak Suhabuddin DP 2jt</i>\n' +
            '• <i>tambah proyek Kafe Tepian Samarinda, SN NVR 12345, progres 100%</i>\n\n' +
            'Semua data akan dikonfirmasikan dulu sebelum disimpan ke database.'
          );
        } else if (t === '/batal') {
          const row = await latestPending(chat_id);
          if (row) await db.from('telegram_pending_actions').update({ status: 'cancelled' }).eq('id', row.id);
          await send(chat_id, row ? 'Aksi dibatalkan bro.' : 'Tidak ada aksi yang menunggu konfirmasi.');
        } else {
          await handleText(chat_id, t);
        }
      } else {
        await send(chat_id, 'Untuk saat ini saya paham pesan teks dan pin lokasi Telegram ya bro.');
      }
    }
  } catch (e) {
    console.error('bot error', e);
    const chat = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
    if (chat) {
      const msg = (e as Error).message || '';
      if (/503|UNAVAILABLE|high demand|overloaded/i.test(msg)) {
        await send(chat, '⚠️ Server AI Google sedang mengalami lonjakan sesaat bro. Coba kirim ulang pesan kamu ya!');
      } else {
        await send(chat, `⚠️ Ada kendala: ${esc(msg.slice(0, 200))}`);
      }
    }
  }
  return new Response('ok');
});
