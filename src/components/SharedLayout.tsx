import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CircleUser, FileText } from 'lucide-react';
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
          <Link to="/quotes" className="flex items-center gap-2 font-semibold text-lg">
            <FileText className="h-6 w-6" />
            <span>QuoteApp</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-2">
                <Button variant="ghost" asChild>
                    <Link to="/quotes">Penawaran Saya</Link>
                </Button>
                <Button variant="ghost" asChild>
                    <Link to="/profile">Profil</Link>
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
                <DropdownMenuItem asChild className="md:hidden">
                    <Link to="/quotes">Penawaran Saya</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to="/profile">Profil</Link>
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