import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MoreVertical, Pencil, Phone, PlusCircle, Search, Trash2, Users } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ClientForm from '@/components/ClientForm';
import { useAuth } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

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
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return clients.filter((client) =>
      [client.name, client.email, client.phone, client.address].some((value) => (value || '').toLowerCase().includes(term))
    );
  }, [clients, searchTerm]);

  const clientsWithContact = useMemo(
    () => clients.filter((client) => client.email || client.phone).length,
    [clients]
  );

  const handleDeleteClient = async (clientId: string) => {
    const { error } = await supabase.from('clients').delete().match({ id: clientId });

    if (error) {
      showError('Gagal menghapus klien.');
      console.error('Delete error:', error);
    } else {
      showSuccess('Klien berhasil dihapus.');
      setClients((current) => current.filter((client) => client.id !== clientId));
    }
  };

  const handleOpenForm = (client: Client | null = null) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    setIsFormOpen(false);
    fetchClients();
  };

  const renderActionMenu = (client: Client) => (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Buka aksi</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={`/client/${client.id}`}>Lihat Detail</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleOpenForm(client)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus klien?</AlertDialogTitle>
          <AlertDialogDescription>Tindakan ini akan menghapus klien secara permanen dari database.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleDeleteClient(client.id)}>Hapus</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <Users className="h-4 w-4" />
            Relasi klien
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Klien</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pusat data kontak dan histori bisnis pelanggan.</p>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Tambah Klien
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['Total klien', clients.length],
          ['Punya kontak', clientsWithContact],
          ['Hasil filter', filteredClients.length],
        ].map(([label, value]) => (
          <Card key={label} className="border-0 shadow-sm ring-1 ring-border/70">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-0 shadow-sm ring-1 ring-border/70">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Daftar klien</CardTitle>
            <CardDescription>{filteredClients.length} dari {clients.length} kontak tampil.</CardDescription>
          </div>
          <div className="relative min-w-0 sm:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, telepon, alamat..."
              className="pl-9"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">Belum ada klien.</p>
              <Button variant="link" onClick={() => handleOpenForm()}>
                Tambah klien pertama
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telepon</TableHead>
                      <TableHead>Alamat</TableHead>
                      <TableHead className="w-[120px] text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          <Link to={`/client/${client.id}`} className="hover:underline">
                            {client.name}
                          </Link>
                        </TableCell>
                        <TableCell>{client.email || '-'}</TableCell>
                        <TableCell>{client.phone || '-'}</TableCell>
                        <TableCell className="max-w-[360px] truncate">{client.address || '-'}</TableCell>
                        <TableCell className="text-right">{renderActionMenu(client)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {filteredClients.map((client) => (
                  <div key={client.id} className="rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/client/${client.id}`} className="truncate font-semibold hover:underline">
                          {client.name}
                        </Link>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{client.address || 'Alamat belum diisi'}</p>
                      </div>
                      {renderActionMenu(client)}
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{client.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="truncate">{client.phone || '-'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ClientForm isOpen={isFormOpen} setIsOpen={setIsFormOpen} client={selectedClient} onSave={handleFormSave} />
    </div>
  );
};

export default ClientList;
