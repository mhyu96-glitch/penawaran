# Product Requirements Document (PRD)
# Glass Morphism Redesign - QuoteApp Modern UI Transformation

## Document Information

**Project Name**: QuoteApp Glass Morphism Redesign  
**Version**: 1.0  
**Date**: August 24, 2026  
**Status**: Approved - Ready for Implementation  
**Owner**: Product Team  
**Stakeholders**: Engineering, Design, Business

---

## 1. Executive Summary

### 1.1 Project Overview

QuoteApp akan menjalani transformasi visual total menuju **Glass Morphism Design System**, mengubah tampilan dari standard shadcn/ui theme menjadi modern, premium, dan futuristic interface dengan frosted glass effects, backdrop blur, dan neon accent colors.

### 1.2 Business Objectives

**Primary Goals**:
- Meningkatkan perceived value aplikasi sebagai premium business tool
- Membedakan QuoteApp dari kompetitor dengan unique visual identity
- Meningkatkan user engagement melalui modern, delightful interface
- Mempertahankan usability dan accessibility standards

**Success Metrics**:
- User satisfaction score: +20% (dari 4.2 → 5.0)
- Time on platform: +15%
- Quote/invoice creation rate: maintain atau improve
- User retention: +10%
- Mobile engagement: +25%

### 1.3 Target Release

**Phase 1 (MVP)**: 2 weeks - Core pages redesign  
**Phase 2**: 1 week - Forms and detail pages  
**Phase 3**: 1 week - Mobile optimization & polish  
**Total Timeline**: 4 weeks from kickoff to production

---

## 2. Design Vision & Principles

### 2.1 Design Philosophy

**"Premium Clarity with Futuristic Edge"**

QuoteApp Glass Morphism redesign akan mencerminkan:
- **Professional**: Business tool yang trustworthy dan reliable
- **Modern**: Cutting-edge design yang ahead of curve
- **Efficient**: Visual hierarchy yang clear, actions yang obvious
- **Delightful**: Subtle animations dan interactions yang engaging

### 2.2 Visual Language

**Glass Morphism Core Characteristics**:
1. **Frosted Glass Effect**: Semi-transparent backgrounds dengan backdrop blur
2. **Layered Depth**: Multiple glass layers untuk hierarchy
3. **Soft Glow**: Subtle neon glows untuk emphasis
4. **Material Borders**: Refined borders dengan transparency
5. **Dark Foundation**: Dark theme untuk premium feel

**Design Principles**:
- Clarity over decoration
- Consistency across all touchpoints
- Performance-conscious animations
- Accessibility-first approach
- Mobile-optimized interactions

### 2.3 Inspiration & References

**Stitch Designs Reference**:
- 14 screens telah di-design di Stitch platform
- 8 desktop screens + 6 mobile screens
- Glass Morphism v2 dan v3 variants
- Located in: `stitch-designs/` folder

---

## 3. Design System Specifications

### 3.1 Color Palette

#### Primary Colors (Dark Theme)
```css
/* Background Gradients */
--bg-primary: linear-gradient(135deg, #060e20 0%, #0b1326 100%);
--bg-secondary: linear-gradient(135deg, #0a1628 0%, #0f1b2e 100%);
--bg-tertiary: #121828;

/* Surface Colors (Glass) */
--glass-light: rgba(255, 255, 255, 0.05);
--glass-medium: rgba(255, 255, 255, 0.08);
--glass-heavy: rgba(255, 255, 255, 0.12);
--glass-ultra: rgba(255, 255, 255, 0.18);

/* Accent Colors (Neon) */
--accent-primary: #4b8eff;      /* Electric Blue */
--accent-secondary: #4edea3;    /* Mint Green */
--accent-tertiary: #ffdea4;     /* Warm Yellow */
--accent-error: #ffb4ab;        /* Soft Red */
--accent-warning: #ffb86c;      /* Orange */

/* Text Colors */
--text-primary: #e4ecfa;        /* Almost White */
--text-secondary: #a8b4ca;      /* Muted Blue-Gray */
--text-tertiary: #6b7893;       /* Dim Gray */
--text-accent: #4b8eff;         /* Accent Blue */

/* Border Colors */
--border-glass: rgba(218, 226, 253, 0.15);
--border-glow: rgba(173, 198, 255, 0.3);
--border-accent: rgba(75, 142, 255, 0.5);
```

#### Status Colors
```css
/* Quote/Invoice Status */
--status-draft: #64748b;        /* Gray */
--status-sent: #4b8eff;         /* Blue */
--status-accepted: #4edea3;     /* Green */
--status-rejected: #ffb4ab;     /* Red */
--status-paid: #22c55e;         /* Success Green */
--status-overdue: #ef4444;      /* Alert Red */
```

### 3.2 Typography

#### Font Families
```css
/* Primary Font: Inter */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Monospace: JetBrains Mono (for numbers, code) */
--font-mono: 'JetBrains Mono', 'Courier New', monospace;

/* Display: Inter with tight tracking */
--font-display: 'Inter', sans-serif;
```

#### Font Sizes & Line Heights
```css
/* Display (Hero, Headers) */
--text-5xl: 48px / 1.1;     /* letter-spacing: -0.02em */
--text-4xl: 40px / 1.2;     /* letter-spacing: -0.02em */
--text-3xl: 32px / 1.25;    /* letter-spacing: -0.015em */

/* Headings */
--text-2xl: 28px / 1.3;
--text-xl: 24px / 1.35;
--text-lg: 20px / 1.4;

/* Body */
--text-base: 16px / 1.5;
--text-sm: 14px / 1.5;
--text-xs: 12px / 1.5;

/* Micro (Labels) */
--text-2xs: 11px / 1.4;     /* letter-spacing: 0.08em, uppercase */
```

#### Font Weights
```css
--font-light: 300;
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;
```

### 3.3 Spacing System

```css
/* Base: 4px */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

### 3.4 Border Radius

```css
--radius-sm: 8px;       /* Inputs, small buttons */
--radius-md: 12px;      /* Buttons, badges */
--radius-lg: 16px;      /* Cards, panels */
--radius-xl: 20px;      /* Feature cards */
--radius-2xl: 24px;     /* Hero sections */
--radius-full: 9999px;  /* Pills, avatars */
```

### 3.5 Glass Effects

#### Backdrop Filters
```css
--blur-light: blur(8px);
--blur-medium: blur(12px);
--blur-heavy: blur(20px);
--blur-ultra: blur(24px);

/* Full Effect */
backdrop-filter: var(--blur-heavy) saturate(180%);
-webkit-backdrop-filter: var(--blur-heavy) saturate(180%);
```

#### Shadows
```css
/* Elevation Shadows */
--shadow-sm: 0 2px 8px 0 rgba(0, 0, 0, 0.12);
--shadow-md: 0 4px 16px 0 rgba(0, 0, 0, 0.16);
--shadow-lg: 0 8px 24px 0 rgba(0, 0, 0, 0.20);
--shadow-xl: 0 12px 32px 0 rgba(0, 0, 0, 0.24);

/* Glow Shadows (Accent) */
--glow-blue: 0 0 20px rgba(75, 142, 255, 0.4);
--glow-green: 0 0 20px rgba(78, 222, 163, 0.4);
--glow-yellow: 0 0 20px rgba(255, 222, 164, 0.4);

/* Glass Shadow */
--shadow-glass: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
```

### 3.6 Animation & Transitions

```css
/* Timing Functions */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in: cubic-bezier(0.7, 0, 0.84, 0);
--ease-in-out: cubic-bezier(0.87, 0, 0.13, 1);

/* Durations */
--duration-instant: 100ms;
--duration-fast: 200ms;
--duration-normal: 300ms;
--duration-slow: 400ms;
--duration-slower: 600ms;

/* Standard Transitions */
--transition-all: all var(--duration-normal) var(--ease-out);
--transition-transform: transform var(--duration-fast) var(--ease-out);
--transition-opacity: opacity var(--duration-normal) var(--ease-out);
```

#### Micro-interactions
```css
/* Hover States */
.glass-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl), var(--glow-blue);
  border-color: var(--border-glow);
}

/* Active States */
.glass-button:active {
  transform: scale(0.98);
}

/* Focus States */
.glass-input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(75, 142, 255, 0.2);
}
```

---

## 4. Component Specifications

### 4.1 Glass Card Component

**Component Name**: `GlassCard`

**Variants**:
- `light`: Subtle glass effect
- `medium`: Standard glass effect (default)
- `heavy`: Prominent glass effect
- `glow`: Glass with accent glow

**Props**:
```typescript
interface GlassCardProps {
  variant?: 'light' | 'medium' | 'heavy' | 'glow';
  glowColor?: 'blue' | 'green' | 'yellow';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  children: React.ReactNode;
}
```

**CSS Implementation**:
```css
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(218, 226, 253, 0.15);
  border-radius: 16px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.glass-card:hover {
  transform: translateY(-2px);
  border-color: rgba(173, 198, 255, 0.3);
  box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.45);
}

.glass-card-glow-blue {
  box-shadow: 
    0 8px 32px 0 rgba(31, 38, 135, 0.37),
    0 0 20px rgba(75, 142, 255, 0.4);
}
```

### 4.2 Glass Button Component

**Component Name**: `GlassButton`

**Variants**:
- `primary`: Solid with accent color
- `glass`: Transparent glass effect
- `outline`: Border only
- `ghost`: Minimal style

**Sizes**:
- `sm`: 32px height
- `md`: 40px height (default)
- `lg`: 48px height
- `xl`: 56px height

**Props**:
```typescript
interface GlassButtonProps {
  variant?: 'primary' | 'glass' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  glowing?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
```

**CSS Implementation**:
```css
/* Primary Button */
.glass-button-primary {
  background: linear-gradient(135deg, #4b8eff 0%, #3b6fd9 100%);
  border: 1px solid rgba(75, 142, 255, 0.5);
  color: white;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(75, 142, 255, 0.3);
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.glass-button-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(75, 142, 255, 0.4);
}

/* Glass Button */
.glass-button-glass {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(218, 226, 253, 0.15);
  color: var(--text-primary);
  font-weight: 500;
  padding: 12px 24px;
  border-radius: 12px;
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.glass-button-glass:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(173, 198, 255, 0.3);
  transform: scale(1.02);
}
```

### 4.3 Glass Input Component

**Component Name**: `GlassInput`

**Types**:
- `text`
- `number`
- `email`
- `password`
- `textarea`
- `select`

**Props**:
```typescript
interface GlassInputProps {
  type?: 'text' | 'number' | 'email' | 'password';
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
}
```

**CSS Implementation**:
```css
.glass-input {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(218, 226, 253, 0.15);
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--text-primary);
  font-size: 14px;
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.glass-input:focus {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(75, 142, 255, 0.2);
  outline: none;
}

.glass-input::placeholder {
  color: var(--text-tertiary);
}
```

### 4.4 Glass Badge Component

**Component Name**: `GlassBadge`

**Variants**:
- `draft`: Gray
- `sent`: Blue
- `accepted`: Green
- `rejected`: Red
- `paid`: Success green
- `overdue`: Alert red with pulse

**Props**:
```typescript
interface GlassBadgeProps {
  variant: 'draft' | 'sent' | 'accepted' | 'rejected' | 'paid' | 'overdue';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}
```

**CSS Implementation**:
```css
.glass-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  backdrop-filter: blur(8px);
}

.glass-badge-sent {
  background: rgba(75, 142, 255, 0.15);
  border: 1px solid rgba(75, 142, 255, 0.3);
  color: #4b8eff;
}

.glass-badge-paid {
  background: rgba(78, 222, 163, 0.15);
  border: 1px solid rgba(78, 222, 163, 0.3);
  color: #4edea3;
}

.glass-badge-overdue {
  background: rgba(255, 180, 171, 0.15);
  border: 1px solid rgba(255, 180, 171, 0.3);
  color: #ffb4ab;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
```

### 4.5 Glass Table Component

**Component Name**: `GlassTable`

**Features**:
- Frosted header with sticky positioning
- Glass row hover effects
- Sortable columns
- Selectable rows
- Responsive mobile cards

**Props**:
```typescript
interface GlassTableProps {
  columns: Column[];
  data: any[];
  sortable?: boolean;
  selectable?: boolean;
  onRowClick?: (row: any) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  loading?: boolean;
  emptyMessage?: string;
}
```

**CSS Implementation**:
```css
.glass-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.glass-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
}

.glass-table thead th {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(218, 226, 253, 0.15);
  padding: 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.glass-table tbody tr {
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(218, 226, 253, 0.08);
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.glass-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: scale(1.01);
  box-shadow: 0 4px 16px rgba(31, 38, 135, 0.2);
}

.glass-table tbody td {
  padding: 16px;
  color: var(--text-primary);
  font-size: 14px;
}
```

---

## 5. Page-Level Requirements

### 5.1 Dashboard Page

**Reference**: `stitch-designs/1-dashboard-glass-v2.html`

#### 5.1.1 Hero Section

**Components**:
- Large gradient background with animated particles (optional)
- Welcome message with user name
- Current date/time display
- Quick action CTAs (Buat Penawaran, Buat Faktur)

**Design Specs**:
```
Height: 320px (desktop), 240px (mobile)
Background: Gradient overlay on dark base
Padding: 64px 32px
Text: Display font, 48px headline
```

**Implementation Requirements**:
- Glassmorphic overlay dengan heavy blur
- Neon accent glow pada CTAs
- Smooth parallax effect on scroll (optional)
- Responsive text sizing

#### 5.1.2 Business Health Score Card

**Components**:
- Large score display (0-100)
- Circular progress indicator
- Status badge (Excellent/Good/Need Attention)
- Trend indicator (up/down/stable)
- Mini chart showing 7-day trend

**Design Specs**:
```
Card: Glass medium variant, 16px radius
Score: 56px font size, bold
Progress: 120px diameter circle
Badge: Dynamic color based on score
```

**Calculation Logic**:
```typescript
const calculateHealthScore = (metrics: {
  revenueAchievement: number;  // 0-1
  conversionRate: number;       // 0-1
  profitMargin: number;         // 0-1
  operationalHealth: number;    // 0-1 (penalties for overdue)
}) => {
  return Math.round(
    metrics.revenueAchievement * 30 +
    metrics.conversionRate * 25 +
    metrics.profitMargin * 25 +
    metrics.operationalHealth * 20
  );
};
```

#### 5.1.3 KPI Cards Grid

**Cards**:
1. Monthly Revenue
2. Profit Margin
3. Target Achievement
4. Pending Invoices
5. Quote Conversion
6. Overdue Count

**Design Specs per Card**:
```
Size: 280px × 160px (desktop)
Layout: 3 columns (desktop), 1-2 columns (mobile)
Background: Glass light variant
Icon: 32px, accent color
Value: 32px, bold
Label: 12px, uppercase, tertiary color
Change: 14px with arrow icon
```

**Hover Effects**:
- Scale: 1.03
- Glow: Accent color shadow
- Border: Brighter border color
- Lift: translateY(-4px)

#### 5.1.4 AI Business Insights

**Components**:
- Insight cards with icon, title, description
- Priority indicator (high/medium/low)
- Action button for each insight
- Auto-refresh every 5 minutes

**Insight Types**:
```typescript
type InsightType = 
  | 'revenue_target'
  | 'conversion_rate'
  | 'overdue_invoices'
  | 'profit_margin'
  | 'inventory_low'
  | 'client_followup';

interface Insight {
  type: InsightType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  icon: string;
}
```

**Design Specs**:
```
Card: Glass medium, 12px radius
Icon: 24px in accent color circle (48px)
Title: 16px, semibold
Description: 14px, secondary color
Action: Ghost button, 14px
```

#### 5.1.5 Financial Chart

**Chart Type**: Area chart with dual lines

**Data**:
- Revenue (green line)
- Expenses (red line)
- Net profit (calculated, shown in tooltip)
- Time range: Last 30 days (default)

**Design Specs**:
```
Container: Glass card, full width
Height: 400px
Grid: Subtle white lines (0.05 opacity)
Axes: Secondary text color
Tooltip: Glass card, 12px radius
Legend: Top right, glass badges
```

**Library**: Recharts with custom styling

**Configuration**:
```typescript
<AreaChart 
  data={chartData}
  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
>
  <defs>
    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#4edea3" stopOpacity={0.3}/>
      <stop offset="95%" stopColor="#4edea3" stopOpacity={0}/>
    </linearGradient>
  </defs>
  <Area 
    type="monotone" 
    dataKey="revenue" 
    stroke="#4edea3"
    strokeWidth={3}
    fill="url(#colorRevenue)" 
  />
</AreaChart>
```

#### 5.1.6 Quick Actions Grid

**Actions**:
1. Buat Penawaran (Blue gradient)
2. Buat Faktur (Green gradient)
3. Catat Expenses (Orange gradient)
4. Kelola Klien (Purple gradient)
5. Lihat Reports (Pink gradient)
6. Kelola Inventory (Indigo gradient)

**Design Specs per Action**:
```
Size: 180px × 180px (desktop), full width (mobile)
Layout: 6 columns (desktop), 2 columns (tablet), 1 column (mobile)
Background: Glass + gradient overlay
Icon: 48px Material Symbols Outlined
Label: 16px, medium weight
Badge: Notification count (top right)
```

**Hover Effects**:
```css
.quick-action:hover {
  transform: scale(1.05) translateY(-4px);
  box-shadow: 
    0 12px 32px rgba(31, 38, 135, 0.4),
    0 0 24px var(--accent-color);
}

.quick-action-icon {
  animation: bounce 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 5.2 Quote List Page

**Reference**: `stitch-designs/2-penawaran-glass-v2.html`

#### 5.2.1 Page Header

**Components**:
- Page title: "Penawaran"
- Search input (glass style)
- Filter dropdown (Status, Date Range, Client)
- Sort dropdown
- Primary CTA: "Buat Penawaran Baru"

**Layout**:
```
Desktop: Horizontal flexbox
  - Left: Title + subtitle
  - Center: Search bar (flex-grow)
  - Right: Filters + CTA

Mobile: Vertical stack
  - Title
  - Search (full width)
  - Filters row
  - CTA (full width)
```

#### 5.2.2 Quote Table/List

**Desktop View**: Glass table component

**Columns**:
1. Nomor Penawaran (sortable)
2. Tanggal (sortable, default desc)
3. Klien (searchable)
4. Total Amount (sortable, right-aligned)
5. Status (filterable, badge component)
6. Valid Until (sortable)
7. Actions (dropdown menu)

**Row Hover State**:
- Background: Lighter glass
- Scale: 1.01
- Shadow: Elevated
- Action menu: Visible

**Actions Menu**:
- View Details
- Edit
- Duplicate
- Create Invoice (if status = Diterima)
- Delete (if status = Draft)
- Send Reminder

**Mobile View**: Card list

**Card Design**:
```
Component: Glass card
Padding: 16px
Layout: Vertical stack
  - Row 1: Status badge + Amount
  - Row 2: Quote number + Date
  - Row 3: Client name
  - Row 4: Valid until + Action menu
```

**Swipe Actions**:
- Swipe left: Delete (red)
- Swipe right: Edit (blue)

#### 5.2.3 Empty State

**When**: No quotes exist

**Design**:
```
Container: Glass card, centered
Icon: 96px, muted color
Headline: "Belum ada penawaran"
Description: "Mulai dengan membuat penawaran pertama Anda"
CTA: "Buat Penawaran Baru" (large, primary)
```

#### 5.2.4 Filter Panel

**Filters**:
1. **Status**:
   - All
   - Draft
   - Terkirim
   - Diterima
   - Ditolak

2. **Date Range**:
   - Last 7 days
   - Last 30 days
   - Last 90 days
   - This month
   - Custom range (calendar picker)

3. **Client**: Multi-select dropdown

4. **Amount Range**: Min/max inputs

**Design**:
```
Container: Glass card, 320px width
Position: Slide-in from right (desktop) or bottom (mobile)
Backdrop: Dark overlay (0.5 opacity)
Apply button: Primary, full width
Reset button: Ghost, full width
```

### 5.3 Invoice List Page

**Reference**: `stitch-designs/8-faktur-glass-premium-v3.html`

**Similar to Quote List with additions**:

#### 5.3.1 Overdue Section

**Position**: Top of page, before regular table

**Design**:
```
Container: Glass card with red accent glow
Background: rgba(255, 180, 171, 0.1)
Border: Red glow (pulsing animation)
Icon: Alert triangle, 32px
Title: "Faktur Jatuh Tempo" + count badge
```

**Table Columns** (Overdue specific):
1. Invoice Number
2. Client
3. Amount
4. Due Date
5. Days Overdue (red, bold)
6. Quick Actions:
   - Send Reminder (ghost button)
   - Mark as Paid (primary button)

#### 5.3.2 Payment Button

**Component**: GlassButton with icon

**Design**:
```
Variant: Primary (green gradient)
Icon: CheckCircle (Material Symbols)
Label: "Pelunasan"
Size: md
Position: In actions column + dropdown menu
```

**Interaction**:
1. Click → Confirmation dialog
2. Dialog content:
   ```
   Title: "Konfirmasi Pelunasan"
   Message: "Tandai faktur INV-20260824-001 sebagai lunas?"
   Amount: Rp 15,500,000 (large, bold)
   Actions:
     - Cancel (ghost)
     - Confirm (primary, green)
   ```
3. On confirm:
   - Show loading state (spinner in button)
   - API call to mark as paid
   - Success toast
   - Remove from overdue list
   - Update dashboard metrics
   - Confetti animation (optional)

### 5.4 Quote/Invoice Form Page

#### 5.4.1 Form Layout

**Container**: Large glass card, centered, max-width 1200px

**Sections**:
1. **Header**
   - Page title
   - Document number (auto-generated, readonly)
   - Status indicator
   - Action buttons (Save Draft, Send)

2. **Client Information**
   - Client selector (searchable dropdown)
   - Or "Add New Client" inline form
   - Display: Company name, contact, address

3. **Document Details**
   - Date picker
   - Valid Until / Due Date picker
   - Payment terms (for invoice)

4. **Items Table**
   - Description (autocomplete from master items)
   - Quantity (number input)
   - Unit (text input)
   - Unit Price (currency input)
   - Cost Price (currency input, for profit calc)
   - Total (calculated, readonly)
   - Actions: Remove row

   - Add Item button (below table)

5. **Calculations**
   - Subtotal (calculated)
   - Discount (input: Rp or %)
   - Tax (input: Rp or %)
   - Grand Total (calculated, large, bold)

6. **Additional**
   - Terms & Conditions (rich text editor)
   - Notes (textarea)

7. **Footer**
   - Cancel button (ghost)
   - Save as Draft (glass)
   - Send/Create (primary)

**Design Specs**:
```
Form inputs: Glass input component
Spacing between sections: 32px
Input height: 40px
Table row height: 56px
Footer height: 80px (sticky)
```

#### 5.4.2 Real-time Calculations

**Logic**:
```typescript
const calculateTotals = (items: Item[], discount: Discount, tax: Tax) => {
  // Subtotal
  const subtotal = items.reduce((sum, item) => 
    sum + (item.quantity * item.unitPrice), 0
  );

  // Discount
  const discountAmount = discount.type === 'percentage' 
    ? subtotal * (discount.value / 100)
    : discount.value;

  // After discount
  const afterDiscount = subtotal - discountAmount;

  // Tax
  const taxAmount = tax.type === 'percentage'
    ? afterDiscount * (tax.value / 100)
    : tax.value;

  // Grand total
  const grandTotal = afterDiscount + taxAmount;

  // Profit (if cost prices provided)
  const totalCost = items.reduce((sum, item) => 
    sum + (item.quantity * (item.costPrice || 0)), 0
  );
  const profit = grandTotal - totalCost;
  const profitMargin = (profit / grandTotal) * 100;

  return {
    subtotal,
    discountAmount,
    afterDiscount,
    taxAmount,
    grandTotal,
    profit,
    profitMargin
  };
};
```

**Display**: Update totals instantly as user types

### 5.5 Client List Page

**Reference**: `stitch-designs/6-klien-glass-v2.html`

#### 5.5.1 Client Cards Grid

**Layout**:
```
Desktop: 3 columns
Tablet: 2 columns
Mobile: 1 column
Gap: 24px
```

**Card Design**:
```
Component: Glass card
Padding: 24px
Hover: Scale 1.02, glow effect

Content:
  - Company logo or avatar (64px circle)
  - Company name (20px, bold)
  - Contact person (14px, secondary)
  - Email + Phone (12px, with icons)
  - Tags (glass badges)
  - Metrics row:
    - Total Quotes
    - Total Invoices
    - Total Revenue
  - Actions: View, Edit, Delete
```

#### 5.5.2 Client Quick Add

**Trigger**: Button in page header

**Modal Design**:
```
Component: Glass dialog
Size: 600px width
Backdrop: Dark blur

Fields:
  - Company Name (required)
  - Contact Person
  - Email
  - Phone
  - Address (textarea)
  - Tax ID (NPWP)
  - Tags (multi-input)

Actions:
  - Cancel (ghost)
  - Add Client (primary)
```

### 5.6 Expense List Page

**Reference**: `stitch-designs/5-pengeluaran-glass-v2.html`

#### 5.6.1 Expense Timeline View

**Layout**: Vertical timeline with glass cards

**Design**:
```
Timeline line: 2px, glass border color
Date markers: Glass circles, 24px
Expense cards: Floating glass cards, offset from timeline

Card content:
  - Category badge (top right)
  - Description (16px, semibold)
  - Amount (24px, bold, right-aligned)
  - Payment method (with icon)
  - Receipt thumbnail (if available)
  - Actions: Edit, Delete
```

**Group By**: Date (Today, Yesterday, This Week, Earlier)

#### 5.6.2 Expense Quick Add

**Position**: FAB (Floating Action Button) - bottom right

**Design**:
```
Button: 56px circle, primary gradient, glow shadow
Icon: Plus, 24px
Position: Fixed, bottom 24px, right 24px
Z-index: 50

Mobile: Bottom navigation bar integration
```

**Form** (Slide-up drawer):
```
Fields:
  - Date (default: today)
  - Category (dropdown)
  - Description
  - Amount
  - Payment Method
  - Receipt Photo (camera or upload)
  - Notes

Actions:
  - Cancel
  - Add Expense
```

### 5.7 Reports Page

**Reference**: `stitch-designs/3-laporan-glass-v2.html`

#### 5.7.1 Report Type Selector

**Types**:
1. Profit & Loss
2. Sales Report
3. Outstanding Report
4. Expense Report
5. Client Analysis

**Design**: Tab navigation with glass effect

#### 5.7.2 Date Range Picker

**Presets**:
- This Month
- Last Month
- This Quarter
- Last Quarter
- This Year
- Custom Range

**Design**: Glass dropdown with calendar

#### 5.7.3 Report Cards

**Metrics Grid**: Similar to dashboard KPIs

**Charts**:
- Profit & Loss: Stacked bar chart
- Sales: Line chart with trend
- Outstanding: Pie chart (aging buckets)
- Expense: Donut chart (by category)

**Table**: Detailed transactions list

**Export Actions**:
- Export to PDF
- Export to Excel
- Print

### 5.8 Calendar/Project View

**Reference**: `stitch-designs/7-kalender-proyek-glass-v3.html`

#### 5.8.1 Calendar Component

**Library**: React Big Calendar (styled with glass theme)

**Views**:
- Month
- Week
- Day
- Agenda

**Event Types**:
- Quote Valid Until (blue)
- Invoice Due Date (orange)
- Payment Received (green)
- Project Milestone (purple)

**Design**:
```
Container: Glass card
Event cards: Mini glass badges with glow
Today highlight: Accent border
Selected day: Accent background
```

#### 5.8.2 Event Details

**Trigger**: Click on calendar event

**Popover Design**:
```
Component: Glass popover
Position: Near clicked event
Width: 320px

Content:
  - Event type badge
  - Title
  - Date/time
  - Amount (if applicable)
  - Client name
  - Status
  - Quick actions:
    - View details
    - Mark as paid (if invoice)
    - Send reminder
```

---

## 6. Mobile-Specific Requirements

### 6.1 Mobile Navigation

**Type**: Bottom Tab Bar

**Tabs**:
1. Dashboard (Home icon)
2. Quotes (Document icon)
3. Invoices (Receipt icon)
4. More (Menu icon)

**Design**:
```
Component: Glass bar, fixed bottom
Height: 64px
Background: rgba(255, 255, 255, 0.12)
Backdrop blur: Heavy
Border top: Glass border

Active tab:
  - Icon: Accent color with glow
  - Label: Visible, accent color
  - Indicator: Top border (2px, accent)

Inactive tab:
  - Icon: Secondary color
  - Label: Hidden or muted
```

### 6.2 Mobile Headers

**Design**:
```
Height: 56px
Background: Glass with blur
Position: Sticky top
Border bottom: Glass border

Content:
  - Left: Back button (if not root)
  - Center: Page title
  - Right: Actions (icon buttons)
```

### 6.3 Mobile Gestures

**Implemented**:
- Swipe left on list items: Delete
- Swipe right on list items: Edit/View
- Pull to refresh: Update data
- Swipe down: Dismiss modals
- Long press: Context menu

### 6.4 Mobile Screens Reference

**Files**:
- `stitch-designs/9-invoices-glass-mobile.html`
- `stitch-designs/10-calendar-glass-mobile.html`
- `stitch-designs/11-dashboard-glass-mobile.html`
- `stitch-designs/12-clients-glass-mobile.html`
- `stitch-designs/13-projects-glass-mobile.html`
- `stitch-designs/14-reports-glass-mobile.html`

**Key Differences from Desktop**:
- Single column layouts
- Larger touch targets (min 44px)
- Bottom sheets instead of modals
- Collapsible sections
- Simpler charts (fewer data points)
- FAB for primary actions
- Bottom navigation

---

## 7. Technical Implementation

### 7.1 Technology Stack

**Current**:
- React 18.3+
- TypeScript
- Vite
- Tailwind CSS
- Shadcn/ui
- Supabase

**Additions for Glass Morphism**:
- Custom Tailwind plugins for glass effects
- CSS custom properties for theming
- Framer Motion for advanced animations (optional)
- React Spring for micro-interactions (optional)

### 7.2 Tailwind Configuration

**File**: `tailwind.config.ts`

**Additions**:
```typescript
export default {
  theme: {
    extend: {
      colors: {
        // Glass Morphism Palette
        glass: {
          light: 'rgba(255, 255, 255, 0.05)',
          medium: 'rgba(255, 255, 255, 0.08)',
          heavy: 'rgba(255, 255, 255, 0.12)',
          ultra: 'rgba(255, 255, 255, 0.18)',
        },
        accent: {
          primary: '#4b8eff',
          secondary: '#4edea3',
          tertiary: '#ffdea4',
          error: '#ffb4ab',
          warning: '#ffb86c',
        },
        status: {
          draft: '#64748b',
          sent: '#4b8eff',
          accepted: '#4edea3',
          rejected: '#ffb4ab',
          paid: '#22c55e',
          overdue: '#ef4444',
        }
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '20px',
        xl: '24px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glow-blue': '0 0 20px rgba(75, 142, 255, 0.4)',
        'glow-green': '0 0 20px rgba(78, 222, 163, 0.4)',
        'glow-yellow': '0 0 20px rgba(255, 222, 164, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        }
      }
    }
  },
  plugins: [
    // Custom plugin for glass utilities
    require('./tailwind-glass-plugin'),
  ]
};
```

### 7.3 Custom Tailwind Plugin

**File**: `tailwind-glass-plugin.js`

```javascript
const plugin = require('tailwindcss/plugin');

module.exports = plugin(function({ addUtilities, theme }) {
  const glassUtilities = {
    '.glass-light': {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(8px) saturate(180%)',
      WebkitBackdropFilter: 'blur(8px) saturate(180%)',
      border: '1px solid rgba(218, 226, 253, 0.15)',
    },
    '.glass-medium': {
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      border: '1px solid rgba(218, 226, 253, 0.15)',
    },
    '.glass-heavy': {
      background: 'rgba(255, 255, 255, 0.12)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '1px solid rgba(218, 226, 253, 0.15)',
    },
    '.glass-ultra': {
      background: 'rgba(255, 255, 255, 0.18)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid rgba(218, 226, 253, 0.2)',
    }
  };

  addUtilities(glassUtilities);
});
```

### 7.4 Component Architecture

**Directory Structure**:
```
src/
  components/
    glass/
      GlassCard.tsx
      GlassButton.tsx
      GlassInput.tsx
      GlassBadge.tsx
      GlassTable.tsx
      GlassModal.tsx
      GlassDropdown.tsx
      index.ts
    
    ui/
      (existing shadcn components - keep for compatibility)
    
    dashboard/
      (dashboard-specific components)
    
    quotes/
      (quote-related components)
    
    invoices/
      (invoice-related components)
  
  styles/
    glass-theme.css
    animations.css
```

### 7.5 CSS Global Styles

**File**: `src/styles/glass-theme.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  /* Color Tokens */
  --bg-primary: linear-gradient(135deg, #060e20 0%, #0b1326 100%);
  --bg-secondary: linear-gradient(135deg, #0a1628 0%, #0f1b2e 100%);
  
  --glass-light: rgba(255, 255, 255, 0.05);
  --glass-medium: rgba(255, 255, 255, 0.08);
  --glass-heavy: rgba(255, 255, 255, 0.12);
  --glass-ultra: rgba(255, 255, 255, 0.18);
  
  --accent-primary: #4b8eff;
  --accent-secondary: #4edea3;
  --accent-tertiary: #ffdea4;
  --accent-error: #ffb4ab;
  --accent-warning: #ffb86c;
  
  --text-primary: #e4ecfa;
  --text-secondary: #a8b4ca;
  --text-tertiary: #6b7893;
  
  --border-glass: rgba(218, 226, 253, 0.15);
  --border-glow: rgba(173, 198, 255, 0.3);
  
  /* Shadows */
  --shadow-glass: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  --glow-blue: 0 0 20px rgba(75, 142, 255, 0.4);
  --glow-green: 0 0 20px rgba(78, 222, 163, 0.4);
  
  /* Typography */
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-primary);
  background: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.03);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.18);
}

/* Selection */
::selection {
  background: rgba(75, 142, 255, 0.3);
  color: var(--text-primary);
}

/* Focus Visible */
*:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

### 7.6 Performance Considerations

**Backdrop Filter Support**:
```css
/* Fallback for browsers without backdrop-filter support */
@supports not (backdrop-filter: blur(20px)) {
  .glass-card {
    background: rgba(255, 255, 255, 0.15);
    /* No blur, just semi-transparent */
  }
}
```

**Browser Support**:
- Chrome 76+
- Edge 79+
- Safari 9+ (with -webkit prefix)
- Firefox 103+
- Mobile Safari 9+
- Chrome Android 76+

**Performance Optimizations**:
1. Use `will-change: transform` sparingly
2. Limit backdrop-filter usage to visible elements
3. Use CSS containment: `contain: layout style paint`
4. Debounce scroll/resize listeners
5. Lazy load chart components
6. Virtual scrolling for long lists

### 7.7 Accessibility Requirements

**WCAG 2.1 Level AA Compliance**:

**Color Contrast**:
- Text on glass backgrounds: Minimum 4.5:1 ratio
- Large text (18px+): Minimum 3:1 ratio
- UI components: Minimum 3:1 ratio

**Keyboard Navigation**:
- All interactive elements focusable
- Logical tab order
- Visible focus indicators
- Keyboard shortcuts documented

**Screen Readers**:
- Semantic HTML (nav, main, article, etc)
- ARIA labels for icon buttons
- ARIA live regions for dynamic content
- Alt text for images

**Motion**:
- Respect prefers-reduced-motion
- Disable animations if requested
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Testing**:
- Lighthouse audit score: 90+
- axe DevTools: Zero violations
- Manual keyboard testing
- Screen reader testing (NVDA, JAWS, VoiceOver)

---

## 8. Migration Strategy

### 8.1 Phased Rollout

**Phase 1: Foundation (Week 1)**
- ✅ Setup glass theme system
- ✅ Create glass component library
- ✅ Update global styles
- ✅ Implement dark theme base

**Phase 2: Core Pages (Week 2)**
- Dashboard redesign
- Quote list redesign
- Invoice list redesign
- Test and iterate

**Phase 3: Forms & Details (Week 3)**
- Quote form redesign
- Invoice form redesign
- Client management redesign
- Expense tracking redesign

**Phase 4: Polish & Mobile (Week 4)**
- Mobile optimization
- Animation refinements
- Performance optimization
- Accessibility audit
- Cross-browser testing
- User acceptance testing

### 8.2 Rollback Plan

**Feature Flag**:
```typescript
// In environment config
const GLASS_THEME_ENABLED = import.meta.env.VITE_GLASS_THEME === 'true';

// In component
const theme = GLASS_THEME_ENABLED ? 'glass' : 'default';
```

**Theme Toggle** (for testing):
```typescript
// Allow users to switch between themes
const [theme, setTheme] = useLocalStorage('ui-theme', 'glass');

// Apply theme class to root
<div className={`app-container theme-${theme}`}>
```

### 8.3 Data Migration

**No data migration required** - This is purely a UI/UX redesign.

---

## 9. Testing Strategy

### 9.1 Visual Regression Testing

**Tool**: Percy or Chromatic

**Test Cases**:
- All pages in desktop viewport (1920×1080)
- All pages in tablet viewport (768×1024)
- All pages in mobile viewport (375×667)
- All component states (default, hover, focus, active, disabled)
- Light/dark mode (if applicable)

### 9.2 Cross-Browser Testing

**Browsers**:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile Safari (iOS 15+)
- Chrome Android (latest)

**Test Matrix**:
| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Backdrop filter | ✓ | ✓ | ✓ | ✓ |
| Glassmorphism | ✓ | ✓ | ✓ | ✓ |
| Animations | ✓ | ✓ | ✓ | ✓ |
| Responsive | ✓ | ✓ | ✓ | ✓ |

### 9.3 Performance Testing

**Metrics**:
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.5s
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms

**Tools**:
- Lighthouse CI
- WebPageTest
- Chrome DevTools Performance

### 9.4 Accessibility Testing

**Tools**:
- axe DevTools
- WAVE
- Lighthouse Accessibility
- Manual keyboard testing
- Screen reader testing

**Checklist**:
- [ ] All images have alt text
- [ ] All buttons have accessible labels
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] ARIA labels correct
- [ ] Heading hierarchy logical
- [ ] Forms have labels
- [ ] Error messages clear

### 9.5 User Acceptance Testing

**Test Users**: 5-10 existing users

**Scenarios**:
1. Create new quote
2. Convert quote to invoice
3. Mark invoice as paid
4. Add new client
5. Record expense
6. View reports
7. Mobile: All above scenarios

**Feedback Collection**:
- System Usability Scale (SUS) questionnaire
- Task completion rate
- Time on task
- Error rate
- Satisfaction rating
- Open feedback

---

## 10. Success Metrics & KPIs

### 10.1 Product Metrics

**Engagement**:
- Session duration: Target +15%
- Pages per session: Target +10%
- Return rate: Target +20%
- Feature adoption: Track glass-specific feature usage

**Performance**:
- Page load time: < 2s
- Interaction response: < 100ms
- Smooth animations: 60 FPS
- Zero layout shift

**Quality**:
- Bug rate: < 1 bug per 100 sessions
- Error rate: < 0.5%
- Crash rate: < 0.1%

### 10.2 Business Metrics

**User Satisfaction**:
- CSAT score: Target 4.5+/5.0
- NPS: Target 50+
- Feature satisfaction: Track specifically for redesign

**Retention**:
- Day 1 retention: Target 70%
- Day 7 retention: Target 50%
- Day 30 retention: Target 30%

**Conversion** (if freemium model):
- Trial to paid: Track impact
- Feature engagement: Premium features usage

### 10.3 Success Criteria

**Must Have** (Go/No-Go):
- [ ] All core pages redesigned
- [ ] Zero critical bugs
- [ ] Performance metrics met
- [ ] Accessibility WCAG AA compliant
- [ ] Cross-browser compatible
- [ ] Mobile responsive

**Nice to Have**:
- [ ] Advanced animations
- [ ] Particle effects
- [ ] Easter eggs
- [ ] Theme variations

---

## 11. Risks & Mitigations

### 11.1 Technical Risks

**Risk**: Backdrop-filter performance on low-end devices

**Mitigation**:
- Performance testing on mid-range devices
- Fallback to solid backgrounds on poor performance
- GPU acceleration hints: `transform: translateZ(0)`

**Risk**: Browser compatibility issues

**Mitigation**:
- Comprehensive cross-browser testing
- Fallback styles for unsupported features
- Progressive enhancement approach

**Risk**: Increased bundle size

**Mitigation**:
- Code splitting by route
- Lazy load heavy components
- Optimize assets (images, fonts)
- Tree shaking unused code

### 11.2 UX Risks

**Risk**: Users dislike dramatic visual change

**Mitigation**:
- Gradual rollout with feature flag
- User preview/opt-in period
- Collect feedback early
- Option to revert (temporary)

**Risk**: Reduced readability with glass effects

**Mitigation**:
- Extensive contrast testing
- User testing with various lighting conditions
- Adjustable opacity (future feature)

**Risk**: Confusion with new layouts

**Mitigation**:
- Maintain familiar navigation patterns
- Keep core workflows unchanged
- Provide onboarding tooltips
- Create "What's New" guide

### 11.3 Business Risks

**Risk**: Development takes longer than planned

**Mitigation**:
- Phased rollout allows partial delivery
- MVP focus on core pages
- Buffer time in schedule

**Risk**: User churn due to change

**Mitigation**:
- Communication campaign before launch
- Highlight benefits clearly
- Provide support resources
- Monitor metrics closely post-launch

---

## 12. Launch Plan

### 12.1 Pre-Launch (1 week before)

**Activities**:
- [ ] Beta testing with select users
- [ ] Final QA and bug fixes
- [ ] Performance optimization
- [ ] Documentation update
- [ ] Support team training
- [ ] Marketing materials prepared

**Communication**:
- Email to all users: "Exciting redesign coming"
- Blog post: "Behind the scenes" of redesign
- Social media teasers
- In-app announcement banner

### 12.2 Launch Day

**Rollout**:
- Deploy to production (feature flag enabled)
- Enable for 10% of users (canary)
- Monitor error rates and performance
- If stable, ramp to 50% after 4 hours
- Full rollout after 24 hours if no issues

**Monitoring**:
- Real-time error tracking (Sentry)
- Performance monitoring (Web Vitals)
- User feedback collection
- Support ticket monitoring

### 12.3 Post-Launch (First week)

**Activities**:
- Daily metric reviews
- Bug fix deployments
- User feedback analysis
- Performance optimization
- Documentation updates based on questions

**Communication**:
- "Thank you" email to beta testers
- "What's New" guide in app
- Tutorial videos
- FAQ updates

### 12.4 Post-Launch (First month)

**Activities**:
- A/B test refinements
- Feature iteration based on feedback
- Performance improvements
- Accessibility enhancements
- Mobile optimization

**Review**:
- Compare metrics to baseline
- User satisfaction survey
- Stakeholder presentation
- Retrospective meeting
- Plan Phase 2 enhancements

---

## 13. Documentation Requirements

### 13.1 Developer Documentation

**Topics**:
1. Glass component library usage
2. Theme customization guide
3. Adding new glass components
4. Animation guidelines
5. Performance best practices
6. Troubleshooting common issues

**Location**: `/docs/glass-design-system.md`

### 13.2 Designer Documentation

**Topics**:
1. Design token reference
2. Component specifications
3. Layout patterns
4. Accessibility guidelines
5. Figma/Stitch integration

**Location**: `/docs/design-guidelines.md`

### 13.3 User Documentation

**Topics**:
1. What's new guide
2. Feature highlights
3. Navigation changes
4. FAQ
5. Video tutorials

**Location**: In-app help center

---

## 14. Appendix

### 14.1 Reference Materials

**Stitch Design Files**:
- Located in: `d:\penawaran-2\stitch-designs\`
- 14 screens total (8 desktop + 6 mobile)
- Glass Morphism v2 and v3 variants

**Design Inspiration**:
- Glassmorphism.com
- Dribbble: Glass morphism tag
- Behance: Glassmorphism projects

**Technical References**:
- MDN: backdrop-filter
- CSS-Tricks: Glassmorphism guide
- WebKit: Backdrop filter blog post

### 14.2 Glossary

**Glassmorphism**: Design trend featuring frosted glass effects with transparency, blur, and subtle shadows

**Backdrop Filter**: CSS property that applies blur and other effects to the area behind an element

**Neon Accent**: Bright, saturated colors used for emphasis and CTAs

**KPI Card**: Key Performance Indicator display component

**Hero Section**: Large, prominent section at the top of a page

**CTA**: Call To Action - Button or link encouraging user action

**RLS**: Row Level Security - Database security feature

---

## 15. Approval & Sign-off

### 15.1 Stakeholder Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Engineering Lead | | | |
| Design Lead | | | |
| Business Stakeholder | | | |

### 15.2 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-24 | Product Team | Initial PRD creation |

---

**Document Status**: ✅ Approved - Ready for Implementation  
**Next Review Date**: 2026-09-24  
**Questions?** Contact: product@quoteapp.com

---

*This PRD is a living document and will be updated as the project progresses.*
