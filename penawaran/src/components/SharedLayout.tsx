import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CircleUser, FileText, LayoutDashboard, Package, Users, Settings, Receipt, User, Wallet, AreaChart, TrendingUp, FolderKanban, Wand2, Calendar, Plus, CreditCard, Repeat, Search, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import NotificationBell from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { GlobalSearch } from './GlobalSearch';
import MobileFAB from './MobileFAB';
import { cn } from '@/lib/utils';

const SharedLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isActive = (to: string, exact = false) => {
    if (exact) return location.pathname === to;
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r bg-sidebar text-sidebar-foreground print:hidden lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <Link to="/dashboard" className="block truncate text-base font-semibold tracking-tight text-sidebar-primary">
              QuoteApp
            </Link>
            <p className="truncate text-xs text-muted-foreground">Quote to cash workspace</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-3 text-xs font-medium text-muted-foreground">{group.label}</p>
                {group.items.map((item) => {
                  const active = isActive(item.to, item.exact);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-10 w-full justify-start">
                <Plus className="h-4 w-4" />
                Buat Baru
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuItem asChild><Link to="/quote/new"><FileText className="mr-2 h-4 w-4" />Penawaran</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/invoice/new"><Receipt className="mr-2 h-4 w-4" />Faktur</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/clients"><Building2 className="mr-2 h-4 w-4" />Klien</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/expenses"><CreditCard className="mr-2 h-4 w-4" />Pengeluaran</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link to="/dashboard" className="flex items-center gap-2 font-semibold lg:hidden">
              <FileText className="h-5 w-5 text-primary" />
              <span>QuoteApp</span>
            </Link>
            <div className="hidden min-w-0 flex-1 lg:block">
              <GlobalSearch />
            </div>
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

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-sm backdrop-blur print:hidden lg:hidden">
        {bottomNav.map((item) => {
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className={cn('h-5 w-5', active && 'fill-primary/10')} />
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
