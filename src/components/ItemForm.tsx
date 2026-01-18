import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Item } from '@/pages/ItemList';

interface ItemFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  item: Item | null;
  onSave: () => void;
}

const ItemForm = ({ isOpen, setIsOpen, item, onSave }: ItemFormProps) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState('0');
  const [costPrice, setCostPrice] = useState('0');
  const [trackStock, setTrackStock] = useState(false);
  const [stock, setStock] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setDescription(item.description);
      setUnit(item.unit || '');
      setUnitPrice(String(item.unit_price || 0));
      setCostPrice(String(item.cost_price || 0));
      setTrackStock(item.track_stock || false);
      setStock(String(item.stock || 0));
    } else {
      setDescription('');
      setUnit('');
      setUnitPrice('0');
      setCostPrice('0');
      setTrackStock(false);
      setStock('0');
    }
  }, [item, isOpen]);

  const handlePriceChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    const sanitized = digitsOnly.replace(/^0+(?=\d)/, '');
    setter(sanitized === '' ? '0' : sanitized);
  };

  const handleSubmit = async () => {
    if (!user || !description) {
      showError('Deskripsi item tidak boleh kosong.');
      return;
    }
    setIsSubmitting(true);

    const itemPayload = {
      user_id: user.id,
      description,
      unit,
      unit_price: parseFloat(unitPrice) || 0,
      cost_price: parseFloat(costPrice) || 0,
      track_stock: trackStock,
      stock: trackStock ? (parseInt(stock) || 0) : 0,
    };

    let error;
    if (item) {
      ({ error } = await supabase.from('items').update(itemPayload).match({ id: item.id }));
    } else {
      ({ error } = await supabase.from('items').insert(itemPayload));
    }

    if (error) {
      showError(`Gagal menyimpan item: ${error.message}`);
    } else {
      showSuccess(`Item berhasil ${item ? 'diperbarui' : 'ditambahkan'}!`);
      onSave();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : 'Tambah Item Baru'}</DialogTitle>
          <DialogDescription>
            Isi detail item dan inventaris di bawah ini.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Deskripsi</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unit" className="text-right">Satuan</Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" placeholder="Contoh: Pcs, Kg, Jam" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="costPrice" className="text-right">Harga Modal</Label>
            <Input
              id="costPrice"
              type="text"
              inputMode="numeric"
              value={costPrice}
              onChange={(e) => handlePriceChange(setCostPrice, e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unitPrice" className="text-right">Harga Jual</Label>
            <Input
              id="unitPrice"
              type="text"
              inputMode="numeric"
              value={unitPrice}
              onChange={(e) => handlePriceChange(setUnitPrice, e.target.value)}
              className="col-span-3"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="trackStock" className="text-right">Lacak Stok</Label>
            <div className="col-span-3 flex items-center space-x-2">
                <Switch id="trackStock" checked={trackStock} onCheckedChange={setTrackStock} />
                <Label htmlFor="trackStock" className="font-normal text-muted-foreground">Aktifkan manajemen inventaris untuk item ini</Label>
            </div>
          </div>

          {trackStock && (
             <div className="grid grid-cols-4 items-center gap-4 animate-in fade-in slide-in-from-top-1">
                <Label htmlFor="stock" className="text-right">Stok Saat Ini</Label>
                <Input
                id="stock"
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="col-span-3"
                />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ItemForm;