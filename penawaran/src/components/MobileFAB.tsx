import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Receipt, Wallet, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

const MobileFAB = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  if (!isMobile) return null;

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <div className="fixed bottom-6 right-6 z-50 print:hidden flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex flex-col gap-3 items-end animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Button asChild size="sm" className="rounded-full shadow-lg bg-blue-600 hover:bg-blue-700" onClick={() => setIsOpen(false)}>
            <Link to="/invoice/new" className="flex items-center gap-2">
              <span className="mr-1">Faktur Baru</span> <Receipt className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm" className="rounded-full shadow-lg bg-green-600 hover:bg-green-700" onClick={() => setIsOpen(false)}>
            <Link to="/quote/new" className="flex items-center gap-2">
              <span className="mr-1">Penawaran</span> <FileText className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm" className="rounded-full shadow-lg bg-orange-600 hover:bg-orange-700" onClick={() => setIsOpen(false)}>
            <Link to="/expenses" className="flex items-center gap-2">
              <span className="mr-1">Catat Beban</span> <Wallet className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
      
      <Button 
        size="icon" 
        className={`h-14 w-14 rounded-full shadow-xl transition-transform ${isOpen ? 'rotate-45 bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`} 
        onClick={toggleMenu}
      >
        {isOpen ? <Plus className="h-8 w-8" /> : <Plus className="h-8 w-8" />}
      </Button>
    </div>
  );
};

export default MobileFAB;