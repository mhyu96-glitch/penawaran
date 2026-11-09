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
  terbilang,
  angkaKeKata,
  ItemCategory,
  DocItem,
} from './pdf.ts';
import { convertToWebP } from './image.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const TOKEN = env('TELEGRAM_BOT_TOKEN');
const WEBHOOK_SECRET = env('TELEGRAM_WEBHOOK_SECRET');
const ALLOWED_ID = Number(env('ALLOWED_TELEGRAM_ID'));
const OWNER_ID = env('OWNER_USER_ID');
const GEMINI_KEY = env('GEMINI_API_KEY');
const APP_URL = (env('APP_BASE_URL') || 'https://quoteapp-glass.vercel.app').replace(/\/$/, '');

const rawModel = env('GEMINI_MODEL');
const initialModel = (rawModel && !rawModel.includes('2.5-pro') && !rawModel.includes('1.0')) ? rawModel : 'gemini-2.5-flash';

const CANDIDATE_MODELS = [
  initialModel,
  'gemini-2.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter((m, i, arr) => m && arr.indexOf(m) === i);

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

const send = (chat_id: number, text: string, buttons?: { text: string; data?: string; url?: string }[][]) =>
  tg('sendMessage', {
    chat_id,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(buttons
      ? {
          reply_markup: {
            inline_keyboard: buttons.map((r) =>
              r.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data || '' }))
            ),
          },
        }
      : {}),
  });

async function sendDocument(chat_id: number, bytes: Uint8Array, filename: string, caption?: string, buttons?: { text: string; data?: string; url?: string }[][]) {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const form = new FormData();
  form.append('chat_id', String(chat_id));
  form.append('document', blob, filename);
  if (caption) form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  if (buttons) {
    form.append('reply_markup', JSON.stringify({
      inline_keyboard: buttons.map((r) =>
        r.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data || '' }))
      ),
    }));
  }
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

// ------------------------------------------------------------------ paket (in-memory cached 5m)
let cachedPackages: any[] | null = null;
let lastPackagesLoadedAt = 0;
async function loadPackages(): Promise<any[]> {
  const now = Date.now();
  if (cachedPackages && now - lastPackagesLoadedAt < 5 * 60 * 1000) {
    return cachedPackages;
  }
  try {
    const { data } = await db.from('borneo_packages').select('id,data').eq('user_id', OWNER_ID);
    if (data && data.length > 0) {
      cachedPackages = data.map((r: any) => ({ ...r.data, id: r.id }));
    } else {
      cachedPackages = DEFAULT_PACKAGES;
    }
  } catch (_) {
    cachedPackages = DEFAULT_PACKAGES;
  }
  lastPackagesLoadedAt = now;
  return cachedPackages;
}

const cloneItems = (pkg: any) => (pkg?.items ?? []).map((i: any) => ({ ...i }));
const subtotal = (items: any[]) => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);

// ------------------------------------------------------------------ Smart Document & Client Matching
function cleanSearchName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\b(pak|bpk|bapak|ibu|bu|toko|cv|pt|penawaran|faktur|minta|cetak|buatkan|buat)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getConsonantSkeleton(s: string): string {
  return cleanSearchName(s).replace(/[aiueo]/g, '');
}

async function findQuoteOrInvoice(
  targetText: string,
  preferredType: 'invoice' | 'quote' | 'auto' = 'auto'
): Promise<{ doc: any; docType: 'invoice' | 'quote'; score?: number } | null> {
  const raw = (targetText || '').trim();
  const clean = cleanSearchName(raw);

  const fetchInvoices = async () => {
    const { data } = await db
      .from('invoices')
      .select('*, invoice_items(*), clients(*)')
      .eq('user_id', OWNER_ID)
      .order('created_at', { ascending: false })
      .limit(30);
    return data || [];
  };

  const fetchQuotes = async () => {
    const { data } = await db
      .from('quotes')
      .select('*, quote_items(*), clients(*)')
      .eq('user_id', OWNER_ID)
      .order('created_at', { ascending: false })
      .limit(30);
    return data || [];
  };

  // If user explicitly asks for "terakhir"
  if (raw.toLowerCase().includes('terakhir') || clean.includes('terakhir')) {
    if (preferredType === 'invoice') {
      const invs = await fetchInvoices();
      return invs[0] ? { doc: invs[0], docType: 'invoice' } : null;
    }
    if (preferredType === 'quote') {
      const qts = await fetchQuotes();
      return qts[0] ? { doc: qts[0], docType: 'quote' } : null;
    }
    const [invs, qts] = await Promise.all([fetchInvoices(), fetchQuotes()]);
    const latestInv = invs[0];
    const latestQt = qts[0];
    if (latestInv && latestQt) {
      const invTime = new Date(latestInv.created_at || 0).getTime();
      const qtTime = new Date(latestQt.created_at || 0).getTime();
      return invTime >= qtTime ? { doc: latestInv, docType: 'invoice' } : { doc: latestQt, docType: 'quote' };
    }
    if (latestInv) return { doc: latestInv, docType: 'invoice' };
    if (latestQt) return { doc: latestQt, docType: 'quote' };
    return null;
  }

  // If no target text specified at all, DO NOT blindly guess to avoid mutating the wrong client
  if (!raw && !clean) {
    return null;
  }

  // Direct UUID lookup (guaranteed to find document even if outside recent 30 pool)
  if (/^[0-9a-f-]{36}$/i.test(raw)) {
    if (preferredType === 'invoice' || preferredType === 'auto') {
      const { data: directInv } = await db.from('invoices').select('*, invoice_items(*), clients(*)').eq('id', raw).maybeSingle();
      if (directInv) return { doc: directInv, docType: 'invoice', score: 100 };
    }
    if (preferredType === 'quote' || preferredType === 'auto') {
      const { data: directQt } = await db.from('quotes').select('*, quote_items(*), clients(*)').eq('id', raw).maybeSingle();
      if (directQt) return { doc: directQt, docType: 'quote', score: 100 };
    }
    const { data: inst } = await db.from('cctv_installations').select('client_name, quote_id').eq('id', raw).maybeSingle();
    if (inst?.client_name) {
      const cMatch = await findQuoteOrInvoice(inst.client_name, preferredType);
      if (cMatch) return cMatch;
    }
  }

  let invCandidates: any[] = [];
  let quoteCandidates: any[] = [];

  if (preferredType === 'invoice') {
    invCandidates = await fetchInvoices();
  } else if (preferredType === 'quote') {
    quoteCandidates = await fetchQuotes();
  } else {
    [invCandidates, quoteCandidates] = await Promise.all([fetchInvoices(), fetchQuotes()]);
  }

  const scoreCandidate = (cand: any, numField: string) => {
    const num = (cand[numField] || '').toLowerCase();
    const client = (cand.to_client || '').toLowerCase();
    const rawLower = raw.toLowerCase();

    if (cand.id && (cand.id === raw || cand.id.toLowerCase() === rawLower)) return 100;
    if (rawLower && num.includes(rawLower)) return 100;
    if (rawLower && client.includes(rawLower)) return 95;

    const candClean = cleanSearchName(client);
    if (clean && candClean && candClean.length >= 3 && (candClean.includes(clean) || clean.includes(candClean))) return 90;

    // Special alias: saha / suha <-> sahabuddin / suhabuddin
    if ((clean === 'saha' || clean === 'suha') && candClean && (candClean.includes('sahabuddin') || candClean.includes('suhabuddin'))) {
      return 95;
    }

    const rawSkel = getConsonantSkeleton(raw);
    const candSkel = getConsonantSkeleton(client);
    if (rawSkel && candSkel && candSkel.length >= 2 && rawSkel.length >= 2 && (candSkel.includes(rawSkel) || rawSkel.includes(candSkel))) return 80;

    return 0;
  };

  const evaluatePool = (pool: any[], numField: string, type: 'invoice' | 'quote') => {
    let bestDoc = null;
    let bestScore = 0;
    for (const c of pool) {
      const score = scoreCandidate(c, numField);
      if (score > bestScore) {
        bestScore = score;
        bestDoc = c;
      }
    }
    return bestScore >= 70 ? { doc: bestDoc, docType: type, score: bestScore } : null;
  };

  if (preferredType === 'invoice') {
    const match = evaluatePool(invCandidates, 'invoice_number', 'invoice');
    if (match) return match;
    quoteCandidates = await fetchQuotes();
    const qMatch = evaluatePool(quoteCandidates, 'quote_number', 'quote');
    if (qMatch) return qMatch;
  } else if (preferredType === 'quote') {
    const match = evaluatePool(quoteCandidates, 'quote_number', 'quote');
    if (match) return match;
    invCandidates = await fetchInvoices();
    const iMatch = evaluatePool(invCandidates, 'invoice_number', 'invoice');
    if (iMatch) return iMatch;
  } else {
    const iMatch = evaluatePool(invCandidates, 'invoice_number', 'invoice');
    const qMatch = evaluatePool(quoteCandidates, 'quote_number', 'quote');
    if (iMatch && qMatch) {
      return (iMatch.score || 0) >= (qMatch.score || 0) ? iMatch : qMatch;
    }
    return iMatch || qMatch || null;
  }

  return null;
}

async function findInstallation(targetText: string): Promise<any | null> {
  const raw = (targetText || '').trim();
  const clean = cleanSearchName(raw);

  const { data: list } = await db
    .from('cctv_installations')
    .select('*, quotes(*, quote_items(*))')
    .eq('user_id', OWNER_ID)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!list || list.length === 0) return null;
  if (!raw && !clean) return null; // NEVER blind fallback to list[0]

  let bestInst = null;
  let bestScore = 0;

  for (const inst of list) {
    let score = 0;
    const client = (inst.client_name || '').toLowerCase();
    const project = (inst.project_name || '').toLowerCase();
    const rawLower = raw.toLowerCase();

    if (inst.id === raw || inst.quote_id === raw) score = 100;
    else if (rawLower && (client.includes(rawLower) || project.includes(rawLower))) score = 95;
    else {
      const cClean = cleanSearchName(client);
      const pClean = cleanSearchName(project);
      if (clean && (cClean.includes(clean) || clean.includes(cClean) || pClean.includes(clean) || clean.includes(pClean))) {
        score = 90;
      } else {
        // Special alias: saha / suha <-> sahabuddin / suhabuddin
        if ((clean === 'saha' || clean === 'suha') && (cClean.includes('sahabuddin') || cClean.includes('suhabuddin'))) {
          score = 95;
        } else {
          const rawSkel = getConsonantSkeleton(raw);
          const cSkel = getConsonantSkeleton(client);
          const pSkel = getConsonantSkeleton(project);
          if (rawSkel && (cSkel.includes(rawSkel) || rawSkel.includes(cSkel) || pSkel.includes(rawSkel) || rawSkel.includes(pSkel))) {
            score = 80;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestInst = inst;
    }
  }

  return bestScore >= 70 ? bestInst : null; // NEVER return list[0]
}

// ------------------------------------------------------------------ Gemini Schema & AI Core
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: {
      type: 'STRING',
      enum: [
        'create_quote',
        'create_invoice',
        'edit_document',
        'deal_project',
        'add_project',
        'update_progress',
        'edit_project',
        'delete_project',
        'delete_document',
        'add_expense',
        'add_item_master',
        'complete_project',
        'modify_pending',
        'get_pdf',
        'get_receipt',
        'get_surat_jalan',
        'get_bast',
        'get_warranty',
        'share_location',
        'stock_check',
        'update_stock',
        'overdue_invoices',
        'tech_troubleshoot',
        'storage_calculator',
        'record_payment',
        'unpaid_invoices',
        'monthly_summary',
        'morning_briefing',
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
    payment_amount: { type: 'NUMBER', nullable: true },
    is_paid_off: { type: 'BOOLEAN', nullable: true },
    target_text: { type: 'STRING', nullable: true },
    project_name: { type: 'STRING', nullable: true },
    service_type: { type: 'STRING', enum: ['CCTV', 'POS', 'BUNDLING'], nullable: true },
    progress: { type: 'INTEGER', nullable: true },
    progress_percent: { type: 'INTEGER', nullable: true },
    notes: { type: 'STRING', nullable: true },
    dvr_sn: { type: 'STRING', nullable: true },
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
    stock_mode: { type: 'STRING', enum: ['add', 'set', 'check'], nullable: true },
    stock_quantity: { type: 'NUMBER', nullable: true },
    proactive_note: { type: 'STRING', nullable: true },
    doc_category: { type: 'STRING', enum: ['standard', 'partner_service'], nullable: true },
    target_doc_type: { type: 'STRING', enum: ['quote', 'invoice', 'warranty', 'project', 'auto'], nullable: true },
    is_partner_store: { type: 'BOOLEAN', nullable: true },
    delete_items: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
  },
  required: ['intent'],
};

async function askGemini(text: string, packages: any[], pending: any | null, audioInline?: { mimeType: string; data: string }, chatContext?: any): Promise<any> {
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

  const contextInfo = chatContext?.client_name
    ? `\nKONTEKS KLIEN AKTIF DI PERCAKAPAN: "${chatContext.client_name}".\nJika pesan Mas Wahyu mengirim perintah ringkas tanpa menyebut nama klien (contoh: "buat lunas", "cetak garansi", "garansi digital", "cetak faktur", "minta kwitansi", "share lokasi", "surat jalan", "bast"), target_text WAJIB diisi dengan nama klien aktif ini ("${chatContext.client_name}")!\n`
    : '';

  const system = `Kamu adalah asisten AI operasional & partner bisnis terpercaya untuk Mas Wahyu (Owner Borneo Etam CCTV & Komputer Kasir) di Samarinda, Kalimantan Timur.
${contextInfo}
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
   - JIKA MAS WAHYU MENYEBUTKAN DAFTAR ITEM/BARANG/JASA (misal: "Item nya kamera analog 2 mp fullcolor modal 268.000 jual 550.000 2 unit, Jasa instalasi 2 titik jual 100.000"):
     WAJIB ekstrak seluruh barang & jasa tersebut ke array "extra_items"! Setiap item harus memiliki:
     • description: nama item (contoh: "kamera analog 2 mp fullcolor")
     • quantity: jumlah unit (contoh: 2)
     • unit_price: harga jual per unit (contoh: 550000)
     • cost_price: harga modal per unit jika disebutkan (contoh: 268000)
     • category: 'item_utama' (kamera/dvr/nvr), 'material_tambahan' (kabel/pipa/konektor), atau 'jasa_akomodasi' (jasa pasang/setting)
   - JIKA MEMILIH DARI KATALOG PAKET: set package_id sesuai id katalog.
   - PENTING ALAMAT: Jika Mas Wahyu menyebutkan alamat (misal: "Alamat m said gg kita blok n no 9"), WAJIB isi client_address dengan alamat tersebut! Jika belum ada alamatnya, beritahu ramah di proactive_note agar alamat lengkap diinput.
   - MODE TOKO / SUBKON (doc_category: 'partner_service'): Jika penawaran ditujukan ke Toko / Mitra / Subkon (misal: "buat penawaran ke Toko Surya jasa pasang 4 titik 600rb, akomodasi 150rb, unit dari toko"):
     Set doc_category: 'partner_service'. Perangkat dari toko diberi unit_price: 0 (non-tagihan), dan item jasa/akomodasi diisi nominal tagihannya.
   - Ekstrak: client_name, client_phone, client_address, package_id, item_adjustments, extra_items (dengan cost_price & category), discount_amount, total_cost_override, doc_category.
2. create_invoice: Mas Wahyu ingin buat FAKTUR TAGIHAN LANGSUNG tanpa lewat penawaran dulu (misal: "buat faktur Pak Yusuf paket 4 kamera 3.5jt DP 1.5jt", "buat faktur penawaran pak Sahabuddin...", "buat faktur ke Toko Berkah Jaya jasa pasang 8 kamera 1.2jt, transportasi 200rb", "buatkan faktur pak yusuf").
   - Jika Mas Wahyu menyebutkan daftar item custom/khusus, WAJIB ekstrak ke array "extra_items" lengkap dengan description, quantity, unit_price, cost_price, dan category.
   - PENTING ALAMAT: Jika ada alamat yang disebutkan, WAJIB isi client_address.
   - Ekstrak: client_name, client_phone, client_address, package_id, extra_items, down_payment_amount, discount_amount, sn_nvr, sn_hdd, doc_category ('partner_service' jika ditujukan ke Toko/Subkon).
3. edit_document: Mas Wahyu ingin MENGEDIT penawaran, faktur, item, atau memasukkan/mengubah Serial Number (SN) hardware yang SUDAH TERSIMPAN di sistem (misal: "faktur pak yusuf kita mau edit nvr nya untuk masukkan sn nya SN: NVR-HL-8899", "edit penawaran pak suhabuddin tambah kabel 1 roll 300rb", "update SN NVR faktur pak yusuf NVR-9988 SN HDD WD-1234", "edit harga jasa di faktur pak yusuf jadi 500rb", "ubah alamat penawaran pak suhabuddin jadi Jl. Juanda", "edit nvr pak yusuf masukkan SN 123456").
   - Ekstrak:
     - target_text: nama klien / nomor dokumen (contoh: "pak yusuf", "suhabuddin").
     - target_doc_type: 'invoice' (jika faktur), 'quote' (jika penawaran), atau 'auto'.
     - sn_nvr: nomor seri NVR jika ada (contoh: "NVR-HL-8899", "123456").
     - sn_hdd: nomor seri HDD jika ada.
     - item_adjustments: item yang mau diubah harga / qty (contoh: item_keyword: "jasa", unit_price: 500000).
     - extra_items: item baru yang mau ditambahkan.
     - delete_items: keyword item yang mau dihapus (contoh: ["kabel"]).
     - client_address, client_phone, discount_amount, down_payment_amount.
4. deal_project: Mas Wahyu menyatakan penawaran atau proyek DEAL / disepakati (misal: "deal ya", "penawaran ini deal", "proyek pak yusuf deal", "pak yusuf deal ya bro", "penawaran pak yusuf sudah deal", "deal pak yusuf", "proyeknya jadi deal"). target_text = nama klien (misal: "Pak Yusuf").
5. add_project: Mas Wahyu ingin buat / tambah proyek baru (misal: "buat proyek Pak Yusuf jl pramuka 4 titik", "tambah proyek toko berkah antasari", "bikin proyek pak dimas baru", "masukkan proyek pak yusril").
   - Ekstrak: client_name (nama klien), client_address (alamat lokasi), client_phone, progress_percent (default 20 jika baru), notes.
6. update_progress / edit_project: Mas Wahyu update kemajuan progres atau edit detail proyek instalasi (misal: "progres pak yusuf 80%", "update progres jadi 90%", "progres 50%", "edit alamat proyek pak budi jadi jl pramuka", "sn nvr pak yusuf NVR-9988", "catatan proyek pak yusuf pipa sudah rapi").
   - Ekstrak: target_text (nama klien/proyek), progress_percent (angka 0-100), client_address, client_phone, dvr_sn, notes.
7. delete_project: Mas Wahyu ingin menghapus / membatalkan proyek dari sistem & peta (misal: "hapus proyek pak budi", "batalkan proyek pak yusuf", "delete proyek pak dimas").
   - Ekstrak: target_text (nama klien / proyek yang mau dihapus).
8. delete_document: Mas Wahyu ingin menghapus / membatalkan dokumen faktur atau penawaran (misal: "hapus faktur pak yusril", "batalkan faktur pak yusuf", "hapus penawaran pak budi", "delete invoice INV-001").
   - Ekstrak: target_text (nama klien / nomor dokumen), target_doc_type ('invoice' jika faktur, 'quote' jika penawaran).
9. add_expense: Mas Wahyu melapor belanja / pengeluaran lapangan (misal: "sudah beli pipa conduit 10 btg 150rb untuk proyek Pak Suhabuddin", "beli bensin 50rb proyek Suhabuddin").
   - Ekstrak: target_text (nama klien/proyek), expense_amount, expense_description, expense_category ('Material Lapangan', 'Transportasi', 'Konsumsi', 'Lainnya').
6. add_item_master: Mas Wahyu ingin menambah barang/jasa baru ke master pustaka (misal: "tolong masukkan barang ini di barang dan jasa: Kamera ColorVu 4MP jual 450rb modal 320rb satuan Unit").
   - Ekstrak: item_description, item_unit, item_unit_price, item_cost_price.
7. complete_project: Proyek dinyatakan sudah selesai (misal: "proyek Pak Suhabuddin sudah selesai pasang", "proyek Suhabuddin tuntas SN NVR 123 SN HDD 456").
   - Ekstrak: target_text, progress: 100, installed_at, sn_nvr, sn_hdd.
8. get_surat_jalan: Minta cetak Surat Jalan (misal: "cetak surat jalan Pak Suhabuddin", "minta surat jalan"). target_text = nama klien.
9. get_bast: Minta cetak Berita Acara Serah Terima (misal: "cetak BAST Pak Suhabuddin", "minta berita acara"). target_text = nama klien.
10. get_warranty: Mas Wahyu minta kartu garansi digital / cek garansi / link garansi / sertifikat garansi (misal: "garansi digital sudah?", "garansi digital", "kartu garansi", "minta kartu garansi Pak Suhabuddin", "link garansi", "cetak garansi"). target_text = nama klien (opsional).
11. storage_calculator: Mas Wahyu tanya kapasitas / lama hari rekaman CCTV (misal: "4 kamera 2MP HDD 1TB tahan rekam berapa hari bro?", "8 kamera 4MP harddisk 2TB").
   - Jawab secara teknis presisi di field reply: sebutkan kompresi H.265+, estimasi hari rekaman 24 jam non-stop, dan perkiraan jika pakai motion detection.
12. record_payment: Pembayaran DP / Pelunasan faktur (misal: "Pak Suhabuddin sudah transfer DP 1.5jt", "Pak Suhabuddin sudah lunas", "Pak Yusuf lunas bro", "catat pelunasan Pak Yusuf", "tadi Pak Yusuf bayar 5.410.000", "catat pelunasan faktur INV-2026-264").
   - Ekstrak: target_text (nama klien / nomor faktur), payment_amount (jika ada nominal yang dibayar), is_paid_off (true jika dikatakan 'lunas' atau 'full').
13. unpaid_invoices: Mas Wahyu ingin mengecek daftar tagihan yang belum lunas / rekap piutang konsumen (misal: "rekap piutang", "siapa yang belum lunas", "cek tagihan belum lunas", "daftar piutang bulan ini", "tagihan berjalan").
14. monthly_summary: Tanya rekap performa keuangan bulanan (misal: "rekap performa bulan ini bro", "laporan bulan ini").
15. get_pdf: Mas Wahyu minta cetak/kirim file PDF penawaran atau faktur yang sudah ada (misal: "minta faktur pak suhabuddin", "cetak faktur pak suhabuddin", "minta penawaran pak hendra", "kirim pdf faktur BST", "minta faktur terakhir").
   - Ekstrak: target_text (nama klien / nomor dokumen), target_doc_type ('invoice' jika faktur, 'quote' jika penawaran).
16. get_receipt: Mas Wahyu minta Kwitansi Pembayaran resmi / bukti bayar PDF (misal: "minta kwitansi pak yusuf", "cetak kwitansi pak suhabuddin", "kwitansi pelunasan pak yusuf", "buatkan kwitansi dp pak sahabuddin 2jt").
   - Ekstrak: target_text (nama klien / nomor faktur), payment_amount (jika ada nominal yang dibayar).
17. share_location: Teknisi atau Mas Wahyu minta lokasi proyek atau rute GPS Google Maps lapangan (misal: "lokasi proyek pak suhabuddin", "share lokasi pak yusuf", "kirim koordinat teknisi pak suhabuddin", "rute pasang pak yusuf", "lokasi pasang pak sahabuddin").
   - Ekstrak: target_text (nama klien / proyek).
18. stock_check: Mas Wahyu cek stok barang di toko / gudang atau cek barang yang menipis/habis (misal: "cek stok", "stok hdd 1tb sisa berapa", "stok kabel utp", "barang apa yang mau habis", "cek sisa stok kamera").
   - Ekstrak: item_description / target_text (nama/keyword barang).
19. update_stock: Mas Wahyu ingin menambah stok fisik barang masuk atau mengupdate stok di sistem (misal: "tambah stok hdd 1tb 5 unit", "masuk barang kabel cat6 2 roll", "update stok kamera colorvu jadi 10 unit", "stok nvr 4ch masuk 3 unit modal 450rb").
   - Ekstrak: item_description, stock_quantity (jumlah), stock_mode ('add' jika tambah/masuk, 'set' jika ubah/set jadi), item_cost_price, item_unit.
20. overdue_invoices: Mas Wahyu ingin mengecek tagihan yang sudah lewat jatuh tempo atau mendekati jatuh tempo (misal: "tagihan jatuh tempo", "siapa yang telat bayar", "invoice overdue", "cek tagihan macet", "ingatkan tagihan").
   - Ekstrak: target_text (nama klien jika spesifik, atau kosongkan untuk semua).
21. tech_troubleshoot: Mas Wahyu atau teknisi tanya kendala teknis lapangan seputar CCTV & POS (misal: "kamera hikvision malam hari gambar hitam putih gak mau nyala warnanya", "printer thermal 80mm gak keluar kertas lampu merah kedip", "kamera poe sering disconnect tiap siang", "nvr bunyi tit tit terus", "dvr hilook lupa sandi", "ip kamera bentrok").
   - Jawab secara teknis, taktis, to-the-point, dan aplikatif di lapangan untuk teknisi Borneo Etam di Samarinda (spesifik merek Hikvision, Hilook, Dahua, Imou, Sunmi, Xprinter, Epson POS).
22. modify_pending: HANYA untuk revisi kecil/ringkas pada dokumen yang baru saja diminta konfirmasi (misal: "diskon 200rb", "modal kamera jadi 190rb", "tambah pipa 5 batang", "dp 500rb"). JANGAN PERNAH gunakan intent ini jika Mas Wahyu menulis "buat faktur...", "buat penawaran...", atau menyebut nama klien baru (wajib gunakan create_invoice atau create_quote)!
23. morning_briefing: Mas Wahyu menyapa di pagi hari atau minta rekap agenda hari ini (misal: "pagi bro", "selamat pagi", "briefing pagi", "agenda hari ini", "cek hari ini", "morning briefing", "rekap pagi").
24. chat: Obrolan santai, konsultasi nego harga klien, atau pertanyaan teknis lain.

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
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
      temperature: 0.1,
    },
  });

  let lastError: Error | null = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout max per attempt
        let res: Response;
        try {
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
            body: payloadBody,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (res.status === 503 || res.status === 429) {
          console.warn(`Gemini ${model} status ${res.status}. Attempt ${attempt}...`);
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`Gemini ${model} returned ${res.status}: ${errText.slice(0, 150)}`);
          lastError = new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
          break; // Move to next healthy candidate model immediately
        }

        const json = await res.json();
        const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
        const parsed = JSON.parse(raw);

        // Safety fallback: if Gemini put address into installed_at
        if (!parsed.client_address && parsed.installed_at && !/^\d{4}-\d{2}-\d{2}/.test(parsed.installed_at)) {
          parsed.client_address = parsed.installed_at;
          parsed.installed_at = null;
        }

        return parsed;
      } catch (err: any) {
        lastError = err;
        console.warn(`Error on model ${model} (attempt ${attempt}):`, err.message);
        if (attempt === 1) await new Promise((r) => setTimeout(r, 500));
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
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 menit masa aktif konfirmasi
  const { data } = await db.from('telegram_pending_actions').select('*')
    .eq('chat_id', chat_id).in('status', statuses).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

// ------------------------------------------------------------------ context memory
async function getChatContext(chat_id: number): Promise<{ client_name?: string; doc_id?: string; doc_type?: string } | null> {
  try {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data } = await db
      .from('telegram_pending_actions')
      .select('payload')
      .eq('chat_id', chat_id)
      .eq('kind', 'project')
      .eq('status', 'done')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10);

    const match = (data || []).find((r: any) => r.payload?.is_context && r.payload?.client_name);
    return match?.payload ?? null;
  } catch {
    return null;
  }
}

async function setChatContext(chat_id: number, payload: { client_name?: string; doc_id?: string; doc_type?: string }) {
  try {
    if (!payload.client_name) return;
    await db.from('telegram_pending_actions').insert({
      chat_id,
      kind: 'project',
      status: 'done',
      payload: { ...payload, is_context: true },
    });
  } catch (err) {
    console.error('Failed to save chat context:', err);
  }
}

// ------------------------------------------------------------------ OTOMATIS TAUTKAN KLIEN, PROYEK, FAKTUR, PENAWARAN & LABA
async function ensureProjectAndLinks(
  clientName: string,
  clientPhone?: string,
  clientAddr?: string,
  explicitQuoteId?: string,
  explicitInvoiceId?: string,
  progressPercent: number = 20
) {
  const cleanName = cleanSearchName(clientName);
  if (!cleanName) return null;

  // 1. Cari atau buat Klien di tabel clients
  let clientId: string | null = null;
  const { data: exClient } = await db.from('clients')
    .select('id, name')
    .eq('user_id', OWNER_ID)
    .ilike('name', `%${cleanName}%`)
    .limit(1)
    .maybeSingle();

  if (exClient?.id) {
    clientId = exClient.id;
  } else {
    const { data: newClient } = await db.from('clients').insert({
      user_id: OWNER_ID,
      name: clientName,
      phone: clientPhone || '',
      address: clientAddr || 'Samarinda, Kalimantan Timur',
    }).select('id').maybeSingle();
    clientId = newClient?.id || null;
  }

  // 2. Cari atau buat Proyek di tabel projects
  const projName = `Proyek ${clientName}`;
  let projectId: string | null = null;
  let currentBudget = 0;

  const { data: exProj } = await db.from('projects')
    .select('id, name, client_id, budget')
    .eq('user_id', OWNER_ID)
    .or(`name.ilike.%${cleanName}%,client_id.eq.${clientId || '00000000-0000-0000-0000-000000000000'}`)
    .limit(1)
    .maybeSingle();

  if (exProj?.id) {
    projectId = exProj.id;
    currentBudget = Number(exProj.budget) || 0;
    if (!exProj.client_id && clientId) {
      await db.from('projects').update({ client_id: clientId }).eq('id', projectId);
    }
  } else {
    const { data: newProj } = await db.from('projects').insert({
      user_id: OWNER_ID,
      name: projName,
      client_id: clientId,
      status: 'Ongoing',
      description: `Instalasi CCTV ${clientName}`,
      budget: 0,
    }).select('id').maybeSingle();
    projectId = newProj?.id || null;
  }

  if (!projectId) return null;

  // 3. Cari & Hubungkan Penawaran (Quotes)
  let quoteQuery = db.from('quotes')
    .select('id, quote_number, discount_amount, quote_items(quantity, unit_price, cost_price)')
    .eq('user_id', OWNER_ID);

  if (explicitQuoteId) {
    quoteQuery = quoteQuery.or(`id.eq.${explicitQuoteId},to_client.ilike.%${cleanName}%`);
  } else if (clientId) {
    quoteQuery = quoteQuery.or(`client_id.eq.${clientId},to_client.ilike.%${cleanName}%`);
  } else {
    quoteQuery = quoteQuery.ilike('to_client', `%${cleanName}%`);
  }

  const { data: matchingQuotes } = await quoteQuery;
  let totalQuote = 0;
  let totalHpp = 0;
  if (matchingQuotes && matchingQuotes.length > 0) {
    for (const q of matchingQuotes) {
      await db.from('quotes').update({
        project_id: projectId,
        client_id: clientId || undefined,
      }).eq('id', q.id);

      const items = q.quote_items || [];
      const subtotal = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
      totalQuote += Math.max(0, subtotal - (Number(q.discount_amount) || 0));
      totalHpp += items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.cost_price) || 0), 0);
    }
  }

  // 4. Cari & Hubungkan Faktur (Invoices)
  let invoiceQuery = db.from('invoices')
    .select('id, invoice_number, discount_amount, invoice_items(quantity, unit_price)')
    .eq('user_id', OWNER_ID);

  if (explicitInvoiceId) {
    invoiceQuery = invoiceQuery.or(`id.eq.${explicitInvoiceId},to_client.ilike.%${cleanName}%`);
  } else if (clientId) {
    invoiceQuery = invoiceQuery.or(`client_id.eq.${clientId},to_client.ilike.%${cleanName}%`);
  } else {
    invoiceQuery = invoiceQuery.ilike('to_client', `%${cleanName}%`);
  }

  const { data: matchingInvoices } = await invoiceQuery;
  let totalRevenue = 0;
  if (matchingInvoices && matchingInvoices.length > 0) {
    for (const inv of matchingInvoices) {
      await db.from('invoices').update({
        project_id: projectId,
        client_id: clientId || undefined,
      }).eq('id', inv.id);

      const items = inv.invoice_items || [];
      const subtotal = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
      totalRevenue += Math.max(0, subtotal - (Number(inv.discount_amount) || 0));
    }
  }

  // Update budget pada proyek jika belum ada
  const finalBudget = totalRevenue || totalQuote || currentBudget;
  if (finalBudget > 0 && currentBudget === 0) {
    await db.from('projects').update({ budget: finalBudget }).eq('id', projectId);
  }

  // 5. Hubungkan / Sinkronisasi cctv_installations
  const primaryQuoteId = matchingQuotes?.[0]?.id || null;
  const { data: existingInst } = await db.from('cctv_installations')
    .select('id, progress')
    .eq('user_id', OWNER_ID)
    .or(`project_id.eq.${projectId},client_name.ilike.%${cleanName}%`)
    .limit(1)
    .maybeSingle();

  if (existingInst?.id) {
    await db.from('cctv_installations').update({
      project_id: projectId,
      client_id: clientId || undefined,
      quote_id: primaryQuoteId || undefined,
    }).eq('id', existingInst.id);
  }

  // 6. Milestone Tasks Otomatis (project_tasks)
  const { data: existingTasks } = await db.from('project_tasks')
    .select('id')
    .eq('project_id', projectId);

  if (!existingTasks || existingTasks.length === 0) {
    const pVal = existingInst?.progress ?? progressPercent;
    const defaultTasks = [
      { name: 'Survei Lokasi & Penentuan Titik Kamera', completed: pVal >= 20 },
      { name: 'Penarikan Kabel & Instalasi Jalur Pipa', completed: pVal >= 40 },
      { name: 'Pemasangan Kamera, NVR, & Setting HDD', completed: pVal >= 60 },
      { name: 'Uji Coba Online / Monitoring HP Konsumen', completed: pVal >= 80 },
      { name: 'Serah Terima Pekerjaan (BAST) & Garansi', completed: pVal >= 100 },
    ];

    for (const t of defaultTasks) {
      await db.from('project_tasks').insert({
        user_id: OWNER_ID,
        project_id: projectId,
        name: t.name,
        is_completed: t.completed,
      });
    }
  }

  return {
    projectId,
    clientId,
    quoteCount: matchingQuotes?.length || 0,
    invoiceCount: matchingInvoices?.length || 0,
    revenue: totalRevenue || totalQuote,
    cost: totalHpp,
    profit: (totalRevenue || totalQuote) - totalHpp,
  };
}

async function healAllProjects() {
  try {
    const { data: allProjs } = await db.from('projects')
      .select('id, name, client_id')
      .eq('user_id', OWNER_ID)
      .order('created_at', { ascending: false });

    if (!allProjs) return [];

    const results = [];
    for (const p of allProjs) {
      const rawClient = (p.name || '').replace(/^proyek\s+/i, '').trim();
      if (!rawClient) continue;
      const res = await ensureProjectAndLinks(rawClient);
      if (res) results.push({ name: p.name, ...res });
    }
    return results;
  } catch (err: any) {
    console.error('healAllProjects error:', err.message);
    return [];
  }
}

async function displayProjectCard(chat_id: number, targetInst: any) {
  // Kunci konteks chat ke proyek ini agar bot mengarah ke proyek kita
  await setChatContext(chat_id, {
    client_name: targetInst.client_name,
    doc_id: targetInst.id,
    doc_type: 'project',
  });

  const photos: string[] = Array.isArray(targetInst.photos)
    ? targetInst.photos.map((p: any) => typeof p === 'string' ? p : p?.url).filter(Boolean)
    : [];

  const prog = targetInst.progress || 0;
  const filled = Math.min(10, Math.max(0, Math.round(prog / 10)));
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const statusLabel = prog >= 100
    ? '✅ Selesai Pasang (100%)'
    : prog >= 80
    ? '⚙️ Pemasangan Selesai / Uji Coba (80%)'
    : prog >= 50
    ? '🔧 Sedang Dikerjakan (50%)'
    : '📅 Terjadwal / Persiapan';

  const coverInfo = photos.length > 0
    ? `⭐ 1 Sampul Utama + ${photos.length - 1} Galeri`
    : 'Belum ada foto';

  const snNvr = targetInst.sn_nvr || '-';
  const snHdd = targetInst.sn_hdd || '-';
  const publicWarrantyUrl = `${APP_URL}/garansi/${targetInst.id}`;

  const buttons = [
    [
      { text: '🌐 Buka Garansi Live', url: publicWarrantyUrl },
      { text: '🗺️ Buka di Peta Command', url: `${APP_URL}/peta` }
    ],
    [
      { text: '📸 Tambah Foto Proyek', data: `add_photo:${targetInst.id}` },
      { text: '📍 Share Lokasi GPS', data: `loc:${targetInst.id}` }
    ],
    [
      { text: '🛡️ Cetak Garansi', data: `warranty:${targetInst.id}` },
      { text: '📜 Cetak BAST', data: `bast:${targetInst.id}` }
    ]
  ];

  return send(
    chat_id,
    `📂 <b>Detail Proyek: ${esc(targetInst.project_name || targetInst.client_name)}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Klien          : <b>${esc(targetInst.client_name)}</b>\n` +
    `• Kontak HP      : <code>${esc(targetInst.client_phone || '-')}</code>\n` +
    `• Lokasi         : <i>${esc(targetInst.address_landmark || 'Samarinda')}</i>\n` +
    `• Status Progres : <b>${statusLabel}</b>\n` +
    `  <code>[${bar}] ${prog}%</code>\n` +
    `• Dokumentasi    : <b>${photos.length} Foto Tersimpan</b> (${coverInfo})\n` +
    `• Serial Number  : NVR: <code>${snNvr}</code> | HDD: <code>${snHdd}</code>\n` +
    `• Garansi Resmi  : <b>${targetInst.warranty_months || 12} Bulan</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 <i>Konteks percakapan bot sekarang TERKUNCI ke proyek ini!</i>\n` +
    `<i>Mas Wahyu bisa langsung:</i>\n` +
    `• Kirim foto (otomatis masuk ke proyek ini)\n` +
    `• Kirim foto + caption "jadikan sampul"\n` +
    `• Balas "lokasi proyek" untuk Google Maps teknisi\n` +
    `• Balas "selesai pasang" untuk terbitkan Faktur & BAST`,
    buttons
  );
}

async function handleProjectCheck(chat_id: number, rawTarget: string, chatContext: any, isListMode: boolean = false) {
  // Jika diminta list atau tidak ada target dan tidak ada konteks chat aktif
  if (isListMode || (!rawTarget && !chatContext?.client_name)) {
    const { data: list } = await db
      .from('cctv_installations')
      .select('*')
      .eq('user_id', OWNER_ID)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!list || list.length === 0) {
      return send(chat_id, 'Belum ada proyek/instalasi terdaftar bro. Buat penawaran atau proyek baru dulu ya!');
    }

    // Jika hanya ada 1 proyek dan bukan explicit list, langsung tampilkan proyek tersebut
    if (list.length === 1 && !isListMode) {
      return displayProjectCard(chat_id, list[0]);
    }

    let text = `📋 <b>Daftar Proyek CCTV &amp; POS Borneo Etam:</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n`;

    list.forEach((inst: any, idx: number) => {
      const photos = Array.isArray(inst.photos) ? inst.photos : [];
      const prog = inst.progress || 0;
      const statusIcon = prog >= 100 ? '✅' : prog >= 80 ? '⚙️' : '🔧';
      text += `${idx + 1}. <b>${esc(inst.client_name || inst.project_name)}</b>\n` +
        `   • Status: ${statusIcon} <b>${prog}%</b> • Foto: <b>${photos.length} Foto</b>\n` +
        `   • Lokasi: <i>${esc(inst.address_landmark || 'Samarinda')}</i>\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Pilih salah satu proyek di bawah untuk membuka detail & mengunci arah bot ke proyek tersebut:</i>`;

    const buttons = [];
    for (let i = 0; i < list.length; i += 2) {
      const row = [];
      row.push({ text: `📂 ${list[i].client_name || 'Proyek'}`, data: `project:${list[i].id}` });
      if (list[i + 1]) {
        row.push({ text: `📂 ${list[i + 1].client_name || 'Proyek'}`, data: `project:${list[i + 1].id}` });
      }
      buttons.push(row);
    }
    buttons.push([
      { text: '🗺️ Buka Peta Command Center', url: `${APP_URL}/peta` }
    ]);

    return send(chat_id, text, buttons);
  }

  // Cari proyek spesifik
  const target = rawTarget || chatContext?.client_name || '';
  let targetInst: any = null;

  if (target && !/^(ini|itu|kita|nya)$/i.test(target)) {
    targetInst = await findInstallation(target);

    if (!targetInst) {
      const cleanT = cleanSearchName(target);
      const { data: insts } = await db.from('cctv_installations')
        .select('*')
        .eq('user_id', OWNER_ID)
        .or(`client_name.ilike.%${cleanT}%,project_name.ilike.%${cleanT}%,public_display_name.ilike.%${cleanT}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      targetInst = insts?.[0] || null;
    }

    if (!targetInst) {
      const match = await findQuoteOrInvoice(target, 'auto');
      if (match) {
        const cName = match.doc.to_client;
        const { data: insts2 } = await db.from('cctv_installations')
          .select('*')
          .eq('user_id', OWNER_ID)
          .or(`client_name.ilike.%${cName}%,quote_id.eq.${match.doc.id}`)
          .order('created_at', { ascending: false })
          .limit(1);
        targetInst = insts2?.[0] || null;
      }
    }
  }

  if (!targetInst && chatContext?.client_name) {
    const cleanCtx = cleanSearchName(chatContext.client_name);
    const { data: insts3 } = await db.from('cctv_installations')
      .select('*')
      .eq('user_id', OWNER_ID)
      .or(`client_name.ilike.%${cleanCtx}%,project_name.ilike.%${cleanCtx}%`)
      .order('created_at', { ascending: false })
      .limit(1);
    targetInst = insts3?.[0] || null;
  }

  if (!targetInst) {
    const { data: latestInsts } = await db.from('cctv_installations')
      .select('*')
      .eq('user_id', OWNER_ID)
      .order('created_at', { ascending: false })
      .limit(1);
    targetInst = latestInsts?.[0] || null;
  }

  if (!targetInst) {
    return send(chat_id, `Data proyek untuk "${esc(target || 'terakhir')}" tidak ditemukan di database bro.`);
  }

  return displayProjectCard(chat_id, targetInst);
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
  const sisa = Math.max(0, (p.total || 0) - (p.dp_amount || 0));
  const isStore = p.doc_category === 'partner_service';
  const lines = (p.items || []).filter((i: any) => Number(i.quantity) > 0 && i.unit !== 'Header').map((i: any) => {
    const q = Number(i.quantity);
    const pr = Number(i.unit_price) || 0;
    const priceText = isStore && pr === 0 ? '(Bawaan Toko)' : rp(pr);
    return `  • ${esc(i.description)} ×${q} ${esc(i.unit || 'Unit')} (${priceText})`;
  }).join('\n');

  return `<b>🧾 Konfirmasi Faktur Tagihan</b>\n` +
    (p.quote_number ? `Nomor Penawaran: <code>${esc(p.quote_number)}</code>\n` : '') +
    `Klien / Penerima: <b>${esc(p.client_name)}</b>\n` +
    `Kategori: <b>${isStore ? 'Faktur Jasa &amp; Subkon (Toko)' : 'Faktur Penjualan Standar'}</b>\n` +
    `Alamat: ${esc(p.client_address || '-')}\n\n` +
    `<b>Daftar Item:</b>\n${lines || '  • Sesuai rincian'}\n\n` +
    `───────────────────────\n` +
    (p.discount_amount > 0 ? `Diskon: -${rp(p.discount_amount)}\n` : '') +
    `Total Tagihan: <b>${rp(p.total)}</b>\n` +
    (p.dp_amount > 0 ? `DP (Uang Muka): <b>${rp(p.dp_amount)}</b>\nSisa Pelunasan: <b>${rp(sisa)}</b>\n` : '') +
    (p.sn_nvr ? `SN NVR: <code>${esc(p.sn_nvr)}</code>\n` : '') +
    (p.sn_hdd ? `SN HDD: <code>${esc(p.sn_hdd)}</code>\n` : '') +
    `───────────────────────\n\n` +
    `<i>Mau sesuaikan DP atau tambah item? Balas misal: "DP 1.5jt" atau "tambah transport 100rb".</i>\n\n` +
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
function makeWhatsAppText(type: 'quote' | 'invoice' | 'warranty', docNumber: string, clientName: string, total = 0, dp = 0, warrantyUrl?: string, docCategory: 'standard' | 'partner_service' = 'standard'): string {
  if (docCategory === 'partner_service') {
    if (type === 'quote') {
      return `📲 <b>Draf Pesan WhatsApp Siap Forward ke Toko / Partner:</b>\n` +
        `<code>Yth. ${clientName || 'Rekan Toko / Mitra'},\n\n` +
        `Berikut kami lampirkan Surat Penawaran Jasa Instalasi Teknis & Akomodasi Lapangan dari Borneo Etam CCTV (No: ${docNumber}).\n\n` +
        `Total Jasa & Akomodasi: ${rp(total)}\n` +
        `(Khusus pengerjaan subkon teknis, seluruh unit utama disediakan pihak Toko).\n\n` +
        `Dokumen penawaran resmi berstempel terlampir dalam file PDF di atas. Terima kasih atas kerjasamanya!\n\n` +
        `Salam hormat,\nMuhammad Wahyu\nBorneo Etam CCTV & Komputer Kasir\nWhatsApp: 0822-5131-4646</code>`;
    }
    const sisa = Math.max(0, total - dp);
    return `📲 <b>Draf Pesan WhatsApp Siap Forward ke Toko / Partner:</b>\n` +
      `<code>Yth. ${clientName || 'Rekan Toko / Mitra'},\n\n` +
      `Pekerjaan teknis di lapangan telah selesai dilaksanakan dengan baik dan serah terima tuntas.\n\n` +
      `Berikut kami lampirkan Faktur Tagihan Jasa & Subkon resmi (No: ${docNumber}).\n` +
      `Total Tagihan: ${rp(total)}\n` +
      (dp > 0 ? `DP Diterima: ${rp(dp)}\nSisa Pelunasan: ${rp(sisa)}\n\n` : '\n') +
      `Pembayaran resmi via Transfer Bank:\nBank BCA: 5135400278 a.n Muhammad Wahyu\n\n` +
      `Dokumen Faktur PDF terlampir. Terima kasih banyak atas kepercayaannya!\n\n` +
      `Salam hormat,\nBorneo Etam CCTV & Komputer Kasir\n0822-5131-4646</code>`;
  }

  if (type === 'quote') {
    return `📲 <b>Draf Pesan WhatsApp Siap Forward ke Klien:</b>\n` +
      `<code>Yth. ${clientName || 'Bapak/Ibu'},\n\n` +
      `Berikut kami lampirkan Surat Penawaran Resmi pemasangan sistem keamanan CCTV dari Borneo Etam CCTV (No: ${docNumber}).\n\n` +
      `Total Penawaran: ${rp(total)}\n` +
      `(Sudah termasuk seluruh perangkat baru bergaransi resmi 12 Bulan, instalasi kabel rapi, dan gratis setting pantau online via HP).\n\n` +
      `Dokumen penawaran resmi berstempel terlampir dalam file PDF di atas.\nTerima kasih atas kepercayaannya.\n\n` +
      `Salam hangat,\nMuhammad Wahyu\nBorneo Etam CCTV & Komputer Kasir\nWhatsApp: 0822-5131-4646</code>`;
  }
  if (type === 'warranty') {
    return `📲 <b>Draf Pesan WhatsApp Siap Forward ke Klien:</b>\n` +
      `<code>Yth. ${clientName || 'Bapak/Ibu'},\n\n` +
      `Pekerjaan instalasi telah selesai dilaksanakan dan sistem keamanan Anda telah aktif sepenuhnya.\n\n` +
      `Bersama ini kami lampirkan Dokumen Resmi Kartu Garansi Digital (No: ${docNumber}) dengan jaminan perlindungan hardware 12 Bulan Penuh.\n\n` +
      (warrantyUrl ? `Bapak/Ibu dapat memantau masa aktif garansi & nomor seri perangkat secara live kapan saja melalui tautan resmi:\n👉 ${warrantyUrl}\n\n` : '') +
      `Layanan bantuan teknis & darurat hubungi WhatsApp: 0822-5131-4646.\nTerima kasih banyak atas kepercayaannya!\n\n` +
      `Salam hangat,\nBorneo Etam CCTV & Komputer Kasir</code>`;
  }
  const sisa = Math.max(0, total - dp);
  return `📲 <b>Draf Pesan WhatsApp Siap Forward ke Klien:</b>\n` +
    `<code>Yth. ${clientName || 'Bapak/Ibu'},\n\n` +
    `Pekerjaan instalasi CCTV telah selesai dilaksanakan dengan baik, seluruh kamera berfungsi normal dan bergaransi resmi 12 Bulan.\n\n` +
    `Berikut kami lampirkan Faktur Tagihan resmi (No: ${docNumber}).\n` +
    `Total: ${rp(total)}\n` +
    (dp > 0 ? `DP Diterima: ${rp(dp)}\nSisa Pelunasan: ${rp(sisa)}\n\n` : '\n') +
    `Pembayaran resmi via Transfer Bank:\nBank BCA: 5135400278 a.n Muhammad Wahyu\n\n` +
    (warrantyUrl ? `Kartu Garansi Digital dapat dipantau di:\n👉 ${warrantyUrl}\n\n` : '') +
    `Dokumen Faktur PDF terlampir. Terima kasih banyak atas kerjasamanya!\n\n` +
    `Salam hormat,\nBorneo Etam CCTV & Komputer Kasir\n0822-5131-4646</code>`;
}

function buildDocActionButtons(
  docId: string,
  clientName: string,
  publicWarrantyUrl?: string,
  docType: 'invoice' | 'quote' | 'warranty' | 'bast' | 'surat_jalan' = 'invoice'
) {
  const rows: { text: string; data?: string; url?: string }[][] = [];

  if (docType === 'invoice') {
    rows.push([
      { text: '📄 Unduh Kwitansi', data: `kwitansi:${docId}` },
      { text: '🛡️ Cetak Garansi', data: `warranty:${docId}` },
    ]);
    rows.push([
      { text: '📜 Cetak BAST', data: `bast:${docId}` },
      { text: '📦 Surat Jalan', data: `sj:${docId}` },
    ]);
    const row3: any[] = [{ text: '📍 Share Lokasi GPS', data: `loc:${clientName}` }];
    if (publicWarrantyUrl) row3.unshift({ text: '🌐 Garansi Live', url: publicWarrantyUrl });
    rows.push(row3);
  } else if (docType === 'warranty') {
    const row1: any[] = [{ text: '📜 Cetak BAST', data: `bast:${docId}` }];
    if (publicWarrantyUrl) row1.unshift({ text: '🌐 Buka Garansi Live', url: publicWarrantyUrl });
    rows.push(row1);
    rows.push([
      { text: '🧾 Lihat Faktur', data: `pdf:${docId}` },
      { text: '📄 Unduh Kwitansi', data: `kwitansi:${docId}` },
    ]);
  } else if (docType === 'bast') {
    rows.push([
      { text: '🛡️ Cetak Garansi', data: `warranty:${docId}` },
      { text: '📦 Surat Jalan', data: `sj:${docId}` },
    ]);
    rows.push([
      { text: '🧾 Lihat Faktur', data: `pdf:${docId}` },
      { text: '📄 Unduh Kwitansi', data: `kwitansi:${docId}` },
    ]);
  } else if (docType === 'surat_jalan') {
    rows.push([
      { text: '📜 Cetak BAST', data: `bast:${docId}` },
      { text: '📍 Lokasi GPS', data: `loc:${clientName}` },
    ]);
    rows.push([
      { text: '🧾 Lihat Faktur', data: `pdf:${docId}` },
      { text: '🛡️ Cetak Garansi', data: `warranty:${docId}` },
    ]);
  } else if (docType === 'quote') {
    rows.push([
      { text: '🤝 Tandai Deal', data: `deal:${docId}` },
      { text: '📦 Surat Jalan', data: `sj:${docId}` },
    ]);
  }
  return rows;
}

async function handleMorningBriefing(chat_id: number) {
  const { iso } = nowParts();

  // 1. Proyek berjalan
  const { data: ongoingInst } = await db.from('cctv_installations')
    .select('project_name, client_name, address_landmark, progress')
    .eq('user_id', OWNER_ID)
    .lt('progress', 100)
    .order('created_at', { ascending: false })
    .limit(5);

  // 2. Piutang / tagihan belum lunas
  const { data: unpaidInvs } = await db.from('invoices')
    .select('id, invoice_number, to_client, down_payment_amount, due_date, invoice_items(quantity, unit_price)')
    .eq('user_id', OWNER_ID)
    .neq('status', 'Lunas')
    .order('due_date', { ascending: true })
    .limit(5);

  // 3. Stok menipis
  const { data: lowStock } = await db.from('items')
    .select('description, stock, unit')
    .eq('user_id', OWNER_ID)
    .eq('track_stock', true)
    .lte('stock', 2)
    .limit(5);

  let projSection = '• <i>Tidak ada proyek tertunda. Seluruh pekerjaan terselesaikan! 👍</i>';
  if (ongoingInst && ongoingInst.length > 0) {
    projSection = ongoingInst.map((p: any, i: number) =>
      `<b>${i + 1}. ${esc(p.project_name || p.client_name)}</b> (${p.progress}%)\n   📍 <i>${esc(p.address_landmark || 'Samarinda')}</i>`
    ).join('\n');
  }

  let debtSection = '• 🟢 <i>Alhamdulillah semua tagihan berstatus Lunas! Arus kas aman.</i>';
  let topUnpaidId: string | null = null;
  if (unpaidInvs && unpaidInvs.length > 0) {
    topUnpaidId = unpaidInvs[0].id;
    debtSection = unpaidInvs.map((inv: any, i: number) => {
      const items = inv.invoice_items || [];
      const tot = items.reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unit_price), 0);
      const sisa = Math.max(0, tot - Number(inv.down_payment_amount || 0));
      return `<b>${i + 1}. ${esc(inv.to_client)}</b> [<code>${esc(inv.invoice_number)}</code>] - Sisa: <b>${rp(sisa)}</b>`;
    }).join('\n');
  }

  let stockSection = '• 🟢 <i>Semua stok material utama di toko aman.</i>';
  if (lowStock && lowStock.length > 0) {
    stockSection = lowStock.map((it: any) =>
      `• ⚠️ <b>${esc(it.description)}</b>: sisa <b>${it.stock} ${it.unit || 'Unit'}</b>`
    ).join('\n');
  }

  const buttons: any[] = [
    [
      { text: '📊 Rekap Piutang', data: 'briefing:unpaid' },
      { text: '📦 Cek Semua Stok', data: 'briefing:stock' },
    ]
  ];
  if (topUnpaidId) {
    buttons.push([{ text: '💰 Catat Pelunasan Terkini', data: `pay_lunas:${topUnpaidId}` }]);
  }

  return send(
    chat_id,
    `🌅 <b>Selamat Pagi Mas Wahyu! Briefing Eksekutif Borneo Etam</b>\n` +
    `📅 <b>${formatDateIndo(iso)}</b> • Samarinda, Kalimantan Timur\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📌 <b>Proyek Berjalan Lapangan:</b>\n${projSection}\n\n` +
    `⏳ <b>Monitoring Piutang Berjalan:</b>\n${debtSection}\n\n` +
    `📦 <b>Peringatan Stok Kritis Gudang:</b>\n${stockSection}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Bismillah, lancar rezeki, instalasi rapi presisi, dan amanah hari ini bro! 🚀</i>`,
    buttons
  );
}

// ------------------------------------------------------------------ helper parser item custom
function parseCustomItemsFromText(text: string): any[] {
  const items: any[] = [];
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);

  const parseNum = (s: string) => {
    if (!s) return 0;
    let clean = s.toLowerCase().trim();
    if (clean.includes('jt') || clean.includes('juta')) {
      const n = parseFloat(clean.replace(/[^0-9.,]/g, '').replace(',', '.'));
      return Math.round(n * 1000000);
    }
    if (clean.includes('rb') || clean.includes('k') || clean.includes('ribu')) {
      const n = parseFloat(clean.replace(/[^0-9.,]/g, '').replace(',', '.'));
      return Math.round(n * 1000);
    }
    const digits = clean.replace(/[^0-9]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^(?:bro|buat|buatkan|bikin|terbitkan|faktur|penawaran|alamat|lokasi)\b/i.test(line) && !line.toLowerCase().includes('modal') && !line.toLowerCase().includes('jual')) continue;

    // Strip leading 'item nya:' or 'item:'
    line = line.replace(/^(?:item\s+nya|item)\s*[:=]?\s*/i, '').trim();
    if (!line) continue;

    const lower = line.toLowerCase();
    const modalIdx = lower.indexOf('modal');
    const jualIdx = lower.indexOf('jual');

    if (modalIdx !== -1 && jualIdx !== -1 && modalIdx < jualIdx) {
      const desc = line.slice(0, modalIdx).trim();
      const modalStr = line.slice(modalIdx + 5, jualIdx).trim();
      const jualStr = line.slice(jualIdx + 4).trim();

      let qty = 1;
      let unit = 'Unit';

      const jualParts = jualStr.split(/\s+/);
      const priceStr = jualParts[0];
      if (jualParts.length >= 2 && /^\d+$/.test(jualParts[1])) {
        qty = parseInt(jualParts[1], 10);
        if (jualParts[2]) unit = jualParts[2];
      } else if (i + 1 < lines.length) {
        const nextMatch = lines[i + 1].match(/^(\d+)\s*([a-zA-Z]+)?$/);
        if (nextMatch) {
          qty = parseInt(nextMatch[1], 10);
          if (nextMatch[2]) unit = nextMatch[2];
          i++;
        }
      }

      items.push({
        description: desc,
        cost_price: parseNum(modalStr),
        unit_price: parseNum(priceStr),
        quantity: qty,
        unit,
        category: 'item_utama',
      });
      continue;
    }

    if (modalIdx !== -1 && jualIdx === -1 && i + 1 < lines.length && lines[i + 1].toLowerCase().startsWith('jual')) {
      const desc = line.slice(0, modalIdx).trim();
      const modalStr = line.slice(modalIdx + 5).trim();
      const nextLine = lines[i + 1];
      const jualStr = nextLine.slice(4).trim();
      const jualParts = jualStr.split(/\s+/);
      const priceStr = jualParts[0];
      let qty = 1;
      let unit = 'Unit';
      if (jualParts.length >= 2 && /^\d+$/.test(jualParts[1])) {
        qty = parseInt(jualParts[1], 10);
        if (jualParts[2]) unit = jualParts[2];
      }
      items.push({
        description: desc,
        cost_price: parseNum(modalStr),
        unit_price: parseNum(priceStr),
        quantity: qty,
        unit,
        category: 'item_utama',
      });
      i++;
      continue;
    }

    if (jualIdx !== -1 && modalIdx === -1) {
      const desc = line.slice(0, jualIdx).trim();
      const priceStr = line.slice(jualIdx + 4).trim().split(/\s+/)[0];
      const qtyMatch = desc.match(/(\d+)\s*(titik|unit|roll|meter|pcs)/i);
      items.push({
        description: desc,
        cost_price: 0,
        unit_price: parseNum(priceStr),
        quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
        unit: qtyMatch ? qtyMatch[2] : 'Titik',
        category: 'jasa_akomodasi',
      });
      continue;
    }
  }
  return items;
}

// ------------------------------------------------------------------ eksekusi intent
async function handleText(chat_id: number, text: string, audioInline?: any) {
  // Shortcut: Revert pelunasan BST jika diminta
  if (/batal.*lunas.*bst|revert.*lunas.*bst|kembalikan.*bst|bst.*belum lunas/i.test(text)) {
    const { data: bstInv } = await db.from('invoices')
      .select('id, invoice_number')
      .eq('user_id', OWNER_ID)
      .ilike('to_client', '%BST%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bstInv) {
      await db.from('invoices').update({
        down_payment_amount: 0,
        status: 'Terkirim',
      }).eq('id', bstInv.id);

      return send(
        chat_id,
        `🔄 <b>Status Faktur BST (${esc(bstInv.invoice_number)}) Berhasil Dikembalikan!</b>\n` +
        `• Status: <b>⏳ Belum Lunas (Terkirim)</b>\n` +
        `• Pembayaran Tercatat: <b>Rp 0</b>\n\n` +
        `Siap bro, faktur BST sudah kembali menjadi belum lunas.`
      );
    }
  }

  const packages = await loadPackages();

  // Deteksi perintah pembuatan dokumen baru secara eksplisit
  const isExplicitNewDoc = /^(?:bro\s+)?(?:buat|buatkan|bikin|terbitkan)\s+(?:faktur|penawaran|invoice|quote)/i.test(text.trim());
  let pending = await latestPending(chat_id);

  if (isExplicitNewDoc) {
    // Batalkan aksi pending usang agar item lama tidak bocor ke faktur/penawaran baru
    await db.from('telegram_pending_actions')
      .update({ status: 'cancelled' })
      .eq('chat_id', chat_id)
      .eq('status', 'pending');
    pending = null;
  }

  const chatContext = await getChatContext(chat_id);
  const trimmed = text.trim();
  let r: any = null;

  // FAST-PATH DETERMINISTIK: Tangani perintah rutin secara instan tanpa limit AI
  const isCreateIntent = /buat|buatkan|bikin|terbitkan|modal|jual|unit|pcs|\d+\s*(?:rb|k|jt)/i.test(trimmed);
  const isDeal = /(?:^|\s)(?:deal|sepakat|disepakati|setuju|diterima|deal\s*ya|jadi\s*pasang|acc)(?:$|\s|[!?.,])/i.test(trimmed);
  const isDeleteProject = /^(?:bro\s+)?(?:hapus|delete|batalkan|buang)\s+(?:proje(?:ct|ck|k|c)|proyek|pekerjaan)\s*(.*)$/i.exec(trimmed);
  const isDeleteDoc = /^(?:bro\s+)?(?:hapus|delete|batalkan|buang)\s+(?:faktur|invoice|penawaran|quote)\s*(.*)$/i.exec(trimmed);
  const progressMatch = trimmed.match(/(?:progr?es(?:s)?|kemajuan|tahap)\s*(?:jadi|udah|sudah)?\s*(\d{1,3})\s*%/i) ||
                        trimmed.match(/(\d{1,3})\s*%\s*(?:progr?es(?:s)?|selesai)/i);
  const isEditProject = /^(?:bro\s+)?(?:edit|ubah|ganti|update)\s+(?:proje(?:ct|ck|k|c)|proyek)\s*(.*)$/i.exec(trimmed);
  const isAddProject = /^(?:bro\s+)?(?:buat|bikin|tambah(?:kan)?|masukkan)\s+(?:proje(?:ct|ck|k|c)|proyek|pekerjaan)\s*(?:baru\s*)?(.*)$/i.exec(trimmed);
  const isInvoiceQuery = /^(?:bro\s+)?(?:cek|lihat|minta|kirim|tampilkan|unduh|buka)?\s*(?:faktur|invoice)\s*(.*)$/i.exec(trimmed);
  const isQuoteQuery = /^(?:bro\s+)?(?:cek|lihat|minta|kirim|tampilkan|unduh|buka)?\s*(?:penawaran|quote)\s*(.*)$/i.exec(trimmed);
  const isLunasQuery = /^(?:bro\s+)?(?:lunas|sudah lunas|tandai lunas|catat pelunasan|lunasin|bayar lunas)(?:\s+(?:bro|ya|faktur|tagihan))?(?:\s+(.*))?$/i.exec(trimmed);
  const isReceiptQuery = /^(?:bro\s+)?(?:cek|lihat|minta|cetak|unduh)\s*(?:kwitansi|bukti bayar)\s*(.*)$/i.exec(trimmed);
  const isBastQuery = /^(?:bro\s+)?(?:cek|lihat|minta|cetak|unduh)\s*(?:bast|berita acara)\s*(.*)$/i.exec(trimmed);
  const isSjQuery = /^(?:bro\s+)?(?:cek|lihat|minta|cetak|unduh)\s*(?:surat jalan|sj)\s*(.*)$/i.exec(trimmed);
  const isWarrantyQuery = /^(?:bro\s+)?(?:cek|lihat|minta|cetak|kartu|link|sertifikat)\s*(?:garansi|garansi digital)\s*(.*)$/i.exec(trimmed);
  const isUnpaidQuery = /^(?:bro\s+)?(?:rekap|cek|lihat|daftar|siapa)?\s*(?:piutang|tagihan belum lunas|faktur belum lunas)/i.test(trimmed);
  const isAddPhotoQuery = /^(?:bro\s+)?(?:tambah(?:kan)?\s*foto|foto\s*(?:ini\s*)?tambah|ini\s*foto\s*(?:buat|untuk)?\s*proje(?:ct|ck|k|c)|ini\s*foto\s*proyek|upload\s*foto|masukkan\s*foto|tambah\s*dokumentasi)(?:\s+(?:ini|itu|untuk|ke|proyek|project|projeck|pak))?(?:\s+(.*))?$/i.exec(trimmed);
  const isCoverQuery = /^(?:bro\s+)?(?:(?:foto\s*ini\s*)?(?:jadi|jadikan|buat|set)\s*(?:sebagai\s*)?sampul|sampul\s*proyek|cover\s*proyek|jadikan\s*cover)(?:\s+(?:ini|itu|untuk|ke|proyek|project|pak))?(?:\s+(.*))?$/i.exec(trimmed);
  const isProjectQuery = /^(?:bro\s+)?(?:cek|lihat|buka|info|detail|status|daftar)\s+(?:semua\s+)?(?:proje(?:ct|ck|k|c)|proyek|pekerjaan)(?:\s+(?:ini|itu|kita|berjalan|aktif|semua|untuk|ke|milik|pak))?(?:\s+(.*))?$/i.exec(trimmed) ||
                         /^(?:bro\s+)?(?:proje(?:ct|ck|k|c)|proyek|pekerjaan)(?:\s+(?:ini|itu|kita|berjalan|aktif|semua))$/i.exec(trimmed);
  const isLocationQuery = /^(?:bro\s+)?(?:share\s+lokasi|lokasi|posisi|maps?|gps|rute)(?:\s+(?:proyek|project|projeck|pak|ke|untuk))?(?:\s+(.*))?$/i.exec(trimmed);

  if (isDeal) {
    const rawTarget = trimmed
      .replace(/(?:^|\s)(?:bro|deal|sepakat|disepakati|setuju|diterima|deal\s*ya|jadi\s*pasang|acc|sudah|udah|proje(?:ct|ck|k|c)|proyek|pekerjaan|penawaran|quote|faktur|invoice|pak|bu|haji|om|mas|ya|dong|oke|ok|tolong)(?:\s|$)/gi, ' ')
      .trim();
    const target = rawTarget || chatContext?.client_name || '';
    r = {
      intent: 'deal_project',
      target_text: target,
      client_name: target,
      reply: 'Memproses kesepakatan deal proyek...',
    };
  } else if (isDeleteProject) {
    const rawTarget = (isDeleteProject[1] || '').replace(/^(?:untuk|atas nama|nama|punya|milik|ke|pak)\s+/i, '').trim();
    r = {
      intent: 'delete_project',
      target_text: rawTarget || chatContext?.client_name || '',
      reply: 'Memproses penghapusan proyek...',
    };
  } else if (isDeleteDoc) {
    const rawTarget = (isDeleteDoc[1] || '').replace(/^(?:untuk|atas nama|nama|punya|milik|ke|pak)\s+/i, '').trim();
    const isInv = /faktur|invoice/i.test(trimmed);
    r = {
      intent: 'delete_document',
      target_doc_type: isInv ? 'invoice' : 'quote',
      target_text: rawTarget || chatContext?.client_name || '',
      reply: 'Memproses pembatalan dokumen...',
    };
  } else if (progressMatch) {
    const percent = parseInt(progressMatch[1], 10);
    const rawTarget = trimmed
      .replace(/(?:progr?es(?:s)?|kemajuan|tahap)\s*(?:jadi|udah|sudah)?\s*(\d{1,3})\s*%/gi, '')
      .replace(/(\d{1,3})\s*%\s*(?:progr?es(?:s)?|selesai)/gi, '')
      .replace(/(?:^|\s)(?:bro|update|edit|ubah|proje(?:ct|ck|k|c)|proyek|pekerjaan|pak|bu|haji|om|mas|ya|dong|sudah|udah|nya|jadi)(?:\s|$)/gi, ' ')
      .trim();
    const target = rawTarget || chatContext?.client_name || '';
    r = {
      intent: 'update_progress',
      progress_percent: percent,
      target_text: target,
      client_name: target,
      reply: `Memperbarui progres proyek jadi ${percent}%...`,
    };
  } else if (isEditProject) {
    const rawTarget = (isEditProject[1] || '').replace(/^(?:untuk|atas nama|nama|punya|milik|ke|pak)\s+/i, '').trim();
    r = {
      intent: 'edit_project',
      target_text: rawTarget || chatContext?.client_name || '',
      client_name: rawTarget || chatContext?.client_name || '',
      reply: 'Memperbarui data proyek...',
    };
  } else if (isAddProject) {
    const rawTarget = (isAddProject[1] || '').replace(/^(?:untuk|atas nama|nama|punya|milik|ke|pak)\s+/i, '').trim();
    r = {
      intent: 'add_project',
      target_text: rawTarget || '',
      client_name: rawTarget || '',
      reply: 'Membuat proyek baru...',
    };
  } else if (!isCreateIntent && isInvoiceQuery) {
    const target = isInvoiceQuery[1]?.replace(/^(?:untuk|atas nama|nama|punya|milik|ke)\s+/i, '').trim();
    r = {
      intent: 'get_pdf',
      target_doc_type: 'invoice',
      target_text: target || chatContext?.client_name || 'terakhir',
      reply: 'Mencari dokumen faktur...',
    };
  } else if (!isCreateIntent && isQuoteQuery) {
    const target = isQuoteQuery[1]?.replace(/^(?:untuk|atas nama|nama|punya|milik|ke)\s+/i, '').trim();
    r = {
      intent: 'get_pdf',
      target_doc_type: 'quote',
      target_text: target || chatContext?.client_name || 'terakhir',
      reply: 'Mencari dokumen penawaran...',
    };
  } else if (!isCreateIntent && isLunasQuery) {
    const target = isLunasQuery[1]?.replace(/^(?:untuk|atas nama|nama|punya|milik|ke|faktur|pak)\s+/i, '').trim();
    r = {
      intent: 'record_payment',
      is_paid_off: true,
      target_text: target || chatContext?.client_name || '',
      reply: 'Mencatat pelunasan faktur...',
    };
  } else if (!isCreateIntent && isReceiptQuery) {
    const target = isReceiptQuery[1]?.replace(/^(?:untuk|atas nama|nama|punya|milik|ke|faktur|pak)\s+/i, '').trim();
    r = {
      intent: 'get_receipt',
      target_text: target || chatContext?.client_name || 'terakhir',
      reply: 'Menyiapkan kwitansi pembayaran...',
    };
  } else if (!isCreateIntent && isBastQuery) {
    const target = isBastQuery[1]?.replace(/^(?:untuk|atas nama|nama|punya|milik|ke|faktur|pak)\s+/i, '').trim();
    r = {
      intent: 'get_bast',
      target_text: target || chatContext?.client_name || 'terakhir',
      reply: 'Menyiapkan dokumen BAST...',
    };
  } else if (!isCreateIntent && isSjQuery) {
    const target = isSjQuery[1]?.replace(/^(?:untuk|atas nama|nama|punya|milik|ke|faktur|pak)\s+/i, '').trim();
    r = {
      intent: 'get_surat_jalan',
      target_text: target || chatContext?.client_name || 'terakhir',
      reply: 'Menyiapkan Surat Jalan...',
    };
  } else if (!isCreateIntent && isWarrantyQuery) {
    const target = isWarrantyQuery[1]?.replace(/^(?:untuk|atas nama|nama|punya|milik|ke|faktur|pak)\s+/i, '').trim();
    r = {
      intent: 'get_warranty',
      target_text: target || chatContext?.client_name || 'terakhir',
      reply: 'Menyiapkan kartu garansi...',
    };
  } else if (!isCreateIntent && isUnpaidQuery) {
    r = {
      intent: 'unpaid_invoices',
      reply: 'Memeriksa rekap tagihan piutang berjalan...',
    };
  } else if (!isCreateIntent && isAddPhotoQuery) {
    const rawTarget = (isAddPhotoQuery[1] || '').replace(/^(?:untuk|atas nama|nama|punya|milik|ke|faktur|proyek|project|pak)\s+/i, '').trim();
    const target = rawTarget || chatContext?.client_name || '';

    let targetInst: any = null;
    if (target && !/^(ini|itu|nya)$/i.test(target)) {
      const cleanT = cleanSearchName(target);
      const { data: insts } = await db.from('cctv_installations')
        .select('*')
        .eq('user_id', OWNER_ID)
        .or(`client_name.ilike.%${cleanT}%,project_name.ilike.%${cleanT}%,public_display_name.ilike.%${cleanT}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      targetInst = insts?.[0] || null;

      if (!targetInst) {
        const match = await findQuoteOrInvoice(target, 'auto');
        if (match) {
          const cName = match.doc.to_client;
          const { data: insts2 } = await db.from('cctv_installations')
            .select('*')
            .eq('user_id', OWNER_ID)
            .or(`client_name.ilike.%${cName}%,quote_id.eq.${match.doc.id}`)
            .order('created_at', { ascending: false })
            .limit(1);
          targetInst = insts2?.[0] || null;

          if (!targetInst) {
            const { data: newInst } = await db.from('cctv_installations').insert({
              user_id: OWNER_ID,
              client_name: cName,
              client_phone: match.doc.to_phone || '',
              address_landmark: match.doc.to_address || 'Samarinda, Kalimantan Timur',
              project_name: `Instalasi CCTV - ${cName}`,
              public_display_name: `Instalasi CCTV - ${cName}`,
              service_type: 'CCTV',
              city: 'Samarinda',
              latitude: -0.502106,
              longitude: 117.153709,
              progress: 80,
              installed_at: match.doc.invoice_date || match.doc.created_at?.slice(0, 10) || nowParts().iso,
              quote_id: match.doc.id,
              photos: [],
              warranty_months: 12,
            }).select('*').single();
            targetInst = newInst;
          }
        }
      }
    }

    if (!targetInst && chatContext?.client_name) {
      const cleanCtx = cleanSearchName(chatContext.client_name);
      const { data: insts3 } = await db.from('cctv_installations')
        .select('*')
        .eq('user_id', OWNER_ID)
        .or(`client_name.ilike.%${cleanCtx}%,project_name.ilike.%${cleanCtx}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      targetInst = insts3?.[0] || null;
    }

    if (!targetInst) {
      const { data: latestInsts } = await db.from('cctv_installations')
        .select('*')
        .eq('user_id', OWNER_ID)
        .order('created_at', { ascending: false })
        .limit(1);
      targetInst = latestInsts?.[0] || null;
    }

    if (!targetInst) {
      return send(chat_id, 'Belum ada proyek/instalasi terdaftar bro. Buat penawaran atau proyek dulu ya!');
    }

    await setChatContext(chat_id, {
      client_name: targetInst.client_name,
      doc_id: targetInst.id,
      doc_type: 'project',
      // @ts-ignore
      is_waiting_for_photo: true,
    });

    const photoCount = Array.isArray(targetInst.photos) ? targetInst.photos.length : 0;
    const publicWarrantyUrl = `${APP_URL}/garansi/${targetInst.id}`;

    return send(
      chat_id,
      `📸 <b>Siap Mas Wahyu! Mode Unggah Foto Proyek Aktif:</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Klien / Proyek : <b>${esc(targetInst.project_name || targetInst.client_name)}</b>\n` +
      `• Lokasi         : <i>${esc(targetInst.address_landmark || 'Samarinda')}</i>\n` +
      `• Koleksi Saat Ini : <b>${photoCount} Foto Tersimpan</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Silakan <b>kirimkan fotonya sekarang</b> bro! Mas Wahyu bisa kirim 1 foto atau langsung <b>banyak foto sekaligus (album)</b>.\n\n` +
      `💡 <i>Tips: Mas Wahyu bisa sertakan caption "<b>jadikan sampul</b>" jika ingin foto tersebut jadi sampul utama di Peta & Garansi!</i>`,
      [
        [
          { text: '🌐 Buka Garansi Live', url: publicWarrantyUrl },
          { text: '🗺️ Buka Peta Command Center', url: `${APP_URL}/peta` }
        ]
      ]
    );
  } else if (!isCreateIntent && isCoverQuery) {
    const rawTarget = (isCoverQuery[1] || '').replace(/^(?:untuk|atas nama|nama|punya|milik|ke|faktur|proyek|project|pak)\s+/i, '').trim();
    const target = rawTarget || chatContext?.client_name || '';

    let targetInst: any = null;
    if (target && !/^(ini|itu|nya)$/i.test(target)) {
      const cleanT = cleanSearchName(target);
      const { data: insts } = await db.from('cctv_installations')
        .select('*')
        .eq('user_id', OWNER_ID)
        .or(`client_name.ilike.%${cleanT}%,project_name.ilike.%${cleanT}%,public_display_name.ilike.%${cleanT}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      targetInst = insts?.[0] || null;
    }

    if (!targetInst && chatContext?.client_name) {
      const cleanCtx = cleanSearchName(chatContext.client_name);
      const { data: insts3 } = await db.from('cctv_installations')
        .select('*')
        .eq('user_id', OWNER_ID)
        .or(`client_name.ilike.%${cleanCtx}%,project_name.ilike.%${cleanCtx}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      targetInst = insts3?.[0] || null;
    }

    if (!targetInst) {
      const { data: latestInsts } = await db.from('cctv_installations')
        .select('*')
        .eq('user_id', OWNER_ID)
        .order('created_at', { ascending: false })
        .limit(1);
      targetInst = latestInsts?.[0] || null;
    }

    if (!targetInst) {
      return send(chat_id, 'Belum ada proyek/instalasi terdaftar bro. Buat proyek dulu ya!');
    }

    const currentPhotos: string[] = Array.isArray(targetInst.photos)
      ? targetInst.photos.map((p: any) => typeof p === 'string' ? p : p?.url).filter(Boolean)
      : [];

    if (currentPhotos.length > 0) {
      const lastPhoto = currentPhotos[currentPhotos.length - 1];
      const remaining = currentPhotos.slice(0, currentPhotos.length - 1);
      const reordered = [lastPhoto, ...remaining];

      await db.from('cctv_installations').update({
        photos: reordered,
        updated_at: new Date().toISOString()
      }).eq('id', targetInst.id);

      await setChatContext(chat_id, {
        client_name: targetInst.client_name,
        doc_id: targetInst.id,
        doc_type: 'project',
      });

      return send(
        chat_id,
        `🌟 <b>Sampul Proyek Berhasil Diperbarui!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `• Klien / Proyek : <b>${esc(targetInst.project_name || targetInst.client_name)}</b>\n` +
        `• Status Sampul  : <b>Foto dokumentasi terbaru resmi dijadikan Sampul Utama (Cover)</b>\n` +
        `• Total Koleksi  : <b>${reordered.length} Foto Tersimpan</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Foto sampul akan otomatis tampil paling depan di Peta Interaktif Command Center dan Kartu Garansi Digital!</i>`,
        [
          [
            { text: '🌐 Buka Garansi Live', url: `${APP_URL}/garansi/${targetInst.id}` },
            { text: '🗺️ Buka Peta Command Center', url: `${APP_URL}/peta` }
          ]
        ]
      );
    } else {
      await setChatContext(chat_id, {
        client_name: targetInst.client_name,
        doc_id: targetInst.id,
        doc_type: 'project',
        // @ts-ignore
        is_waiting_for_photo: true,
        // @ts-ignore
        next_is_cover: true,
      });

      return send(
        chat_id,
        `📸 <b>Siap Mas Wahyu! Proyek: ${esc(targetInst.project_name || targetInst.client_name)}</b>\n` +
        `Proyek ini belum memiliki foto dokumentasi. Silakan <b>kirimkan fotonya sekarang</b>, dan foto pertama otomatis akan dijadikan <b>Sampul Utama (Cover)</b>!`
      );
    }
  } else if (!isCreateIntent && isProjectQuery) {
    const rawTarget = (isProjectQuery[1] || '').replace(/^(?:untuk|atas nama|nama|punya|milik|ke|faktur|proyek|project|pak)\s+/i, '').trim();
    const isListMode = /daftar|semua|berjalan|aktif/i.test(trimmed);
    return handleProjectCheck(chat_id, rawTarget, chatContext, isListMode);
  } else if (!isCreateIntent && isLocationQuery) {
    const target = isLocationQuery[1]?.replace(/^(?:untuk|atas nama|nama|punya|milik|ke|faktur|pak)\s+/i, '').trim();
    r = {
      intent: 'share_location',
      target_text: target || chatContext?.client_name || 'terakhir',
      reply: 'Menyiapkan titik lokasi GPS proyek...',
    };
  }

  if (!r) {
    r = await askGemini(text, packages, pending, audioInline, chatContext);
  }

  // Intent Guard: Jika user jelas minta buat faktur/penawaran baru, paksa intent yang sesuai
  if (isExplicitNewDoc) {
    if (/faktur|invoice/i.test(text)) r.intent = 'create_invoice';
    else if (/penawaran|quote/i.test(text)) r.intent = 'create_quote';
  }

  // Pending Mismatch Guard: Jika r.intent === 'modify_pending' tapi menyebut nama klien berbeda dari pending
  if (r.intent === 'modify_pending' && pending?.payload?.client_name && r.client_name) {
    const cn1 = cleanSearchName(r.client_name);
    const cn2 = cleanSearchName(pending.payload.client_name);
    if (cn1 && cn2 && cn1 !== cn2) {
      r.intent = pending.kind === 'invoice' ? 'create_invoice' : 'create_quote';
      await db.from('telegram_pending_actions').update({ status: 'cancelled' }).eq('id', pending.id);
      pending = null;
    }
  }

  // Fallback custom items parser if AI missed extra_items
  if (text && (!r.extra_items || r.extra_items.length === 0)) {
    const customParsed = parseCustomItemsFromText(text);
    if (customParsed.length > 0) {
      r.extra_items = customParsed;
    }
  }

  // Regex fallback for client_address if user explicitly mentioned address but AI missed it
  if (!r.client_address && text) {
    const addrMatch = text.match(/(?:alamat|lokasi)\s*[:=]?\s*([^\n\r]+)/i);
    if (addrMatch) r.client_address = addrMatch[1].trim();
  }

  // Fallback target_text to active conversation context if empty or generic "terakhir"
  const isGenericPrompt = !r.target_text || /^(terakhir|last|terbaru|kemarin|ini|itu|nya)$/i.test((r.target_text || '').trim());
  if (isGenericPrompt && !r.client_name && chatContext?.client_name) {
    if (['record_payment', 'get_pdf', 'get_receipt', 'get_surat_jalan', 'get_bast', 'get_warranty', 'share_location', 'deal_project', 'update_progress', 'edit_project', 'delete_project', 'delete_document'].includes(r.intent)) {
      r.target_text = chatContext.client_name;
    }
  }

  switch (r.intent) {
    // ---------------------------------------------------- BUAT FAKTUR LANGSUNG (CREATE INVOICE)
    case 'create_invoice': {
      if (!r.client_name) {
        return send(
          chat_id,
          'Klien atau tokonya atas nama siapa bro? Contoh:\n• <i>buat faktur ke Toko Berkah Jaya jasa pasang 4 titik 600rb, akomodasi 150rb</i>\n• <i>buat faktur Pak Yusuf paket 4 kamera 3.5jt DP 1.5jt</i>'
        );
      }

      const pkg = packages.find((p) => p.id === r.package_id) ?? null;
      let items = cloneItems(pkg);

      // Jika item kosong, cari apakah klien ini punya penawaran tersimpan sebelumnya untuk ditarik itemnya
      // HANYA jika pesan Mas Wahyu TIDAK mencantumkan rincian item sendiri
      const userMentionedItems = /(?:item|barang|jasa|unit|pcs|modal|jual|\d+\s*(?:rb|k|jt))/i.test(text);
      if (!userMentionedItems && items.length === 0 && (r.extra_items ?? []).length === 0) {
        const t = (r.client_name || r.target_text || '').trim();
        if (t) {
          const match = await findQuoteOrInvoice(t, 'quote');
          // Pastikan nama klien benar-benar cocok dan bukan nama kosong
          if (match?.doc?.to_client && cleanSearchName(match.doc.to_client) === cleanSearchName(t)) {
            const exQuote = match.doc;
            if (exQuote?.quote_items && exQuote.quote_items.length > 0) {
              items = exQuote.quote_items.map((i: any) => ({
                description: i.description,
                quantity: i.quantity,
                unit: i.unit || 'Unit',
                unit_price: i.unit_price,
                cost_price: i.cost_price || 0,
                category: classifyItem(i),
              }));
              if (!r.client_address && exQuote.to_address) r.client_address = exQuote.to_address;
              if (!r.client_phone && exQuote.to_phone) r.client_phone = exQuote.to_phone;
              if (r.discount_amount == null && exQuote.discount_amount) r.discount_amount = exQuote.discount_amount;
            }
          }
        }
      }

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
          'Rincian tagihan fakturnya apa saja bro? Contoh:\n• <i>buat faktur ke Toko Berkah Jaya jasa pasang 4 titik 600rb, akomodasi 150rb</i>\n• <i>buat faktur Pak Yusuf paket 4 kamera 3.5jt DP 1.5jt</i>'
        );
      }

      const isStore = r.doc_category === 'partner_service' || r.is_partner_store || (r.client_name || '').toLowerCase().includes('toko') || (r.client_name || '').toLowerCase().includes('cv');
      const docCategory: 'standard' | 'partner_service' = isStore ? 'partner_service' : 'standard';

      if (isStore) {
        items.forEach((it: any) => {
          const d = (it.description || '').toLowerCase();
          if (d.includes('bawaan toko') || d.includes('unit toko') || d.includes('disediakan toko')) {
            it.unit_price = 0;
            it.cost_price = 0;
          }
        });
      }

      const sub = subtotal(items);
      const discount = Number(r.discount_amount || 0);
      const total = Math.max(0, sub - discount);
      let dp = Number(r.down_payment_amount || 0);
      if (r.down_payment_percent != null && dp === 0) {
        dp = Math.round((total * r.down_payment_percent) / 100);
      }

      const payload = {
        client_name: r.client_name,
        client_phone: r.client_phone || '',
        client_address: r.client_address || '',
        package_id: pkg?.id ?? null,
        package_name: pkg?.shortName ?? null,
        items,
        discount_amount: discount,
        dp_amount: dp,
        total,
        sn_nvr: r.sn_nvr || null,
        sn_hdd: r.sn_hdd || null,
        doc_category: docCategory,
        terms: isStore
          ? `[CATEGORY:partner_service]\n1. Faktur ini khusus tagihan jasa instalasi teknis & akomodasi lapangan.\n2. Pembayaran ditransfer ke rekening resmi BCA 5135400278 a.n Muhammad Wahyu.\n3. Garansi instalasi kabel & kerapian 3 bulan sejak tanggal faktur.`
          : (pkg?.defaultTerms ?? ''),
      };

      const id = await savePending(chat_id, 'invoice', payload);
      return showPending(chat_id, id, 'invoice', payload);
    }

    // ---------------------------------------------------- EDIT PENAWARAN & FAKTUR & INPUT SN (EDIT DOCUMENT)
    case 'edit_document': {
      const t = (r.target_text || r.client_name || '').trim();
      if (!t) {
        return send(chat_id, 'Dokumen mana yang mau diedit bro? Contoh: <i>faktur pak yusuf mau masukkan SN NVR</i> atau <i>edit penawaran pak hendra</i>');
      }

      const wantInvoice = r.target_doc_type === 'invoice' || /faktur|inv/i.test(text);
      const wantQuote = r.target_doc_type === 'quote' || /penawaran|quote|quo/i.test(text);
      const prefType = wantInvoice && !wantQuote ? 'invoice' : wantQuote && !wantInvoice ? 'quote' : 'auto';

      const match = await findQuoteOrInvoice(t, prefType);
      if (!match) {
        return send(chat_id, `Dokumen faktur atau penawaran untuk "${esc(t)}" tidak ditemukan bro. Pastikan nama klien atau nomor dokumennya sesuai ya.`);
      }

      const doc = match.doc;
      const docType = match.docType;

      const itemTable = docType === 'invoice' ? 'invoice_items' : 'quote_items';
      const docFk = docType === 'invoice' ? 'invoice_id' : 'quote_id';
      const currentItems: any[] = (docType === 'invoice' ? doc.invoice_items : doc.quote_items) || [];

      const snNvr = r.sn_nvr ? String(r.sn_nvr).trim() : null;
      const snHdd = r.sn_hdd ? String(r.sn_hdd).trim() : null;
      const hasItemEdits = (r.item_adjustments?.length || 0) > 0 || (r.extra_items?.length || 0) > 0 || (r.delete_items?.length || 0) > 0;
      const hasHeaderEdits = Boolean(r.client_address || r.client_phone || r.discount_amount != null || r.down_payment_amount != null);

      // Jika user minta masukkan SN tapi belum menyebutkan nomor SN-nya
      if (!snNvr && !snHdd && !hasItemEdits && !hasHeaderEdits) {
        const nvrItem = currentItems.find((i: any) => /nvr|dvr|perekam/i.test(i.description));
        return send(
          chat_id,
          `📋 <b>Dokumen ${docType === 'invoice' ? 'Faktur' : 'Penawaran'} Ditemukan: ${esc(doc.to_client)}</b>\n` +
          `Nomor: <code>${esc(docType === 'invoice' ? doc.invoice_number : doc.quote_number)}</code>\n` +
          (nvrItem ? `Item Perekam: <i>${esc(nvrItem.description)}</i>\n\n` : '\n') +
          `Silakan sebutkan nomor Serial Number (SN) yang mau dimasukkan bro, contoh:\n` +
          `• <i>faktur ${doc.to_client} SN NVR: NVR-DS7204-ABC, SN HDD: WD-PURPLE-1TB</i>\n` +
          `• <i>edit nvr ${doc.to_client} masukkan SN NVR-8899</i>`
        );
      }

      const changesMade: string[] = [];

      // 1. Update Serial Number di cctv_installations & Item Description
      let instId: string | null = null;
      if (snNvr || snHdd) {
        const { data: exInst } = await db.from('cctv_installations')
          .select('id, sn_nvr, sn_hdd')
          .eq('user_id', OWNER_ID)
          .or(`client_name.ilike.%${doc.to_client}%,project_name.ilike.%${doc.to_client}%`)
          .limit(1)
          .maybeSingle();

        const updateInstData: any = { progress: 100, installed_at: nowParts().iso };
        if (snNvr) updateInstData.sn_nvr = snNvr;
        if (snHdd) updateInstData.sn_hdd = snHdd;

        if (exInst) {
          instId = exInst.id;
          await db.from('cctv_installations').update(updateInstData).eq('id', exInst.id);
        } else {
          const { data: newInst } = await db.from('cctv_installations').insert({
            user_id: OWNER_ID,
            client_id: doc.client_id || null,
            quote_id: docType === 'quote' ? doc.id : doc.quote_id || null,
            project_id: doc.project_id || null,
            project_name: `Proyek CCTV - ${doc.to_client}`,
            public_display_name: `Instalasi CCTV - ${doc.to_client}`,
            client_name: doc.to_client,
            client_phone: doc.to_phone || '',
            address_landmark: doc.to_address || 'Samarinda',
            service_type: 'CCTV',
            city: 'Samarinda',
            latitude: -0.502106,
            longitude: 117.153709,
            progress: 100,
            installed_at: nowParts().iso,
            sn_nvr: snNvr || null,
            sn_hdd: snHdd || null,
            warranty_months: 12,
          }).select('id').single();
          instId = newInst?.id ?? null;
        }

        if (snNvr) {
          changesMade.push(`• SN NVR diinput: <code>${esc(snNvr)}</code>`);
          const nvrItem = currentItems.find((i: any) => /nvr|dvr|perekam/i.test(i.description));
          if (nvrItem) {
            let newDesc = nvrItem.description;
            if (/\(SN:[^)]+\)/i.test(newDesc)) {
              newDesc = newDesc.replace(/\(SN:[^)]+\)/i, `(SN: ${snNvr})`);
            } else {
              newDesc = `${newDesc} (SN: ${snNvr})`;
            }
            await db.from(itemTable).update({ description: newDesc }).eq('id', nvrItem.id);
            nvrItem.description = newDesc;
          }
        }

        if (snHdd) {
          changesMade.push(`• SN HDD diinput: <code>${esc(snHdd)}</code>`);
          const hddItem = currentItems.find((i: any) => /hdd|harddisk|seagate|wd purple/i.test(i.description));
          if (hddItem) {
            let newDesc = hddItem.description;
            if (/\(SN:[^)]+\)/i.test(newDesc)) {
              newDesc = newDesc.replace(/\(SN:[^)]+\)/i, `(SN: ${snHdd})`);
            } else {
              newDesc = `${newDesc} (SN: ${snHdd})`;
            }
            await db.from(itemTable).update({ description: newDesc }).eq('id', hddItem.id);
            hddItem.description = newDesc;
          }
        }
      }

      // 2. Update item harga / qty
      for (const a of r.item_adjustments ?? []) {
        let targetItem: any = null;
        if (a.index != null && currentItems[a.index]) {
          targetItem = currentItems[a.index];
        } else if (a.item_keyword) {
          const kw = a.item_keyword.toLowerCase();
          targetItem = currentItems.find((i: any) => (i.description || '').toLowerCase().includes(kw));
        }
        if (targetItem) {
          const upObj: any = {};
          if (a.quantity != null) { upObj.quantity = a.quantity; targetItem.quantity = a.quantity; }
          if (a.unit_price != null) { upObj.unit_price = a.unit_price; targetItem.unit_price = a.unit_price; }
          if (a.cost_price != null) { upObj.cost_price = a.cost_price; targetItem.cost_price = a.cost_price; }
          await db.from(itemTable).update(upObj).eq('id', targetItem.id);
          changesMade.push(`• Item "${esc(targetItem.description)}": ${a.quantity ? `Qty ${a.quantity} ` : ''}${a.unit_price ? `Harga ${rp(a.unit_price)}` : ''}`);
        }
      }

      // 3. Hapus item
      for (const delKw of r.delete_items ?? []) {
        const kw = delKw.toLowerCase();
        const targets = currentItems.filter((i: any) => (i.description || '').toLowerCase().includes(kw));
        for (const tg of targets) {
          await db.from(itemTable).delete().eq('id', tg.id);
          changesMade.push(`• Hapus item: "${esc(tg.description)}"`);
        }
      }

      // 4. Tambah item ekstra
      for (const e of r.extra_items ?? []) {
        const row: any = {
          [docFk]: doc.id,
          description: e.description,
          quantity: e.quantity || 1,
          unit: e.unit || 'Unit',
          unit_price: e.unit_price || 0,
          cost_price: e.cost_price || 0,
        };
        const { data: newRow } = await db.from(itemTable).insert(row).select().single();
        if (newRow) {
          currentItems.push(newRow);
          changesMade.push(`• Tambah item: "${esc(e.description)}" ×${e.quantity || 1} @${rp(e.unit_price || 0)}`);
        }
      }

      // 5. Update Header Dokumen
      const docTable = docType === 'invoice' ? 'invoices' : 'quotes';
      const docHeaderUpdates: any = {};

      if (r.client_address) {
        docHeaderUpdates.to_address = r.client_address;
        doc.to_address = r.client_address;
        changesMade.push(`• Alamat diubah: <i>${esc(r.client_address)}</i>`);
      }
      if (r.client_phone) {
        docHeaderUpdates.to_phone = r.client_phone;
        doc.to_phone = r.client_phone;
        changesMade.push(`• No HP diubah: <code>${esc(r.client_phone)}</code>`);
      }
      if (r.discount_amount != null) {
        docHeaderUpdates.discount_amount = r.discount_amount;
        doc.discount_amount = r.discount_amount;
        changesMade.push(`• Diskon diubah: ${rp(r.discount_amount)}`);
      }
      if (docType === 'invoice' && r.down_payment_amount != null) {
        docHeaderUpdates.down_payment_amount = r.down_payment_amount;
        doc.down_payment_amount = r.down_payment_amount;
        changesMade.push(`• DP diubah: ${rp(r.down_payment_amount)}`);
      }

      if (Object.keys(docHeaderUpdates).length > 0) {
        await db.from(docTable).update(docHeaderUpdates).eq('id', doc.id);
      }

      // 6. Tarik seluruh item terkini & hitung ulang total
      const { data: freshItems } = await db.from(itemTable).select('*').eq(docFk, doc.id);
      const itemsList = freshItems || currentItems;
      const sub = subtotal(itemsList);
      const discount = Number(doc.discount_amount || 0);
      const tot = Math.max(0, sub - discount);
      const dp = Number(doc.down_payment_amount || 0);

      const isStore = (doc.terms || '').includes('[CATEGORY:partner_service]') || (doc.title || '').toLowerCase().includes('subkon') || (doc.to_client || '').toLowerCase().includes('toko');
      const docCategory: 'standard' | 'partner_service' = isStore ? 'partner_service' : 'standard';

      // 7. Generate PDF terbaru
      const docNumber = docType === 'invoice' ? doc.invoice_number : doc.quote_number;
      const docDateStr = doc.created_at ? String(doc.created_at).slice(0, 10) : nowParts().iso;

      const pdfBytes = generateBorneoDocumentPdf({
        type: docType,
        docCategory,
        docNumber,
        dateStr: docDateStr,
        clientName: doc.to_client,
        clientPhone: doc.to_phone,
        clientAddress: doc.to_address,
        companyName: doc.from_company || 'Borneo Etam CCTV & Komputer Kasir',
        companyPhone: '082251314646',
        companyWebsite: 'Borneoetam.com',
        paymentInstructions: 'Bank BCA\n5135400278\na.n Muhammad Wahyu',
        terms: doc.terms,
        items: itemsList,
        discountAmount: discount,
        downPaymentAmount: dp,
        snNvr: snNvr || undefined,
        snHdd: snHdd || undefined,
      });

      const safeName = `${docType === 'invoice' ? 'Faktur' : 'Penawaran'}-${doc.to_client.replace(/[^a-zA-Z0-9]/g, '_')}-${docNumber.replace(/\//g, '-')}.pdf`;

      await sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `📄 <b>${docType === 'invoice' ? (isStore ? 'Faktur Jasa &amp; Subkon (Toko)' : 'Faktur Tagihan') : (isStore ? 'Penawaran Jasa &amp; Subkon (Toko)' : 'Surat Penawaran')} Diperbarui: <code>${esc(docNumber)}</code></b>\n` +
        `Klien/Toko: <b>${esc(doc.to_client)}</b>\n` +
        `Total: <b>${rp(tot)}</b>${dp > 0 ? ` (DP: ${rp(dp)})` : ''}\n` +
        (changesMade.length > 0 ? `\n<b>Perubahan Berhasil Disimpan:</b>\n${changesMade.join('\n')}` : '')
      );

      // 8. Jika SN diupdate, kirim juga Sertifikat Garansi Digital terbaru PDF + link web live
      const publicWarrantyUrl = instId ? `${APP_URL}/garansi/${instId}` : `${APP_URL}/garansi/${doc.id}`;
      if (snNvr || snHdd) {
        const warNumber = `WAR/BE-CCTV/${nowParts().y}/${String(docNumber).split('/').pop() || '001'}`;
        const warPdf = generateBorneoDocumentPdf({
          type: 'warranty',
          docNumber: warNumber,
          dateStr: docDateStr,
          clientName: doc.to_client,
          clientPhone: doc.to_phone,
          clientAddress: doc.to_address,
          companyName: 'Borneo Etam CCTV & Komputer Kasir',
          items: itemsList,
          snNvr: snNvr || 'Tercatat di sistem',
          snHdd: snHdd || 'Tercatat di sistem',
          warrantyMonths: 12,
          warrantyUrl: publicWarrantyUrl,
        });

        const safeWarName = `Sertifikat_Garansi-${doc.to_client.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

        await sendDocument(
          chat_id,
          warPdf,
          safeWarName,
          `🛡️ <b>Sertifikat Garansi Digital Terbaru (12 Bulan)</b>\n` +
          `No. Registrasi: <code>${warNumber}</code>\n` +
          `Klien: <b>${esc(doc.to_client)}</b>\n` +
          (snNvr ? `SN NVR: <code>${esc(snNvr)}</code> ` : '') +
          (snHdd ? `| SN HDD: <code>${esc(snHdd)}</code>` : '') + `\n\n` +
          `🌐 <b>Link Verifikasi Live Konsumen:</b>\n${publicWarrantyUrl}`
        );
      }

      // 9. Kirim draf WhatsApp siap forward
      const waDraft = makeWhatsAppText(docType, docNumber, doc.to_client, tot, dp, publicWarrantyUrl, docCategory);
      return send(
        chat_id,
        `✅ <b>Dokumen Berhasil Diperbarui &amp; Tersimpan ke Database!</b>\n\n${waDraft}`,
        instId ? [[{ text: '🌐 Buka Garansi Digital Live', url: publicWarrantyUrl }]] : undefined
      );
    }

    // ---------------------------------------------------- DEAL PROYEK (OTOMATIS PROYEK & PETA)
    case 'deal_project': {
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru|ini|itu|nya)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }

      if (!t || isGeneric) {
        return send(chat_id, 'Proyek / penawaran atas nama siapa yang sudah deal bro? Contoh: <i>proyek Pak Yusuf deal</i>');
      }

      // 1. Cari Penawaran (Quote)
      let match = await findQuoteOrInvoice(t, 'quote');
      let quote: any = match?.doc;
      let invoice: any = null;

      // 2. Jika tidak ada quote, cari Faktur (Invoice)
      if (!quote) {
        match = await findQuoteOrInvoice(t, 'invoice');
        if (match?.doc) {
          invoice = match.doc;
        }
      }

      // 3. Cari entri cctv_installations yang sudah ada
      let inst = await findInstallation(t);

      if (!quote && !invoice && !inst) {
        return send(
          chat_id,
          `Data penawaran atau proyek untuk "${esc(t)}" tidak ditemukan bro. Mau langsung buat proyek baru? Ketik misal:\n• <i>buat proyek ${esc(t)} [alamat]</i>`
        );
      }

      const clientName = quote?.to_client || invoice?.to_client || inst?.client_name || t;
      const clientAddress = quote?.to_address || invoice?.to_address || inst?.address_landmark || 'Samarinda, Kalimantan Timur';
      const clientPhone = quote?.to_phone || invoice?.to_phone || inst?.client_phone || '';
      const projName = `Proyek ${clientName}`;

      if (quote) {
        await db.from('quotes').update({ status: 'Diterima' }).eq('id', quote.id);
      }

      // Tautkan secara atomik Klien, Proyek, Penawaran, Faktur, HPP & Milestone Tugas
      const syncResult = await ensureProjectAndLinks(
        clientName,
        clientPhone,
        clientAddress,
        quote?.id,
        invoice?.id,
        25
      );

      const projectId = syncResult?.projectId || inst?.project_id || null;
      const tot = syncResult?.revenue || (quote ? (quote.quote_items ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(quote.discount_amount || 0) : 0);
      const profitVal = syncResult?.profit || 0;

      // Geocode & Masukkan ke Peta Command Center (cctv_installations)
      if (!inst) {
        const geo = await geocode(clientAddress, 'Samarinda');
        const lat = geo ? geo.lat : -0.502106;
        const lng = geo ? geo.lng : 117.153709;

        const { data: newInst } = await db.from('cctv_installations').insert({
          user_id: OWNER_ID,
          quote_id: quote?.id || null,
          project_id: projectId,
          client_id: syncResult?.clientId || quote?.client_id || invoice?.client_id || null,
          project_name: projName,
          public_display_name: `Instalasi CCTV - ${clientName}`,
          client_name: clientName,
          client_phone: clientPhone,
          address_landmark: clientAddress,
          service_type: 'CCTV',
          city: 'Samarinda',
          latitude: lat,
          longitude: lng,
          progress: 25,
          is_public_portfolio: true,
          notes: quote ? `Dari penawaran ${quote.quote_number}` : 'Proyek disepakati (Deal)',
          photos: [],
        }).select('*').single();
        inst = newInst;
      } else {
        await db.from('cctv_installations').update({
          progress: Math.max(inst.progress || 0, 25),
          project_id: projectId || inst.project_id,
          client_id: syncResult?.clientId || inst.client_id,
        }).eq('id', inst.id);
        inst.progress = Math.max(inst.progress || 0, 25);
        inst.project_id = projectId || inst.project_id;
      }

      await setChatContext(chat_id, {
        client_name: clientName,
        doc_id: inst?.id || quote?.id || invoice?.id,
        doc_type: 'project',
      });

      const publicWarrantyUrl = inst?.id ? `${APP_URL}/garansi/${inst.id}` : undefined;

      const buttons: any[] = [];
      const row1: any[] = [];
      if (publicWarrantyUrl) row1.push({ text: '🌐 Garansi Live', url: publicWarrantyUrl });
      row1.push({ text: '🗺️ Peta Command', url: `${APP_URL}/peta` });
      if (projectId) row1.push({ text: '📈 Detail & Laba', url: `${APP_URL}/project/${projectId}` });
      buttons.push(row1);

      const row2: any[] = [];
      if (inst?.id) row2.push({ text: '📸 Tambah Foto', data: `add_photo:${inst.id}` });
      if (quote?.id) row2.push({ text: '📦 Surat Jalan', data: `sj:${quote.id}` });
      else if (invoice?.id) row2.push({ text: '📦 Surat Jalan', data: `sj:${invoice.id}` });
      buttons.push(row2);

      const row3: any[] = [];
      if (invoice?.id) {
        row3.push({ text: '🧾 Faktur Tagihan', data: `pdf:${invoice.id}` });
        if (invoice.status !== 'Lunas') row3.push({ text: '💰 Tandai Lunas', data: `pay_lunas:${invoice.id}` });
      } else if (quote?.id) {
        row3.push({ text: '📄 Cetak Penawaran', data: `pdf:${quote.id}` });
        row3.push({ text: '📜 Cetak BAST', data: `bast:${quote.id}` });
      }
      if (row3.length > 0) buttons.push(row3);

      return send(
        chat_id,
        `🎉 <b>ALHAMDULILLAH DEAL BRO! Proyek Resmi Masuk Antrean Lapangan!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `• Klien / Proyek : <b>${esc(clientName)}</b>\n` +
        `• Lokasi         : <i>${esc(clientAddress)}</i>\n` +
        (tot > 0 ? `• Nilai Proyek   : <b>${rp(tot)}</b>\n` : '') +
        (profitVal > 0 ? `• Estimasi Laba  : <b>${rp(profitVal)}</b>\n` : '') +
        `• Status Pengerjaan : <b>📅 Antrean Lapangan (Progres 25%)</b>\n` +
        `  <code>[██░░░░░░░░] 25%</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Konteks percakapan bot sekarang TERKUNCI ke proyek ${esc(clientName)}. Silakan kirim foto dokumentasi atau update progres kapan saja!</i>`,
        buttons
      );
    }

    // ---------------------------------------------------- BUAT / TAMBAH PROYEK BARU (ADD PROJECT)
    case 'add_project': {
      let clientName = (r.client_name || r.target_text || '').trim();
      if (!clientName) {
        return send(chat_id, 'Proyek atas nama siapa bro? Contoh:\n• <i>buat proyek Pak Yusuf jl pramuka 4 titik</i>\n• <i>tambah proyek Toko Berkah jln antasari</i>');
      }

      let clientAddr = r.client_address || '';
      if (!clientAddr && text) {
        const addrMatch = text.match(/(?:alamat|lokasi|di|jl|jalan)\s*[:=]?\s*([^\n\r,]+)/i);
        if (addrMatch) clientAddr = addrMatch[1].trim();
      }
      if (!clientAddr) clientAddr = 'Samarinda, Kalimantan Timur';

      const clientPhone = r.client_phone || '';
      const initialProgress = r.progress_percent ?? 20;

      // 1. Tautkan atau buat Klien, Proyek, dan cari Penawaran/Faktur terkait
      const syncResult = await ensureProjectAndLinks(
        clientName,
        clientPhone,
        clientAddr,
        undefined,
        undefined,
        initialProgress
      );

      const projectId = syncResult?.projectId || null;
      const projName = `Proyek ${clientName}`;

      const geo = await geocode(clientAddr, 'Samarinda');
      const lat = geo ? geo.lat : -0.502106;
      const lng = geo ? geo.lng : 117.153709;

      // 2. Insert atau Update cctv_installations
      let inst = await findInstallation(clientName);
      if (!inst) {
        const { data: newInst, error: instErr } = await db.from('cctv_installations').insert({
          user_id: OWNER_ID,
          project_id: projectId,
          client_id: syncResult?.clientId || null,
          project_name: projName,
          public_display_name: `Instalasi CCTV - ${clientName}`,
          client_name: clientName,
          client_phone: clientPhone,
          address_landmark: clientAddr,
          service_type: 'CCTV',
          city: 'Samarinda',
          latitude: lat,
          longitude: lng,
          progress: initialProgress,
          is_public_portfolio: true,
          notes: r.notes || 'Dibuat via Telegram AI Command Center',
          photos: [],
        }).select('*').single();

        if (instErr || !newInst) {
          throw new Error('Gagal menyimpan proyek: ' + (instErr?.message || ''));
        }
        inst = newInst;
      } else {
        await db.from('cctv_installations').update({
          project_id: projectId || inst.project_id,
          client_id: syncResult?.clientId || inst.client_id,
          progress: Math.max(inst.progress || 0, initialProgress),
        }).eq('id', inst.id);
        inst.project_id = projectId || inst.project_id;
      }

      await displayProjectCard(chat_id, inst);
      return;
    }

    // ---------------------------------------------------- EDIT PROYEK & UPDATE PROGRESS
    case 'update_progress':
    case 'edit_project': {
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru|ini|itu|nya)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }

      const inst: any = await findInstallation(t);
      if (!inst) {
        return send(chat_id, `Data proyek untuk "${esc(t || 'klien')}" tidak ditemukan bro. Pastikan nama kliennya sesuai ya.`);
      }

      const updates: any = { updated_at: new Date().toISOString() };
      let changedLog: string[] = [];

      if (r.progress_percent != null) {
        const p = Math.min(100, Math.max(0, Number(r.progress_percent)));
        updates.progress = p;
        changedLog.push(`• Progres pengerjaan : <b>${p}%</b>`);
        if (p === 100 && !inst.installed_at) {
          updates.installed_at = nowParts().iso;
          changedLog.push(`• Status : <b>✅ Pemasangan Selesai 100% (Garansi Resmi Mulai Aktif)</b>`);
        }
      }

      if (r.client_address && r.client_address !== inst.address_landmark) {
        updates.address_landmark = r.client_address;
        const geo = await geocode(r.client_address, 'Samarinda');
        if (geo) {
          updates.latitude = geo.lat;
          updates.longitude = geo.lng;
        }
        changedLog.push(`• Alamat lokasi : <i>${esc(r.client_address)}</i>`);
      }

      if (r.client_phone && r.client_phone !== inst.client_phone) {
        updates.client_phone = r.client_phone;
        changedLog.push(`• No. Kontak : <code>${esc(r.client_phone)}</code>`);
      }

      if (r.dvr_sn) {
        updates.sn_nvr = r.dvr_sn;
        changedLog.push(`• Serial Number NVR/DVR : <code>${esc(r.dvr_sn)}</code>`);
      }

      if (r.notes) {
        updates.notes = r.notes;
        changedLog.push(`• Catatan lapangan : <i>${esc(r.notes)}</i>`);
      }

      if (Object.keys(updates).length <= 1) {
        return displayProjectCard(chat_id, inst);
      }

      await db.from('cctv_installations').update(updates).eq('id', inst.id);
      const updatedInst = { ...inst, ...updates };

      await setChatContext(chat_id, {
        client_name: updatedInst.client_name,
        doc_id: updatedInst.id,
        doc_type: 'project',
      });

      await send(
        chat_id,
        `✅ <b>Data Proyek Berhasil Diperbarui!</b>\n` +
        `Klien: <b>${esc(updatedInst.project_name || updatedInst.client_name)}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        changedLog.join('\n') + '\n' +
        `━━━━━━━━━━━━━━━━━━━━━`
      );

      return displayProjectCard(chat_id, updatedInst);
    }

    // ---------------------------------------------------- HAPUS PROYEK (DELETE PROJECT)
    case 'delete_project': {
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru|ini|itu|nya)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }

      if (!t || isGeneric) {
        return send(chat_id, 'Proyek atas nama siapa yang mau dihapus bro? Contoh: <i>hapus proyek Pak Budi</i>');
      }

      const inst: any = await findInstallation(t);
      if (!inst) {
        return send(chat_id, `Proyek untuk "${esc(t)}" tidak ditemukan bro. Pastikan nama proyek atau klien sesuai.`);
      }

      // Hapus dari cctv_installations
      await db.from('cctv_installations').delete().eq('id', inst.id);

      // Hapus proyek terkait di tabel projects jika ada
      if (inst.project_id) {
        await db.from('projects').delete().eq('id', inst.project_id);
      }

      // Hapus context jika menunjuk ke proyek ini
      if (chatContext?.doc_id === inst.id) {
        await db.from('telegram_pending_actions').update({ status: 'cancelled' }).eq('chat_id', chat_id).eq('status', 'done');
      }

      return send(
        chat_id,
        `🗑️ <b>Proyek Berhasil Dihapus!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `• Klien / Proyek : <b>${esc(inst.project_name || inst.client_name)}</b>\n` +
        `• Lokasi         : <i>${esc(inst.address_landmark || 'Samarinda')}</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Data proyek dan pin di peta interaktif Command Center telah resmi dihapus dari sistem aplikasi.</i>`
      );
    }

    // ---------------------------------------------------- HAPUS / BATALKAN DOKUMEN (DELETE DOCUMENT)
    case 'delete_document': {
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru|ini|itu|nya)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }

      if (!t || isGeneric) {
        return send(chat_id, 'Dokumen (faktur/penawaran) atas nama siapa yang mau dihapus bro? Contoh: <i>hapus faktur Pak Yusril</i>');
      }

      const docTypePref = r.target_doc_type || 'auto';
      const match = await findQuoteOrInvoice(t, docTypePref);
      if (!match) {
        return send(chat_id, `Dokumen untuk "${esc(t)}" tidak ditemukan bro. Pastikan nama klien atau nomor dokumen sesuai.`);
      }

      const doc = match.doc;
      const isInv = match.docType === 'invoice';

      if (isInv) {
        await db.from('invoice_items').delete().eq('invoice_id', doc.id);
        await db.from('invoices').delete().eq('id', doc.id);
      } else {
        await db.from('quote_items').delete().eq('quote_id', doc.id);
        await db.from('quotes').delete().eq('id', doc.id);
      }

      return send(
        chat_id,
        `🗑️ <b>Dokumen Berhasil Dibatalkan &amp; Dihapus!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `• Jenis Dokumen  : <b>${isInv ? 'Faktur Tagihan Resmi' : 'Surat Penawaran Resmi'}</b>\n` +
        `• Nomor Dokumen  : <code>${esc(doc.invoice_number || doc.quote_number)}</code>\n` +
        `• Klien          : <b>${esc(doc.to_client)}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Dokumen beserta rincian itemnya telah resmi dihapus permanen dari database.</i>`
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
          .eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(30);

        let bestProj: any = null;
        let bestScore = 0;
        const clean = cleanSearchName(t);
        const rawSkel = getConsonantSkeleton(t);

        for (const p of pList || []) {
          const pName = (p.name || '').toLowerCase();
          let score = 0;
          if (pName.includes(t.toLowerCase())) score = 95;
          else {
            const pClean = cleanSearchName(pName);
            if (clean && (pClean.includes(clean) || clean.includes(pClean))) score = 90;
            else {
              const pSkel = getConsonantSkeleton(pName);
              if (rawSkel && (pSkel.includes(rawSkel) || rawSkel.includes(pSkel))) score = 80;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestProj = p;
          }
        }

        if (bestProj && bestScore >= 70) {
          projectId = bestProj.id;
          projName = bestProj.name;
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
      const inst: any = await findInstallation(t);

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

      // 7. Generate & Kirim Sertifikat Garansi Digital PDF
      const warNumber = `WAR/BE-CCTV/${nowParts().y}/${String(quote?.quote_number || invNumber).split('/').pop()}`;
      const warrantyPdfBytes = generateBorneoDocumentPdf({
        type: 'warranty',
        docNumber: warNumber,
        dateStr: tglPasang,
        clientName: inst.client_name,
        clientPhone: inst.client_phone,
        clientAddress: inst.address_landmark,
        companyName: 'Borneo Etam CCTV & Komputer Kasir',
        items,
        snNvr,
        snHdd,
        warrantyMonths: inst.warranty_months || 12,
      });

      const safeWarName = `Sertifikat_Garansi-${inst.client_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const publicWarrantyUrl = `${APP_URL}/garansi/${inst.id}`;

      await sendDocument(
        chat_id,
        warrantyPdfBytes,
        safeWarName,
        `🛡️ <b>Sertifikat Garansi Digital Resmi (12 Bulan): <code>${warNumber}</code></b>\n` +
        `Klien: <b>${esc(inst.client_name)}</b>\n` +
        `SN NVR: <code>${esc(snNvr)}</code> | SN HDD: <code>${esc(snHdd)}</code>\n` +
        `Masa Garansi: <b>12 Bulan Penuh (Mulai ${formatDateIndo(tglPasang)})</b>\n\n` +
        `🌐 <b>Link Verifikasi Live Konsumen:</b>\n${publicWarrantyUrl}`
      );

      // 8. Kirim Kartu Rekap Finansial & Teks WA
      const waText = makeWhatsAppText('invoice', invNumber, inst.client_name, omset, 0, publicWarrantyUrl);

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
          [
            { text: '🛡️ Buka Garansi Digital Live', url: publicWarrantyUrl },
            { text: '📜 Cetak BAST Resmi', data: `bast:${quote?.id || inst.id}` },
          ],
        ]
      );
    }

    // ---------------------------------------------------- CETAK SURAT JALAN
    case 'get_surat_jalan': {
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }
      const match = await findQuoteOrInvoice(t, 'auto');
      const doc = match?.doc;
      if (!doc) return send(chat_id, `Data penawaran/faktur untuk "${esc(t || 'klien')}" tidak ditemukan bro. Pastikan nama kliennya sesuai ya (contoh: <i>surat jalan Pak Sahabuddin</i>).`);

      const isInv = match.docType === 'invoice';
      const items = (isInv ? doc.invoice_items : doc.quote_items) || [];
      const docNum = isInv ? doc.invoice_number : doc.quote_number;

      const sjNumber = `SJ/BE-CCTV/${nowParts().y}/${String(docNum).split('/').pop() || '001'}`;
      const pdfBytes = generateBorneoDocumentPdf({
        type: 'surat_jalan',
        docNumber: sjNumber,
        dateStr: nowParts().iso,
        clientName: doc.to_client,
        clientPhone: doc.to_phone,
        clientAddress: doc.to_address,
        companyName: 'Borneo Etam CCTV & Komputer Kasir',
        items,
      });

      const safeName = `Surat_Jalan-${doc.to_client.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      await setChatContext(chat_id, { client_name: doc.to_client, doc_id: doc.id, doc_type: match.docType });
      return sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `📦 <b>Surat Jalan Pengeluaran Barang Resmi</b>\nNo: <code>${sjNumber}</code>\nKlien: <b>${esc(doc.to_client)}</b>\n\n<i>Daftar perangkat & material tanpa harga, siap dibawa teknisi ke lokasi!</i>`,
        buildDocActionButtons(doc.id, doc.to_client, undefined, 'surat_jalan')
      );
    }

    // ---------------------------------------------------- CETAK BAST (BERITA ACARA SERAH TERIMA)
    case 'get_bast': {
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }
      const match = await findQuoteOrInvoice(t, 'auto');
      const doc = match?.doc;
      if (!doc) return send(chat_id, `Data proyek/dokumen untuk "${esc(t || 'klien')}" tidak ditemukan bro. Pastikan penawaran/faktur klien sudah dibuat ya (contoh: <i>cetak BAST Pak Sahabuddin</i>).`);

      const isInv = match.docType === 'invoice';
      const items = (isInv ? doc.invoice_items : doc.quote_items) || [];
      const docNum = isInv ? doc.invoice_number : doc.quote_number;

      // Ambil SN dari cctv_installations jika ada
      const { data: inst } = await db.from('cctv_installations')
        .select('sn_nvr, sn_hdd')
        .or(`client_name.ilike.%${doc.to_client}%,quote_id.eq.${doc.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const bastNumber = `BAST/BE-CCTV/${nowParts().y}/${String(docNum).split('/').pop() || '001'}`;
      const pdfBytes = generateBorneoDocumentPdf({
        type: 'bast',
        docNumber: bastNumber,
        dateStr: nowParts().iso,
        clientName: doc.to_client,
        clientPhone: doc.to_phone,
        clientAddress: doc.to_address,
        companyName: 'Borneo Etam CCTV & Komputer Kasir',
        items,
        snNvr: inst?.sn_nvr || r.sn_nvr || 'Tercatat di sistem',
        snHdd: inst?.sn_hdd || r.sn_hdd || 'Tercatat di sistem',
      });

      const safeName = `BAST-${doc.to_client.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      await setChatContext(chat_id, { client_name: doc.to_client, doc_id: doc.id, doc_type: match.docType });
      return sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `📜 <b>Berita Acara Serah Terima (BAST) Resmi</b>\nNo: <code>${bastNumber}</code>\nKlien: <b>${esc(doc.to_client)}</b>\n\n<i>Lengkap dengan pernyataan serah terima, nomor seri unit, dan stempel resmi!</i>`,
        buildDocActionButtons(doc.id, doc.to_client, undefined, 'bast')
      );
    }

    // ---------------------------------------------------- KARTU GARANSI DIGITAL
    case 'get_warranty': {
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }

      let inst: any = t && !isGeneric ? await findInstallation(t) : null;
      let docObj: any = inst?.quotes;
      let docType: 'invoice' | 'quote' = 'quote';

      if (!inst && t) {
        const match = await findQuoteOrInvoice(t, 'auto');
        if (match) {
          docObj = match.doc;
          docType = match.docType;
          const cName = docObj.to_client;
          const { data: instData } = await db.from('cctv_installations')
            .select('*')
            .eq('user_id', OWNER_ID)
            .or(`client_name.ilike.%${cName}%,quote_id.eq.${docObj.id}`)
            .order('created_at', { ascending: false })
            .limit(1);
          inst = instData?.[0] || null;
        }
      }

      if (!inst && !docObj) {
        return send(
          chat_id,
          `Data proyek/garansi untuk "${esc(t || 'klien')}" tidak ditemukan bro. Pastikan penawaran/faktur klien sudah dibuat ya (contoh: <i>cetak garansi Pak Sahabuddin</i>).`
        );
      }

      const clientName = inst?.client_name || docObj?.to_client || 'Pelanggan';
      const clientPhone = inst?.client_phone || docObj?.to_phone || '';
      const clientAddress = inst?.address_landmark || docObj?.to_address || 'Samarinda, Kalimantan Timur';
      let items = (docType === 'invoice' ? docObj?.invoice_items : docObj?.quote_items) || inst?.quotes?.quote_items || [];

      // Fallback: pastikan item terisi dari invoice/quote terbaru jika belum ter-join
      if ((!items || items.length === 0) && clientName) {
        const { data: invData } = await db.from('invoices')
          .select('*, invoice_items(*)')
          .ilike('to_client', `%${clientName}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (invData?.invoice_items && invData.invoice_items.length > 0) {
          items = invData.invoice_items;
        } else {
          const { data: qData } = await db.from('quotes')
            .select('*, quote_items(*)')
            .ilike('to_client', `%${clientName}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (qData?.quote_items && qData.quote_items.length > 0) {
            items = qData.quote_items;
          }
        }
      }

      const tglPasang = inst?.installed_at ? String(inst.installed_at).slice(0, 10) : (docObj?.invoice_date || docObj?.created_at?.slice(0, 10) || nowParts().iso);
      const snNvr = inst?.sn_nvr || r.sn_nvr || docObj?.sn_nvr || 'Tercatat di sistem distributor';
      const snHdd = inst?.sn_hdd || r.sn_hdd || docObj?.sn_hdd || 'Tercatat di sistem distributor';
      
      const docNum = docObj ? (docType === 'invoice' ? docObj.invoice_number : docObj.quote_number) : (inst?.quotes?.quote_number || '001');
      const numCode = String(docNum).split('/').pop() || '001';
      const warNumber = `WAR/BE-CCTV/${nowParts().y}/${numCode}`;

      // Auto-insert cctv_installations if missing so live web link works
      if (!inst) {
        const { data: newInst } = await db.from('cctv_installations').insert({
          user_id: OWNER_ID,
          client_name: clientName,
          client_phone: clientPhone,
          address_landmark: clientAddress,
          project_name: `Instalasi CCTV - ${clientName}`,
          public_display_name: `Instalasi CCTV - ${clientName}`,
          service_type: 'CCTV',
          city: 'Samarinda',
          latitude: -0.502106,
          longitude: 117.153709,
          progress: 100,
          installed_at: tglPasang,
          sn_nvr: snNvr !== 'Tercatat di sistem distributor' ? snNvr : null,
          sn_hdd: snHdd !== 'Tercatat di sistem distributor' ? snHdd : null,
          warranty_months: 12,
        }).select('*').single();
        inst = newInst;
      }

      const instId = inst?.id || docObj?.id;
      const publicWarrantyUrl = `${APP_URL}/garansi/${instId}`;

      const pdfBytes = generateBorneoDocumentPdf({
        type: 'warranty',
        docNumber: warNumber,
        dateStr: tglPasang,
        clientName,
        clientPhone,
        clientAddress,
        companyName: 'Borneo Etam CCTV & Komputer Kasir',
        items,
        snNvr,
        snHdd,
        warrantyMonths: inst?.warranty_months || 12,
        warrantyUrl: publicWarrantyUrl,
      });

      const safeName = `Sertifikat_Garansi-${clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      await sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `🛡️ <b>Sertifikat Garansi Digital Resmi (12 Bulan)</b>\n` +
        `No. Registrasi: <code>${warNumber}</code>\n` +
        `Klien: <b>${esc(clientName)}</b>\n` +
        `SN NVR: <code>${esc(snNvr)}</code> | SN HDD: <code>${esc(snHdd)}</code>\n` +
        `Mulai Garansi: <b>${formatDateIndo(tglPasang)}</b>\n\n` +
        `🌐 <b>Link Verifikasi Live Konsumen:</b>\n${publicWarrantyUrl}`,
        buildDocActionButtons(docObj?.id || instId, clientName, publicWarrantyUrl, 'warranty')
      );

      await setChatContext(chat_id, { client_name: clientName, doc_id: instId, doc_type: 'warranty' });

      const waMsg = makeWhatsAppText('warranty', warNumber, clientName, 0, 0, publicWarrantyUrl);

      return send(
        chat_id,
        `${waMsg}`,
        buildDocActionButtons(docObj?.id || instId, clientName, publicWarrantyUrl, 'warranty')
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

    // ---------------------------------------------------- CATAT PEMBAYARAN / PELUNASAN (RECORD PAYMENT)
    case 'record_payment': {
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }
      if (!t || isGeneric) {
        return send(
          chat_id,
          'Faktur tagihan atas nama siapa yang mau dibuat lunas bro? Contoh:\n• <i>buat lunas Pak Sahabuddin</i>\n• <i>Pak Yusuf lunas</i>\n• atau sebutkan nomor fakturnya.'
        );
      }

      // Auto-revert accidental BST invoice if user is fixing Pak Saha
      if (/saha|sahabuddin|suhabuddin/i.test(t)) {
        const { data: bstInv } = await db.from('invoices')
          .select('id, invoice_number, status, down_payment_amount')
          .eq('user_id', OWNER_ID)
          .ilike('to_client', '%BST%')
          .eq('status', 'Lunas')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (bstInv) {
          await db.from('invoices').update({
            down_payment_amount: 0,
            status: 'Terkirim',
          }).eq('id', bstInv.id);
          console.log('Auto-reverted accidental BST invoice back to unpaid Terkirim');
        }
      }

      const match = await findQuoteOrInvoice(t, 'invoice');
      if (!match) {
        return send(
          chat_id,
          `Dokumen tagihan untuk "${esc(t)}" tidak ditemukan bro. Pastikan nama klien atau nomor dokumennya sesuai ya.`
        );
      }

      let inv: any = null;
      if (match.docType === 'invoice') {
        inv = match.doc;
      } else {
        // Auto convert Quote to Invoice if client only has a quote
        const quote = match.doc;
        const number = await nextInvoiceNumber();
        const items = quote.quote_items || [];
        const rawTotal = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
        const tot = Math.max(0, rawTotal - Number(quote.discount_amount || 0));
        const isLunasInitial = r.is_paid_off || /lunas|selesai|full|lunasin/i.test(text);

        const { data: newInv, error: invErr } = await db.from('invoices').insert({
          user_id: OWNER_ID,
          invoice_number: number,
          client_id: quote.client_id,
          to_client: quote.to_client,
          to_address: quote.to_address,
          to_phone: quote.to_phone,
          title: `Faktur Pelunasan - ${quote.to_client}`,
          discount_amount: quote.discount_amount || 0,
          down_payment_amount: isLunasInitial ? tot : (r.payment_amount || 0),
          status: isLunasInitial ? 'Lunas' : 'Sebagian',
          invoice_date: nowParts().iso,
          due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
        }).select('*').single();

        if (invErr || !newInv) throw new Error('Gagal mengonversi penawaran ke faktur: ' + (invErr?.message || ''));

        const rows = items.map((i: any) => ({
          invoice_id: newInv.id,
          description: i.description,
          quantity: i.quantity,
          unit: i.unit || 'Unit',
          unit_price: i.unit_price,
          cost_price: i.cost_price || 0,
        }));
        if (rows.length > 0) {
          await db.from('invoice_items').insert(rows);
        }
        inv = { ...newInv, invoice_items: items };
      }

      const items = inv.invoice_items || [];
      const totalAmount = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(inv.discount_amount || 0);
      const isLunas = r.is_paid_off || /lunas|selesai|full|lunasin/i.test(text);

      let payAmount = Number(r.payment_amount || 0);
      const prevDp = Number(inv.down_payment_amount || 0);

      if (isLunas) {
        payAmount = Math.max(0, totalAmount - prevDp);
      } else if (!payAmount && r.down_payment_amount) {
        payAmount = Number(r.down_payment_amount);
      }

      const newDp = isLunas ? totalAmount : Math.min(totalAmount, prevDp + payAmount);
      const newStatus = newDp >= totalAmount || isLunas ? 'Lunas' : 'Sebagian';

      await db.from('invoices').update({
        down_payment_amount: newDp,
        status: newStatus,
      }).eq('id', inv.id);

      await setChatContext(chat_id, { client_name: inv.to_client, doc_id: inv.id, doc_type: 'invoice' });

      const sisa = Math.max(0, totalAmount - newDp);

      const waReceipt =
        `*BUKTI PEMBAYARAN RESMI*\n` +
        `*Borneo Etam CCTV & Komputer Kasir*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Pelanggan: *${inv.to_client}*\n` +
        `No. Faktur: *${inv.invoice_number}*\n` +
        `Tanggal: *${formatDateIndo(nowParts().iso)}*\n` +
        `Pembayaran Diterima: *${rp(payAmount || (isLunas ? totalAmount : newDp))}*\n` +
        `Total Tagihan: *${rp(totalAmount)}*\n` +
        `Status: *${newStatus === 'Lunas' ? 'LUNAS (LUNAS PENUH)' : `SEBAGIAN (Sisa ${rp(sisa)})`}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Terima kasih banyak atas kepercayaannya! 🙏`;

      // Cari link kartu garansi live / instalasi proyek terkait klien ini (jika ada)
      let publicWarrantyUrl: string | undefined = undefined;
      const cleanName = cleanSearchName(inv.to_client) || inv.to_client;
      const { data: instData } = await db.from('cctv_installations')
        .select('id, progress')
        .eq('user_id', OWNER_ID)
        .or(`client_name.ilike.%${cleanName}%,project_name.ilike.%${cleanName}%,client_name.ilike.%${inv.to_client}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (instData?.id) {
        publicWarrantyUrl = `${APP_URL}/garansi/${instData.id}`;
        if (newStatus === 'Lunas' && (instData.progress ?? 0) < 100) {
          await db.from('cctv_installations').update({
            progress: 100,
            installed_at: nowParts().iso,
          }).eq('id', instData.id);
        }
      }

      return send(
        chat_id,
        `💰 <b>Pembayaran Berhasil Dicatat &amp; Disimpan!</b>\n\n` +
        `• Klien: <b>${esc(inv.to_client)}</b>\n` +
        `• No. Faktur: <code>${esc(inv.invoice_number)}</code>\n` +
        `• Nominal Masuk: <b>${rp(payAmount || totalAmount)}</b>\n` +
        `• Total Nilai Tagihan: <b>${rp(totalAmount)}</b>\n` +
        `• Total Sudah Dibayar: <b>${rp(newDp)}</b>\n` +
        `• Status Faktur: <b>${newStatus === 'Lunas' ? '✅ LUNAS PENUH' : `⏳ DIBAYAR SEBAGIAN (Sisa: ${rp(sisa)})`}</b>\n\n` +
        `<i>Data di database aplikasi sudah otomatis terupdate menjadi status <b>${newStatus}</b>.</i>\n\n` +
        `📲 <b>Teks Tanda Terima (Siap kirim ke WA Klien):</b>\n` +
        `<code>${esc(waReceipt)}</code>`,
        buildDocActionButtons(inv.id, inv.to_client, publicWarrantyUrl, 'invoice')
      );
    }

    // ---------------------------------------------------- REKAP PIUTANG / TAGIHAN BELUM LUNAS
    case 'unpaid_invoices': {
      const { data: invList } = await db
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('user_id', OWNER_ID)
        .neq('status', 'Lunas')
        .order('created_at', { ascending: false });

      if (!invList || invList.length === 0) {
        return send(
          chat_id,
          `🎉 <b>Alhamdulillah, Luar Biasa Bro!</b>\nSemua faktur tagihan sudah <b>LUNAS</b>, tidak ada piutang tertunggak saat ini. Arus kas lancar jaya! 🚀`
        );
      }

      let grandTotalTagihan = 0;
      let grandTotalMasuk = 0;
      let grandTotalSisa = 0;

      const lines: string[] = [];

      invList.forEach((inv: any, idx: number) => {
        const items = inv.invoice_items || [];
        const tot = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(inv.discount_amount || 0);
        const dp = Number(inv.down_payment_amount || 0);
        const sisa = Math.max(0, tot - dp);

        grandTotalTagihan += tot;
        grandTotalMasuk += dp;
        grandTotalSisa += sisa;

        const dueInfo = inv.due_date ? ` (Tempo: ${inv.due_date.slice(0, 10)})` : '';
        lines.push(
          `<b>${idx + 1}. ${esc(inv.to_client)}</b> [<code>${esc(inv.invoice_number)}</code>]\n` +
          `   • Sisa Tagihan : <b>${rp(sisa)}</b> (dari total ${rp(tot)})\n` +
          `   • Masuk : ${rp(dp)} | Status: <i>${esc(inv.status || 'Belum Lunas')}</i>${dueInfo}`
        );
      });

      const topInv = invList[0];
      const topItems = topInv.invoice_items || [];
      const topTot = topItems.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(topInv.discount_amount || 0);
      const topSisa = Math.max(0, topTot - Number(topInv.down_payment_amount || 0));

      const waReminderDraft =
        `Halo ${topInv.to_client}, salam hormat dari Borneo Etam CCTV & POS Samarinda 🙏\n\n` +
        `Kami ingin mengonfirmasikan kembali terkait sisa pelunasan Faktur No. *${topInv.invoice_number}* sebesar *${rp(topSisa)}*.\n\n` +
        `Pembayaran dapat ditransfer via:\n` +
        `*Bank BCA: 5135400278*\n` +
        `a.n *Muhammad Wahyu*\n\n` +
        `Terima kasih banyak atas kerjasamanya! 🙏`;

      return send(
        chat_id,
        `📊 <b>Daftar Rekap Piutang &amp; Tagihan Berjalan</b>\n` +
        `Borneo Etam CCTV &amp; Komputer Kasir\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        lines.join('\n\n') + '\n\n' +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• Total Nilai Tagihan : <b>${rp(grandTotalTagihan)}</b>\n` +
        `• Total Uang Muka Masuk : <b>${rp(grandTotalMasuk)}</b>\n` +
        `• 🔴 <b>Total Piutang Belum Tertagih : ${rp(grandTotalSisa)}</b>\n\n` +
        `📲 <b>Draf WA Penagihan Ramah (${esc(topInv.to_client)}):</b>\n` +
        `<code>${esc(waReminderDraft)}</code>`,
        [
          [
            { text: `💰 Lunasi ${topInv.to_client}`, data: `pay_lunas:${topInv.id}` },
            { text: `🧾 Faktur ${topInv.to_client}`, data: `pdf:${topInv.id}` }
          ]
        ]
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

      const isStore = r.doc_category === 'partner_service' || r.is_partner_store || (r.client_name || '').toLowerCase().includes('toko') || (r.client_name || '').toLowerCase().includes('cv');
      const docCategory: 'standard' | 'partner_service' = isStore ? 'partner_service' : 'standard';

      if (isStore) {
        items.forEach((it: any) => {
          const d = (it.description || '').toLowerCase();
          if (d.includes('bawaan toko') || d.includes('unit toko') || d.includes('disediakan toko')) {
            it.unit_price = 0;
            it.cost_price = 0;
          }
        });
      }

      const payload = {
        client_name: r.client_name,
        client_phone: r.client_phone || '',
        client_address: r.client_address || '',
        package_id: pkg?.id ?? null,
        package_name: pkg?.shortName ?? null,
        terms: isStore
          ? `[CATEGORY:partner_service]\n1. Penawaran ini khusus mencakup jasa instalasi teknis, konfigurasi, dan biaya akomodasi lapangan.\n2. Seluruh unit/material utama disediakan langsung oleh pihak Toko/Pemberi Kerja.\n3. Pembayaran jasa diselesaikan setelah serah terima pekerjaan (BAST).`
          : (pkg?.defaultTerms ?? ''),
        items,
        discount_amount: r.discount_amount || 0,
        total_cost_override: r.total_cost_override || null,
        proactive_note: r.proactive_note || '',
        doc_category: docCategory,
      };

      const id = await savePending(chat_id, 'quote', payload);
      return showPending(chat_id, id, 'quote', payload);
    }

    // ---------------------------------------------------- REVISI AKSI MENUNGGU (MODIFY PENDING)
    case 'modify_pending': {
      if (!pending || pending.kind !== 'quote') {
        if (pending && pending.kind === 'invoice') {
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
          p.total = Math.max(0, subtotal(p.items) - (p.discount_amount || 0));
          if (r.down_payment_percent != null) p.dp_amount = Math.round(p.total * r.down_payment_percent / 100);
          if (r.down_payment_amount != null) p.dp_amount = r.down_payment_amount;
          if (r.sn_nvr) p.sn_nvr = r.sn_nvr;
          if (r.sn_hdd) p.sn_hdd = r.sn_hdd;
          if (r.client_name) p.client_name = r.client_name;
          if (r.client_address) p.client_address = r.client_address;
          if (r.client_phone) p.client_phone = r.client_phone;
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
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }
      const wantInvoice = r.target_doc_type === 'invoice' || /faktur|inv|tagihan/i.test(text);
      const wantQuote = r.target_doc_type === 'quote' || /penawaran|quote|quo/i.test(text);
      const prefType = wantInvoice && !wantQuote ? 'invoice' : wantQuote && !wantInvoice ? 'quote' : 'auto';

      const match = await findQuoteOrInvoice(t, prefType);
      if (!match) {
        return send(
          chat_id,
          `Dokumen ${prefType === 'invoice' ? 'faktur' : 'penawaran'} untuk "${esc(t || 'terakhir')}" tidak ditemukan bro. Pastikan nama klien atau nomor dokumennya sesuai ya.`
        );
      }

      const { doc, docType } = match;
      const isInv = docType === 'invoice';
      const items = (isInv ? doc.invoice_items : doc.quote_items) || [];
      const docNum = isInv ? doc.invoice_number : doc.quote_number;

      const pdfBytes = generateBorneoDocumentPdf({
        type: docType,
        docNumber: docNum,
        dateStr: isInv
          ? (doc.invoice_date || doc.created_at?.slice(0, 10) || nowParts().iso)
          : (doc.created_at ? doc.created_at.slice(0, 10) : nowParts().iso),
        dueDateStr: isInv ? doc.due_date : undefined,
        clientName: doc.to_client,
        clientPhone: doc.to_phone || '',
        clientAddress: doc.to_address || '',
        companyName: doc.from_company || 'Borneo Etam CCTV & Komputer Kasir',
        companyPhone: '082251314646',
        companyWebsite: doc.from_website || 'Borneoetam.com',
        paymentInstructions: 'Bank BCA\n5135400278\na.n Muhammad Wahyu',
        terms: doc.terms,
        items,
        discountAmount: doc.discount_amount || 0,
        downPaymentAmount: doc.down_payment_amount || 0,
      });

      const prefixLabel = isInv ? 'Faktur' : 'Penawaran';
      const safeName = `${prefixLabel}-${(doc.to_client || 'Klien').replace(/[^a-zA-Z0-9]/g, '_')}-${docNum.replace(/\//g, '-')}.pdf`;
      const tot = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(doc.discount_amount || 0);

      await sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        isInv
          ? `🧾 <b>Faktur Tagihan Resmi: <code>${esc(docNum)}</code></b>\nKlien: <b>${esc(doc.to_client)}</b>\nTotal: <b>${rp(tot)}</b>${Number(doc.down_payment_amount) > 0 ? `\nDP: <b>${rp(doc.down_payment_amount)}</b>` : ''}`
          : `📄 <b>Surat Penawaran Resmi: <code>${esc(docNum)}</code></b>\nKlien: <b>${esc(doc.to_client)}</b>\nTotal: <b>${rp(tot)}</b>`
      );

      await setChatContext(chat_id, { client_name: doc.to_client, doc_id: doc.id, doc_type: docType });
      const waDraft = makeWhatsAppText(isInv ? 'invoice' : 'quote', docNum, doc.to_client, tot, doc.down_payment_amount);
      return send(chat_id, waDraft, buildDocActionButtons(doc.id, doc.to_client, undefined, isInv ? 'invoice' : 'quote'));
    }

    // ---------------------------------------------------- CETAK KWITANSI PEMBAYARAN RESMI (GET RECEIPT)
    case 'get_receipt': {
      let t = (r.target_text || r.client_name || '').trim();
      const isGeneric = !t || /^(terakhir|last|terbaru)$/i.test(t);
      if (isGeneric && chatContext?.client_name) {
        t = chatContext.client_name;
      }
      const match = await findQuoteOrInvoice(t, 'invoice');
      const inv: any = match?.doc;

      if (!inv) {
        return send(
          chat_id,
          `Faktur tagihan untuk kwitansi "${esc(t || 'terakhir')}" tidak ditemukan bro. Pastikan nama klien atau nomor fakturnya sesuai ya.`
        );
      }

      const items = inv.invoice_items || [];
      const rawTot = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0);
      const totalAmount = Math.max(0, rawTot - Number(inv.discount_amount || 0));
      const dp = Number(inv.down_payment_amount || 0);

      let payAmount = Number(r.payment_amount || 0);
      if (!payAmount) {
        if (inv.status === 'Lunas' || dp >= totalAmount) {
          payAmount = totalAmount;
        } else if (dp > 0) {
          payAmount = dp;
        } else {
          payAmount = totalAmount;
        }
      }

      const receiptNum = `KW/${inv.invoice_number || Date.now().toString().slice(-6)}`;
      const purpose = (r.target_text || text || '').toLowerCase().includes('dp')
        ? `Pembayaran Uang Muka (DP) Pengadaan & Instalasi CCTV / Komputer Kasir Faktur No. ${inv.invoice_number}`
        : `Pelunasan Pembayaran Pengadaan & Instalasi CCTV / Komputer Kasir Faktur No. ${inv.invoice_number}`;

      const pdfBytes = generateBorneoDocumentPdf({
        type: 'kwitansi',
        docNumber: inv.invoice_number,
        receiptNumber: receiptNum,
        dateStr: inv.invoice_date || inv.created_at?.slice(0, 10) || nowParts().iso,
        clientName: inv.to_client,
        clientPhone: inv.to_phone || '',
        clientAddress: inv.to_address || '',
        companyName: inv.from_company || 'Borneo Etam CCTV & Komputer Kasir',
        companyPhone: '082251314646',
        companyWebsite: inv.from_website || 'Borneoetam.com',
        paymentInstructions: 'Bank BCA\n5135400278\na.n Muhammad Wahyu',
        items,
        paymentAmount: payAmount,
        paymentFor: purpose,
        discountAmount: inv.discount_amount || 0,
        downPaymentAmount: dp,
        isPaid: true,
      });

      const safeName = `Kwitansi-${(inv.to_client || 'Klien').replace(/[^a-zA-Z0-9]/g, '_')}-${receiptNum.replace(/\//g, '-')}.pdf`;

      await sendDocument(
        chat_id,
        pdfBytes,
        safeName,
        `🧾 <b>Kwitansi Pembayaran Resmi: <code>${esc(receiptNum)}</code></b>\n` +
        `Klien: <b>${esc(inv.to_client)}</b>\n` +
        `Nominal: <b>${rp(payAmount)}</b>\n` +
        `<i># ${terbilang(payAmount)} Rupiah #</i>`
      );

      const waReceiptMsg =
        `*KWITANSI PEMBAYARAN RESMI*\n` +
        `*Borneo Etam CCTV & Komputer Kasir*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `No. Kwitansi : *${receiptNum}*\n` +
        `Sudah Terima Dari : *${inv.to_client}*\n` +
        `Jumlah Uang : *${rp(payAmount)}*\n` +
        `Terbilang : _# ${terbilang(payAmount)} Rupiah #_\n` +
        `Untuk Pembayaran : ${purpose}\n` +
        `Status : *LUNAS / SAH*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Dokumen PDF Kwitansi Resmi terlampir. Terima kasih atas kepercayaan Anda kepada Borneo Etam! 🙏`;

      await setChatContext(chat_id, { client_name: inv.to_client, doc_id: inv.id, doc_type: 'invoice' });
      return send(
        chat_id,
        `📲 <b>Teks Konfirmasi Kwitansi WhatsApp:</b>\n<code>${esc(waReceiptMsg)}</code>`,
        buildDocActionButtons(inv.id, inv.to_client, undefined, 'invoice')
      );
    }

    // ---------------------------------------------------- SHARE LOKASI GPS & PRE-DEPARTURE TEKNISI (SHARE LOCATION)
    case 'share_location': {
      const t = (r.target_text || r.client_name || r.project_name || '').trim();
      const inst: any = await findInstallation(t);

      if (!inst) {
        return send(
          chat_id,
          `Data proyek atau instalasi untuk "${esc(t || 'terakhir')}" tidak ditemukan di database bro.`
        );
      }

      const lat = Number(inst.latitude);
      const lng = Number(inst.longitude);
      const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

      if (hasCoords) {
        try {
          await tg('sendLocation', { chat_id, latitude: lat, longitude: lng });
        } catch (locErr) {
          console.error('Error sending native location:', locErr);
        }
      }

      const mapsUrl = hasCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((inst.address_landmark || inst.client_name) + ' Samarinda')}`;

      const clientName = inst.client_name || inst.project_name || 'Pelanggan';
      const address = inst.address_landmark || 'Samarinda, Kalimantan Timur';
      const phone = inst.client_phone || '-';

      const msg =
        `📍 <b>Lokasi Proyek Lapangan: ${esc(inst.project_name || clientName)}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Klien: <b>${esc(clientName)}</b>\n` +
        `📞 Kontak / WA: <code>${esc(phone)}</code>\n` +
        `🏢 Alamat / Landmark: <i>${esc(address)}</i>\n` +
        `📊 Progress Saat Ini: <b>${inst.progress || 0}%</b>\n\n` +
        `🗺️ <b>Navigasi Google Maps:</b>\n` +
        `<a href="${mapsUrl}">Buka Rute &amp; Navigasi Turn-by-Turn</a>\n\n` +
        `🛠️ <b>Pre-Departure Checklist Teknisi Borneo Etam:</b>\n` +
        `• 🪜 Tangga lipat, bor beton rotary + mata bor 6mm/8mm\n` +
        `• 🔌 Kabel UTP Cat6 / Coaxial, konektor RJ45 / BNC, klem &amp; steker\n` +
        `• 📹 Unit Kamera, NVR/DVR, Adaptor / Switch PoE &amp; HDD CCTV\n` +
        `• 📱 Pastikan modem internet klien / orbit sudah aktif jika setting online HP`;

      return send(
        chat_id,
        msg,
        [[{ text: '🗺️ Buka Rute Google Maps', url: mapsUrl }]]
      );
    }

    // ---------------------------------------------------- CEK STOK BARANG & SISA GUDANG (STOCK CHECK)
    case 'stock_check': {
      const kw = (r.item_description || r.target_text || '').trim();
      let query = db.from('items').select('id, description, unit, unit_price, cost_price, stock, track_stock').eq('user_id', OWNER_ID);

      if (kw) {
        query = query.ilike('description', `%${kw}%`);
      } else {
        query = query.order('stock', { ascending: true }).limit(15);
      }

      const { data: items, error } = await query;
      if (error || !items || items.length === 0) {
        return send(
          chat_id,
          kw
            ? `Barang dengan kata kunci "<b>${esc(kw)}</b>" tidak ditemukan di katalog stok bro.`
            : `Belum ada data barang di pustaka stok bro. Kamu bisa tambah dengan ketik: <i>masuk barang kabel cat6 2 roll</i>`
        );
      }

      const lines: string[] = [];
      let lowCount = 0;

      items.forEach((it: any, idx: number) => {
        const s = Number(it.stock ?? 0);
        let badge = '🟢';
        if (s <= 0) { badge = '🔴 HABIS (0)'; lowCount++; }
        else if (s <= 2) { badge = `🟡 MENIPIS (${s} ${it.unit || 'Unit'})`; lowCount++; }
        else { badge = `🟢 ${s} ${it.unit || 'Unit'}`; }

        lines.push(
          `<b>${idx + 1}. ${esc(it.description)}</b>\n` +
          `   • Stok: <b>${badge}</b> | Modal: ${rp(it.cost_price || 0)} | Jual: ${rp(it.unit_price || 0)}`
        );
      });

      const header = kw
        ? `📦 <b>Hasil Pencarian Stok: "${esc(kw)}"</b>`
        : `📦 <b>Daftar Stok Inventaris Borneo Etam</b>${lowCount > 0 ? ` (⚠️ ${lowCount} item perlu restock)` : ''}`;

      return send(
        chat_id,
        `${header}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        lines.join('\n\n') + '\n\n' +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 <i>Untuk update atau tambah stok masuk, ketik contoh:</i>\n` +
        `• <code>tambah stok HDD 1TB 5 unit</code>\n` +
        `• <code>masuk barang kabel cat6 2 roll modal 650rb</code>`
      );
    }

    // ---------------------------------------------------- UPDATE / TAMBAH STOK BARANG (UPDATE STOCK)
    case 'update_stock': {
      const desc = (r.item_description || r.target_text || '').trim();
      const qty = Number(r.stock_quantity ?? 0);
      const isAdd = r.stock_mode === 'add' || /tambah|masuk|beli|kulakan/i.test(text);

      if (!desc) {
        return send(
          chat_id,
          'Barang apa yang mau di-update stoknya bro? Contoh:\n• <i>tambah stok HDD 1TB 5 unit</i>\n• <i>masuk kabel cat6 2 roll modal 650rb</i>\n• <i>stok kamera colorvu jadi 10</i>'
        );
      }

      const { data: existingList } = await db.from('items')
        .select('*')
        .eq('user_id', OWNER_ID)
        .ilike('description', `%${desc}%`)
        .limit(1);

      const item = existingList?.[0];

      if (item) {
        const curStock = Number(item.stock || 0);
        const finalStock = isAdd ? curStock + (qty || 1) : (qty || 0);
        const updatePayload: any = {
          stock: finalStock,
          track_stock: true,
        };
        if (r.item_cost_price && Number(r.item_cost_price) > 0) {
          updatePayload.cost_price = Number(r.item_cost_price);
        }
        if (r.item_unit_price && Number(r.item_unit_price) > 0) {
          updatePayload.unit_price = Number(r.item_unit_price);
        }

        await db.from('items').update(updatePayload).eq('id', item.id);

        return send(
          chat_id,
          `📦 <b>Stok Barang Berhasil Diperbarui!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `• Item: <b>${esc(item.description)}</b>\n` +
          `• Stok Sebelumnya: <b>${curStock} ${item.unit || 'Unit'}</b>\n` +
          `• Perubahan: <b>${isAdd ? `+${qty || 1}` : `Set jadi ${qty}`}</b>\n` +
          `• <b>Stok Sekarang: ${finalStock} ${item.unit || 'Unit'}</b>\n` +
          (updatePayload.cost_price ? `• Harga Modal Baru: <b>${rp(updatePayload.cost_price)}</b>\n` : '') +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `<i>Data inventaris sudah langsung sinkron dengan Dashboard Command Center.</i>`
        );
      } else {
        const initialStock = qty || 1;
        const cost = Number(r.item_cost_price || 0);
        const price = Number(r.item_unit_price || (cost > 0 ? Math.round(cost * 1.3) : 0));
        const unit = r.item_unit || 'Unit';

        await db.from('items').insert({
          user_id: OWNER_ID,
          description: desc,
          unit,
          stock: initialStock,
          track_stock: true,
          cost_price: cost,
          unit_price: price,
        });

        return send(
          chat_id,
          `✨ <b>Barang Baru Berhasil Ditambahkan ke Master Stok!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `• Nama: <b>${esc(desc)}</b>\n` +
          `• Stok Awal: <b>${initialStock} ${unit}</b>\n` +
          `• Modal: <b>${rp(cost)}</b> | Jual: <b>${rp(price)}</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━`
        );
      }
    }

    // ---------------------------------------------------- TAGIHAN JATUH TEMPO & REMINDER WA (OVERDUE INVOICES)
    case 'overdue_invoices': {
      const t = (r.target_text || r.client_name || '').trim();
      let query = db.from('invoices').select('*, invoice_items(*)').eq('user_id', OWNER_ID).neq('status', 'Lunas');

      if (t) {
        query = query.or(`to_client.ilike.%${t}%,invoice_number.ilike.%${t}%`);
      }

      const { data: invList } = await query.order('due_date', { ascending: true });

      if (!invList || invList.length === 0) {
        return send(
          chat_id,
          `🎉 <b>Semua Tagihan Aman Bro!</b>\nTidak ada faktur yang mendekati jatuh tempo atau menunggak saat ini.`
        );
      }

      const now = Date.now();
      const threeDaysMs = 3 * 86400000;
      const overdueOrUpcoming = invList.filter((inv: any) => {
        if (!inv.due_date) return true;
        const dueTime = new Date(inv.due_date).getTime();
        return dueTime <= now + threeDaysMs;
      });

      const targets = overdueOrUpcoming.length > 0 ? overdueOrUpcoming : invList.slice(0, 5);

      const cards: string[] = [];
      const primaryInv = targets[0];

      targets.forEach((inv: any, idx: number) => {
        const items = inv.invoice_items || [];
        const tot = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(inv.discount_amount || 0);
        const dp = Number(inv.down_payment_amount || 0);
        const sisa = Math.max(0, tot - dp);

        let tempoText = 'Tidak ditentukan';
        let alertBadge = '⏳ Mendekati Tempo';

        if (inv.due_date) {
          const diffDays = Math.round((new Date(inv.due_date).getTime() - now) / 86400000);
          if (diffDays < 0) {
            alertBadge = `🔴 TELAT ${Math.abs(diffDays)} HARI`;
          } else if (diffDays === 0) {
            alertBadge = '⚠️ JATUH TEMPO HARI INI';
          } else {
            alertBadge = `⏳ ${diffDays} hari lagi`;
          }
          tempoText = inv.due_date.slice(0, 10);
        }

        cards.push(
          `<b>${idx + 1}. ${esc(inv.to_client)}</b> [<code>${esc(inv.invoice_number)}</code>]\n` +
          `   • Status: <b>${alertBadge}</b> (Tempo: ${tempoText})\n` +
          `   • Sisa Piutang: <b>${rp(sisa)}</b> (dari ${rp(tot)})\n` +
          `   • Kontak: <code>${esc(inv.to_phone || '-')}</code>`
        );
      });

      const primItems = primaryInv.invoice_items || [];
      const primTot = primItems.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0) - Number(primaryInv.discount_amount || 0);
      const primSisa = Math.max(0, primTot - Number(primaryInv.down_payment_amount || 0));

      const waReminder =
        `Halo ${primaryInv.to_client}, salam hangat dari Borneo Etam CCTV & POS Samarinda 🙏\n\n` +
        `Kami ingin mengonfirmasikan kembali terkait Faktur Tagihan No. *${primaryInv.invoice_number}* yang telah jatuh tempo pada tanggal *${primaryInv.due_date ? primaryInv.due_date.slice(0, 10) : 'saat ini'}*.\n\n` +
        `Rincian sisa pembayaran:\n` +
        `• Total Tagihan : *${rp(primTot)}*\n` +
        `• Sisa yang Belum Dibayarkan : *${rp(primSisa)}*\n\n` +
        `Pembayaran dapat ditransfer melalui:\n` +
        `*Bank BCA: 5135400278*\n` +
        `a.n *Muhammad Wahyu*\n\n` +
        `Jika sudah melakukan pembayaran, mohon kirimkan bukti transfernya ya. Terima kasih banyak atas kerjasamanya! 🙏`;

      return send(
        chat_id,
        `⚠️ <b>Monitoring Tagihan Jatuh Tempo &amp; Piutang Kritis</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        cards.join('\n\n') + '\n\n' +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📲 <b>Draft Pesan Tagih WhatsApp (${esc(primaryInv.to_client)}):</b>\n` +
        `<code>${esc(waReminder)}</code>`,
        [
          [
            { text: '💰 Tandai Sudah Lunas', data: `pay_lunas:${primaryInv.id}` },
            { text: '🧾 Lihat Faktur', data: `pdf:${primaryInv.id}` }
          ]
        ]
      );
    }

    // ---------------------------------------------------- TROUBLESHOOTING TEKNIS LAPANGAN CCTV & POS
    case 'tech_troubleshoot': {
      const topic = (r.target_text || text || '').trim();
      const aiReply = r.reply || '';

      return send(
        chat_id,
        `🛠️ <b>Solusi Teknis Lapangan - Borneo Etam</b>\n` +
        `Kendala: <i>${esc(topic)}</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${aiReply.includes('<') ? aiReply : esc(aiReply)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 <i>Ada kendala hardware, setting IP, atau barcode scanner lain di lokasi bro? Tanyakan saja langsung!</i>`
      );
    }

    case 'morning_briefing': {
      return handleMorningBriefing(chat_id);
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

async function nextInvoiceNumber(): Promise<string> {
  const { y, m } = nowParts();
  const prefix = `INV/BE-CCTV/${ROMAN[m - 1]}/${y}/`;
  const { data } = await db.from('invoices').select('invoice_number').eq('user_id', OWNER_ID).like('invoice_number', `${prefix}%`);
  const max = (data ?? []).reduce((mx: number, r: any) => Math.max(mx, parseInt(String(r.invoice_number).split('/').pop() || '0', 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

async function execQuote(chat_id: number, p: any): Promise<void> {
  const { data: profile } = await db.from('profiles').select('*').eq('id', OWNER_ID).maybeSingle();
  let clientId: string | null = null;
  const name = p.client_name.trim();
  const isStore = p.doc_category === 'partner_service' || name.toLowerCase().includes('toko') || name.toLowerCase().includes('cv');
  const docCategory: 'standard' | 'partner_service' = isStore ? 'partner_service' : 'standard';

  const { data: ex } = await db.from('clients').select('id').eq('user_id', OWNER_ID).ilike('name', name).limit(1).maybeSingle();
  if (ex?.id) clientId = ex.id;
  else {
    const { data: nc } = await db.from('clients').insert({
      user_id: OWNER_ID,
      name,
      address: p.client_address || '',
      phone: p.client_phone || '',
      notes: isStore ? 'Partner Toko / Subkon' : null,
    }).select('id').single();
    clientId = nc?.id ?? null;
  }
  const number = await nextQuoteNumber();
  const valid = new Date(Date.now() + 14 * 86400000).toISOString();
  const quoteTerms = isStore
    ? `[CATEGORY:partner_service]\n1. Penawaran ini khusus mencakup jasa instalasi teknis, konfigurasi, dan biaya akomodasi lapangan.\n2. Seluruh unit/material utama disediakan langsung oleh pihak Toko/Pemberi Kerja.\n3. Pembayaran jasa diselesaikan setelah serah terima pekerjaan (BAST).`
    : (p.terms || profile?.default_terms || '');

  const { data: quote, error } = await db.from('quotes').insert({
    user_id: OWNER_ID, quote_number: number, status: 'Draf', client_id: clientId,
    from_company: profile?.company_name || 'Borneo Etam', from_address: profile?.company_address || '', from_website: profile?.company_website || '',
    to_client: name, to_address: p.client_address || '', to_phone: p.client_phone || '',
    title: isStore ? `Penawaran Jasa & Subkon - ${name}` : `Penawaran ${p.package_name || 'Custom'} - ${name}`,
    discount_amount: p.discount_amount || 0, tax_amount: 0,
    terms: quoteTerms, attachments: [],
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
    docCategory,
    docNumber: number,
    dateStr: nowParts().iso,
    clientName: name,
    clientPhone: p.client_phone,
    clientAddress: p.client_address,
    companyName: profile?.company_name || 'Borneo Etam CCTV & Komputer Kasir',
    companyPhone: profile?.company_phone || '082251314646',
    companyWebsite: profile?.company_website || 'Borneoetam.com',
    paymentInstructions: profile?.payment_instructions || 'Bank BCA\n5135400278\na.n Muhammad Wahyu',
    terms: quoteTerms,
    items: p.items,
    discountAmount: p.discount_amount || 0,
  });

  const safeName = `Penawaran-${name.replace(/[^a-zA-Z0-9]/g, '_')}-${number.replace(/\//g, '-')}.pdf`;
  await sendDocument(
    chat_id,
    pdfBytes,
    safeName,
    `📄 <b>${isStore ? 'Surat Penawaran Jasa &amp; Subkon (Toko)' : 'Surat Penawaran Resmi'}: <code>${esc(number)}</code></b>\nKlien/Toko: <b>${esc(name)}</b>\nTotal: <b>${rp(tot)}</b>\nEstimasi Laba: <b>${rp(laba)}</b>`
  );

  const waDraft = makeWhatsAppText('quote', number, name, tot, 0, undefined, docCategory);
  await send(
    chat_id,
    `<b>✅ Penawaran Berhasil Dibuat &amp; Tersimpan!</b>\n\n${waDraft}\n\n<i>Kalau konsumen sudah konfirmasi deal, cukup balas: <b>"Deal bro, lanjut buat proyek"</b> atau klik tombol di bawah:</i>`,
    [
      [
        { text: '🤝 Konfirmasi Deal & Buat Proyek', data: `deal:${quote.id}` },
        { text: '📦 Cetak Surat Jalan', data: `sj:${quote.id}` },
      ],
      [
        { text: '📄 Unduh PDF Penawaran', data: `pdf:${quote.id}` },
      ],
    ]
  );
  await setChatContext(chat_id, { client_name: name, doc_id: quote.id, doc_type: 'quote' });
}

async function execInvoice(chat_id: number, p: any): Promise<void> {
  const { data: profile } = await db.from('profiles').select('*').eq('id', OWNER_ID).maybeSingle();
  let clientId: string | null = null;
  const name = p.client_name.trim();
  const isStore = p.doc_category === 'partner_service' || name.toLowerCase().includes('toko') || name.toLowerCase().includes('cv');
  const docCategory: 'standard' | 'partner_service' = isStore ? 'partner_service' : 'standard';

  const { data: ex } = await db.from('clients').select('id').eq('user_id', OWNER_ID).ilike('name', name).limit(1).maybeSingle();
  if (ex?.id) clientId = ex.id;
  else {
    const { data: nc } = await db.from('clients').insert({
      user_id: OWNER_ID,
      name,
      address: p.client_address || '',
      phone: p.client_phone || '',
      notes: isStore ? 'Partner Toko / Subkon' : null,
    }).select('id').single();
    clientId = nc?.id ?? null;
  }

  const number = await nextInvoiceNumber();
  const sub = subtotal(p.items);
  const discount = Number(p.discount_amount || 0);
  const tot = Math.max(0, sub - discount);
  const dp = Number(p.dp_amount || 0);
  let invoiceTerms = isStore
    ? `[CATEGORY:partner_service]\n1. Faktur ini khusus tagihan jasa instalasi teknis & akomodasi lapangan.\n2. Pembayaran ditransfer ke rekening resmi BCA 5135400278 a.n Muhammad Wahyu.\n3. Garansi instalasi kabel & kerapian 3 bulan sejak tanggal faktur.`
    : (p.terms || profile?.default_terms || '');

  if (p.notes) {
    invoiceTerms = invoiceTerms ? `${invoiceTerms}\n\nCatatan: ${p.notes}` : `Catatan: ${p.notes}`;
  }

  const { data: inv, error } = await db.from('invoices').insert({
    user_id: OWNER_ID,
    invoice_number: number,
    status: dp >= tot && tot > 0 ? 'Lunas' : (dp > 0 ? 'DP Diterima' : 'Draf'),
    client_id: clientId,
    project_id: p.project_id || null,
    quote_id: p.quote_id || null,
    from_company: profile?.company_name || 'Borneo Etam CCTV & Komputer Kasir',
    from_address: profile?.company_address || '',
    from_website: profile?.company_website || 'Borneoetam.com',
    to_client: name,
    to_address: p.client_address || '',
    to_phone: p.client_phone || '',
    title: isStore ? `Faktur Jasa & Subkon - ${name}` : (p.title || `Faktur Pemasangan CCTV - ${name}`),
    discount_amount: discount,
    tax_amount: 0,
    down_payment_amount: dp,
    terms: invoiceTerms,
    invoice_date: nowParts().iso,
    due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
  }).select('id').single();

  if (error || !inv) throw new Error('Gagal membuat faktur: ' + (error?.message ?? ''));

  const rows = (p.items || []).filter((i: any) => i.description?.trim()).map((i: any) => ({
    invoice_id: inv.id,
    description: i.description.trim(),
    quantity: Number(i.quantity) || 0,
    unit: i.unit || 'Unit',
    unit_price: Number(i.unit_price) || 0,
    cost_price: Number(i.cost_price) || 0,
  }));

  if (rows.length > 0) {
    const { error: ie } = await db.from('invoice_items').insert(rows);
    if (ie) {
      await db.from('invoices').delete().eq('id', inv.id);
      throw new Error('Gagal menyimpan item faktur: ' + ie.message);
    }
  }

  // Update or insert cctv_installations for SN & Warranty
  let instId: string | null = null;
  const { data: exInst } = await db.from('cctv_installations').select('id')
    .eq('user_id', OWNER_ID).or(`client_name.ilike.%${name}%,project_name.ilike.%${name}%`).limit(1).maybeSingle();
  if (exInst) {
    instId = exInst.id;
    if (p.sn_nvr || p.sn_hdd) {
      await db.from('cctv_installations').update({
        sn_nvr: p.sn_nvr || undefined,
        sn_hdd: p.sn_hdd || undefined,
        progress: 100,
        installed_at: nowParts().iso,
      }).eq('id', exInst.id);
    }
  } else {
    const { data: newInst } = await db.from('cctv_installations').insert({
      user_id: OWNER_ID,
      client_id: clientId,
      client_name: name,
      client_phone: p.client_phone || '',
      address_landmark: p.client_address || 'Samarinda',
      project_name: `Proyek CCTV - ${name}`,
      public_display_name: `Instalasi CCTV - ${name}`,
      service_type: 'CCTV',
      city: 'Samarinda',
      latitude: -0.502106,
      longitude: 117.153709,
      progress: 100,
      installed_at: nowParts().iso,
      sn_nvr: p.sn_nvr || null,
      sn_hdd: p.sn_hdd || null,
      warranty_months: 12,
    }).select('id').single();
    instId = newInst?.id ?? null;
  }

  // Generate PDF Resmi
  const pdfBytes = generateBorneoDocumentPdf({
    type: 'invoice',
    docCategory,
    docNumber: number,
    dateStr: nowParts().iso,
    clientName: name,
    clientPhone: p.client_phone,
    clientAddress: p.client_address,
    companyName: profile?.company_name || 'Borneo Etam CCTV & Komputer Kasir',
    companyPhone: profile?.company_phone || '082251314646',
    companyWebsite: profile?.company_website || 'Borneoetam.com',
    paymentInstructions: profile?.payment_instructions || 'Bank BCA\n5135400278\na.n Muhammad Wahyu',
    terms: invoiceTerms,
    items: p.items,
    discountAmount: discount,
    downPaymentAmount: dp,
    snNvr: p.sn_nvr,
    snHdd: p.sn_hdd,
  });

  const safeName = `Faktur-${name.replace(/[^a-zA-Z0-9]/g, '_')}-${number.replace(/\//g, '-')}.pdf`;
  await sendDocument(
    chat_id,
    pdfBytes,
    safeName,
    `🧾 <b>${isStore ? 'Faktur Jasa &amp; Subkon (Toko)' : 'Faktur Tagihan Resmi'}: <code>${esc(number)}</code></b>\nKlien/Toko: <b>${esc(name)}</b>\nTotal: <b>${rp(tot)}</b>${dp > 0 ? ` (DP: ${rp(dp)})` : ''}`
  );

  const publicWarrantyUrl = instId ? `${APP_URL}/garansi/${instId}` : undefined;
  const waDraft = makeWhatsAppText('invoice', number, name, tot, dp, publicWarrantyUrl, docCategory);

  const actionButtons: { text: string; data?: string; url?: string }[][] = [];
  const row1: any[] = [{ text: '📜 Cetak BAST', data: `bast:${inv.id}` }];
  if (publicWarrantyUrl) row1.push({ text: '🛡️ Garansi Live', url: publicWarrantyUrl });
  actionButtons.push(row1);

  if (dp < tot) {
    actionButtons.push([{ text: '💰 Tandai Sudah Lunas', data: `pay_lunas:${inv.id}` }]);
  }

  await send(
    chat_id,
    `<b>✅ Faktur Berhasil Diterbitkan &amp; Tersimpan!</b>\n\n${waDraft}`,
    actionButtons.length > 0 ? actionButtons : undefined
  );
  await setChatContext(chat_id, { client_name: name, doc_id: inv.id, doc_type: 'invoice' });
}

async function handleCallback(cb: any) {
  const chat_id = cb.message.chat.id;
  const [action, id] = String(cb.data).split(':');
  await tg('answerCallbackQuery', { callback_query_id: cb.id });

  if (action === 'project' || action === 'proyek') {
    const chatContext = await getChatContext(chat_id);
    await handleProjectCheck(chat_id, id, chatContext);
    return;
  }
  if (action === 'add_photo') {
    await handleText(chat_id, `tambahkan foto ${id}`);
    return;
  }
  if (action === 'sj') {
    // Tombol cetak surat jalan langsung
    await handleText(chat_id, `cetak surat jalan ${id}`);
    return;
  }
  if (action === 'bast') {
    await handleText(chat_id, `cetak BAST ${id}`);
    return;
  }
  if (action === 'warranty') {
    await handleText(chat_id, `garansi digital ${id}`);
    return;
  }
  if (action === 'pdf') {
    await handleText(chat_id, `get pdf ${id}`);
    return;
  }
  if (action === 'deal') {
    await handleText(chat_id, `deal proyek ${id}`);
    return;
  }
  if (action === 'pay_lunas') {
    await handleText(chat_id, `catat pelunasan faktur ${id}`);
    return;
  }
  if (action === 'kwitansi') {
    await handleText(chat_id, `cetak kwitansi ${id}`);
    return;
  }
  if (action === 'loc') {
    await handleText(chat_id, `share lokasi ${id}`);
    return;
  }
  if (action === 'briefing') {
    if (id === 'unpaid') await handleText(chat_id, 'cek piutang');
    else if (id === 'stock') await handleText(chat_id, 'cek stok');
    else await handleMorningBriefing(chat_id);
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
      } else if (row.kind === 'invoice') {
        await execInvoice(chat_id, row.payload);
      }
    } catch (e) {
      await db.from('telegram_pending_actions').update({ status: 'pending' }).eq('id', id);
      return send(chat_id, `⚠️ ${esc((e as Error).message)}\nTekan tombol di bawah untuk coba simpan ulang ya bro.`, [
        [{ text: '✅ Coba Lagi', data: `ok:${id}` }, { text: '❌ Batal', data: `no:${id}` }],
      ]);
    }
  }
}

function startTyping(chatId: number) {
  tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
  const timer = setInterval(() => {
    tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
  }, 4500);
  return () => {
    clearInterval(timer);
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

async function analyzePhotoWithVision(photoBase64: string, caption: string, chatContext: any) {
  const prompt = `Kamu adalah AI Visual Inspector & OCR untuk Borneo Etam CCTV & Komputer Kasir Samarinda.
Tugasmu menganalisis foto yang dikirim Mas Wahyu (Owner Borneo Etam).

Foto ini umumnya merupakan salah satu dari 3 kategori:
1. BARCODE / SERIAL NUMBER (photo_type: "barcode_sn"):
   - Foto stiker barcode, dus kemasan, atau stiker nomor seri (SN) perangkat CCTV (NVR, DVR, Kamera, Harddisk Seagate/WD Purple).
   - Ekstrak nomor seri (SN) dengan sangat teliti!
   - Tentukan apakah itu SN NVR/DVR atau SN Harddisk atau Kamera.
2. STRUK / NOTA BELANJA / BON BIAYA (photo_type: "expense_receipt"):
   - Foto nota belanja material lapangan (pipa conduit, kabel, baut, klem, konektor RJ45/BNC, stopkontak), struk BBM bensin SPBU, nota konsumsi teknisi, atau belanja toko material/elektronik.
   - Ekstrak nama toko/tempat belanja, dan TOTAL NOMINAL belanja (angka integer murni tanpa titik/koma).
   - Kategori: 'Material Lapangan', 'Transportasi', 'Konsumsi', atau 'Lainnya'.
   - Rincian ringkas barang belanjaan.
3. DOKUMENTASI FISIK INSTALASI LAPANGAN (photo_type: "installation_photo"):
   - Foto fisik kamera terpasang di plafon/dinding, rak server/NVR, kabel rapi dalam pipa conduit, teknisi bekerja, atau layar monitor CCTV.
   - Buat ringkasan teknis profesional apa yang tampak di foto.

Konteks Klien Aktif di percakapan: "${chatContext?.client_name || 'Tidak ada'}".
Caption Mas Wahyu: "${caption || 'Tidak ada'}".`;

  const visionSchema = {
    type: 'OBJECT',
    properties: {
      photo_type: { type: 'STRING', enum: ['barcode_sn', 'expense_receipt', 'installation_photo'] },
      sn_nvr: { type: 'STRING', nullable: true },
      sn_hdd: { type: 'STRING', nullable: true },
      sn_general: { type: 'STRING', nullable: true },
      device_type: { type: 'STRING', enum: ['nvr', 'hdd', 'camera', 'other'], nullable: true },
      brand: { type: 'STRING', nullable: true },
      expense_store: { type: 'STRING', nullable: true },
      expense_amount: { type: 'INTEGER', nullable: true },
      expense_description: { type: 'STRING', nullable: true },
      expense_category: { type: 'STRING', enum: ['Material Lapangan', 'Transportasi', 'Konsumsi', 'Lainnya'], nullable: true },
      project_name_detected: { type: 'STRING', nullable: true },
      caption_summary: { type: 'STRING' },
    },
    required: ['photo_type', 'caption_summary'],
  };

  const payload = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: photoBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: visionSchema,
      temperature: 0.1,
    },
  });

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: payload,
      });
      if (res.ok) {
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return JSON.parse(text);
      }
    } catch (e) {
      console.warn(`Vision attempt failed on ${model}:`, e);
    }
  }
  return null;
}

function extractProjectTargetFromCaption(cap: string, chatContext: any): string {
  if (!cap) return chatContext?.client_name || '';

  // Bersihkan kata-kata umum seperti "ini foto", "foto project", "foto projeck", "dokumentasi", "hasil pasang", dll
  let cleaned = cap
    .replace(/^(?:ini\s+)?(?:foto|dokumentasi)\s*(?:project|projeck|projek|proyek|instalasi|pemasangan|hasil\s*pasang|cctv)?(?:\s*(?:ini|itu|nya))?/i, '')
    .replace(/\b(?:tambahkan|tambah|ini|itu|buat|untuk|project|projeck|projek|proyek|foto|dokumentasi|instalasi|cctv|hasil|pasang|pemasangan|tolong|masukkan|ke|ya|otomatis|akan|situ|jadikan|jadi|sampul|cover|sebagai)\b/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();

  if (cleaned.length >= 3) {
    return cleaned;
  }

  // Jika umum seperti "ini foto projeck ini", gunakan konteks chat aktif!
  return chatContext?.client_name || '';
}

// Cache in-memory untuk mengelola sesi album media group (banyak foto sekaligus)
const mediaGroupSessions = new Map<string, {
  targetInstId: string;
  clientName: string;
  isCover: boolean;
  totalSaved: number;
  lastTime: number;
}>();

async function addPhotoToInstallation(
  instId: string,
  newPhotoUrl: string,
  isCover: boolean = false
): Promise<string[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: freshInst } = await db
      .from('cctv_installations')
      .select('photos, progress')
      .eq('id', instId)
      .single();

    if (!freshInst) throw new Error('Instalasi proyek tidak ditemukan di database');

    const currentPhotos: string[] = Array.isArray(freshInst.photos)
      ? freshInst.photos.map((p: any) => (typeof p === 'string' ? p : p?.url)).filter(Boolean)
      : [];

    const filtered = currentPhotos.filter((url: string) => url !== newPhotoUrl);

    let updatedPhotos: string[];
    if (isCover) {
      // Sampul proyek selalu berada di posisi pertama (index 0)
      updatedPhotos = [newPhotoUrl, ...filtered];
    } else {
      // Jika belum ada foto, foto pertama otomatis jadi sampul awal.
      // Jika sudah ada foto, tambahkan ke koleksi (bisa banyak foto tanpa menimpa sampul lama)
      if (filtered.length === 0) {
        updatedPhotos = [newPhotoUrl];
      } else {
        updatedPhotos = [...filtered, newPhotoUrl];
      }
    }

    const { error: updateErr } = await db
      .from('cctv_installations')
      .update({
        photos: updatedPhotos,
        progress: Math.max(freshInst.progress || 0, 80),
        updated_at: new Date().toISOString(),
      })
      .eq('id', instId);

    if (!updateErr) {
      return updatedPhotos;
    }

    // Jika terjadi concurrent conflict saat upload banyak foto sekaligus, tunggu sebentar lalu coba lagi
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return [newPhotoUrl];
}

async function saveInstallationPhoto(
  chat_id: number,
  rawBytes: Uint8Array,
  cap: string,
  chatContext: any,
  aiSummary?: string,
  mediaGroupId?: string,
  explicitIsCover?: boolean
) {
  // Cek apakah ada sesi album media group yang sudah berjalan
  const mgSession = mediaGroupId ? mediaGroupSessions.get(mediaGroupId) : null;

  let targetInst: any = null;
  if (mgSession?.targetInstId) {
    const { data: mgInst } = await db.from('cctv_installations')
      .select('*')
      .eq('id', mgSession.targetInstId)
      .maybeSingle();
    targetInst = mgInst;
  }

  if (!targetInst) {
    // 1. Ekstrak target proyek/klien dari teks caption atau ingatan chat
    const target = extractProjectTargetFromCaption(cap, chatContext);

    if (target) {
      const cleanT = cleanSearchName(target);
      // Cari di tabel cctv_installations
      const { data: insts } = await db.from('cctv_installations')
        .select('*')
        .eq('user_id', OWNER_ID)
        .or(`client_name.ilike.%${cleanT}%,project_name.ilike.%${cleanT}%,public_display_name.ilike.%${cleanT}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      targetInst = insts?.[0] || null;

      if (!targetInst) {
        // Cari di quotes atau invoices
        const match = await findQuoteOrInvoice(target, 'auto');
        if (match) {
          const cName = match.doc.to_client;
          const { data: insts2 } = await db.from('cctv_installations')
            .select('*')
            .eq('user_id', OWNER_ID)
            .or(`client_name.ilike.%${cName}%,quote_id.eq.${match.doc.id}`)
            .order('created_at', { ascending: false })
            .limit(1);
          targetInst = insts2?.[0] || null;

          if (!targetInst) {
            // Buat otomatis jika belum ada entri instalasi
            const { data: newInst } = await db.from('cctv_installations').insert({
              user_id: OWNER_ID,
              client_name: cName,
              client_phone: match.doc.to_phone || '',
              address_landmark: match.doc.to_address || 'Samarinda, Kalimantan Timur',
              project_name: `Instalasi CCTV - ${cName}`,
              public_display_name: `Instalasi CCTV - ${cName}`,
              service_type: 'CCTV',
              city: 'Samarinda',
              latitude: -0.502106,
              longitude: 117.153709,
              progress: 80,
              installed_at: match.doc.invoice_date || match.doc.created_at?.slice(0, 10) || nowParts().iso,
              quote_id: match.doc.id,
              photos: [],
              warranty_months: 12,
            }).select('*').single();
            targetInst = newInst;
          }
        }
      }
    }
  }

  // Jika target masih belum ketemu, gunakan instalasi proyek terbaru
  if (!targetInst) {
    const { data: latestInsts } = await db.from('cctv_installations')
      .select('*')
      .eq('user_id', OWNER_ID)
      .order('created_at', { ascending: false })
      .limit(1);
    targetInst = latestInsts?.[0] || null;
  }

  if (!targetInst) {
    return send(chat_id, 'Belum ada proyek/instalasi terdaftar bro. Buat penawaran atau proyek dulu ya!');
  }

  const isCover = explicitIsCover !== undefined
    ? explicitIsCover
    : (/(?:sampul|cover|jadikan\s*sampul|foto\s*sampul|sampul\s*proyek|cover\s*proyek|jadikan\s*cover)/i.test(cap) || Boolean(chatContext?.next_is_cover));

  // 2. Konversi foto ke format WebP (efisiensi tinggi, kompresi maksimal & cepat dimuat)
  const { bytes: webpBytes, isConverted } = await convertToWebP(rawBytes);

  // 3. Unggah ke Supabase Storage (bucket: document_attachments)
  const instId = targetInst.id;
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fileName = `${uniqueId}.webp`;
  const storagePath = `${OWNER_ID}/projects/${instId}/${fileName}`;

  const { error: uploadErr } = await db.storage
    .from('document_attachments')
    .upload(storagePath, webpBytes, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (uploadErr) {
    console.error('Storage upload error:', uploadErr);
    return send(chat_id, `Gagal mengunggah foto ke storage cloud: ${esc(uploadErr.message)}`);
  }

  const { data: urlData } = db.storage
    .from('document_attachments')
    .getPublicUrl(storagePath);
  const photoWebpUrl = urlData.publicUrl;

  // 4. Update data foto di cctv_installations secara atomik (bisa banyak foto tanpa race condition)
  const updatedPhotos = await addPhotoToInstallation(targetInst.id, photoWebpUrl, isCover);

  // 5. Update konteks percakapan agar ingatan terkunci ke proyek ini
  await setChatContext(chat_id, {
    client_name: targetInst.client_name,
    doc_id: targetInst.id,
    doc_type: 'project',
  });

  const sizeKb = Math.round(webpBytes.length / 1024);
  const publicWarrantyUrl = `${APP_URL}/garansi/${targetInst.id}`;

  // 6. Kelola sesi album media group
  const isSubsequentAlbumPhoto = Boolean(mediaGroupId && mgSession && mgSession.totalSaved > 0);

  if (mediaGroupId) {
    mediaGroupSessions.set(mediaGroupId, {
      targetInstId: targetInst.id,
      clientName: targetInst.client_name,
      isCover,
      totalSaved: (mgSession?.totalSaved || 0) + 1,
      lastTime: Date.now(),
    });
  }

  // Jika ini foto ke-2, 3, dst dalam 1 album yang sama, kirim konfirmasi ringkas agar chat rapi
  if (isSubsequentAlbumPhoto) {
    return send(
      chat_id,
      `📸 <b>+1 Foto WebP Ditambahkan (${sizeKb} KB)</b>\n` +
      `• Proyek: <b>${esc(targetInst.project_name || targetInst.client_name)}</b>\n` +
      `• Total Koleksi Saat Ini: <b>${updatedPhotos.length} Foto Tersimpan</b> ✅`
    );
  }

  const buttons = [
    [
      { text: '🌐 Buka Garansi Live', url: publicWarrantyUrl },
      { text: '🗺️ Buka Peta Command Center', url: `${APP_URL}/peta` }
    ],
    [
      { text: '🛡️ Cetak Garansi', data: `warranty:${targetInst.id}` },
      { text: '📜 Cetak BAST', data: `bast:${targetInst.id}` }
    ]
  ];

  const headerTitle = isCover
    ? `🌟 <b>Foto Berhasil Disimpan &amp; Dijadikan SAMPUL UTAMA!</b>`
    : `📸 <b>Foto Dokumentasi Proyek Berhasil Ditambahkan!</b>`;

  const coverNotice = isCover
    ? `• Posisi Foto     : <b>⭐ Sampul Utama (Cover Peta &amp; Garansi)</b>\n`
    : '';

  return send(
    chat_id,
    `${headerTitle}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Klien / Proyek : <b>${esc(targetInst.project_name || targetInst.client_name)}</b>\n` +
    `• Format File    : <b>WebP High-Efficiency (${sizeKb} KB${isConverted ? ' • WASM' : ''})</b>\n` +
    coverNotice +
    (aiSummary ? `• Rincian Visual : <i>${esc(aiSummary)}</i>\n` : '') +
    `• Cloud Storage  : <code>document_attachments</code>\n` +
    `• Total Koleksi  : <b>${updatedPhotos.length} Foto Dokumentasi</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    (isCover
      ? `<i>Foto resmi menjadi tampilan sampul di Peta Command Center &amp; Portofolio Publik Borneo Etam!</i>`
      : `<i>Dokumentasi proyek tersimpan rapi di Cloud Storage. Mas Wahyu bisa kirim banyak foto lagi kapan saja!</i>`),
    buttons
  );
}

async function handlePhotoUpload(chat_id: number, photo: any, cap: string, chatContext: any, mediaGroupId?: string) {
  const fileInfo = await tg('getFile', { file_id: photo.file_id });
  const filePath = fileInfo?.result?.file_path;
  if (!filePath) {
    return send(chat_id, 'Gagal mengambil foto dari Telegram bro. Coba kirim ulang ya.');
  }

  const photoUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
  const res = await fetch(photoUrl);
  if (!res.ok) {
    return send(chat_id, 'Gagal mengunduh foto untuk dianalisis bro.');
  }

  const arrayBuf = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);

  // Cek apakah foto ini bagian dari media group (album) yang sudah terdaftar
  let mgSession = mediaGroupId ? mediaGroupSessions.get(mediaGroupId) : null;

  // Deteksi intent foto proyek eksplisit atau sedang dalam mode unggah foto proyek
  const isExplicitProjectPhoto =
    Boolean(mgSession) ||
    /(?:tambah(?:kan)?\s*foto|foto\s*(?:ini\s*)?tambah|ini\s*foto|foto\s*(?:buat|untuk)?\s*proje(?:ct|ck|k|c)|ini\s*foto\s*proyek|sampul|cover|dokumentasi|foto\s*instalasi|foto\s*lapangan|foto\s*cctv|foto\s*hasil)/i.test(cap) ||
    Boolean(chatContext?.is_waiting_for_photo) ||
    (chatContext?.doc_type === 'project' && !cap);

  const isCoverPhoto =
    /(?:sampul|cover|jadikan\s*sampul|foto\s*sampul|sampul\s*proyek|cover\s*proyek|jadikan\s*cover)/i.test(cap) ||
    Boolean(chatContext?.next_is_cover) ||
    (Boolean(mgSession?.isCover) && mgSession?.totalSaved === 0);

  // JIKA EKSPLISIT FOTO PROYEK: Langsung simpan ke proyek tanpa panggil Gemini Vision!
  if (isExplicitProjectPhoto) {
    return saveInstallationPhoto(chat_id, bytes, cap, chatContext, undefined, mediaGroupId, isCoverPhoto);
  }

  const base64 = toBase64(bytes);
  const analysis = await analyzePhotoWithVision(base64, cap, chatContext);

  // A. DETEKSI STIKER BARCODE / SERIAL NUMBER (SN) (Hanya jika BUKAN foto proyek eksplisit)
  if (!isExplicitProjectPhoto && analysis?.photo_type === 'barcode_sn') {
    let clientName = analysis.project_name_detected || chatContext?.client_name || '';
    let snNvr = analysis.sn_nvr;
    let snHdd = analysis.sn_hdd;

    if (!snNvr && !snHdd && analysis.sn_general) {
      if (analysis.device_type === 'hdd') snHdd = analysis.sn_general;
      else snNvr = analysis.sn_general;
    }

    let targetDoc: any = null;
    if (clientName) {
      const match = await findQuoteOrInvoice(clientName, 'invoice');
      targetDoc = match?.doc;
    }
    if (!targetDoc) {
      const { data: latestInvs } = await db.from('invoices').select('*, invoice_items(*)').eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(1);
      targetDoc = latestInvs?.[0];
      if (targetDoc) clientName = targetDoc.to_client;
    }

    if (targetDoc) {
      const updates: any = {};
      if (snNvr) updates.sn_nvr = snNvr;
      if (snHdd) updates.sn_hdd = snHdd;

      if (Object.keys(updates).length > 0) {
        await db.from('invoices').update(updates).eq('id', targetDoc.id);

        await db.from('cctv_installations').update(updates)
          .eq('user_id', OWNER_ID)
          .or(`client_name.ilike.%${targetDoc.to_client}%,quote_id.eq.${targetDoc.id}`);

        if (snNvr) {
          const nvrItem = (targetDoc.invoice_items || []).find((i: any) => /nvr|dvr|perekam/i.test(i.description));
          if (nvrItem) {
            let desc = nvrItem.description;
            desc = /\(SN:[^)]+\)/i.test(desc) ? desc.replace(/\(SN:[^)]+\)/i, `(SN: ${snNvr})`) : `${desc} (SN: ${snNvr})`;
            await db.from('invoice_items').update({ description: desc }).eq('id', nvrItem.id);
          }
        }
        if (snHdd) {
          const hddItem = (targetDoc.invoice_items || []).find((i: any) => /hdd|harddisk|seagate|wd purple/i.test(i.description));
          if (hddItem) {
            let desc = hddItem.description;
            desc = /\(SN:[^)]+\)/i.test(desc) ? desc.replace(/\(SN:[^)]+\)/i, `(SN: ${snHdd})`) : `${desc} (SN: ${snHdd})`;
            await db.from('invoice_items').update({ description: desc }).eq('id', hddItem.id);
          }
        }

        await setChatContext(chat_id, { client_name: targetDoc.to_client, doc_id: targetDoc.id, doc_type: 'invoice' });
      }
    }

    return send(
      chat_id,
      `📷 <b>Serial Number (SN) Berhasil Terbaca dari Foto!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Klien Terkait : <b>${esc(clientName || 'Tersimpan')}</b>\n` +
      (snNvr ? `• <b>SN NVR/DVR :</b> <code>${esc(snNvr)}</code>\n` : '') +
      (snHdd ? `• <b>SN Harddisk:</b> <code>${esc(snHdd)}</code>\n` : '') +
      (analysis.brand ? `• Perangkat : <b>${esc(analysis.brand)}</b> (${analysis.device_type?.toUpperCase() || 'CCTV'})\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Nomor seri otomatis ter-update di Faktur dan Kartu Garansi Digital Konsumen bro!</i>`,
      targetDoc ? [
        [
          { text: '🛡️ Cetak Garansi Terkini', data: `warranty:${targetDoc.id}` },
          { text: '🧾 Lihat Faktur', data: `pdf:${targetDoc.id}` }
        ]
      ] : undefined
    );
  }

  // B. DETEKSI NOTA BELANJA / STRUK BIAYA (Hanya jika BUKAN foto proyek eksplisit)
  if (!isExplicitProjectPhoto && analysis?.photo_type === 'expense_receipt') {
    const amount = Number(analysis.expense_amount || 0);
    const store = analysis.expense_store || 'Toko Material Lapangan';
    const cat = analysis.expense_category || 'Material Lapangan';
    const desc = analysis.expense_description || `Belanja di ${store}`;

    let projectId: string | null = null;
    let projName: string | null = null;
    const targetName = analysis.project_name_detected || chatContext?.client_name || cap;

    if (targetName) {
      const { data: pList } = await db.from('projects').select('id, name').eq('user_id', OWNER_ID).order('created_at', { ascending: false }).limit(10);
      const cleanTarget = cleanSearchName(targetName);
      const matched = (pList || []).find((p: any) => {
        const pClean = cleanSearchName(p.name);
        return cleanTarget && (pClean.includes(cleanTarget) || cleanTarget.includes(pClean));
      });
      if (matched) {
        projectId = matched.id;
        projName = matched.name;
      }
    }

    await db.from('expenses').insert({
      user_id: OWNER_ID,
      project_id: projectId,
      description: `${desc} (via Scan Nota)`,
      amount,
      category: cat,
      expense_date: nowParts().iso,
      notes: `Di-scan otomatis oleh AI dari nota ${store}`,
    });

    return send(
      chat_id,
      `🧾 <b>Nota Belanja Lapangan Berhasil Di-Scan &amp; Dicatat!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Toko / Tempat : <b>${esc(store)}</b>\n` +
      `• Total Pengeluaran : <b>${rp(amount)}</b>\n` +
      `• Kategori Beban : <b>${esc(cat)}</b>\n` +
      (projName ? `• Proyek Terbeban : <b>${esc(projName)}</b>\n` : '') +
      `• Rincian Item : <i>${esc(desc)}</i>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Laba riil proyek dan buku kas Borneo Etam otomatis terpotong rapi!</i>`
    );
  }

  // C. DOKUMENTASI FISIK INSTALASI PROYEK (Upload WebP & Hubungkan ke Proyek)
  return saveInstallationPhoto(chat_id, bytes, cap, chatContext, analysis?.caption_summary);
}

// ------------------------------------------------------------------ webhook & hybrid failover gateway
Deno.serve(async (req) => {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const homeLabUrl = (env('BORNEO_HOMELAB_URL') || '').trim().replace(/\/$/, '');

    // Endpoint auto-heal & relink seluruh proyek, klien, faktur, dan penawaran
    if (url.searchParams.get('heal') === '1' || url.searchParams.get('sync') === '1') {
      const healed = await healAllProjects();
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'Borneo Etam Project & Profit Auto-Healer',
        healed_count: healed.length,
        projects: healed,
        timestamp: new Date().toISOString(),
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      status: 'ok',
      service: 'Borneo Etam AI Command Center Gateway',
      region: 'Singapore Cloud (SIN)',
      mode: homeLabUrl ? 'Hybrid Gateway (Failover Ready)' : 'Cloud Native',
      homelab_configured: Boolean(homeLabUrl),
      timestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') return new Response('ok');
  if (!WEBHOOK_SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 401 });
  }
  let update: any;
  try { update = await req.json(); } catch { return new Response('ok'); }

  const from = update.message?.from?.id ?? update.callback_query?.from?.id;
  if (!ALLOWED_ID || from !== ALLOWED_ID) return new Response('ok');

  // ------------------------------------------------------------------ HYBRID FAILOVER GATEWAY
  // Jika Borneo Home Lab Server diset di secret BORNEO_HOMELAB_URL:
  // Coba teruskan update ke server Home Lab kantor. Jika server mati lampu / timeout 1.8s,
  // seketika otomatis failover dieksekusi secara mandiri oleh Supabase Cloud!
  const homeLabUrl = (env('BORNEO_HOMELAB_URL') || '').trim().replace(/\/$/, '');
  const isFromHomeLab = req.headers.get('x-borneo-source') === 'homelab';

  if (homeLabUrl && !isFromHomeLab) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800); // 1.8 detik maks
      const res = await fetch(`${homeLabUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
          'x-borneo-gateway': 'supabase-cloud',
        },
        body: JSON.stringify(update),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        console.log('[GATEWAY] Successfully processed by Borneo Home Lab Server!');
        return new Response('ok');
      } else {
        console.warn(`[GATEWAY-FAILOVER] Home Lab returned status ${res.status}. Falling back to Supabase Cloud!`);
      }
    } catch (err: any) {
      console.warn(`[GATEWAY-FAILOVER] Home Lab unreachable (${err.name || err.message}). Instant fallback to Supabase Cloud!`);
    }
  }

  const processUpdate = async () => {
    const chat_id = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
    const stopTyping = chat_id ? startTyping(chat_id) : () => {};

    try {
      if (update.callback_query) {
        await handleCallback(update.callback_query);
      } else if (update.message) {
        const m = update.message;

        // 1. Tangani Foto Dokumentasi Lapangan, Scan Barcode SN, atau Nota Belanja
        if (m.photo && m.photo.length > 0) {
          const photo = m.photo[m.photo.length - 1]; // Resolusi tertinggi
          const cap = (m.caption || '').trim();
          const chatContext = await getChatContext(chat_id);
          await handlePhotoUpload(chat_id, photo, cap, chatContext, m.media_group_id);
        } else if (m.document && m.document.mime_type?.startsWith('image/')) {
          const photo = { file_id: m.document.file_id };
          const cap = (m.caption || '').trim();
          const chatContext = await getChatContext(chat_id);
          await handlePhotoUpload(chat_id, photo, cap, chatContext, m.media_group_id);
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
              '• <i>buat faktur ke Toko Berkah Jaya jasa pasang 4 titik 600rb, akomodasi 150rb</i> (Mode Toko / Subkon)\n' +
              '• <i>cek proyek Pak Yusril</i> / <i>proyek kita</i> / <i>daftar proyek</i> (mengarahkan bot & kunci konteks proyek)\n' +
              '• <i>tambahkan foto proyek Pak Yusril</i> (kirim 1 atau banyak foto sekaligus / album)\n' +
              '• <i>foto ini jadi sampul proyek</i> (jadikan sampul utama di Peta & Garansi)\n' +
              '• <i>ini foto buat projeck pak hendra</i> / <i>foto ini tambah</i>\n' +
              '• <i>faktur Pak Yusuf edit nvr masukkan SN: NVR-HL-8899</i> (Input SN Hardware)\n' +
              '• <i>edit penawaran Pak Hendra tambah kabel 1 roll 300rb</i>\n' +
              '• <i>deal bro, lanjut buat proyek</i> (otomatis masuk Peta & Proyek)\n' +
              '• <i>sudah beli pipa conduit 150rb untuk proyek Pak Suhabuddin</i> (catat pengeluaran)\n' +
              '• <i>proyek Pak Suhabuddin sudah selesai pasang</i> (otomatis Faktur, BAST & Garansi)\n' +
              '• <i>cetak surat jalan Pak Suhabuddin</i>\n' +
              '• <i>cetak BAST Pak Suhabuddin</i>\n' +
              '• <i>garansi digital Pak Suhabuddin</i>\n' +
              '• <i>4 kamera 2MP HDD 1TB tahan berapa hari bro?</i>\n' +
              '• <i>tolong masukkan barang ini: Kamera ColorVu 4MP jual 450rb modal 320rb</i>\n' +
              '• <i>Pak Yusuf sudah lunas</i> (catat pelunasan faktur)\n' +
              '• <i>Pak Sahabuddin transfer DP 2jt</i> (catat DP faktur)\n' +
              '• <i>minta kwitansi Pak Yusuf</i> (cetak Kwitansi Resmi PDF)\n' +
              '• <i>lokasi proyek Pak Yusuf</i> (share pin GPS & rute Google Maps teknisi)\n' +
              '• <i>cek stok HDD 1TB</i> / <i>tambah stok kabel cat6 2 roll</i> (manajemen stok)\n' +
              '• <i>cek tagihan jatuh tempo</i> (monitoring piutang & draft reminder WA)\n' +
              '• <i>kamera hikvision malam hari gelap gak mau nyala LED kenapa ya?</i> (asisten teknisi)\n' +
              '• <i>rekap piutang bro</i> (cek daftar tagihan yang belum lunas)\n' +
              '• <i>rekap performa bulan ini bro</i>'
            );
          } else if (t === '/batal') {
            const row = await latestPending(chat_id);
            if (row) await db.from('telegram_pending_actions').update({ status: 'cancelled' }).eq('id', row.id);
            await send(chat_id, row ? 'Aksi dibatalkan bro.' : 'Tidak ada aksi yang menunggu konfirmasi.');
          } else if (t === '/briefing' || /^(briefing|selamat pagi|pagi bro|agenda hari ini|cek hari ini)$/i.test(t)) {
            await handleMorningBriefing(chat_id);
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
      if (chat_id) {
        const msg = (e as Error).message || '';
        if (/503|UNAVAILABLE|high demand|overloaded/i.test(msg)) {
          await send(chat_id, '⚠️ Server AI Google sedang mengalami lonjakan trafik sesaat bro. Coba kirim ulang pesan kamu ya!');
        } else {
          await send(chat_id, `⚠️ Ada kendala: ${esc(msg.slice(0, 200))}`);
        }
      }
    } finally {
      stopTyping();
    }
  };

  if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
    (globalThis as any).EdgeRuntime.waitUntil(processUpdate());
    return new Response('ok');
  } else {
    await processUpdate();
    return new Response('ok');
  }
});
