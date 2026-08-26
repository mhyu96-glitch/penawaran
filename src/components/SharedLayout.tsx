import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  AreaChart,
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  CircleUser,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Receipt,
  Repeat,
  Search,
  Settings,
  TrendingUp,
  User,
  Users,
  Wallet,
  Wand2,
  Menu,
  X,
  Sparkles,
  ArrowUpRight,
  Shield,
  Layers,
  CheckSquare,
  ChevronUp,
  Grid
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import NotificationBell from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { GlobalSearch } from './GlobalSearch';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const SharedLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Sidebar state for desktop
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('quoteapp-sidebar-collapsed') === 'true';
  });

  // Mobile Quick Action Sheet State
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  // Mobile All Menus Sheet State
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('quoteapp-sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isActive = (to: string, exact = false) => {
    if (exact) return location.pathname === to;
    if (to === '/invoices' && location.pathname.startsWith('/invoices/recurring')) return false;
    const activeAliases: Record<string, string[]> = {
      '/quotes': ['/quote/'],
      '/invoices': ['/invoice/'],
      '/clients': ['/client/'],
      '/projects': ['/project/'],
    };
    if (activeAliases[to]?.some((alias) => location.pathname.startsWith(alias))) return true;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  // 9 Essential Modules for the Quick Hub Modal
  const allHubModules = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: 'Command Center', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
    { to: '/quotes', icon: FileText, label: 'Penawaran', desc: 'Proposal Harga', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
    { to: '/invoices', icon: Receipt, label: 'Faktur', desc: 'Tagihan & Kas', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    { to: '/clients', icon: Users, label: 'Klien', desc: 'CRM & Riwayat', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
    { to: '/projects', icon: FolderKanban, label: 'Proyek', desc: 'Task & Progres', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    { to: '/calendar', icon: Calendar, label: 'Kalender', desc: 'Jatuh Tempo & Agenda', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
    { to: '/expenses', icon: Wallet, label: 'Pengeluaran', desc: 'Catat Biaya Beban', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
    { to: '/items', icon: Package, label: 'Barang & Jasa', desc: 'Katalog & Stok', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
    { to: '/reports', icon: AreaChart, label: 'Laporan Keuangan', desc: 'Finansial 360°', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    { to: '/reports/profit-loss', icon: BarChart3, label: 'Laba Rugi', desc: 'Income Statement', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
    { to: '/reports/profitability', icon: TrendingUp, label: 'Profitabilitas', desc: 'Analisis Margin', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    { to: '/automation', icon: Wand2, label: 'Otomatisasi AI', desc: 'Smart Workflows', color: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20' },
  ];

  const navGroups = [
    {
      label: 'Utama',
      items: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true, color: 'text-teal-500 dark:text-teal-400', activeBg: 'bg-teal-500/10' },
        { to: '/quotes', icon: FileText, label: 'Penawaran', color: 'text-sky-500 dark:text-sky-400', activeBg: 'bg-sky-500/10' },
        { to: '/invoices', icon: Receipt, label: 'Faktur', color: 'text-emerald-500 dark:text-emerald-400', activeBg: 'bg-emerald-500/10' },
        { to: '/invoices/recurring', icon: Repeat, label: 'Faktur Berulang', tag: 'Auto', color: 'text-cyan-500 dark:text-cyan-400', activeBg: 'bg-cyan-500/10' },
      ],
    },
    {
      label: 'Operasional',
      items: [
        { to: '/clients', icon: Users, label: 'Klien', color: 'text-violet-500 dark:text-violet-400', activeBg: 'bg-violet-500/10' },
        { to: '/projects', icon: FolderKanban, label: 'Proyek', color: 'text-amber-500 dark:text-amber-400', activeBg: 'bg-amber-500/10' },
        { to: '/calendar', icon: Calendar, label: 'Kalender', exact: true, color: 'text-orange-500 dark:text-orange-400', activeBg: 'bg-orange-500/10' },
        { to: '/items', icon: Package, label: 'Barang & Jasa', exact: true, color: 'text-indigo-500 dark:text-indigo-400', activeBg: 'bg-indigo-500/10' },
      ],
    },
    {
      label: 'Keuangan',
      items: [
        { to: '/expenses', icon: Wallet, label: 'Pengeluaran', color: 'text-rose-500 dark:text-rose-400', activeBg: 'bg-rose-500/10' },
        { to: '/reports', icon: AreaChart, label: 'Laporan Keuangan', exact: true, color: 'text-blue-500 dark:text-blue-400', activeBg: 'bg-blue-500/10' },
        { to: '/reports/profitability', icon: TrendingUp, label: 'Profitabilitas', color: 'text-emerald-500 dark:text-emerald-400', activeBg: 'bg-emerald-500/10' },
        { to: '/reports/profit-loss', icon: BarChart3, label: 'Laba Rugi', color: 'text-purple-500 dark:text-purple-400', activeBg: 'bg-purple-500/10' },
      ],
    },
    {
      label: 'Sistem & AI',
      items: [
        { to: '/automation', icon: Wand2, label: 'Otomatisasi', exact: true, tag: 'AI', color: 'text-fuchsia-500 dark:text-fuchsia-400', activeBg: 'bg-fuchsia-500/10' },
        { to: '/settings', icon: Settings, label: 'Pengaturan', exact: true, color: 'text-slate-500 dark:text-slate-400', activeBg: 'bg-slate-500/10' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-teal-500 selection:text-white">
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR NAVIGATION */}
      {/* ========================================================================= */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border/80 bg-sidebar/90 backdrop-blur-xl text-sidebar-foreground transition-[width] duration-250 ease-in-out print:hidden lg:flex lg:flex-col shadow-xl shadow-black/5',
          isSidebarCollapsed ? 'w-[72px]' : 'w-72'
        )}
      >
        {/* Ambient Subtle Lighting Glows */}
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

        {/* Sidebar Header & Brand */}
        <div className={cn('relative z-10 border-b border-sidebar-border/70 pb-3.5 pt-4 transition-all', isSidebarCollapsed ? 'px-2' : 'px-4')}>
          <div className="flex items-center justify-between">
            <Link 
              to="/dashboard" 
              className={cn(
                'group flex items-center gap-3 transition-transform duration-150 active:scale-95 min-w-0',
                isSidebarCollapsed && 'mx-auto justify-center'
              )}
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-600 to-teal-800 text-white shadow-md shadow-teal-700/30 ring-1 ring-white/25 transition-all duration-200 group-hover:scale-105 group-hover:shadow-teal-700/50">
                <FileText className="h-5 w-5 drop-shadow-xs" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-sidebar animate-pulse" />
                </span>
              </div>

              {!isSidebarCollapsed && (
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-base tracking-tight text-sidebar-foreground truncate">
                      QuoteApp
                    </span>
                    <span className="rounded-full bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.2 text-[9px] font-black uppercase text-teal-400">
                      PRO
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 truncate">Executive ERP Suite</p>
                </div>
              )}
            </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={cn(
                'h-8 w-8 rounded-xl text-muted-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
                isSidebarCollapsed && 'hidden'
              )}
              title={isSidebarCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <div className="relative z-10 flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-sidebar-border">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              {!isSidebarCollapsed && (
                <p className="px-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.to, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150',
                        active 
                          ? 'bg-teal-500/15 text-teal-600 dark:text-teal-300 font-bold shadow-xs border border-teal-500/30' 
                          : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/70'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-110', active ? 'text-teal-500 dark:text-teal-400' : item.color)} />
                      {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar User Profile Footer */}
        <div className="relative z-10 border-t border-sidebar-border/70 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-sidebar-accent transition-colors">
                <div className="h-9 w-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                {!isSidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-sidebar-foreground truncate">{user?.user_metadata?.full_name || 'Admin Workspace'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                  </div>
                )}
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0', isSidebarCollapsed && 'hidden')} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56 rounded-2xl border border-border/80 p-1.5 shadow-2xl backdrop-blur-xl bg-popover/95">
              <DropdownMenuLabel className="px-2.5 py-2">
                <p className="text-xs font-bold text-foreground truncate">{user?.user_metadata?.full_name || 'Admin Workspace'}</p>
                <p className="text-[10px] font-medium text-muted-foreground truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-1.5">
                <Link to="/profile"><User className="mr-2 h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs font-medium">Profil & Akun</span></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-1.5">
                <Link to="/settings"><Settings className="mr-2 h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs font-medium">Pengaturan Sistem</span></Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="rounded-xl cursor-pointer py-1.5 text-rose-600 focus:text-rose-600 focus:bg-rose-500/10">
                <LogOut className="mr-2 h-3.5 w-3.5" /><span className="text-xs font-semibold">Keluar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN VIEW AREA */}
      {/* ========================================================================= */}
      <div className={cn('transition-[padding-left] duration-200', isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-72')}>
        {/* Top Navbar Header */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/70 print:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            {/* Mobile Left: Menu Drawer Trigger & Logo */}
            <div className="flex items-center gap-2.5 lg:hidden">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsMenuDrawerOpen(true)}
                className="h-10 w-10 rounded-xl text-foreground hover:bg-muted"
                aria-label="Buka Semua Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <Link to="/dashboard" className="flex items-center gap-2 font-bold text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-xs">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-sm font-extrabold tracking-tight">QuoteApp</span>
              </Link>
            </div>

            {/* Desktop Center Space */}
            <div className="hidden min-w-0 flex-1 lg:block" />

            {/* Top Right Actions */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 rounded-xl border-border/80 bg-muted/40 hover:bg-muted px-3 text-xs font-semibold gap-2 shadow-2xs" 
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              >
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Cari...</span>
                <kbd className="hidden sm:inline-block rounded-md bg-background px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted-foreground border border-border">⌘K</kbd>
              </Button>

              <ThemeToggle />
              <NotificationBell />

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-muted/60 border border-border hover:bg-muted">
                    <CircleUser className="h-5 w-5 text-foreground" />
                    <span className="sr-only">Buka menu akun</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-2xl border border-border/80 p-1.5 shadow-2xl backdrop-blur-xl bg-popover/95">
                  <DropdownMenuLabel className="px-2.5 py-2">
                    <p className="text-xs font-bold text-foreground truncate">{user?.user_metadata?.full_name || 'Admin Workspace'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-1.5">
                    <Link to="/profile"><User className="mr-2 h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs font-medium">Profil</span></Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-1.5">
                    <Link to="/settings"><Settings className="mr-2 h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs font-medium">Pengaturan</span></Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-1.5">
                    <Link to="/automation"><Wand2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs font-medium">Otomatisasi AI</span></Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="rounded-xl cursor-pointer py-1.5 text-rose-600 focus:text-rose-600 focus:bg-rose-500/10">
                    <LogOut className="mr-2 h-3.5 w-3.5" /><span className="text-xs font-semibold">Keluar</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content Router View */}
        <main className="min-h-[calc(100vh-4rem)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 5-COLUMN PERFECT GRID BOTTOM NAVIGATION (MOBILE PWA) - ZERO OVERLAP */}
      {/* ========================================================================= */}
      <nav 
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center h-[calc(4.25rem+env(safe-area-inset-bottom))] border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-2xl backdrop-blur-2xl print:hidden lg:hidden" 
        aria-label="Navigasi Bawah Mobile"
      >
        {/* Column 1: Home */}
        <Link
          to="/dashboard"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition-all active:scale-95 select-none',
            isActive('/dashboard', true) 
              ? 'text-teal-500 dark:text-teal-400' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className={cn(
            'flex h-7 w-12 items-center justify-center rounded-full transition-all',
            isActive('/dashboard', true) ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : ''
          )}>
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <span>Home</span>
        </Link>

        {/* Column 2: Penawaran */}
        <Link
          to="/quotes"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition-all active:scale-95 select-none',
            isActive('/quotes') 
              ? 'text-sky-500 dark:text-sky-400' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className={cn(
            'flex h-7 w-12 items-center justify-center rounded-full transition-all',
            isActive('/quotes') ? 'bg-sky-500/15 ring-1 ring-sky-500/30' : ''
          )}>
            <FileText className="h-4 w-4" />
          </div>
          <span>Quote</span>
        </Link>

        {/* Column 3: DEDICATED CENTER '+' QUICK ACTION BUTTON (NO OVERLAP) */}
        <div className="flex items-center justify-center">
          <button
            onClick={() => setIsQuickActionOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-500 to-teal-700 text-white shadow-lg shadow-teal-500/40 ring-2 ring-white/25 active:scale-90 transition-transform select-none"
            title="Tambah Cepat (+)"
            aria-label="Aksi Cepat"
          >
            <Plus className="h-6 w-6 font-black stroke-[3]" />
          </button>
        </div>

        {/* Column 4: Faktur */}
        <Link
          to="/invoices"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition-all active:scale-95 select-none',
            isActive('/invoices') 
              ? 'text-emerald-500 dark:text-emerald-400' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className={cn(
            'flex h-7 w-12 items-center justify-center rounded-full transition-all',
            isActive('/invoices') ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30' : ''
          )}>
            <Receipt className="h-4 w-4" />
          </div>
          <span>Faktur</span>
        </Link>

        {/* Column 5: Menu & Semua Fitur Hub */}
        <button
          onClick={() => setIsMenuDrawerOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition-all active:scale-95 select-none',
            ['/clients', '/projects', '/calendar', '/expenses', '/items', '/reports', '/automation', '/settings'].some(p => location.pathname.startsWith(p))
              ? 'text-indigo-500 dark:text-indigo-400'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className={cn(
            'flex h-7 w-12 items-center justify-center rounded-full transition-all',
            ['/clients', '/projects', '/calendar', '/expenses', '/items', '/reports', '/automation', '/settings'].some(p => location.pathname.startsWith(p))
              ? 'bg-indigo-500/15 ring-1 ring-indigo-500/30'
              : ''
          )}>
            <Grid className="h-4 w-4" />
          </div>
          <span>Menu</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM SHEET: QUICK ACTION CREATOR (+) */}
      {/* ========================================================================= */}
      <Sheet open={isQuickActionOpen} onOpenChange={setIsQuickActionOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t border-border/80 bg-background/95 backdrop-blur-2xl p-6 shadow-2xl">
          <SheetHeader className="text-left space-y-1 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <SheetTitle className="text-lg font-black text-foreground">Aksi Cepat & Buat Dokumen</SheetTitle>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              Pilih dokumen atau tindakan cepat yang ingin Anda buat langsung.
            </SheetDescription>
          </SheetHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            {/* Action 1: Buat Faktur */}
            <SheetClose asChild>
              <Link
                to="/invoice/new"
                className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-bold text-sm text-foreground">Faktur Baru</h5>
                  <p className="text-[11px] text-muted-foreground">Terbitkan tagihan baru</p>
                </div>
              </Link>
            </SheetClose>

            {/* Action 2: Buat Penawaran */}
            <SheetClose asChild>
              <Link
                to="/quote/new"
                className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-bold text-sm text-foreground">Penawaran Baru</h5>
                  <p className="text-[11px] text-muted-foreground">Buat proposal harga</p>
                </div>
              </Link>
            </SheetClose>

            {/* Action 3: Catat Pengeluaran */}
            <SheetClose asChild>
              <Link
                to="/expenses"
                className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-bold text-sm text-foreground">Catat Beban</h5>
                  <p className="text-[11px] text-muted-foreground">Input pengeluaran kas</p>
                </div>
              </Link>
            </SheetClose>

            {/* Action 4: Buat Proyek Baru */}
            <SheetClose asChild>
              <Link
                to="/projects"
                className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-bold text-sm text-foreground">Mulai Proyek</h5>
                  <p className="text-[11px] text-muted-foreground">Kelola tugas & timeline</p>
                </div>
              </Link>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      {/* ========================================================================= */}
      {/* MOBILE ALL-IN-ONE FEATURES HUB MODAL (MENU) */}
      {/* ========================================================================= */}
      <Sheet open={isMenuDrawerOpen} onOpenChange={setIsMenuDrawerOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] rounded-t-3xl border-t border-border/80 bg-background/95 backdrop-blur-2xl p-6 shadow-2xl flex flex-col">
          {/* Header */}
          <SheetHeader className="text-left space-y-1 pb-3 border-b border-border/60 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                  <Grid className="h-4 w-4" />
                </div>
                <div>
                  <SheetTitle className="text-lg font-black text-foreground">Semua Fitur & Modul</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">Akses langsung ke seluruh menu aplikasi</SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Grid of All Features */}
          <div className="flex-1 overflow-y-auto py-4">
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {allHubModules.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to, item.to === '/dashboard');
                return (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all active:scale-95 group',
                        active 
                          ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30' 
                          : 'bg-card border-border/80 hover:bg-muted/40'
                      )}
                    >
                      <div className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 border',
                        item.color
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-[11px] text-foreground truncate w-full">{item.label}</span>
                      <span className="text-[9px] text-muted-foreground truncate w-full mt-0.5">{item.desc}</span>
                    </Link>
                  </SheetClose>
                );
              })}
            </div>
          </div>

          {/* User Profile Quick Footer */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <div className="h-8 w-8 rounded-xl bg-muted/80 flex items-center justify-center font-bold text-xs text-foreground shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground text-xs truncate">{user?.user_metadata?.full_name || 'Admin'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="h-8 text-xs font-bold text-rose-600 hover:bg-rose-500/10 border-rose-500/30"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Keluar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SharedLayout;
