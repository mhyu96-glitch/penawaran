import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import NotificationBell from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { GlobalSearch } from './GlobalSearch';
import MobileFAB from './MobileFAB';
import { cn } from '@/lib/utils';

const SharedLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('quoteapp-sidebar-collapsed') === 'true';
  });

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

  const navGroups = [
    {
      label: 'Utama',
      items: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
        { to: '/quotes', icon: FileText, label: 'Penawaran' },
        { to: '/invoices', icon: Receipt, label: 'Faktur' },
        { to: '/invoices/recurring', icon: Repeat, label: 'Faktur Berulang' },
      ],
    },
    {
      label: 'Operasional',
      items: [
        { to: '/clients', icon: Users, label: 'Klien' },
        { to: '/projects', icon: FolderKanban, label: 'Proyek' },
        { to: '/calendar', icon: Calendar, label: 'Kalender', exact: true },
        { to: '/items', icon: Package, label: 'Barang & Jasa', exact: true },
      ],
    },
    {
      label: 'Keuangan',
      items: [
        { to: '/expenses', icon: Wallet, label: 'Pengeluaran' },
        { to: '/reports', icon: AreaChart, label: 'Laporan', exact: true },
        { to: '/reports/profitability', icon: TrendingUp, label: 'Profitabilitas' },
        { to: '/reports/profit-loss', icon: BarChart3, label: 'Laba Rugi' },
      ],
    },
    {
      label: 'Sistem',
      items: [
        { to: '/automation', icon: Wand2, label: 'Otomatisasi', exact: true },
        { to: '/settings', icon: Settings, label: 'Pengaturan', exact: true },
      ],
    },
  ];

  const bottomNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home', exact: true },
    { to: '/quotes', icon: FileText, label: 'Quote' },
    { to: '/invoices', icon: Receipt, label: 'Faktur' },
    { to: '/clients', icon: Users, label: 'Klien' },
    { to: '/reports', icon: AreaChart, label: 'Laporan' },
  ];
  const hideFab = [
    '/quote/new',
    '/invoice/new',
    '/quote/edit/',
    '/invoice/edit/',
    '/quote/',
    '/invoice/',
  ].some((path) => location.pathname === path || location.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 print:hidden lg:flex lg:flex-col',
          isSidebarCollapsed ? 'w-20' : 'w-72'
        )}
      >
        <div className={cn('border-b border-sidebar-border py-4', isSidebarCollapsed ? 'px-3' : 'px-4')}>
          <div className={cn('flex items-center', isSidebarCollapsed ? 'justify-center' : 'gap-3')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <div className={cn('min-w-0', isSidebarCollapsed && 'hidden')}>
              <Link to="/dashboard" className="block truncate text-base font-semibold tracking-tight text-sidebar-primary">
                QuoteApp
              </Link>
              <p className="truncate text-xs font-medium text-sidebar-foreground/70">Quote to cash workspace</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn('mt-4 h-9 w-full rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground', isSidebarCollapsed && 'mx-auto w-10')}
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            aria-label={isSidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
            title={isSidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>

          <div className={cn('mt-4', isSidebarCollapsed && 'hidden')}>
            <GlobalSearch />
          </div>
        </div>

        <div className={cn('sidebar-scrollbar flex-1 overflow-y-auto py-4', isSidebarCollapsed ? 'px-2' : 'px-3')}>
          <nav className="space-y-5" aria-label="Navigasi utama">
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <p className={cn('px-3 text-[11px] font-semibold text-sidebar-foreground/55', isSidebarCollapsed && 'sr-only')}>{group.label}</p>
                {group.items.map((item) => {
                  const active = isActive(item.to, item.exact);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-1 focus-visible:ring-sidebar-ring',
                        isSidebarCollapsed && 'justify-center gap-0 px-0',
                        active
                          ? 'bg-primary/10 text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/78 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground'
                      )}
                      aria-current={active ? 'page' : undefined}
                      title={item.label}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                          active ? 'bg-background text-primary' : 'text-sidebar-foreground/55 group-hover:bg-sidebar-background group-hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className={cn('truncate', isSidebarCollapsed && 'sr-only')}>{item.label}</span>
                      {active && <span className={cn('ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary', isSidebarCollapsed && 'absolute right-1.5 ml-0')} aria-hidden="true" />}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className={cn('space-y-3 border-t border-sidebar-border p-3', isSidebarCollapsed && 'px-2')}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className={cn('h-10 w-full rounded-lg', isSidebarCollapsed ? 'justify-center px-0' : 'justify-between')}>
                <span className={cn('flex items-center gap-2', isSidebarCollapsed && 'gap-0')}>
                  <Plus className="h-4 w-4" />
                  <span className={cn(isSidebarCollapsed && 'sr-only')}>Buat Baru</span>
                </span>
                <ChevronDown className={cn('h-4 w-4 opacity-70', isSidebarCollapsed && 'hidden')} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuItem asChild><Link to="/quote/new"><FileText className="mr-2 h-4 w-4" />Penawaran</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/invoice/new"><Receipt className="mr-2 h-4 w-4" />Faktur</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/clients"><Building2 className="mr-2 h-4 w-4" />Klien</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/expenses"><CreditCard className="mr-2 h-4 w-4" />Pengeluaran</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  isSidebarCollapsed && 'justify-center px-0'
                )}
                title="Akun Saya"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
                  <CircleUser className="h-4 w-4" />
                </span>
                <span className={cn('min-w-0 flex-1', isSidebarCollapsed && 'sr-only')}>
                  <span className="block truncate font-medium">Akun Saya</span>
                  <span className="block truncate text-xs text-sidebar-foreground/60">Profil dan preferensi</span>
                </span>
                <ChevronDown className={cn('h-4 w-4 text-sidebar-foreground/50', isSidebarCollapsed && 'hidden')} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/profile"><User className="mr-2 h-4 w-4" /><span>Profil</span></Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/settings"><Settings className="mr-2 h-4 w-4" /><span>Pengaturan</span></Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Keluar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className={cn('transition-[padding-left] duration-200', isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72')}>
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link to="/dashboard" className="flex items-center gap-2 font-semibold lg:hidden">
              <FileText className="h-5 w-5 text-primary" />
              <span>QuoteApp</span>
            </Link>
            <div className="hidden min-w-0 flex-1 lg:block" />
            <Button variant="outline" size="sm" className="ml-auto gap-2 lg:hidden" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}>
              <Search className="h-4 w-4" />
              Cari
            </Button>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" className="rounded-full"><CircleUser className="h-5 w-5" /><span className="sr-only">Buka menu akun</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/profile"><User className="mr-2 h-4 w-4" /><span>Profil</span></Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/settings"><Settings className="mr-2 h-4 w-4" /><span>Pengaturan</span></Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/automation"><Wand2 className="mr-2 h-4 w-4" /><span>Otomatisasi</span></Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>Keluar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-sm backdrop-blur print:hidden lg:hidden" aria-label="Navigasi bawah">
        {bottomNav.map((item) => {
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {!hideFab && <MobileFAB />}
    </div>
  );
};

export default SharedLayout;
