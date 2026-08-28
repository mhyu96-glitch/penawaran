import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTextarea,
  GlassSelect,
  GlassDialog,
  GlassDialogFooter,
  GlassDatePicker,
} from '@/components/glass';
import {
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  DollarSign,
} from 'lucide-react';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice: number;
  total: number;
}

interface Client {
  value: string;
  label: string;
  subLabel: string;
}

export default function QuoteFormGlass() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  // Mock clients data
  const mockClients: Client[] = [
    { value: '1', label: 'PT Maju Jaya', subLabel: 'Jl. Sudirman No. 123' },
    { value: '2', label: 'CV Sejahtera', subLabel: 'Jl. Gatot Subroto No. 45' },
    { value: '3', label: 'Toko Berkah', subLabel: 'Jl. Ahmad Yani No. 78' },
    { value: 'new', label: '+ Tambah Klien Baru', subLabel: 'Buat klien baru' },
  ];

  // Form state
  const [quoteNumber] = useState(`QT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
  const [selectedClient, setSelectedClient] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [items, setItems] = useState<LineItem[]>([
    {
      id: '1',
      description: '',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 0,
      costPrice: 0,
      total: 0,
    },
  ]);
  const [discount, setDiscount] = useState({ type: 'amount', value: 0 });
  const [tax, setTax] = useState({ type: 'percentage', value: 11 });
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Pembayaran dilakukan dalam 30 hari setelah invoice diterima.');

  // Dialog states
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAction, setSaveAction] = useState<'draft' | 'send'>('draft');

  // New client form
  const [newClient, setNewClient] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
  });

  // Calculations
  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    if (discount.type === 'percentage') {
      return subtotal * (discount.value / 100);
    }
    return discount.value;
  };

  const calculateAfterDiscount = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const calculateTax = () => {
    const afterDiscount = calculateAfterDiscount();
    if (tax.type === 'percentage') {
      return afterDiscount * (tax.value / 100);
    }
    return tax.value;
  };

  const calculateGrandTotal = () => {
    return calculateAfterDiscount() + calculateTax();
  };

  const calculateProfit = () => {
    const totalCost = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);
    return calculateGrandTotal() - totalCost;
  };

  const calculateProfitMargin = () => {
    const grandTotal = calculateGrandTotal();
    if (grandTotal === 0) return 0;
    return (calculateProfit() / grandTotal) * 100;
  };

  // Handlers
  const handleAddItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 0,
      costPrice: 0,
      total: 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          updated.total = updated.quantity * updated.unitPrice;
          return updated;
        }
        return item;
      })
    );
  };

  const handleClientSelect = (value: string) => {
    if (value === 'new') {
      setShowNewClientDialog(true);
    } else {
      setSelectedClient(value);
    }
  };

  const handleSaveNewClient = () => {
    // In real app, this would call API
    // TODO: Replace with actual API call
    setShowNewClientDialog(false);
    setNewClient({
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
    });
  };

  const handleSave = (action: 'draft' | 'send') => {
    setSaveAction(action);
    setShowSaveDialog(true);
  };

  const confirmSave = () => {
    // In real app, this would call API
    const quoteData = {
      quoteNumber,
      client: selectedClient,
      date: quoteDate,
      validUntil,
      items,
      discount,
      tax,
      subtotal: calculateSubtotal(),
      discountAmount: calculateDiscount(),
      taxAmount: calculateTax(),
      grandTotal: calculateGrandTotal(),
      profit: calculateProfit(),
      profitMargin: calculateProfitMargin(),
      notes,
      terms,
      status: saveAction === 'draft' ? 'draft' : 'sent',
    };

    // In real app, this would call API
    // TODO: Replace with actual API call
    setShowSaveDialog(false);
    
    // Show success toast (would use actual toast in real app)
    alert(saveAction === 'draft' ? 'Penawaran disimpan sebagai draft' : 'Penawaran berhasil dikirim!');
    
    // Navigate back to quotes list
    navigate('/quotes-glass');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060e20] via-[#0b1326] to-[#0a1628] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <GlassButton
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/quotes-glass')}
            className="mb-4"
          >
            Kembali
          </GlassButton>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                {isEditing ? 'Edit Penawaran' : 'Buat Penawaran Baru'}
              </h1>
              <p className="text-text-secondary">
                Lengkapi form di bawah untuk membuat penawaran
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-text-tertiary">Nomor Penawaran</div>
              <div className="text-2xl font-bold text-accent-primary">{quoteNumber}</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Client Information */}
          <GlassCard variant="medium">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-accent-primary" />
                <h2 className="text-xl font-bold text-text-primary">Informasi Klien</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlassSelect
                  label="Pilih Klien"
                  options={mockClients}
                  value={selectedClient}
                  onChange={handleClientSelect}
                  searchable
                  placeholder="Cari atau pilih klien..."
                />

                <GlassDatePicker
                  label="Tanggal Penawaran"
                  value={quoteDate}
                  onChange={setQuoteDate}
                />

                <GlassDatePicker
                  label="Berlaku Hingga"
                  value={validUntil}
                  onChange={setValidUntil}
                  min={quoteDate}
                />
              </div>

              {selectedClient && selectedClient !== 'new' && (
                <div className="mt-4 p-4 glass-light rounded-lg">
                  <div className="text-sm text-text-secondary">Detail Klien</div>
                  <div className="text-text-primary font-semibold mt-1">
                    {mockClients.find((c) => c.value === selectedClient)?.label}
                  </div>
                  <div className="text-sm text-text-tertiary mt-1">
                    {mockClients.find((c) => c.value === selectedClient)?.subLabel}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Items Table */}
          <GlassCard variant="medium">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-accent-secondary" />
                  <h2 className="text-xl font-bold text-text-primary">Item Penawaran</h2>
                </div>
                <GlassButton
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleAddItem}
                >
                  Tambah Item
                </GlassButton>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-glass">
                      <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider py-3 px-2">
                        Deskripsi
                      </th>
                      <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider py-3 px-2 w-24">
                        Qty
                      </th>
                      <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider py-3 px-2 w-24">
                        Unit
                      </th>
                      <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider py-3 px-2 w-32">
                        Harga Satuan
                      </th>
                      <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider py-3 px-2 w-32">
                        Harga Modal
                      </th>
                      <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider py-3 px-2 w-36">
                        Total
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-b border-border-glass/50">
                        <td className="py-3 px-2">
                          <GlassInput
                            value={item.description}
                            onChange={(e) =>
                              handleItemChange(item.id, 'description', e.target.value)
                            }
                            placeholder="Nama produk/jasa..."
                            className="w-full"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <GlassInput
                            type="number"
                            value={item.quantity.toString()}
                            onChange={(e) =>
                              handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            min="0"
                            step="0.01"
                            className="w-full"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <GlassInput
                            value={item.unit}
                            onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                            placeholder="pcs"
                            className="w-full"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <GlassInput
                            type="number"
                            value={item.unitPrice.toString()}
                            onChange={(e) =>
                              handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                            }
                            min="0"
                            step="1000"
                            className="w-full text-right"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <GlassInput
                            type="number"
                            value={item.costPrice.toString()}
                            onChange={(e) =>
                              handleItemChange(item.id, 'costPrice', parseFloat(e.target.value) || 0)
                            }
                            min="0"
                            step="1000"
                            className="w-full text-right"
                          />
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="font-semibold text-text-primary">
                            {formatCurrency(item.total)}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={items.length === 1}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </GlassCard>

          {/* Calculations */}
          <GlassCard variant="medium">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <DollarSign className="w-5 h-5 text-accent-tertiary" />
                <h2 className="text-xl font-bold text-text-primary">Perhitungan</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Discount & Tax */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Diskon
                    </label>
                    <div className="flex gap-2">
                      <GlassInput
                        type="number"
                        value={discount.value.toString()}
                        onChange={(e) =>
                          setDiscount({ ...discount, value: parseFloat(e.target.value) || 0 })
                        }
                        min="0"
                        className="flex-1"
                      />
                      <GlassSelect
                        options={[
                          { value: 'amount', label: 'Rp' },
                          { value: 'percentage', label: '%' },
                        ]}
                        value={discount.type}
                        onChange={(value) => setDiscount({ ...discount, type: value })}
                        className="w-24"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Pajak (PPN)
                    </label>
                    <div className="flex gap-2">
                      <GlassInput
                        type="number"
                        value={tax.value.toString()}
                        onChange={(e) => setTax({ ...tax, value: parseFloat(e.target.value) || 0 })}
                        min="0"
                        className="flex-1"
                      />
                      <GlassSelect
                        options={[
                          { value: 'amount', label: 'Rp' },
                          { value: 'percentage', label: '%' },
                        ]}
                        value={tax.type}
                        onChange={(value) => setTax({ ...tax, type: value })}
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Summary */}
                <div className="glass-light rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Subtotal</span>
                    <span className="text-text-primary font-medium">
                      {formatCurrency(calculateSubtotal())}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Diskon</span>
                    <span className="text-red-400 font-medium">
                      - {formatCurrency(calculateDiscount())}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Setelah Diskon</span>
                    <span className="text-text-primary font-medium">
                      {formatCurrency(calculateAfterDiscount())}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Pajak</span>
                    <span className="text-text-primary font-medium">
                      {formatCurrency(calculateTax())}
                    </span>
                  </div>
                  <div className="border-t border-border-glass pt-3 flex justify-between">
                    <span className="text-text-primary font-bold text-lg">Grand Total</span>
                    <span className="text-accent-primary font-bold text-2xl">
                      {formatCurrency(calculateGrandTotal())}
                    </span>
                  </div>
                  <div className="border-t border-border-glass pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Estimasi Profit</span>
                      <span className="text-accent-secondary font-semibold">
                        {formatCurrency(calculateProfit())}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Margin</span>
                      <span className="text-accent-secondary font-semibold">
                        {calculateProfitMargin().toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Notes & Terms */}
          <GlassCard variant="medium">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GlassTextarea
                  label="Catatan"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan untuk klien..."
                  rows={4}
                />
                <GlassTextarea
                  label="Syarat & Ketentuan"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Syarat & ketentuan penawaran..."
                  rows={4}
                />
              </div>
            </div>
          </GlassCard>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <GlassButton variant="ghost" onClick={() => navigate('/quotes-glass')}>
              Batal
            </GlassButton>
            <GlassButton
              variant="glass"
              icon={<Save className="w-4 h-4" />}
              onClick={() => handleSave('draft')}
            >
              Simpan Draft
            </GlassButton>
            <GlassButton
              variant="primary"
              icon={<Send className="w-4 h-4" />}
              onClick={() => handleSave('send')}
            >
              Kirim Penawaran
            </GlassButton>
          </div>
        </div>
      </div>

      {/* New Client Dialog */}
      <GlassDialog
        isOpen={showNewClientDialog}
        onClose={() => setShowNewClientDialog(false)}
        title="Tambah Klien Baru"
        description="Lengkapi informasi klien di bawah"
        size="lg"
      >
        <div className="space-y-4">
          <GlassInput
            label="Nama Perusahaan"
            value={newClient.companyName}
            onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
            placeholder="PT/CV Nama Perusahaan"
          />
          <GlassInput
            label="Kontak Person"
            value={newClient.contactPerson}
            onChange={(e) => setNewClient({ ...newClient, contactPerson: e.target.value })}
            placeholder="Nama kontak person"
          />
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Email"
              type="email"
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              placeholder="email@perusahaan.com"
            />
            <GlassInput
              label="Telepon"
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
        </div>

        <GlassDialogFooter>
          <GlassButton variant="ghost" onClick={() => setShowNewClientDialog(false)}>
            Batal
          </GlassButton>
          <GlassButton variant="primary" onClick={handleSaveNewClient}>
            Simpan Klien
          </GlassButton>
        </GlassDialogFooter>
      </GlassDialog>

      {/* Save Confirmation Dialog */}
      <GlassDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        title={saveAction === 'draft' ? 'Simpan sebagai Draft?' : 'Kirim Penawaran?'}
        description={
          saveAction === 'draft'
            ? 'Penawaran akan disimpan sebagai draft dan bisa diedit nanti.'
            : 'Penawaran akan dikirim ke klien dan status akan diubah menjadi "Terkirim".'
        }
        size="sm"
      >
        <div className="glass-light rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Nomor Penawaran</span>
            <span className="text-text-primary font-medium">{quoteNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Klien</span>
            <span className="text-text-primary font-medium">
              {mockClients.find((c) => c.value === selectedClient)?.label || '-'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Total Item</span>
            <span className="text-text-primary font-medium">{items.length}</span>
          </div>
          <div className="border-t border-border-glass pt-2 mt-2 flex justify-between">
            <span className="text-text-primary font-bold">Grand Total</span>
            <span className="text-accent-primary font-bold text-lg">
              {formatCurrency(calculateGrandTotal())}
            </span>
          </div>
        </div>

        <GlassDialogFooter>
          <GlassButton variant="ghost" onClick={() => setShowSaveDialog(false)}>
            Batal
          </GlassButton>
          <GlassButton variant="primary" onClick={confirmSave}>
            {saveAction === 'draft' ? 'Simpan Draft' : 'Kirim Sekarang'}
          </GlassButton>
        </GlassDialogFooter>
      </GlassDialog>
    </div>
  );
}
