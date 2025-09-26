import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CircleUser, FileText, LayoutDashboard, Package, Users, Settings, Receipt, User, Wallet, AreaChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SharedLayout = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
            <FileText className="h-6 w-6 text-primary" />
            <span>QuoteApp</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-2">
                <Button variant="ghost" asChild>
                    <Link to="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4"/>Dashboard</Link>
                </Button>
                <Button variant="ghost" asChild>
                    <Link to="/quotes"><FileText className="mr-2 h-4 w-4"/>Penawaran</Link>
                </Button>
                <Button variant="ghost" asChild>
                    <Link to="/invoices"><Receipt className="mr-2 h-4 w-4"/>Faktur</Link>
                </Button>
                <Button variant="ghost" asChild>
                    <Link to="/expenses"><Wallet className="mr-2 h-4 w-4"/>Pengeluaran</Link>
                </Button>
                <Button variant="ghost" asChild>
                    <Link to="/reports"><AreaChart className="mr-2 h-4 w-4"/>Laporan</Link>
                </Button>
                <Button variant="ghost" asChild>
                    <Link to="/clients"><Users className="mr-2 h-4 w-4"/>Klien</Link>
                </Button>
                <Button variant="ghost" asChild>
                    <Link to="/items"><Package className="mr-2 h-4 w-4"/>Barang & Jasa</Link>
                </Button>
            </nav>
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
                <DropdownMenuItem asChild className="md:hidden"><Link to="/dashboard">Dashboard</Link></DropdownMenuItem>
                <DropdownMenuItem asChild className="md:hidden"><Link to="/quotes">Penawaran</Link></DropdownMenuItem>
                <DropdownMenuItem asChild className="md:hidden"><Link to="/invoices">Faktur</Link></DropdownMenuItem>
                <DropdownMenuItem asChild className="md:hidden"><Link to="/expenses">Pengeluaran</Link></DropdownMenuItem>
                <DropdownMenuItem asChild className="md:hidden"><Link to="/reports">Laporan</Link></DropdownMenuItem>
                <DropdownMenuItem asChild className="md:hidden"><Link to="/clients">Klien</Link></DropdownMenuItem>
                <DropdownMenuItem asChild className="md:hidden"><Link to="/items">Barang & Jasa</Link></DropdownMenuItem>
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