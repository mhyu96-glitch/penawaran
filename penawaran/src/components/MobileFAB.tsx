import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Receipt, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

const MobileFAB = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  if (!isMobile) return null;

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end gap-3 print:hidden sm:right-6 lg:bottom-6">
      {isOpen && (
        <div className="flex flex-col gap-3 items-end animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Button asChild size="sm" className="rounded-full shadow-md bg-primary hover:bg-primary/90" onClick={() => setIsOpen(false)}>
            <Link to="/invoice/new" className="flex items-center gap-2">
              <span className="mr-1">Faktur Baru</span> <Receipt className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm" className="rounded-full shadow-md bg-emerald-700 hover:bg-emerald-800" onClick={() => setIsOpen(false)}>
            <Link to="/quote/new" className="flex items-center gap-2">
              <span className="mr-1">Penawaran</span> <FileText className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm" className="rounded-full shadow-md bg-amber-700 hover:bg-amber-800" onClick={() => setIsOpen(false)}>
            <Link to="/expenses" className="flex items-center gap-2">
              <span className="mr-1">Catat Beban</span> <Wallet className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
      
      <Button 
        size="icon" 
        className={`h-14 w-14 rounded-full shadow-lg transition-transform ${isOpen ? 'rotate-45 bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'}`} 
        onClick={toggleMenu}
      >
        {isOpen ? <Plus className="h-8 w-8" /> : <Plus className="h-8 w-8" />}
      </Button>
    </div>
  );
};

export default MobileFAB;
