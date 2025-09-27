import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Trash2, PlusCircle, Calendar as CalendarIcon, Library, FileEdit, FilePlus2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { id as localeId } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Client } from "./ClientList";
import ItemLibraryDialog from "@/components/ItemLibraryDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Item = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  cost_price: number;
};

const QuoteGenerator = () => {
  const { id: quoteId } = useParams<{ id: string }>();
  const isEditMode = !!quoteId;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEditMode);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [fromCompany, setFromCompany] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromWebsite, setFromWebsite] = useState("");
  const [toClient, setToClient] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [toPhone, setToPhone] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState<Date | undefined>(new Date());
  const [validUntil, setValidUntil] = useState<Date | undefined>();
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState("Draf");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isItemLibraryOpen, setIsItemLibraryOpen] = useState(false);

  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;
      const { data } = await supabase.from('clients').select('*').eq('user_id', user.id);
      if (data) setClients(data);
    };
    fetchClients();
  }, [user]);

  useEffect(() => {
    const generateNewQuoteNumber = async () => {
        if (!user) return;
        const year = new Date().getFullYear();
        const { data, error } = await supabase
            .from('quotes')
            .select('quote_number')
            .eq('user_id', user.id)
            .like('quote_number', `%${year}%`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error("Error fetching last quote number", error);
            setQuoteNumber(`Q-${year}-001`);
            return;
        }
        
        let nextNumber = 1;
        if (data && data.length > 0 && data[0].quote_number) {
            const lastNumberStr = data[0].quote_number.split('-').pop();
            if (lastNumberStr) {
                nextNumber = parseInt(lastNumberStr, 10) + 1;
            }
        }
        setQuoteNumber(`Q-${year}-${String(nextNumber).padStart(3, '0')}`);
    };

    const fetchQuoteForEdit = async () => {
      if (!quoteId || !user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', quoteId)
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        showError("Gagal memuat penawaran untuk diedit.");
        navigate('/quotes');
        return;
      }

      setFromCompany(data.from_company || "");
      setFromAddress(data.from_address || "");
      setFromWebsite(data.from_website || "");
      setToClient(data.to_client || "");
      setToAddress(data.to_address || "");
      setToPhone(data.to_phone || "");
      setQuoteNumber(data.quote_number || "");
      setQuoteDate(data.quote_date ? parseISO(data.quote_date) : undefined);
      setValidUntil(data.valid_until ? parseISO(data.valid_until) : undefined);
      setStatus(data.status || "Draf");
      setSelectedClientId(data.client_id);
      
      const itemsWithDefaults = data.quote_items.map((item: any) => ({ ...item, unit: item.unit || '', cost_price: item.cost_price || 0 }));
      setItems(itemsWithDefaults.length > 0 ? itemsWithDefaults : [{ description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }]);

      setDiscountAmount(data.discount_amount || 0);
      setTaxAmount(data.tax_amount || 0);
      setTerms(data.terms || "");
      setLoading(false);
    };

    const fetchProfileForNew = async () => {
      if (isEditMode || !user) return;
      const { data } = await supabase.from('profiles').select('company_name, company_address, company_website, default_terms, default_tax_amount, default_discount_amount').eq('id', user.id).single();
      if (data) {
        setFromCompany(data.company_name || "");
        setFromAddress(data.company_address || "");
        setFromWebsite(data.company_website || "");
        setTerms(data.default_terms || "");
        setTaxAmount(data.default_tax_amount || 0);
        setDiscountAmount(data.default_discount_amount || 0);
      }
      if (!quoteNumber) {
        generateNewQuoteNumber();
      }
    };

    if (isEditMode) {
      fetchQuoteForEdit();
    } else {
      fetchProfileForNew();
    }
  }, [quoteId, user, navigate, isEditMode, quoteNumber]);

  const handleClientSelect = (clientId: string) => {
    const selected = clients.find(c => c.id === clientId);
    if (selected) {
      setToClient(selected.name);
      setToAddress(selected.address || "");
      setToPhone(selected.phone || "");
      setSelectedClientId(selected.id);
    }
  };

  const handleItemChange = (index: number, field: keyof Item, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }]);
  const removeItem = (index: number) => {
    if (items.length > 1) {
        setItems(items.filter((_, i) => i !== index));
    } else {
        setItems([{ description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }]);
    }
  };

  const handleAddItemsFromLibrary = (libraryItems: any[]) => {
    const newItems = libraryItems.map(item => ({
        description: item.description,
        quantity: 1,
        unit: item.unit || '',
        unit_price: item.unit_price,
        cost_price: item.cost_price || 0,
    }));
    const existingItems = items.filter(item => item.description.trim() !== '');
    setItems([...existingItems, ...newItems]);
  };

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + Number(item.quantity) * Number(item.unit_price), 0), [items]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    const quotePayload = {
      user_id: user.id, from_company: fromCompany, from_address: fromAddress, from_website: fromWebsite,
      to_client: toClient, to_address: toAddress, to_phone: toPhone, quote_number: quoteNumber,
      quote_date: quoteDate?.toISOString(), valid_until: validUntil?.toISOString(),
      discount_amount: discountAmount, tax_amount: taxAmount, terms: terms, status: status,
      client_id: selectedClientId,
    };

    let currentQuoteId = quoteId;

    if (isEditMode) {
      const { error: quoteUpdateError } = await supabase.from('quotes').update(quotePayload).match({ id: quoteId });
      if (quoteUpdateError) {
        showError("Gagal memperbarui penawaran.");
        setIsSubmitting(false); return;
      }
      await supabase.from('quote_items').delete().match({ quote_id: quoteId });
    } else {
      const { data: newQuote, error: quoteInsertError } = await supabase.from('quotes').insert(quotePayload).select().single();
      if (quoteInsertError || !newQuote) {
        showError("Gagal membuat penawaran.");
        setIsSubmitting(false); return;
      }
      currentQuoteId = newQuote.id;
    }

    const quoteItemsPayload = items.filter(item => item.description).map(item => ({ ...item, quote_id: currentQuoteId }));
    if (quoteItemsPayload.length > 0) {
        const { error: itemsError } = await supabase.from('quote_items').insert(quoteItemsPayload);
        if (itemsError) {
            showError("Gagal menyimpan item penawaran.");
            setIsSubmitting(false);
            return;
        }
    }

    showSuccess(`Penawaran berhasil ${isEditMode ? 'diperbarui' : 'dibuat'}!`);
    setIsSubmitting(false);
    navigate(`/quote/${currentQuoteId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader><Skeleton className="h-8 w-64" /></CardHeader>
          <CardContent className="space-y-4"><Skeleton className="h-96 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <ItemLibraryDialog isOpen={isItemLibraryOpen} setIsOpen={setIsItemLibraryOpen} onAddItems={handleAddItemsFromLibrary} />
      <Card className="w-full max-w-5xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            {isEditMode ? <FileEdit className="h-7 w-7" /> : <FilePlus2 className="h-7 w-7" />}
            <CardTitle className="text-3xl">{isEditMode ? "Edit Penawaran" : "Generator Penawaran"}</CardTitle>
          </div>
          <CardDescription>{isEditMode ? "Perbarui detail di bawah ini." : "Isi detail di bawah untuk membuat penawaran baru."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* From/To sections remain the same */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold">Dari:</h3>
              <Input placeholder="Nama Perusahaan Anda" value={fromCompany} onChange={e => setFromCompany(e.target.value)} />
              <Textarea placeholder="Alamat Perusahaan Anda" value={fromAddress} onChange={e => setFromAddress(e.target.value)} />
              <Input placeholder="Website Perusahaan Anda" value={fromWebsite} onChange={e => setFromWebsite(e.target.value)} />
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Untuk:</h3>
              <Select onValueChange={handleClientSelect} value={selectedClientId || undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Klien yang Ada atau Isi Manual" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Nama Klien" value={toClient} onChange={e => setToClient(e.target.value)} />
              <Textarea placeholder="Alamat Klien" value={toAddress} onChange={e => setToAddress(e.target.value)} />
              <Input placeholder="Nomor Telepon Klien" value={toPhone} onChange={e => setToPhone(e.target.value)} />
            </div>
          </div>
          <Separator />
          {/* Quote details sections remain the same */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nomor Penawaran</Label>
              <Input placeholder="Contoh: Q-2024-001" value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Penawaran</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !quoteDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {quoteDate ? format(quoteDate, "PPP", { locale: localeId }) : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={quoteDate} onSelect={setQuoteDate} initialFocus /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Berlaku Hingga</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !validUntil && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {validUntil ? format(validUntil, "PPP", { locale: localeId }) : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={validUntil} onSelect={setValidUntil} /></PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-2 md:w-1/3">
            <Label>Status Penawaran</Label>
            <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Draf">Draf</SelectItem>
                    <SelectItem value="Terkirim">Terkirim</SelectItem>
                    <SelectItem value="Diterima">Diterima</SelectItem>
                    <SelectItem value="Ditolak">Ditolak</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="space-y-4">
            <h3 className="font-semibold">Barang & Jasa</h3>
            <div className="rounded-md border overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[50px] text-center">No.</TableHead>
                    <TableHead className="min-w-[200px]">Deskripsi</TableHead>
                    <TableHead className="w-[100px] text-center">Jumlah</TableHead>
                    <TableHead className="w-[100px]">Satuan</TableHead>
                    <TableHead className="w-[150px] text-right">Harga Modal</TableHead>
                    <TableHead className="w-[150px] text-right">Harga Jual</TableHead>
                    <TableHead className="w-[150px] text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item, index) => (
                    <TableRow key={index}>
                        <TableCell className="text-center font-medium">{index + 1}</TableCell>
                        <TableCell><Input placeholder="Deskripsi" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} /></TableCell>
                        <TableCell><Input type="number" placeholder="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="w-full text-center" /></TableCell>
                        <TableCell><Input placeholder="Pcs" value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value)} /></TableCell>
                        <TableCell><Input type="number" placeholder="0" value={item.cost_price} onChange={e => handleItemChange(index, 'cost_price', e.target.value)} className="w-full text-right" /></TableCell>
                        <TableCell><Input type="number" placeholder="0" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} className="w-full text-right" /></TableCell>
                        <TableCell className="text-right font-medium">{(Number(item.quantity) * Number(item.unit_price)).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</TableCell>
                        <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addItem}><PlusCircle className="mr-2 h-4 w-4" /> Tambah Item</Button>
                <Button variant="outline" size="sm" onClick={() => setIsItemLibraryOpen(true)}><Library className="mr-2 h-4 w-4" /> Pilih dari Pustaka</Button>
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{subtotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Diskon (Rp)</span>
                <Input type="number" className="w-32 text-right" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pajak (Rp)</span>
                <Input type="number" className="w-32 text-right" value={taxAmount} onChange={e => setTaxAmount(parseFloat(e.target.value) || 0)} />
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span>{total.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span>
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Syarat & Ketentuan</Label>
            <Textarea placeholder="Contoh: Pembayaran 50% di muka..." value={terms} onChange={e => setTerms(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button size="lg" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : (isEditMode ? "Simpan Perubahan" : "Buat & Lihat Penawaran")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default QuoteGenerator;