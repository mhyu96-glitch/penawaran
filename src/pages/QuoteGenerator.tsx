import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Trash2, PlusCircle, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/SessionContext";
import { showError, showSuccess } from "@/utils/toast";

type Item = {
  description: string;
  quantity: number;
  unit_price: number;
};

const QuoteGenerator = () => {
  const { user } = useAuth();
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

  const handleItemChange = (index: number, field: keyof Item, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.quantity) * Number(item.unit_price), 0);
  }, [items]);

  const discountAmount = useMemo(() => subtotal * (discount / 100), [subtotal, discount]);
  const taxAmount = useMemo(() => (subtotal - discountAmount) * (tax / 100), [subtotal, discountAmount, tax]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);

  const handleSubmit = async () => {
    if (!user) {
      showError("Anda harus masuk untuk membuat penawaran.");
      return;
    }
    setIsSubmitting(true);

    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .insert([{
        user_id: user.id,
        from_company: fromCompany, from_address: fromAddress, from_website: fromWebsite,
        to_client: toClient, to_address: toAddress, to_phone: toPhone,
        quote_number: quoteNumber, quote_date: quoteDate, valid_until: validUntil,
        discount_percentage: discount, tax_percentage: tax, terms: terms,
      }])
      .select().single();

    if (quoteError || !quoteData) {
      showError("Gagal membuat penawaran. Silakan coba lagi.");
      console.error("Quote Error:", quoteError);
      setIsSubmitting(false);
      return;
    }

    const quoteItems = items.map(item => ({
      quote_id: quoteData.id,
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    }));

    const { error: itemsError } = await supabase.from('quote_items').insert(quoteItems);

    if (itemsError) {
      showError("Gagal menyimpan item penawaran.");
      console.error("Items Error:", itemsError);
      await supabase.from('quotes').delete().match({ id: quoteData.id });
      setIsSubmitting(false);
      return;
    }

    showSuccess("Penawaran berhasil dibuat!");
    // Here you might want to redirect or clear the form
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl">Generator Penawaran</CardTitle>
          <CardDescription>Isi detail di bawah untuk membuat penawaran baru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Company & Client Info */}
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

          {/* Quote Details */}
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

          {/* Items */}
          <div className="space-y-4">
            <h3 className="font-semibold">Barang & Jasa</h3>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_100px_100px_100px_auto] gap-2 items-center">
                  <Input placeholder="Deskripsi Barang/Jasa" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} />
                  <Input type="number" placeholder="Jumlah" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                  <Input type="number" placeholder="Harga Satuan" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} />
                  <div className="text-right font-medium">{(Number(item.quantity) * Number(item.unit_price)).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</div>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addItem}><PlusCircle className="mr-2 h-4 w-4" /> Tambah Item</Button>
          </div>

          <Separator />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{subtotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Diskon (%)</span>
                <Input type="number" className="w-24" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jumlah Diskon</span>
                <span className="font-medium">{discountAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pajak (%)</span>
                <Input type="number" className="w-24" value={tax} onChange={e => setTax(parseFloat(e.target.value) || 0)} />
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

          {/* Terms */}
          <div className="space-y-2">
            <Label>Syarat & Ketentuan</Label>
            <Textarea placeholder="Contoh: Pembayaran 50% di muka..." value={terms} onChange={e => setTerms(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button size="lg" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : "Buat Penawaran"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default QuoteGenerator;