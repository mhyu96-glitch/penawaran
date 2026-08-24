import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
  Receipt,
} from 'lucide-react';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface Client {
  value: string;
  label: string;
  subLabel: string;
}

export default function InvoiceFormGlass() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditing = !!id;
  
  // Check if converting from quote
  const convertFromQuote = location.state?.fromQuote;

  // Mock clients data
  const mockClients: Client[] = [
    { value: '1', label: 'PT Maju Jaya', subLabel: 'Jl. Sudirman No. 123' },
    { value: '2', label: 'CV Sejahtera', subLabel: 'Jl. Gatot Subroto No. 45' },
    { value: '3', label: 'Toko Berkah', subLabel: 'Jl. Ahmad Yani No. 78' },
  ];

  const paymentTermsOptions = [
    { value: 'net7', label: 'Net 7', subLabel: 'Pembayaran dalam 7 hari' },
    { value: 'net14', label: 'Net 14', subLabel: 'Pembayaran dalam 14 hari' },
    { value: 'net30', label: 'Net 30', subLabel: 'Pembayaran dalam 30 hari' },
    { value: 'net60', label: 'Net 60', subLabel: 'Pembayaran dalam 60 hari' },
    { value: 'due_on_receipt', label: 'Due on Receipt', subLabel: 'Bayar saat terima' },
  ];

  // Form state
  const [invoiceNumber] = useState(`INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
  const [selectedClient, setSelectedClient] = useState(convertFromQuote?.client || '');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [paymentTerms, setPaymentTerms] = useState('net30');
  const [items, setItems] = useState<LineItem[]>(
    convertFromQuote?.items || [
      {
        id: '1',
        description: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        total: 0,
      },
    ]
  );
  const [discount, setDiscount] = useState({ type: 'amount', value: 0 });
  const [tax, setTax] = useState({ type: 'percentage', value: 11 });
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Pembayaran dilakukan sesuai dengan termin yang telah disepakati.');

  // Dialog states
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAction, setSaveAction] = useState<'draft' | 'send'>('draft');

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

  // Handlers
  const handleAddItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 0,
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

  const handlePaymentTermsChange = (value: string) => {
    setPaymentTerms(value);
    
    // Auto-calculate due date based on payment terms
    const today = new Date(invoiceDate);
    let daysToAdd = 30; // default
    
    switch (value) {
      case 'net7':
        daysToAdd = 7;
        break;
      case 'net14':
        daysToAdd = 14;
        break;
      case 'net30':
        daysToAdd = 30;
        break;
      case 'net60':
        daysToAdd = 60;
        break;
      case 'due_on_receipt':
        daysToAdd = 0;
        break;
    }
    
    const newDueDate = new Date(today.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    setDueDate(newDueDate.toISOString().split('T')[0]);
  };

  const handleSave = (action: 'draft' | 'send') => {
    setSaveAction(action);
    setShowSaveDialog(true);
  };

  const confirmSave = () => {
    // In real app, this would call API
    const invoiceData = {
      invoiceNumber,
      client: selectedClient,
      date: invoiceDate,
      dueDate,
      paymentTerms,
      items,
      discount,
      tax,
      subtotal: calculateSubtotal(),
      discountAmount: calculateDiscount(),
      taxAmount: calculateTax(),
      grandTotal: calculateGrandTotal(),
      notes,
      terms,
      status: saveAction === 'draft' ? 'draft' : 'sent',
      convertedFrom: convertFromQuote?.quoteNumber,
    };

    // In real app, this would call API
    // TODO: Replace with actual API call
    setShowSaveDialog(false);
    
    // Show success toast
    alert(saveAction === 'draft' ? 'Faktur disimpan sebagai draft' : 'Faktur berhasil dikirim!');
    
    // Navigate back to invoices list
    navigate('/invoices-glass');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDaysUntilDue = () => {
    const due = new Date(dueDate);
    const today = new Date(invoiceDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
            onClick={() => navigate('/invoices-glass')}
            className="mb-4"
          >
            Kembali
          </GlassButton>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                {isEditing ? 'Edit Faktur' : 'Buat Faktur Baru'}
              </h1>
              <p className="text-text-secondary">
                {convertFromQuote 
                  ? `Konversi dari Penawaran ${convertFromQuote.quoteNumber}`
                  : 'Lengkapi form di bawah untuk membuat faktur'
                }
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-text-tertiary">Nomor Faktur</div>
              <div className="text-2xl font-bold text-accent-secondary">{invoiceNumber}</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Client & Payment Information */}
          <GlassCard variant="medium">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-accent-primary" />
                <h2 className="text-xl font-bold text-text-primary">Informasi Klien & Pembayaran</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlassSelect
                  label="Pilih Klien"
                  options={mockClients}
                  value={selectedClient}
                  onChange={setSelectedClient}
                  searchable
                  placeholder="Cari atau pilih klien..."
                />

                <GlassDatePicker
                  label="Tanggal Faktur"
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                />

                <GlassSelect
                  label="Termin Pembayaran"
                  options={paymentTermsOptions}
                  value={paymentTerms}
                  onChange={handlePaymentTermsChange}
                />

                <GlassDatePicker
                  label="Jatuh Tempo"
                  value={dueDate}
                  onChange={setDueDate}
                  min={invoiceDate}
                />
              </div>

              {selectedClient && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 glass-light rounded-lg">
                    <div className="text-sm text-text-secondary">Detail Klien</div>
                    <div className="text-text-primary font-semibold mt-1">
                      {mockClients.find((c) => c.value === selectedClient)?.label}
                    </div>
                    <div className="text-sm text-text-tertiary mt-1">
                      {mockClients.find((c) => c.value === selectedClient)?.subLabel}
                    </div>
                  </div>

                  <div className="p-4 glass-light rounded-lg">
                    <div className="text-sm text-text-secondary">Info Jatuh Tempo</div>
                    <div className="text-text-primary font-semibold mt-1">
                      {calculateDaysUntilDue()} hari dari tanggal faktur
                    </div>
                    <div className="text-sm text-text-tertiary mt-1">
                      Jatuh tempo: {new Date(dueDate).toLocaleDateString('id-ID', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </div>
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
                  <h2 className="text-xl font-bold text-text-primary">Item Faktur</h2>
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
                      <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider py-3 px-2 w-36">
                        Harga Satuan
                      </th>
                      <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider py-3 px-2 w-40">
                        Total
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
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
                    <span className="text-text-primary font-bold text-lg">Total Tagihan</span>
                    <span className="text-accent-secondary font-bold text-2xl">
                      {formatCurrency(calculateGrandTotal())}
                    </span>
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
                  placeholder="Syarat & ketentuan pembayaran..."
                  rows={4}
                />
              </div>
            </div>
          </GlassCard>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <GlassButton variant="ghost" onClick={() => navigate('/invoices-glass')}>
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
              Kirim Faktur
            </GlassButton>
          </div>
        </div>
      </div>

      {/* Save Confirmation Dialog */}
      <GlassDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        title={saveAction === 'draft' ? 'Simpan sebagai Draft?' : 'Kirim Faktur?'}
        description={
          saveAction === 'draft'
            ? 'Faktur akan disimpan sebagai draft dan bisa diedit nanti.'
            : 'Faktur akan dikirim ke klien dan status akan diubah menjadi "Terkirim".'
        }
        size="sm"
      >
        <div className="glass-light rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Nomor Faktur</span>
            <span className="text-text-primary font-medium">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Klien</span>
            <span className="text-text-primary font-medium">
              {mockClients.find((c) => c.value === selectedClient)?.label || '-'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Jatuh Tempo</span>
            <span className="text-text-primary font-medium">
              {new Date(dueDate).toLocaleDateString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Total Item</span>
            <span className="text-text-primary font-medium">{items.length}</span>
          </div>
          <div className="border-t border-border-glass pt-2 mt-2 flex justify-between">
            <span className="text-text-primary font-bold">Total Tagihan</span>
            <span className="text-accent-secondary font-bold text-lg">
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
