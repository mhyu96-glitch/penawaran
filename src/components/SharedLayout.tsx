import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Bell,
  CircleUser,
  FilePlus2,
  FileText,
  FolderKanban,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  TrendingUp,
  User,
  Users,
  Wallet,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import NotificationBell from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { GlobalSearch } from './GlobalSearch';

const primaryLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/quotes', icon: FileText, label: 'Penawaran' },
  { to: '/invoices', icon: Receipt, label: 'Faktur' },
  { to: '/projects', icon: FolderKanban, label: 'Proyek' },
  { to: '/clients', icon: Users, label: 'Klien' },
  { to: '/items', icon: Package, label: 'Barang & Jasa' },
];

const secondaryLinks = [
  { to: '/expenses', icon: Wallet, label: 'Pengeluaran' },
  { to: '/reports', icon: AreaChart, label: 'Laporan Keuangan' },
  { to: '/reports/profitability', icon: TrendingUp, label: 'Profitabilitas' },
  { to: '/reports/profit-loss', icon: TrendingUp, label: 'Laba Rugi' },
  { to: '/reports/expenses', icon: Wallet, label: 'Laporan Pengeluaran' },
  { to: '/automation', icon: Wand2, label: 'Otomatisasi' },
];

const bottomLinks = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/quotes', icon: FileText, label: 'Penawaran' },
  { to: '/invoice/new', icon: FilePlus2, label: 'Buat' },
  { to: '/invoices', icon: Receipt, label: 'Faktur' },
  { to: '/clients', icon: Users, label: 'Klien' },
];

const isActivePath = (pathname: string, target: string) => {
  if (target === '/dashboard') return pathname === target;
  return pathname === target || pathname.startsWith(`${target}/`);
};

const Brand = () => (
  <Link to="/dashboard" className="flex items-center gap-3 rounded-lg px-2 py-1.5">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
      <FileText className="h-5 w-5" />
    </div>
    <div className="leading-tight">
      <div className="font-semibold tracking-tight">QuoteApp</div>
      <div className="text-xs text-muted-foreground">Penawaran & faktur</div>
    </div>
  </Link>
);

type NavListProps = {
  onNavigate?: () => void;
  compact?: boolean;
};

const NavList = ({ onNavigate, compact }: NavListProps) => {
  const location = useLocation();

  const renderLink = (link: (typeof primaryLinks)[number]) => {
    const active = isActivePath(location.pathname, link.to);
    return (
      <Link
        key={link.to}
        to={link.to}
        onClick={onNavigate}
        className={cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
          active
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          compact && 'py-2'
        )}
      >
        <link.icon className={cn('h-4 w-4 shrink-0', active && 'text-emerald-600 dark:text-emerald-300')} />
        <span className="truncate">{link.label}</span>
      </Link>
    );
  };

  return (
    <nav className="space-y-6">
      <div className="space-y-1">
        <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Operasional</div>
        {primaryLinks.map(renderLink)}
      </div>
      <div className="space-y-1">
        <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bisnis</div>
        {secondaryLinks.map(renderLink)}
      </div>
    </nav>
  );
};

const SharedLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const pageTitle = useMemo(() => {
    const allLinks = [...primaryLinks, ...secondaryLinks];
    return allLinks.find((link) => isActivePath(location.pathname, link.to))?.label || 'QuoteApp';
  }, [location.pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r bg-white/95 p-4 shadow-sm backdrop-blur lg:block dark:bg-slate-950/95">
        <Brand />
        <div className="mt-8">
          <NavList />
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 border-b bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur dark:bg-slate-950/90">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Buka navigasi</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[310px] p-4">
                <Brand />
                <div className="mt-8">
                  <NavList onNavigate={() => setOpen(false)} compact />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 lg:hidden">
              <div className="truncate text-sm font-semibold">{pageTitle}</div>
              <div className="truncate text-xs text-muted-foreground">QuoteApp</div>
            </div>

            <div className="hidden min-w-0 flex-1 md:flex">
              <GlobalSearch />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button asChild className="hidden sm:inline-flex">
                <Link to="/quote/new">
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Penawaran
                </Link>
              </Button>
              <ThemeToggle />
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" className="rounded-full">
                    <CircleUser className="h-5 w-5" />
                    <span className="sr-only">Buka menu akun</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <User className="mr-2 h-4 w-4" />
                      Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Pengaturan
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/automation">
                      <Bell className="mr-2 h-4 w-4" />
                      Otomatisasi
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="border-t px-4 py-3 md:hidden">
            <GlobalSearch />
          </div>
        </header>

        <main className="pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden dark:bg-slate-950/95">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {bottomLinks.map((link) => {
            const active = isActivePath(location.pathname, link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition',
                  active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-muted-foreground'
                )}
              >
                <link.icon className="h-5 w-5" />
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default SharedLayout;
