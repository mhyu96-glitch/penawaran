import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Receipt, Users, FolderKanban, Package, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

// Search results types
type ClientResult = { id: string; name: string };
type QuoteResult = { id: string; quote_number: string; to_client: string };
type InvoiceResult = { id: string; invoice_number: string; to_client: string };
type ProjectResult = { id: string; name: string };
type ItemResult = { id: string; description: string };

type SearchResults = {
  clients: ClientResult[];
  quotes: QuoteResult[];
  invoices: InvoiceResult[];
  projects: ProjectResult[];
  items: ItemResult[];
};

export const GlobalSearch = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchTerm) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('global-search', {
          body: { searchTerm: debouncedSearchTerm },
        });
        if (error) throw error;
        setResults(data.results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm]);

  const runCommand = useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const handleNavigate = (path: string) => {
    runCommand(() => navigate(path));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex h-9 w-full items-center gap-2.5 rounded-xl border border-border/70 bg-background/70 px-3 text-xs text-muted-foreground outline-none transition-all hover:border-primary/40 hover:bg-background hover:text-foreground hover:shadow-xs focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 group-hover:text-primary transition-colors" />
        <span className="truncate text-xs font-normal">Cari klien, dokumen...</span>
        <kbd className="pointer-events-none ml-auto inline-flex h-4.5 items-center gap-0.5 rounded-md border border-border/70 bg-muted/60 px-1.5 font-mono text-[9px] font-semibold text-muted-foreground group-hover:border-border">
          Ctrl+K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Cari klien, penawaran, faktur..."
          value={searchTerm}
          onValueChange={setSearchTerm}
        />
        <CommandList>
          {loading && <CommandEmpty>Mencari...</CommandEmpty>}
          {!loading && !results && <CommandEmpty>Ketik untuk mencari.</CommandEmpty>}
          {!loading && results && Object.values(results).every(arr => arr.length === 0) && (
            <CommandEmpty>Tidak ada hasil ditemukan.</CommandEmpty>
          )}
          
          {results?.clients?.length > 0 && (
            <CommandGroup heading="Klien">
              {results.clients.map((client) => (
                <CommandItem key={`client-${client.id}`} onSelect={() => handleNavigate(`/client/${client.id}`)}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>{client.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results?.quotes?.length > 0 && (
            <CommandGroup heading="Penawaran">
              {results.quotes.map((quote) => (
                <CommandItem key={`quote-${quote.id}`} onSelect={() => handleNavigate(`/quote/${quote.id}`)}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{quote.quote_number || 'N/A'} - {quote.to_client}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results?.invoices?.length > 0 && (
            <CommandGroup heading="Faktur">
              {results.invoices.map((invoice) => (
                <CommandItem key={`invoice-${invoice.id}`} onSelect={() => handleNavigate(`/invoice/${invoice.id}`)}>
                  <Receipt className="mr-2 h-4 w-4" />
                  <span>{invoice.invoice_number || 'N/A'} - {invoice.to_client}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results?.projects?.length > 0 && (
            <CommandGroup heading="Proyek">
              {results.projects.map((project) => (
                <CommandItem key={`project-${project.id}`} onSelect={() => handleNavigate(`/project/${project.id}`)}>
                  <FolderKanban className="mr-2 h-4 w-4" />
                  <span>{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results?.items?.length > 0 && (
            <CommandGroup heading="Barang & Jasa">
              {results.items.map((item) => (
                <CommandItem key={`item-${item.id}`} onSelect={() => handleNavigate(`/items`)}>
                  <Package className="mr-2 h-4 w-4" />
                  <span>{item.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
