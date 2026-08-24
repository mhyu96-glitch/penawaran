# Product Requirements Document (PRD)
# Sistem Manajemen Penawaran & Faktur

## 1. Overview

### 1.1 Product Vision
Sistem manajemen penawaran dan faktur berbasis web yang membantu bisnis kecil dan menengah untuk mengelola workflow penjualan mereka dari penawaran hingga pembayaran dengan cara yang modern, efisien, dan mobile-friendly.

### 1.2 Product Goals
- Mempercepat pembuatan penawaran dan faktur hingga 80%
- Meningkatkan tracking status dokumen dan pembayaran
- Memberikan visibility real-time terhadap kesehatan bisnis
- Memudahkan follow-up terhadap penawaran dan faktur
- Menyediakan insights bisnis berbasis AI

### 1.3 Target Users
- **Primary**: Pemilik bisnis kecil dan menengah
- **Secondary**: Sales team, finance team
- **Tertiary**: Klien yang menerima penawaran/faktur

### 1.4 Success Metrics
- Time to create quote/invoice < 2 menit
- User engagement: 70% daily active users
- Quote to invoice conversion rate > 40%
- Overdue invoice reduction > 30%
- User satisfaction score > 4.5/5

---

## 2. Core Features

### 2.1 Dashboard (AI-Powered Command Center)

#### 2.1.1 Business Health Score
**Priority**: P0 (Critical)

**Description**: 
Algoritma AI yang menghitung skor kesehatan bisnis (0-100) berdasarkan 4 metrics utama.

**Calculation Formula**:
- Revenue Achievement: 30% (current revenue vs target)
- Conversion Rate: 25% (accepted quotes / sent quotes)
- Profitability: 25% (net profit margin)
- Operational Health: 20% (penalties untuk overdue invoices & low stock)

**User Stories**:
- US-001: Sebagai pemilik bisnis, saya ingin melihat skor kesehatan bisnis saya dalam satu angka sederhana
- US-002: Sebagai user, saya ingin melihat trend performa (up/down/stable) untuk memahami arah bisnis

**Acceptance Criteria**:
- Score dihitung otomatis setiap kali ada perubahan data
- Score dikategorikan: Excellent (>80), Good (60-80), Need Attention (<60)
- Trend indicator ditampilkan dengan icon yang sesuai
- Progress bar menunjukkan visualisasi score

**Technical Requirements**:
- Real-time calculation menggunakan useMemo
- Score harus recalculate saat dependency berubah
- Performance: calculation time < 50ms

---

#### 2.1.2 AI Business Insights
**Priority**: P0 (Critical)

**Description**:
Sistem memberikan rekomendasi dan insight otomatis berdasarkan analisis data bisnis.

**Insight Types**:
1. Revenue target achievement status
2. Conversion rate assessment
3. Overdue invoice alerts dengan action items
4. Profit margin health check
5. Inventory management warnings

**User Stories**:
- US-003: Sebagai pemilik bisnis, saya ingin mendapat insight otomatis tentang area yang perlu perhatian
- US-004: Sebagai user, saya ingin rekomendasi actionable untuk meningkatkan performa

**Acceptance Criteria**:
- Minimal 3 insights ditampilkan
- Insights harus contextual dan actionable
- Update setiap kali ada perubahan data signifikan
- Bahasa Indonesia yang natural dan mudah dipahami

---

#### 2.1.3 Real-time System Metrics
**Priority**: P1 (High)

**Description**:
Monitoring sistem real-time yang menampilkan status operasional.

**Metrics Displayed**:
- Server load percentage
- Active users count
- Response time (ms)
- System uptime
- Last backup time

**User Stories**:
- US-005: Sebagai admin, saya ingin melihat status sistem secara real-time
- US-006: Sebagai user, saya ingin tahu bahwa sistem sedang berjalan normal

**Acceptance Criteria**:
- Metrics update setiap 30 detik (configurable)
- Auto-refresh dapat di-enable/disable
- Refresh interval dapat disesuaikan (10-120 detik)
- Visual indicator untuk status normal/warning/critical

---

#### 2.1.4 Enhanced KPI Cards
**Priority**: P0 (Critical)

**KPI Cards**:
1. **Business Health Score**
   - Main metric: Score 0-100
   - Secondary: Status badge (Excellent/Good/Need Attention)
   - Visual: Progress bar, trend icon

2. **Monthly Revenue**
   - Main metric: Total pendapatan bulan ini
   - Secondary: Growth percentage vs last month
   - Visual: Trend arrow, gradient background

3. **Profit Margin**
   - Main metric: Percentage margin
   - Secondary: Absolute profit value
   - Visual: Badge dengan actual value

4. **Target Achievement**
   - Main metric: Percentage of goal reached
   - Secondary: Actual vs target amounts
   - Visual: Progress bar, editable target
   - Action: Quick edit untuk mengubah target

**User Stories**:
- US-007: Sebagai pemilik bisnis, saya ingin melihat metrics penting di satu tempat
- US-008: Sebagai user, saya ingin mengubah target pendapatan dengan mudah

**Acceptance Criteria**:
- Semua KPI cards responsive di mobile
- Target dapat diedit inline dengan 2 klik
- Data update real-time saat ada perubahan
- Visual feedback saat hover (scale, shadow)

---

#### 2.1.5 Financial Chart
**Priority**: P0 (Critical)

**Description**:
Area chart yang menampilkan tren cashflow harian (pendapatan vs biaya).

**Features**:
- X-axis: Tanggal (default: last 30 days)
- Y-axis: Amount dalam Rupiah
- Two lines: Pendapatan (green), Biaya (red)
- Tooltip: Detail amount per tanggal
- Gradient fill untuk visual clarity

**User Stories**:
- US-009: Sebagai pemilik bisnis, saya ingin melihat tren pendapatan dan biaya
- US-010: Sebagai user, saya ingin filter chart berdasarkan date range

**Acceptance Criteria**:
- Chart responsive di semua device
- Tooltip menampilkan formatted currency
- Date range dapat diubah via calendar picker
- Chart smooth animation saat data berubah

---

#### 2.1.6 Quick Actions
**Priority**: P0 (Critical)

**Action Buttons**:
1. Buat Penawaran (Blue gradient)
2. Buat Faktur (Green gradient)
3. Catat Expenses (Orange gradient)
4. Kelola Klien (Purple gradient)
5. Lihat Reports (Pink gradient)
6. Kelola Inventory (Indigo gradient)

**User Stories**:
- US-011: Sebagai user, saya ingin akses cepat ke fungsi yang sering digunakan
- US-012: Sebagai user, saya ingin notifikasi visual jika ada item yang perlu perhatian

**Acceptance Criteria**:
- Button hover: scale 1.05 + shadow enhancement
- Icon animation saat hover
- Badge notifikasi untuk inventory (low stock count)
- Responsive: 2 columns mobile, 6 columns desktop

---

### 2.2 Quote Management

#### 2.2.1 Create Quote
**Priority**: P0 (Critical)

**Description**:
Form untuk membuat penawaran baru dengan auto-calculation dan template support.

**Form Fields**:
- Nomor Penawaran (auto-generated)
- Tanggal Penawaran
- Klien (dropdown + search, atau create new)
- Valid Until (default: 30 days)
- Items Table:
  - Deskripsi (autocomplete dari items master)
  - Quantity
  - Unit
  - Unit Price
  - Cost Price (for profit calculation)
  - Total (auto-calculated)
- Subtotal (auto-calculated)
- Discount (Rp atau %)
- Tax (Rp atau %)
- Grand Total (auto-calculated)
- Terms & Conditions (rich text editor)
- Notes (optional)

**User Stories**:
- US-013: Sebagai sales, saya ingin membuat penawaran dalam < 2 menit
- US-014: Sebagai user, saya ingin nomor penawaran generated otomatis
- US-015: Sebagai user, saya ingin duplicate penawaran existing
- US-016: Sebagai user, saya ingin save as draft untuk dilanjutkan nanti

**Acceptance Criteria**:
- Nomor penawaran format: QT-YYYYMMDD-XXX
- Klien dapat dicreate inline tanpa pindah halaman
- Item dapat ditambah dari master data atau manual input
- Calculation real-time saat user input
- Validation: klien required, minimal 1 item, harga > 0
- Draft dapat disimpan dan dilanjutkan
- PDF preview sebelum kirim

---

#### 2.2.2 Quote List
**Priority**: P0 (Critical)

**Description**:
Tabel yang menampilkan semua penawaran dengan filtering dan sorting.

**Columns**:
- Nomor Penawaran
- Tanggal
- Klien
- Total Amount
- Status (Draft/Terkirim/Diterima/Ditolak)
- Valid Until
- Actions

**Features**:
- Search: nomor, klien name
- Filter: status, date range
- Sort: tanggal (newest first default)
- Status badges dengan warna:
  - Draft: Gray
  - Terkirim: Blue
  - Diterima: Green
  - Ditolak: Red
- Bulk actions: delete multiple drafts
- Export to Excel/CSV

**User Stories**:
- US-017: Sebagai user, saya ingin melihat semua penawaran dalam satu list
- US-018: Sebagai user, saya ingin filter penawaran by status
- US-019: Sebagai user, saya ingin search penawaran by klien atau nomor
- US-020: Sebagai user, saya ingin sort penawaran by tanggal

**Acceptance Criteria**:
- Pagination: 50 items per page
- Mobile view: card layout dengan swipeable actions
- Desktop view: table dengan sortable columns
- Status dapat diubah langsung dari list (dropdown)
- Quick action dropdown: View, Edit, Duplicate, Delete, Create Invoice

---

#### 2.2.3 Quote to Invoice Conversion
**Priority**: P0 (Critical)

**Description**:
Tombol "Buat Faktur" yang mengkonversi penawaran menjadi faktur dengan satu klik.

**User Stories**:
- US-021: Sebagai user, saya ingin convert penawaran ke faktur dengan 1 klik
- US-022: Sebagai user, saya ingin data penawaran auto-populate ke faktur

**Acceptance Criteria**:
- Button "Buat Faktur" prominent (green, with icon)
- Tersedia di: Quote detail page, Quote list (dropdown)
- Data yang di-copy: klien, items, prices, discount, tax
- Nomor faktur auto-generated baru
- Invoice date = today
- Due date = today + 30 days (configurable)
- Redirect ke invoice edit page setelah create
- Original quote status tidak berubah

**Business Rules**:
- Quote status harus "Diterima" atau "Terkirim"
- Tidak bisa create invoice dari quote yang sudah expired
- Satu quote bisa create multiple invoices (partial invoicing)

---

### 2.3 Invoice Management

#### 2.3.1 Create Invoice
**Priority**: P0 (Critical)

**Description**:
Form untuk membuat faktur baru, mirip dengan create quote.

**Form Fields**:
(Similar to Quote) +
- Invoice Number (auto-generated)
- Invoice Date
- Due Date
- Payment Terms (Net 30, Net 60, etc)
- Bank Account Info (for payment instruction)

**User Stories**:
- US-023: Sebagai user, saya ingin membuat faktur manual
- US-024: Sebagai user, saya ingin set due date untuk reminder

**Acceptance Criteria**:
- Nomor faktur format: INV-YYYYMMDD-XXX
- Due date default: invoice date + 30 days
- Validation: due date >= invoice date
- Payment terms dapat dipilih dari preset atau custom
- Bank account info dari profile settings

---

#### 2.3.2 Invoice List
**Priority**: P0 (Critical)

**Description**:
List semua faktur dengan status tracking dan payment actions.

**Columns**:
- Nomor Faktur
- Tanggal
- Klien
- Total Amount
- Status (Draft/Terkirim/Lunas)
- Due Date
- Overdue Days (if applicable)
- Actions

**Features**:
- Status badges dengan warna:
  - Draft: Gray
  - Terkirim: Yellow
  - Lunas: Green
  - Overdue: Red (pulsing animation)
- Overdue indicator: "X hari terlambat" in red
- Filter: status, date range, overdue only
- Sort: due date, amount, status
- Quick payment button untuk mark as Lunas

**User Stories**:
- US-025: Sebagai user, saya ingin lihat faktur yang overdue
- US-026: Sebagai user, saya ingin mark faktur as paid dengan 1 klik
- US-027: Sebagai user, saya ingin send reminder ke klien untuk overdue invoice

**Acceptance Criteria**:
- Overdue invoices highlighted di top of list
- "Pelunasan" button prominent (green) untuk invoice yang belum lunas
- Confirmation dialog sebelum mark as paid
- Send reminder feature (email/WhatsApp)
- Export overdue invoices untuk collection

---

#### 2.3.3 Payment/Pelunasan Feature
**Priority**: P0 (Critical)

**Description**:
Tombol "Pelunasan" untuk mencatat pembayaran faktur.

**User Stories**:
- US-028: Sebagai user, saya ingin record payment dengan cepat
- US-029: Sebagai user, saya ingin konfirmasi sebelum mark as paid

**Acceptance Criteria**:
- Button "Pelunasan" dengan icon CheckCircle, warna hijau
- Tersedia di: Invoice list (table & mobile dropdown), Invoice detail
- Confirmation dialog: "Tandai faktur INV-XXX sebagai lunas?"
- Setelah confirm:
  - Status berubah ke "Lunas"
  - Payment date = today
  - Payment method dapat dipilih (Transfer/Cash/etc)
  - Create payment record di database
- Success toast: "Faktur berhasil ditandai lunas"
- Button hilang setelah invoice lunas

**Business Rules**:
- Hanya invoice dengan status "Terkirim" yang bisa dilunasi
- Tidak bisa undo setelah pelunasan (need admin)
- Payment date harus >= invoice date

---

### 2.4 Client Management

#### 2.4.1 Client List
**Priority**: P1 (High)

**Description**:
Database klien dengan contact info dan transaction history.

**Client Fields**:
- Nama Perusahaan
- Contact Person
- Email
- Phone
- Address
- Tax ID (NPWP)
- Notes
- Tags (for segmentation)

**Features**:
- Search: nama, email, phone
- Filter: tags, city
- Sort: name, last transaction
- Client card: shows total quotes, total invoices, total revenue
- Transaction history: list of quotes & invoices

**User Stories**:
- US-030: Sebagai user, saya ingin manage database klien
- US-031: Sebagai user, saya ingin lihat transaction history per klien
- US-032: Sebagai user, saya ingin segment klien dengan tags

**Acceptance Criteria**:
- Quick add client dari quote/invoice form
- Client detail page shows all transactions
- Revenue analytics per client
- Export client list to Excel
- Bulk import from CSV

---

### 2.5 Expense Management

#### 2.5.1 Create Expense
**Priority**: P1 (High)

**Description**:
Form untuk mencatat pengeluaran bisnis.

**Form Fields**:
- Expense Date
- Category (dropdown: Operasional, Marketing, Supplies, etc)
- Description
- Amount
- Payment Method
- Receipt Photo (upload)
- Notes

**User Stories**:
- US-033: Sebagai user, saya ingin catat expense dengan cepat
- US-034: Sebagai user, saya ingin attach receipt photo

**Acceptance Criteria**:
- Mobile-first form (easy input on the go)
- Category dapat dikustomisasi
- Receipt photo upload (drag & drop or camera)
- Amount validation > 0
- Expense included dalam profit calculation

---

### 2.6 Inventory Management

#### 2.6.1 Items Master
**Priority**: P1 (High)

**Description**:
Master data produk/jasa yang sering dijual.

**Item Fields**:
- Description/Name
- Unit (pcs, box, jam, etc)
- Unit Price (default selling price)
- Cost Price (for profit calculation)
- Stock Quantity
- Min Stock Alert
- Track Stock (yes/no)
- Category
- SKU/Code
- Status (Active/Inactive)

**Features**:
- Quick add item
- Stock in/out recording
- Low stock alerts
- Price history tracking
- Bulk price update

**User Stories**:
- US-035: Sebagai user, saya ingin maintain product master
- US-036: Sebagai user, saya ingin dapat alert saat stock menipis
- US-037: Sebagai user, saya ingin track profit per item

**Acceptance Criteria**:
- Item autocomplete saat create quote/invoice
- Low stock alert di dashboard (badge notification)
- Stock update otomatis saat invoice paid (if track stock enabled)
- Price history untuk analisis

---

### 2.7 Reports & Analytics

#### 2.7.1 Financial Reports
**Priority**: P1 (High)

**Report Types**:
1. **Profit & Loss Statement**
   - Revenue (by payment date)
   - Cost of Goods Sold
   - Gross Profit
   - Operating Expenses
   - Net Profit
   - Period: Monthly, Quarterly, Yearly

2. **Sales Report**
   - Total quotes sent
   - Total quotes accepted
   - Conversion rate
   - Total invoices
   - Total revenue
   - Average deal size
   - By period, by client, by item

3. **Outstanding Report**
   - Unpaid invoices
   - Overdue invoices
   - Aging analysis (0-30, 31-60, 61-90, >90 days)
   - Collection priority list

4. **Expense Report**
   - By category
   - By period
   - Expense trends

**User Stories**:
- US-038: Sebagai pemilik bisnis, saya ingin lihat laporan keuangan
- US-039: Sebagai user, saya ingin export laporan ke PDF/Excel
- US-040: Sebagai user, saya ingin compare period over period

**Acceptance Criteria**:
- All reports filterable by date range
- Export to PDF dan Excel
- Printable format
- Charts untuk visualization
- Drill-down ke detail transactions

---

## 3. Technical Requirements

### 3.1 Technology Stack

**Frontend**:
- React 18.3+ with TypeScript
- Vite for build tool
- Tailwind CSS for styling
- Shadcn/ui for component library
- Recharts for data visualization
- React Router for navigation
- React Query (@tanstack/react-query) for data fetching
- date-fns for date manipulation
- Lucide React for icons

**Backend**:
- Supabase (PostgreSQL database)
- Supabase Auth for authentication
- Supabase Storage for file uploads
- Row Level Security (RLS) untuk data isolation

**Deployment**:
- Cloudflare Pages untuk hosting
- Cloudflare Workers (optional untuk serverless functions)
- PWA support untuk offline capability

### 3.2 Database Schema

#### Tables:

**profiles**
```sql
- id (uuid, PK, FK to auth.users)
- full_name (text)
- company_name (text)
- email (text)
- phone (text)
- address (text)
- tax_id (text)
- monthly_revenue_goal (numeric)
- created_at (timestamp)
- updated_at (timestamp)
```

**clients**
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- name (text)
- contact_person (text)
- email (text)
- phone (text)
- address (text)
- tax_id (text)
- notes (text)
- tags (text[])
- created_at (timestamp)
- updated_at (timestamp)
```

**items**
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- description (text)
- unit (text)
- unit_price (numeric)
- cost_price (numeric)
- stock (numeric)
- min_stock_alert (numeric)
- track_stock (boolean)
- category (text)
- sku (text)
- status (text)
- created_at (timestamp)
- updated_at (timestamp)
```

**quotes**
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- quote_number (text, unique)
- quote_date (date)
- client_id (uuid, FK to clients)
- to_client (text) - denormalized for quick access
- valid_until (date)
- status (text) - Draft, Terkirim, Diterima, Ditolak
- discount_type (text) - percentage, fixed
- discount_amount (numeric)
- tax_amount (numeric)
- terms (text)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)
```

**quote_items**
```sql
- id (uuid, PK)
- quote_id (uuid, FK to quotes)
- item_id (uuid, FK to items, nullable)
- description (text)
- quantity (numeric)
- unit (text)
- unit_price (numeric)
- cost_price (numeric)
- created_at (timestamp)
```

**invoices**
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- invoice_number (text, unique)
- invoice_date (date)
- due_date (date)
- client_id (uuid, FK to clients)
- to_client (text)
- quote_id (uuid, FK to quotes, nullable)
- status (text) - Draft, Terkirim, Lunas
- discount_type (text)
- discount_amount (numeric)
- tax_amount (numeric)
- payment_terms (text)
- bank_account_info (text)
- terms (text)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)
```

**invoice_items**
```sql
- id (uuid, PK)
- invoice_id (uuid, FK to invoices)
- item_id (uuid, FK to items, nullable)
- description (text)
- quantity (numeric)
- unit (text)
- unit_price (numeric)
- cost_price (numeric)
- created_at (timestamp)
```

**payments**
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- invoice_id (uuid, FK to invoices)
- amount (numeric)
- payment_date (date)
- payment_method (text)
- status (text) - Lunas
- notes (text)
- created_at (timestamp)
```

**expenses**
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- expense_date (date)
- category (text)
- description (text)
- amount (numeric)
- payment_method (text)
- receipt_url (text)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)
```

**notifications**
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- message (text)
- type (text) - info, warning, success, error
- link (text, nullable)
- read (boolean)
- created_at (timestamp)
```

### 3.3 Performance Requirements

**Response Time**:
- Page load: < 2 seconds
- Search/Filter: < 500ms
- Form submission: < 1 second
- Dashboard data refresh: < 1 second

**Data Volume**:
- Support 10,000+ quotes per user
- Support 10,000+ invoices per user
- Support 100+ concurrent users

**Offline Support**:
- PWA dengan basic offline capability
- Cache dashboard data untuk offline viewing
- Queue form submissions untuk sync saat online

### 3.4 Security Requirements

**Authentication**:
- Email + Password login
- Password minimum 8 characters
- Session timeout after 24 hours of inactivity
- Remember me option (30 days)

**Authorization**:
- Row Level Security (RLS) di Supabase
- User hanya bisa akses data mereka sendiri
- Admin role untuk support (future)

**Data Protection**:
- HTTPS only
- Encrypted at rest (Supabase default)
- No sensitive data di localStorage
- Sanitize user input untuk prevent XSS

**Audit Trail**:
- Log all create/update/delete operations
- Track user who made changes
- Timestamp all operations

---

## 4. User Interface Requirements

### 4.1 Design Principles

**Mobile-First**:
- Semua fitur harus accessible di mobile
- Touch-friendly targets (min 44px)
- Swipe gestures untuk actions
- Bottom navigation untuk quick access

**Responsive Design**:
- Breakpoints: Mobile (<640px), Tablet (640-1024px), Desktop (>1024px)
- Adaptive layouts: cards on mobile, tables on desktop
- Progressive disclosure: show more info on larger screens

**Visual Hierarchy**:
- Primary actions prominent (large, colorful buttons)
- Secondary actions subtle (ghost buttons, icons)
- Danger actions require confirmation (delete, cancel)

**Accessibility**:
- WCAG 2.1 Level AA compliance
- Keyboard navigation support
- Screen reader friendly
- Color contrast ratio > 4.5:1
- Alt text untuk images

### 4.2 Color Palette

**Primary Colors**:
- Primary: Blue (#3B82F6) - untuk primary actions
- Success: Green (#10B981) - untuk positive states
- Warning: Amber (#F59E0B) - untuk warnings
- Danger: Red (#EF4444) - untuk destructive actions

**Neutral Colors**:
- Slate scale untuk text dan backgrounds
- White (#FFFFFF) untuk cards
- Gray shades untuk borders dan dividers

**Semantic Colors**:
- Draft: Gray (#64748B)
- Sent/Terkirim: Blue (#0EA5E9)
- Accepted/Diterima: Green (#16A34A)
- Rejected/Ditolak: Red (#DC2626)
- Paid/Lunas: Emerald (#059669)
- Overdue: Red with pulsing animation

### 4.3 Typography

**Font Family**:
- Primary: Inter (Google Fonts)
- Monospace: "Courier New" untuk currency

**Font Sizes**:
- Display: 3xl-5xl (headers)
- Title: xl-2xl (section titles)
- Body: sm-base (normal text)
- Caption: xs (labels, metadata)

**Font Weights**:
- Regular: 400 (body text)
- Medium: 500 (emphasis)
- Semibold: 600 (titles)
- Bold: 700 (headers)

### 4.4 Component Library

**Using Shadcn/ui**:
- Button (primary, secondary, outline, ghost, destructive)
- Card (for content containers)
- Dialog/Modal (for confirmations)
- Dropdown Menu (for actions)
- Form components (Input, Select, Textarea, Checkbox, Switch)
- Table (with sorting, filtering)
- Toast (for notifications)
- Badge (for status indicators)
- Progress Bar
- Calendar/Date Picker
- Tabs
- Skeleton (for loading states)

---

## 5. User Flows

### 5.1 Quote Creation Flow

1. User clicks "Buat Penawaran" dari dashboard
2. Form ditampilkan dengan fields kosong
3. User pilih/create klien
4. User add items:
   - Select dari master items (autocomplete)
   - Atau input manual (deskripsi, qty, price)
5. System auto-calculate totals
6. User add discount/tax (optional)
7. User review total
8. User choose action:
   - Save as Draft → Quote saved with status "Draft"
   - Send → Quote saved with status "Terkirim", email sent
9. Success message displayed
10. Redirect ke quote list atau detail

**Alternative Flows**:
- A1: User duplicate existing quote → pre-fill form with existing data
- A2: User save draft → can continue later from quote list

### 5.2 Quote to Invoice Flow

1. User open quote dengan status "Diterima" atau "Terkirim"
2. User click button "Buat Faktur" (prominent green button)
3. System create invoice draft dengan data dari quote:
   - Auto-generate invoice number
   - Copy klien info
   - Copy all items dengan prices
   - Copy discount dan tax
   - Set invoice date = today
   - Set due date = today + 30 days
4. Redirect ke invoice edit page
5. User dapat edit invoice jika perlu
6. User save/send invoice

**Alternative Flows**:
- A1: Quote expired → show error, cannot create invoice
- A2: Partial invoicing → user dapat adjust quantities

### 5.3 Invoice Payment Flow

1. User open invoice list
2. User lihat invoice dengan status "Terkirim"
3. User click button "Pelunasan" (green button with CheckCircle icon)
4. Confirmation dialog muncul: "Tandai faktur INV-XXX sebagai lunas?"
5. User confirm
6. System:
   - Update invoice status ke "Lunas"
   - Create payment record dengan:
     - Payment date = today
     - Amount = invoice total
     - Status = "Lunas"
   - Update stock if tracked
   - Send notification
7. Success toast: "Faktur berhasil ditandai lunas"
8. Invoice removed dari overdue list
9. Dashboard metrics updated

**Alternative Flows**:
- A1: User cancel confirmation → no changes
- A2: Partial payment (future) → record partial amount, status remains "Terkirim"

---

## 6. Non-Functional Requirements

### 6.1 Usability

**Learnability**:
- New user dapat create first quote dalam < 5 menit
- Onboarding tutorial untuk first-time users
- Contextual help tooltips
- Empty states dengan clear CTAs

**Efficiency**:
- Power users dapat create quote dalam < 2 menit
- Keyboard shortcuts untuk common actions
- Batch operations untuk bulk actions
- Templates untuk frequently used quotes

**Error Prevention**:
- Inline validation dengan clear error messages
- Confirmation dialogs untuk destructive actions
- Auto-save drafts untuk prevent data loss
- Undo capability untuk recent actions (optional)

### 6.2 Reliability

**Uptime**:
- Target: 99.9% uptime (leveraging Cloudflare Pages)
- Planned maintenance windows communicated in advance

**Data Integrity**:
- Transaction consistency untuk related records
- Foreign key constraints di database
- Backup daily (Supabase automatic)
- Point-in-time recovery capability

**Error Handling**:
- Graceful degradation saat service unavailable
- Retry mechanism untuk network failures
- Clear error messages untuk users
- Error logging untuk debugging

### 6.3 Scalability

**Horizontal Scaling**:
- Serverless architecture (Cloudflare Pages + Supabase)
- Auto-scaling based on traffic
- CDN untuk static assets

**Vertical Scaling**:
- Database optimization (indexes, query optimization)
- Lazy loading untuk large datasets
- Pagination untuk lists
- Virtual scrolling untuk very long lists

### 6.4 Maintainability

**Code Quality**:
- TypeScript untuk type safety
- ESLint + Prettier untuk code formatting
- Component-based architecture
- Separation of concerns (UI, business logic, data)

**Documentation**:
- Code comments untuk complex logic
- README dengan setup instructions
- API documentation untuk integrations
- User documentation/help center

**Testing**:
- Unit tests untuk business logic
- Integration tests untuk critical flows
- E2E tests untuk smoke testing
- Manual QA checklist

---

## 7. Roadmap & Prioritization

### Phase 1: MVP (Current - Completed)
**Timeline**: Completed
**Focus**: Core quote & invoice management

**Features**:
- ✅ Authentication (login, register)
- ✅ Dashboard with basic metrics
- ✅ Quote CRUD
- ✅ Invoice CRUD
- ✅ Quote to Invoice conversion
- ✅ Client management
- ✅ Basic reporting
- ✅ Payment recording (Pelunasan button)

### Phase 2: Enhanced Dashboard (Completed)
**Timeline**: Completed
**Focus**: AI-powered insights dan modern UI

**Features**:
- ✅ Business Health Score
- ✅ AI Business Insights
- ✅ Real-time system metrics
- ✅ Enhanced KPI cards
- ✅ Futuristic hero section
- ✅ Modern quick actions
- ✅ External data widgets (weather, crypto, market)

### Phase 3: Advanced Features (Next - 1-2 months)
**Timeline**: Q2 2026
**Focus**: Productivity & automation

**Features**:
- [ ] Email integration (send quotes/invoices)
- [ ] WhatsApp integration (reminders)
- [ ] Payment gateway integration
- [ ] Recurring invoices
- [ ] Invoice templates
- [ ] Multi-currency support
- [ ] Advanced reporting & analytics
- [ ] Export to accounting software
- [ ] Mobile app (React Native)

### Phase 4: Collaboration & Growth (3-4 months)
**Timeline**: Q3 2026
**Focus**: Multi-user & team features

**Features**:
- [ ] Team collaboration (multiple users per account)
- [ ] Role-based access control
- [ ] Client portal (view quotes/invoices, make payments)
- [ ] E-signature untuk quote approval
- [ ] Contract management
- [ ] Project management integration
- [ ] Time tracking integration
- [ ] API untuk third-party integrations

### Phase 5: Intelligence & Automation (6+ months)
**Timeline**: Q4 2026
**Focus**: Advanced AI & automation

**Features**:
- [ ] Predictive analytics (forecast revenue)
- [ ] Smart pricing recommendations
- [ ] Automated follow-ups
- [ ] Chatbot untuk customer service
- [ ] Document OCR (scan receipt → expense)
- [ ] Voice commands
- [ ] Advanced workflow automation
- [ ] Custom integrations via Zapier/Make

---

## 8. Success Criteria

### 8.1 Business Metrics

**Adoption**:
- [ ] 100 active users within 3 months of launch
- [ ] 500 active users within 6 months
- [ ] 70% monthly active users (MAU/total users)

**Engagement**:
- [ ] Average session duration > 5 minutes
- [ ] User creates 5+ quotes per month
- [ ] 60% quote to invoice conversion rate
- [ ] 40% users return daily

**Revenue** (if monetized):
- [ ] $10k MRR within 6 months
- [ ] $50k MRR within 12 months
- [ ] 80% customer retention rate
- [ ] < $50 CAC (Customer Acquisition Cost)

### 8.2 Product Metrics

**Performance**:
- [ ] Page load time < 2 seconds (P95)
- [ ] Dashboard load < 1 second
- [ ] 99.9% uptime
- [ ] < 0.1% error rate

**Quality**:
- [ ] Zero critical bugs in production
- [ ] < 5 minor bugs per release
- [ ] Customer satisfaction (CSAT) > 4.5/5
- [ ] Net Promoter Score (NPS) > 50

**Efficiency**:
- [ ] Time to create quote < 2 minutes
- [ ] 90% of quotes created on first try (no errors)
- [ ] 95% of invoices paid within 30 days
- [ ] 80% reduction in manual data entry

### 8.3 User Satisfaction

**Feedback Channels**:
- In-app feedback widget
- Email surveys (quarterly)
- User interviews (monthly)
- Support ticket analysis

**Target Scores**:
- Overall satisfaction: 4.5/5
- Ease of use: 4.7/5
- Feature completeness: 4.0/5
- Performance: 4.5/5
- Support quality: 4.8/5

---

## 9. Risk Assessment

### 9.1 Technical Risks

**Risk 1: Performance Degradation**
- **Impact**: High
- **Probability**: Medium
- **Mitigation**: 
  - Implement pagination early
  - Use indexes on frequently queried columns
  - Monitor query performance
  - Implement caching strategy

**Risk 2: Data Loss**
- **Impact**: Critical
- **Probability**: Low
- **Mitigation**:
  - Daily automated backups (Supabase)
  - Point-in-time recovery testing
  - User-initiated export functionality
  - Transaction logs

**Risk 3: Security Breach**
- **Impact**: Critical
- **Probability**: Low
- **Mitigation**:
  - RLS enforcement on all tables
  - Regular security audits
  - Input sanitization
  - HTTPS only
  - Rate limiting

### 9.2 Business Risks

**Risk 1: Low User Adoption**
- **Impact**: High
- **Probability**: Medium
- **Mitigation**:
  - User onboarding flow
  - Marketing strategy
  - Free tier to reduce barrier
  - Referral program

**Risk 2: Competitor with Better Features**
- **Impact**: High
- **Probability**: Medium
- **Mitigation**:
  - Rapid iteration based on feedback
  - Focus on unique value prop (AI insights)
  - Build switching costs (data lock-in)
  - Community building

**Risk 3: Scaling Costs**
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**:
  - Monitor usage metrics
  - Optimize expensive queries
  - Implement usage limits per tier
  - Negotiate volume pricing with Supabase

### 9.3 Operational Risks

**Risk 1: Key Person Dependency**
- **Impact**: High
- **Probability**: Medium
- **Mitigation**:
  - Documentation
  - Code review process
  - Knowledge sharing sessions
  - Backup developer

**Risk 2: Support Overload**
- **Impact**: Medium
- **Probability**: High
- **Mitigation**:
  - Comprehensive help documentation
  - Video tutorials
  - FAQ section
  - Chatbot for common questions
  - Community forum

---

## 10. Open Questions & Decisions Needed

### 10.1 Product Decisions

**Q1: Monetization Strategy**
- [ ] Freemium (free tier + paid tiers)?
- [ ] Free trial then paid?
- [ ] 100% free with optional paid features?
- [ ] Decision: TBD based on market research

**Q2: Multi-tenancy Model**
- [ ] Single user per account?
- [ ] Team collaboration from day 1?
- [ ] Start single-user, add teams later?
- [ ] Decision: Start single-user (MVP), add teams in Phase 4

**Q3: Email Sending**
- [ ] Integrate with SendGrid/Mailgun?
- [ ] Use Supabase Edge Functions?
- [ ] Let user use their own email?
- [ ] Decision: Phase 3 feature

### 10.2 Technical Decisions

**Q4: State Management**
- [ ] React Query only?
- [ ] Add Zustand for global state?
- [ ] Redux?
- [ ] Decision: React Query + Context API (current approach is working)

**Q5: Testing Strategy**
- [ ] Unit tests priority?
- [ ] E2E tests priority?
- [ ] Manual QA only for MVP?
- [ ] Decision: Manual QA for MVP, add automated tests in Phase 3

**Q6: Deployment Strategy**
- [ ] Continuous deployment on every push?
- [ ] Staged releases (dev → staging → production)?
- [ ] Feature flags untuk gradual rollout?
- [ ] Decision: Staged releases with Cloudflare Pages

---

## 11. Appendix

### 11.1 Glossary

- **Quote/Penawaran**: Dokumen yang dikirim ke klien berisi daftar produk/jasa dengan harga
- **Invoice/Faktur**: Dokumen tagihan yang mengiringi atau mengikuti pengiriman barang/jasa
- **Pelunasan**: Proses pencatatan pembayaran faktur
- **Business Health Score**: Skor 0-100 yang menilai kesehatan bisnis berdasarkan multiple metrics
- **Conversion Rate**: Persentase quote yang diubah menjadi invoice atau deal closed
- **Overdue**: Faktur yang melewati due date dan belum dibayar
- **COGs (Cost of Goods Sold)**: Harga pokok penjualan
- **Net Profit**: Laba bersih setelah dikurangi semua biaya

### 11.2 References

- Shadcn/ui Documentation: https://ui.shadcn.com/
- Supabase Documentation: https://supabase.com/docs
- Cloudflare Pages Documentation: https://developers.cloudflare.com/pages/
- React Query Documentation: https://tanstack.com/query/latest
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/

### 11.3 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-24 | AI Assistant | Initial PRD creation dengan semua fitur existing dan roadmap |

---

**Document Status**: ✅ Complete & Up-to-date
**Last Updated**: August 24, 2026
**Next Review**: Monthly or upon major feature releases
