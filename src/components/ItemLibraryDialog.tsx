import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Item } from '@/pages/ItemList';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ItemLibraryDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAddItems: (items: Omit<Item, 'id'>[]) => void;
}

const ItemLibraryDialog = ({ isOpen, setIsOpen, onAddItems }: ItemLibraryDialogProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen || !user) return;
    const fetchItems = async () => {
      const { data } = await supabase.from('items').select('*').eq('user_id', user.id);
      if (data) setItems(data);
    };
    fetchItems();
  }, [isOpen, user]);

  const handleSelect = (itemId: string) => {
    setSelectedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleAdd = () => {
    const itemsToAdd = items
      .filter(item => selectedItems[item.id])
      .map(({ id, ...rest }) => ({ ...rest, quantity: 1 })); // Add quantity field
    onAddItems(itemsToAdd);
    setIsOpen(false);
    setSelectedItems({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pilih Item dari Pustaka</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Harga Satuan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id} onClick={() => handleSelect(item.id)} className="cursor-pointer">
                  <TableCell><Checkbox checked={!!selectedItems[item.id]} /></TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.unit_price.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={handleAdd}>Tambah Item Terpilih</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ItemLibraryDialog;