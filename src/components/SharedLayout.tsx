import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CircleUser, FileText, LayoutDashboard, Package, Users, Settings, Receipt, User, Wallet, AreaChart, TrendingUp, Menu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import NotificationBell from './NotificationBell';

const SharedLayout = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/quotes", icon: FileText, label: "Penawaran" },
    { to: "/invoices", icon: Receipt, label: "Faktur" },
    { to: "/expenses", icon: Wallet, label: "Pengeluaran" },
    { to: "/clients", icon: Users, label: "Klien" },
    { to: "/items", icon: Package, label: "Barang & Jasa" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <nav className="grid gap-6 text-lg font-medium">
                  <Link to="/dashboard" className="flex items-center gap-2 text-lg font-semibold mb-4">
                    <FileText className="h-6 w-6 text-primary" />
                    <span>QuoteApp</span>
                  </Link>
                  {navLinks.map(link => (
                    <Link key={link.to} to={link.to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  ))}
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="justify-start px-3 py-2 -ml-3 text-muted-foreground font-medium text-lg">
                            <AreaChart className="mr-3 h-4 w-4"/>Laporan
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem asChild>
                            <Link to="/reports"><AreaChart className="mr-2 h-4 w-4"/>Laporan Keuangan</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link to="/reports/profitability"><TrendingUp className="mr-2 h-4 w-4"/>Laporan Profitabilitas</Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                </nav>
              </SheetContent>
            </Sheet>
            <Link to="/dashboard" className="hidden md:flex items-center gap-2 font-semibold text-lg">
              <FileText className="h-6 w-6 text-primary" />
              <span>QuoteApp</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex gap-1">
                <Button variant="ghost" asChild size="sm">
                    <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button variant="ghost" asChild size="sm">
                    <Link to="/quotes">Penawaran</Link>
                </Button>
                <Button variant="ghost" asChild size="sm">
                    <Link to="/invoices">Faktur</Link>
                </Button>
                <Button variant="ghost" asChild size="sm">
                    <Link to="/expenses">Pengeluaran</Link>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                            Laporan
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem asChild>
                            <Link to="/reports"><AreaChart className="mr-2 h-4 w-4"/>Laporan Keuangan</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link to="/reports/profitability"><TrendingUp className="mr-2 h-4 w-4"/>Laporan Profitabilitas</Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" asChild size="sm">
                    <Link to="/clients">Klien</Link>
                </Button>
                <Button variant="ghost" asChild size="sm">
                    <Link to="/items">Barang & Jasa</Link>
                </Button>
            </nav>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full">
                  <CircleUser className="h-5 w-5" />
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Pengaturan</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-muted/40">
        <Outlet />
      </main>
    </div>
  );
};

export default SharedLayout;