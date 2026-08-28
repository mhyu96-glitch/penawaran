import { Link } from 'react-router-dom';
import { GlassCard } from '@/components/glass/GlassCard';
import { GlassButton } from '@/components/glass/GlassButton';
import { Sparkles, FileText, Receipt, LayoutDashboard } from 'lucide-react';

export default function GlassThemeHub() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060e20] via-[#0b1326] to-[#0a1628] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-12 h-12 text-accent-primary" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-tertiary bg-clip-text text-transparent">
              Glass Morphism Theme
            </h1>
          </div>
          <p className="text-xl text-text-secondary">
            Modern, Premium, Futuristic Design System
          </p>
          <p className="text-sm text-text-tertiary mt-2">
            QuoteApp Redesign - Phase 1-3 Complete
          </p>
        </div>

        {/* Status Banner */}
        <GlassCard variant="glow" glowColor="blue" className="mb-12 p-8">
          <div className="flex items-start gap-4">
            <div className="w-3 h-3 bg-accent-secondary rounded-full mt-2 animate-pulse"></div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                🎉 3 Pages Ready for Testing
              </h2>
              <p className="text-text-secondary mb-4">
                Dashboard, Quote List, dan Invoice List sudah selesai dibangun dengan glass morphism design.
                Klik tombol di bawah untuk mengakses masing-masing halaman.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="glass-light rounded-lg p-4">
                  <div className="text-text-tertiary mb-1">Build Status</div>
                  <div className="text-accent-secondary font-semibold">✓ Passed</div>
                </div>
                <div className="glass-light rounded-lg p-4">
                  <div className="text-text-tertiary mb-1">Bundle Size</div>
                  <div className="text-text-primary font-semibold">690 KB gzipped</div>
                </div>
                <div className="glass-light rounded-lg p-4">
                  <div className="text-text-tertiary mb-1">Progress</div>
                  <div className="text-accent-primary font-semibold">Phase 3/6 (45%)</div>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Pages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Dashboard Glass */}
          <GlassCard variant="medium" className="p-6 hover:scale-105 transition-transform">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center mb-4 border border-blue-500/30">
                <LayoutDashboard className="w-8 h-8 text-accent-primary" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Dashboard Glass
              </h3>
              <p className="text-sm text-text-secondary mb-6">
                Business Health Score, KPI Cards, AI Insights, Financial Chart, Quick Actions
              </p>
              <Link to="/dashboard-glass" className="w-full">
                <GlassButton variant="primary" size="lg" className="w-full">
                  Lihat Dashboard
                </GlassButton>
              </Link>
              <div className="mt-4 text-xs text-text-tertiary">
                756 lines • 6 components
              </div>
            </div>
          </GlassCard>

          {/* Quote List Glass */}
          <GlassCard variant="medium" className="p-6 hover:scale-105 transition-transform">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-4 border border-green-500/30">
                <FileText className="w-8 h-8 text-accent-secondary" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Quote List Glass
              </h3>
              <p className="text-sm text-text-secondary mb-6">
                Search & Filter, Sortable Table, Stats Cards, Action Menus, Duplicate & Convert
              </p>
              <Link to="/quotes-glass" className="w-full">
                <GlassButton variant="primary" size="lg" className="w-full">
                  Lihat Penawaran
                </GlassButton>
              </Link>
              <div className="mt-4 text-xs text-text-tertiary">
                650 lines • GlassTable component
              </div>
            </div>
          </GlassCard>

          {/* Invoice List Glass */}
          <GlassCard variant="medium" className="p-6 hover:scale-105 transition-transform">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 flex items-center justify-center mb-4 border border-yellow-500/30">
                <Receipt className="w-8 h-8 text-accent-tertiary" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Invoice List Glass
              </h3>
              <p className="text-sm text-text-secondary mb-6">
                Overdue Section (Pulsing), Pelunasan Button, Days Overdue, Search & Filter
              </p>
              <Link to="/invoices-glass" className="w-full">
                <GlassButton variant="primary" size="lg" className="w-full">
                  Lihat Faktur
                </GlassButton>
              </Link>
              <div className="mt-4 text-xs text-text-tertiary">
                772 lines • Payment dialog
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Features List */}
        <GlassCard variant="light" className="p-8 mb-12">
          <h3 className="text-2xl font-bold text-text-primary mb-6">
            ✨ Glass Morphism Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-accent-primary rounded-full mt-2"></div>
              <div>
                <div className="font-semibold text-text-primary">Frosted Glass Effect</div>
                <div className="text-sm text-text-secondary">Backdrop blur dengan transparency</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-accent-secondary rounded-full mt-2"></div>
              <div>
                <div className="font-semibold text-text-primary">Neon Accent Colors</div>
                <div className="text-sm text-text-secondary">Electric Blue, Mint Green, Warm Yellow</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-accent-tertiary rounded-full mt-2"></div>
              <div>
                <div className="font-semibold text-text-primary">Smooth Animations</div>
                <div className="text-sm text-text-secondary">Hover effects, transitions, micro-interactions</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-accent-primary rounded-full mt-2"></div>
              <div>
                <div className="font-semibold text-text-primary">Dark Theme Foundation</div>
                <div className="text-sm text-text-secondary">Premium feel dengan gradient backgrounds</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-accent-secondary rounded-full mt-2"></div>
              <div>
                <div className="font-semibold text-text-primary">TypeScript Support</div>
                <div className="text-sm text-text-secondary">Fully typed components dengan props</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-accent-tertiary rounded-full mt-2"></div>
              <div>
                <div className="font-semibold text-text-primary">Responsive Design</div>
                <div className="text-sm text-text-secondary">Mobile-optimized layouts</div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Next Steps */}
        <GlassCard variant="heavy" className="p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            🚀 Next Steps (Phase 4-6)
          </h3>
          <div className="space-y-3 text-text-secondary">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-sm">
                4
              </div>
              <div>
                <span className="font-semibold text-text-primary">Quote & Invoice Forms</span>
                <span className="text-sm ml-2">(6-8 hours)</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-secondary/20 flex items-center justify-center text-accent-secondary font-bold text-sm">
                5
              </div>
              <div>
                <span className="font-semibold text-text-primary">Additional Pages</span>
                <span className="text-sm ml-2">(Clients, Expenses, Reports, Calendar)</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-tertiary/20 flex items-center justify-center text-accent-tertiary font-bold text-sm">
                6
              </div>
              <div>
                <span className="font-semibold text-text-primary">Polish & Optimization</span>
                <span className="text-sm ml-2">(Testing, mobile, performance)</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Footer */}
        <div className="text-center mt-12 text-text-tertiary text-sm">
          <p>Built with React + TypeScript + Tailwind CSS</p>
          <p className="mt-1">Glass Morphism Design System v1.0</p>
        </div>
      </div>
    </div>
  );
}
