import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassDialog,
  GlassDialogFooter,
  GlassTextarea,
  GlassBadge,
} from '@/components/glass';
import {
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Receipt,
  TrendingUp,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';

interface Client {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  tags: string[];
  totalQuotes: number;
  totalInvoices: number;
  totalRevenue: number;
  status: 'active' | 'inactive';
  avatar?: string;
}

export default function ClientListGlass() {
  const navigate = useNavigate();

  const mockClients: Client[] = [
    {
      id: '1',
      companyName: 'PT Maju Jaya',
      contactPerson: 'Budi Santoso',
      email: 'budi@majujaya.com',
      phone: '081234567890',
      address: 'Jl. Sudirman No. 123, Jakarta',
      tags: ['Enterprise', 'VIP'],
      totalQuotes: 24,
      totalInvoices: 18,
      totalRevenue: 450000000,
      status: 'active',
    },
    {
      id: '2',
      companyName: 'CV Sejahtera',
      contactPerson: 'Siti Nurhaliza',
      email: 'siti@sejahtera.co.id',
      phone: '082345678901',
      address: 'Jl. Gatot Subroto No. 45, Bandung',
      tags: ['SME', 'Regular'],
      totalQuotes: 12,
      totalInvoices: 10,
      totalRevenue: 180000000,
      status: 'active',
    },
    {
      id: '3',
      companyName: 'Toko Berkah',
      contactPerson: 'Ahmad Fauzi',
      email: 'ahmad@tokoberkah.com',
      phone: '083456789012',
      address: 'Jl. Ahmad Yani No. 78, Surabaya',
      tags: ['Retail'],
      totalQuotes: 8,
      totalInvoices: 6,
      totalRevenue: 95000000,
      status: 'active',
    },
    {
      id: '4',
      companyName: 'PT Teknologi Maju',
      contactPerson: 'Rina Wati',
      email: 'rina@tekmaju.com',
      phone: '084567890123',
      address: 'Jl. Thamrin No. 234, Jakarta',
      tags: ['Tech', 'Startup'],
      totalQuotes: 15,
      totalInvoices: 12,
      totalRevenue: 320000000,
      status: 'active',
    },
  ];

  const [clients, setClients] = useState<Client[]>(mockClients);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [newClient, setNewClient] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    tags: '',
  });

  const filteredClients = clients.filter((client) =>
    client.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddClient = () => {
    const client: Client = {
      id: Date.now().toString(),
      companyName: newClient.companyName,
      contactPerson: newClient.contactPerson,
      email: newClient.email,
      phone: newClient.phone,
      address: newClient.address,
      tags: newClient.tags.split(',').map((t) => t.trim()).filter(Boolean),
      totalQuotes: 0,
      totalInvoices: 0,
      totalRevenue: 0,
      status: 'active',
    };

    setClients([...clients, client]);
    setShowAddDialog(false);
    setNewClient({
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      tags: '',
    });
  };

  const handleDeleteClient = () => {
    if (selectedClient) {
      setClients(clients.filter((c) => c.id !== selectedClient.id));
      setShowDeleteDialog(false);
      setSelectedClient(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Calculate stats
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status === 'active').length;
  const totalRevenue = clients.reduce((sum, c) => sum + c.totalRevenue, 0);
  const avgRevenuePerClient = totalRevenue / totalClients;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060e20] via-[#0b1326] to-[#0a1628] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Daftar Klien</h1>
              <p className="text-text-secondary">Kelola informasi dan relationship dengan klien</p>
            </div>
            <GlassButton
              variant="primary"
              size="lg"
              icon={<Plus className="w-5 h-5" />}
              onClick={() => setShowAddDialog(true)}
            >
              Tambah Klien
            </GlassButton>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <GlassCard variant="medium" className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-accent-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">{totalClients}</div>
                  <div className="text-xs text-text-secondary">Total Klien</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard variant="medium" className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-accent-secondary" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">{activeClients}</div>
                  <div className="text-xs text-text-secondary">Klien Aktif</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard variant="medium" className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-accent-tertiary" />
                </div>
                <div>
                  <div className="text-lg font-bold text-text-primary">
                    {formatCurrency(totalRevenue).slice(0, -3)}jt
                  </div>
                  <div className="text-xs text-text-secondary">Total Revenue</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard variant="medium" className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="text-lg font-bold text-text-primary">
                    {formatCurrency(avgRevenuePerClient).slice(0, -3)}jt
                  </div>
                  <div className="text-xs text-text-secondary">Avg per Klien</div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <GlassInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari klien berdasarkan nama, kontak, atau email..."
              className="w-full pl-12"
            />
          </div>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <GlassCard key={client.id} variant="medium" className="p-6 hover:scale-[1.02] transition-transform">
              {/* Header with Avatar & Actions */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center border border-accent-primary/30">
                    <span className="text-lg font-bold text-accent-primary">
                      {getInitials(client.companyName)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-text-primary">{client.companyName}</h3>
                    <p className="text-sm text-text-tertiary">{client.contactPerson}</p>
                  </div>
                </div>

                {/* Actions Menu */}
                <div className="relative">
                  <button
                    onClick={() => setActiveMenu(activeMenu === client.id ? null : client.id)}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-text-secondary" />
                  </button>

                  {activeMenu === client.id && (
                    <div className="absolute right-0 mt-2 w-48 glass-heavy rounded-lg border border-border-glass shadow-xl z-10">
                      <button
                        onClick={() => {
                          console.log('View client:', client.id);
                          setActiveMenu(null);
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left rounded-t-lg"
                      >
                        <Eye className="w-4 h-4 text-accent-primary" />
                        <span className="text-sm text-text-primary">Lihat Detail</span>
                      </button>
                      <button
                        onClick={() => {
                          console.log('Edit client:', client.id);
                          setActiveMenu(null);
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                      >
                        <Edit className="w-4 h-4 text-accent-secondary" />
                        <span className="text-sm text-text-primary">Edit</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedClient(client);
                          setShowDeleteDialog(true);
                          setActiveMenu(null);
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left rounded-b-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400">Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary truncate">{client.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary">{client.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary line-clamp-1">{client.address}</span>
                </div>
              </div>

              {/* Tags */}
              {client.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {client.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 rounded-md glass-light text-xs text-text-secondary border border-border-glass"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border-glass">
                <div className="text-center">
                  <div className="text-xl font-bold text-accent-primary">{client.totalQuotes}</div>
                  <div className="text-xs text-text-tertiary">Penawaran</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-accent-secondary">{client.totalInvoices}</div>
                  <div className="text-xs text-text-tertiary">Faktur</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-accent-tertiary">
                    {formatCurrency(client.totalRevenue).slice(0, -3)}jt
                  </div>
                  <div className="text-xs text-text-tertiary">Revenue</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <GlassCard variant="medium" className="p-12 text-center">
            <Building2 className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-primary mb-2">Tidak ada klien ditemukan</h3>
            <p className="text-text-secondary mb-6">
              {searchQuery
                ? 'Coba kata kunci pencarian yang berbeda'
                : 'Belum ada klien. Tambahkan klien pertama Anda!'}
            </p>
            {!searchQuery && (
              <GlassButton variant="primary" onClick={() => setShowAddDialog(true)}>
                Tambah Klien Pertama
              </GlassButton>
            )}
          </GlassCard>
        )}
      </div>

      {/* Add Client Dialog */}
      <GlassDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        title="Tambah Klien Baru"
        description="Lengkapi informasi klien di bawah"
        size="lg"
      >
        <div className="space-y-4">
          <GlassInput
            label="Nama Perusahaan *"
            value={newClient.companyName}
            onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
            placeholder="PT/CV Nama Perusahaan"
          />
          <GlassInput
            label="Kontak Person *"
            value={newClient.contactPerson}
            onChange={(e) => setNewClient({ ...newClient, contactPerson: e.target.value })}
            placeholder="Nama kontak person"
          />
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Email *"
              type="email"
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              placeholder="email@perusahaan.com"
            />
            <GlassInput
              label="Telepon *"
              type="tel"
              value={newClient.phone}
              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              placeholder="08xxxxxxxxxx"
            />
          </div>
          <GlassTextarea
            label="Alamat"
            value={newClient.address}
            onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
            placeholder="Alamat lengkap perusahaan"
            rows={3}
          />
          <GlassInput
            label="Tags (pisahkan dengan koma)"
            value={newClient.tags}
            onChange={(e) => setNewClient({ ...newClient, tags: e.target.value })}
            placeholder="VIP, Enterprise, Tech"
          />
        </div>

        <GlassDialogFooter>
          <GlassButton variant="ghost" onClick={() => setShowAddDialog(false)}>
            Batal
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={handleAddClient}
            disabled={!newClient.companyName || !newClient.contactPerson || !newClient.email || !newClient.phone}
          >
            Simpan Klien
          </GlassButton>
        </GlassDialogFooter>
      </GlassDialog>

      {/* Delete Confirmation Dialog */}
      <GlassDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Hapus Klien?"
        description="Tindakan ini tidak dapat dibatalkan. Data klien akan dihapus permanen."
        size="sm"
      >
        {selectedClient && (
          <div className="glass-light rounded-lg p-4">
            <div className="font-semibold text-text-primary mb-1">
              {selectedClient.companyName}
            </div>
            <div className="text-sm text-text-secondary">
              {selectedClient.totalQuotes} penawaran, {selectedClient.totalInvoices} faktur
            </div>
          </div>
        )}

        <GlassDialogFooter>
          <GlassButton variant="ghost" onClick={() => setShowDeleteDialog(false)}>
            Batal
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={handleDeleteClient}
            className="bg-red-500 hover:bg-red-600"
          >
            Hapus Klien
          </GlassButton>
        </GlassDialogFooter>
      </GlassDialog>
    </div>
  );
}
