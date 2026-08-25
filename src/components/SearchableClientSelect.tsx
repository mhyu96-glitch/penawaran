import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

export interface ClientOption {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface SearchableClientSelectProps {
  clients: ClientOption[];
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
}

export const SearchableClientSelect: React.FC<SearchableClientSelectProps> = ({
  clients,
  value,
  onValueChange,
  placeholder = 'Pilih klien...',
  allowClear = true,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Urutkan klien berdasarkan Abjad (A - Z)
  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' })
    );
  }, [clients]);

  // Filter berdasarkan ketikan pencarian
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return sortedClients;
    const q = searchQuery.toLowerCase().trim();
    return sortedClients.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
    );
  }, [sortedClients, searchQuery]);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === value);
  }, [clients, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between h-10 rounded-xl text-xs font-semibold border-border/80 bg-background/80 hover:bg-muted/50 px-3',
            !selectedClient && 'text-muted-foreground font-normal',
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedClient ? selectedClient.name : placeholder}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {allowClear && selectedClient && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange(undefined);
                }}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                title="Hapus pilihan klien"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] sm:w-[380px] p-0 rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-2xl shadow-2xl overflow-hidden" align="start">
        {/* Search Input Box */}
        <div className="flex items-center border-b border-border/70 px-3 py-2 bg-muted/20">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
          <Input
            placeholder="Ketik nama / alamat klien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-none bg-transparent p-0 text-xs focus-visible:ring-0 shadow-none placeholder:text-muted-foreground"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Client Options List */}
        <div className="max-h-64 overflow-y-auto p-1 divide-y divide-border/40 scrollbar-thin">
          {allowClear && (
            <div
              onClick={() => {
                onValueChange(undefined);
                setOpen(false);
                setSearchQuery('');
              }}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors hover:bg-muted/60',
                !value ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'
              )}
            >
              <span>-- Tanpa Klien / Umum --</span>
              {!value && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
          )}

          {filteredClients.length === 0 ? (
            <div className="py-6 px-4 text-center text-xs text-muted-foreground">
              Tidak ada klien yang cocok dengan &quot;{searchQuery}&quot;.
            </div>
          ) : (
            filteredClients.map((client) => {
              const isSelected = client.id === value;
              return (
                <div
                  key={client.id}
                  onClick={() => {
                    onValueChange(client.id);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all hover:bg-muted/60',
                    isSelected
                      ? 'bg-primary/15 text-primary font-black shadow-2xs'
                      : 'text-foreground font-semibold'
                  )}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate text-xs font-bold leading-tight">
                      {client.name}
                    </p>
                    {(client.address || client.phone) && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-normal">
                        {[client.phone, client.address].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-2 border-t border-border/60 bg-muted/20 text-[10px] text-muted-foreground flex justify-between items-center px-3">
          <span>{filteredClients.length} Klien (Urut A-Z)</span>
          <span className="text-primary font-medium">Bisa ketik nama</span>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableClientSelect;
