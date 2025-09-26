import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import ItemForm from '@/components/ItemForm';

export type Item = {
  id: string;
  description: string;
  unit: string | null;
  unit_price: number;
};

const ItemList = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const fetchItems = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('items')
      .select('id, description, unit, unit_price')
      .eq('user_id', user.id)
      .order('description', { ascending: true });

    if (error) {
      console.error('Error fetching items:', error);
      showError('Gagal memuat daftar item.');
    } else {
      setItems(data as Item[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [user]);

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.from('items').delete().match({ id: itemId });

    if (error) {
      showError('Gagal menghapus item.');
    } else {
      showSuccess('Item berhasil dihapus.');
      setItems(items.filter(i => i.id !== itemId));
    }
  };

  const handleOpenForm = (item: Item | null = null) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    setIsFormOpen(false);
    fetchItems();
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl">Pustaka Barang & Jasa</CardTitle>
            <CardDescription>Kelola item yang sering Anda gunakan untuk penawaran.</CardDescription>
          </div>
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Tambah Item Baru
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Anda belum menambahkan item apa pun.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead>Harga Satuan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell>{item.unit || '-'}</TableCell>
                    <TableCell>{item.unit_price.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenForm(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                            <AlertDialogDescription>Tindakan ini akan menghapus item secara permanen.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteItem(item.id)}>Hapus</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ItemForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        item={selectedItem}
        onSave={handleFormSave}
      />
    </div>
  );
};

export default ItemList;