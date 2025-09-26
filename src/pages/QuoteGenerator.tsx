import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Trash2, PlusCircle, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";

type Item = {
  description: string;
  quantity: number;
  unit_price: number;
};

const QuoteGenerator = () => {
  const { id: quoteId } = useParams<{ id: string }>();
  const isEditMode = !!quoteId;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEditMode);
  const [fromCompany, setFromCompany] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromWebsite, setFromWebsite] = useState("");
  const [toClient, setToClient] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [toPhone, setToPhone] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState<Date | undefined>(new Date());
  const [validUntil, setValidUntil] = useState<Date | undefined>();
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [terms, setTerms] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
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
      setItems(data.quote_items.length > 0 ? data.quote_items : [{ description: "", quantity: 1, unit_price: 0 }]);
      setDiscount(data.discount_percentage || 0);
      setTax(data.tax_percentage || 0);
      setTerms(data.terms || "");
      setLoading(false);
    };

    const fetchProfileForNew = async () => {
      if (isEditMode || !user) return;
      const { data } = await supabase.from('profiles').select('company_name, company_address, company_website').eq('id', user.id).single();
      if (data) {
        setFromCompany(data.company_name || "");
        setFromAddress(data.company_address || "");
        setFromWebsite(data.company_website || "");
      }
    };

    if (isEditMode) {
      fetchQuoteForEdit();
    } else {
      fetchProfileForNew();
    }
  }, [quoteId, user, navigate, isEditMode]);

  const handleItemChange = (index: number, field: keyof Item, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + Number(item.quantity) * Number(item.unit_price), 0), [items]);
  const discountAmount = useMemo(() => subtotal * (discount / 100), [subtotal, discount]);
  const taxAmount = useMemo(() => (subtotal - discountAmount) * (tax / 100), [subtotal, discountAmount, tax]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    const quotePayload = {
      user_id: user.id, from_company: fromCompany, from_address: fromAddress, from_website: fromWebsite,
      to_client: toClient, to_address: toAddress, to_phone: toPhone, quote_number: quoteNumber,
      quote_date: quoteDate?.toISOString(), valid_until: validUntil?.toISOString(),
      discount_percentage: discount, tax_percentage: tax, terms: terms,
    };

    if (isEditMode) {
      // Update logic
      const { error: quoteUpdateError } = await supabase.from('quotes').update(quotePayload).match({ id: quoteId });
      if (quoteUpdateError) {
        showError("Gagal memperbarui penawaran.");
        setIsSubmitting(false); return;
      }
      await supabase.from('quote_items').delete().match({ quote_id: quoteId });
    } else {
      // Insert logic
      const { data: newQuote, error: quoteInsertError } = await supabase.from('quotes').insert(quotePayload).select().single();
      if (quoteInsertError || !newQuote) {
        showError("Gagal membuat penawaran.");
        setIsSubmitting(false); return;
      }
      const newQuoteId = newQuote.id;
      const quoteItemsPayload = items.map(item => ({ ...item, quote_id: newQuoteId }));
      await supabase.from('quote_items').insert(quoteItemsPayload);
      showSuccess("Penawaran berhasil dibuat!");
      navigate(`/quote/${newQuoteId}`);
      return;
    }

    const quoteItemsPayload = items.map(item => ({ ...item, quote_id: quoteId }));
    await supabase.from('quote_items').insert(quoteItemsPayload);
    showSuccess("Penawaran berhasil diperbarui!");
    setIsSubmitting(false);
    navigate(`/quote/${quoteId}`);
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
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl">{isEditMode ? "Edit Penawaran" : "Generator Penawaran"}</CardTitle>
          <CardDescription>{isEditMode ? "Perbarui detail di bawah ini." : "Isi detail di bawah untuk membuat penawaran baru."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold">Dari:</h3>
              <Input placeholder="Nama Perusahaan Anda" value={fromCompany} onChange={e => setFromCompany(e.target.value)} />
              <Textarea placeholder="Alamat Perusahaan Anda" value={fromAddress} onChange={e => setFromAddress(e.target.value)} />
              <Input placeholder="Website Perusahaan Anda" value={fromWebsite} onChange={e => setFromWebsite(e.target.value)} />
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Untuk:</h3>
              <Input placeholder="Nama Klien" value={toClient} onChange={e => setToClient(e.target.value)} />
              <Textarea placeholder="Alamat Klien" value={toAddress} onChange={e => setToAddress(e.target.value)} />
              <Input placeholder="Nomor Telepon Klien" value={toPhone} onChange={e => setToPhone(e.target.value)} />
            </div>
          </div>
          <Separator />
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
                    {quoteDate ? format(quoteDate, "PPP") : <span>Pilih tanggal</span>}
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
                    {validUntil ? format(validUntil, "PPP") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={validUntil} onSelect={setValidUntil} /></PopoverContent>
              </Popover>
            </div>
          </div>
          <Separator />
          <div className="space-y-4">
            <h3 className="font-semibold">Barang & Jasa</h3>
            <div className="hidden md:grid grid-cols-[1fr_100px_150px_150px_auto] gap-2 items-center px-1 text-sm font-medium text-muted-foreground">
                <div>Deskripsi</div>
                <div className="text-center">Jumlah</div>
                <div className="text-right">Harga Satuan</div>
                <div className="text-center">Total</div>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_100px_150px_150px_auto] gap-2 items-center">
                  <Input placeholder="Deskripsi Barang/Jasa" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} />
                  <Input type="number" placeholder="Jumlah" className="text-center" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                  <Input type="number" placeholder="Harga Satuan" className="text-right" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} />
                  <div className="text-center font-medium">{(Number(item.quantity) * Number(item.unit_price)).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</div>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addItem}><PlusCircle className="mr-2 h-4 w-4" /> Tambah Item</Button>
          </div>
          <Separator />
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{subtotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Diskon (%)</span>
                <Input type="number" className="w-24 text-right" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jumlah Diskon</span>
                <span className="font-medium">{discountAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pajak (%)</span>
                <Input type="number" className="w-24 text-right" value={tax} onChange={e => setTax(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jumlah Pajak</span>
                <span className="font-medium">{taxAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span>
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