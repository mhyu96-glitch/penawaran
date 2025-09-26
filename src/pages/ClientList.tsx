import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Pencil, Trash2, Users, MoreVertical } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showError, showSuccess } from '@/utils/toast';
import ClientForm from '@/components/ClientForm';
import { Link } from 'react-router-dom';

export type Client = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

const ClientList = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const fetchClients = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, address, phone, email, notes')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching clients:', error);
      showError('Gagal memuat daftar klien.');
    } else {
      setClients(data as Client[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [user]);

  const handleDeleteClient = async (clientId: string) => {
    const { error } = await supabase.from('clients').delete().match({ id: clientId });

    if (error) {
      showError('Gagal menghapus klien.');
      console.error('Delete error:', error);
    } else {
      showSuccess('Klien berhasil dihapus.');
      setClients(clients.filter(c => c.id !== clientId));
    }
  };

  const handleOpenForm = (client: Client | null = null) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    setIsFormOpen(false);
    fetchClients(); // Refresh list after save
  };

  const renderActions = (client: Client) => (
    <>
      <DropdownMenuItem asChild><Link to={`/client/${client.id}`}>Lihat Detail</Link></DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleOpenForm(client)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />Hapus</DropdownMenuItem>
      </AlertDialogTrigger>
    </>
  );

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Users className="h-7 w-7" />
              <CardTitle className="text-3xl">Klien Saya</CardTitle>
            </div>
            <CardDescription>Kelola semua kontak klien Anda di sini.</CardDescription>
          </div>
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Tambah Klien Baru
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Anda belum menambahkan klien.</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telepon</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium"><Link to={`/client/${client.id}`} className="hover:underline">{client.name}</Link></TableCell>
                        <TableCell>{client.email || '-'}</TableCell>
                        <TableCell>{client.phone || '-'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenForm(client)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus klien secara permanen.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteClient(client.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {clients.map(client => (
                  <Card key={client.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle><Link to={`/client/${client.id}`} className="hover:underline">{client.name}</Link></CardTitle>
                          <CardDescription>{client.email || 'No email'}</CardDescription>
                        </div>
                        <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">{renderActions(client)}</DropdownMenuContent>
                          </DropdownMenu>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus klien secara permanen.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteClient(client.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardHeader>
                    <CardFooter className="text-sm text-muted-foreground">
                      {client.phone || 'No phone'}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <ClientForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        client={selectedClient}
        onSave={handleFormSave}
      />
    </div>
  );
};

export default ClientList;