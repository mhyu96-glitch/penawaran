import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Trash2, PlusCircle, Calendar as CalendarIcon, Library, FileEdit, FilePlus2, ReceiptText, TrendingUp, GripVertical, Heading, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { parseISO } from "date-fns";
import { cn, safeFormat, formatCurrency, calculateSubtotal, calculateTotal, calculateItemTotal } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Client } from "@/pages/ClientList";
import ItemLibraryDialog from "@/components/ItemLibraryDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Project } from "./ProjectForm";
import AttachmentManager from "./AttachmentManager";
import TemplateManager from "./TemplateManager";
import ProfitAnalysisCard from "./ProfitAnalysisCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";

// DnD Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Item = {
  uid: string; // Local unique ID for DnD
  item_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  cost_price: number;
  [key: string]: any;
};

interface Attachment {
  name: string;
  url: string;
  path: string;
}

interface DocumentGeneratorProps {
  docType: 'quote' | 'invoice';
}

// Helper formatting for rupiah thousand dots (e.g. 1.500.000)
const formatNumberWithDots = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'number' ? val : Number(String(val).replace(/\D/g, ''));
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('id-ID').format(num);
};

const parseDotsToNumber = (val: string): number => {
  const clean = val.replace(/\D/g, '');
  return clean === '' ? 0 : parseInt(clean, 10);
};

// Sortable Row Component
const SortableItemRow = ({ 
  item, 
  index, 
  handleItemChange, 
  removeItem,
  isMobile
}: { 
  item: Item; 
  index: number; 
  handleItemChange: (index: number, field: keyof Item, value: any) => void; 
  removeItem: (index: number) => void;
  isMobile: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.uid });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: isDragging ? 'relative' as const : undefined,
  };

  const isSectionHeader = Number(item.quantity) === 0;

  // COMPACT & BALANCED MOBILE CARD VIEW
  if (isMobile) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
          "relative rounded-2xl border bg-card p-3.5 shadow-xs transition-all space-y-3",
          isDragging && "opacity-50 z-50",
          isSectionHeader ? "border-primary/30 bg-primary/5" : "border-border/80"
        )}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border/70 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-black">
              {index + 1}
            </span>
            {isSectionHeader ? (
              <span className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-primary">
                <Heading className="h-3.5 w-3.5" /> Kategori Header
              </span>
            ) : (
              <span className="text-xs font-bold text-foreground">
                Item #{index + 1}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
              <GripVertical className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-500/10" onClick={() => removeItem(index)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Description Field */}
        <div>
          <Label className="text-[10px] font-bold text-muted-foreground uppercase">Deskripsi Item / Jasa</Label>
          <Input 
            placeholder={isSectionHeader ? "Nama Kategori (misal: Instalasi, Material, dll)" : "Deskripsi item produk atau layanan"} 
            value={item.description} 
            onChange={e => handleItemChange(index, 'description', e.target.value)} 
            className={cn("h-10 rounded-xl text-xs font-medium mt-1", isSectionHeader && "font-bold text-primary border-primary/40")}
          />
        </div>

        {!isSectionHeader && (
          <>
            {/* 2-Column Grid: Qty & Unit */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Jumlah (Qty)</Label>
                <Input 
                  type="number" 
                  placeholder="1" 
                  value={item.quantity} 
                  onChange={e => handleItemChange(index, 'quantity', Number(e.target.value) || 0)} 
                  className="h-9 rounded-xl text-center text-xs font-bold mt-1" 
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Satuan</Label>
                <Input 
                  placeholder="Pcs / Unit / Bln" 
                  value={item.unit} 
                  onChange={e => handleItemChange(index, 'unit', e.target.value)} 
                  className="h-9 rounded-xl text-xs text-center font-medium mt-1" 
                />
              </div>
            </div>

            {/* 2-Column Grid: Modal (HPP) & Harga Jual SIDE-BY-SIDE */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Harga Modal (HPP)</Label>
                <div className="relative flex items-center mt-1">
                  <span className="pointer-events-none absolute left-2.5 text-[11px] font-bold text-muted-foreground select-none">Rp</span>
                  <Input 
                    type="text" 
                    inputMode="numeric"
                    placeholder="0" 
                    value={formatNumberWithDots(item.cost_price)} 
                    onChange={e => handleItemChange(index, 'cost_price', parseDotsToNumber(e.target.value))} 
                    className="h-9 rounded-xl pl-8 pr-2.5 text-right text-xs font-medium tabular-nums" 
                  />
                </div>
              </div>

              <div>
                <Label className="text-[10px] font-bold text-primary uppercase">Harga Jual</Label>
                <div className="relative flex items-center mt-1">
                  <span className="pointer-events-none absolute left-2.5 text-[11px] font-bold text-primary select-none">Rp</span>
                  <Input 
                    type="text" 
                    inputMode="numeric"
                    placeholder="0" 
                    value={formatNumberWithDots(item.unit_price)} 
                    onChange={e => handleItemChange(index, 'unit_price', parseDotsToNumber(e.target.value))} 
                    className="h-9 rounded-xl pl-8 pr-2.5 border-primary/40 text-right text-xs font-bold text-foreground tabular-nums focus-visible:ring-primary" 
                  />
                </div>
              </div>
            </div>

            {/* Compact Subtotal Footer */}
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 border border-border/60">
              <div className="text-[10px] font-semibold text-muted-foreground">
                {Number(item.unit_price) > 0 && Number(item.cost_price) > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Profit: {formatCurrency((Number(item.unit_price) - Number(item.cost_price)) * (Number(item.quantity) || 1))}
                  </span>
                ) : (
                  <span>Total Item</span>
                )}
              </div>
              <span className="font-extrabold text-sm text-foreground tabular-nums">
                {formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  // DESKTOP SECTION HEADER
  if (isSectionHeader) {
    return (
      <TableRow ref={setNodeRef} style={style} className={cn("bg-primary/5 hover:bg-primary/10 border-b border-border/80", isDragging && "opacity-50")}>
        <TableCell className="text-center w-10 py-2.5 px-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
            <GripVertical className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
        <TableCell colSpan={5} className="py-2.5 px-3">
          <div className="flex items-center gap-2">
            <Heading className="h-4 w-4 shrink-0 text-primary" />
            <Input 
              placeholder="Nama Kategori (misal: Pekerjaan Persiapan, Material Utama, dll)" 
              value={item.description} 
              onChange={e => handleItemChange(index, 'description', e.target.value)} 
              className="h-9 font-bold text-sm text-primary border-transparent bg-transparent focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background px-2"
            />
          </div>
        </TableCell>
        <TableCell className="text-right font-bold text-xs text-muted-foreground py-2.5 px-3">-</TableCell>
        <TableCell className="text-center w-10 py-2.5 px-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:bg-rose-500/10" onClick={() => removeItem(index)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  // DESKTOP REGULAR ITEM ROW
  return (
    <TableRow ref={setNodeRef} style={style} className={cn("hover:bg-muted/30 transition-colors border-b border-border/60", isDragging && "opacity-50")}>
      {/* Handle */}
      <TableCell className="text-center w-10 py-2.5 px-1 align-middle">
        <Button variant="ghost" size="icon" className="h-7 w-7 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="h-3.5 w-3.5" />
        </Button>
      </TableCell>

      {/* Deskripsi */}
      <TableCell className="py-2.5 px-3 align-middle">
        <Input 
          placeholder="Deskripsi barang atau jasa" 
          value={item.description} 
          onChange={e => handleItemChange(index, 'description', e.target.value)} 
          className="h-9 rounded-xl text-xs font-medium"
        />
      </TableCell>

      {/* Jumlah (Qty) */}
      <TableCell className="w-20 py-2.5 px-2 align-middle">
        <Input 
          type="number" 
          placeholder="1" 
          value={item.quantity} 
          onChange={e => handleItemChange(index, 'quantity', Number(e.target.value) || 0)} 
          className="h-9 rounded-xl text-center text-xs font-bold" 
        />
      </TableCell>

      {/* Satuan */}
      <TableCell className="w-24 py-2.5 px-2 align-middle">
        <Input 
          placeholder="Pcs" 
          value={item.unit} 
          onChange={e => handleItemChange(index, 'unit', e.target.value)} 
          className="h-9 rounded-xl text-xs text-center font-medium"
        />
      </TableCell>

      {/* Harga Modal (HPP) with Dots */}
      <TableCell className="w-40 py-2.5 px-2 align-middle">
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-2.5 text-[11px] font-bold text-muted-foreground select-none">Rp</span>
          <Input 
            type="text" 
            inputMode="numeric"
            placeholder="0" 
            value={formatNumberWithDots(item.cost_price)} 
            onChange={e => handleItemChange(index, 'cost_price', parseDotsToNumber(e.target.value))} 
            className="h-9 rounded-xl pl-8 pr-2.5 text-right text-xs font-medium tabular-nums" 
          />
        </div>
      </TableCell>

      {/* Harga Jual with Dots */}
      <TableCell className="w-40 py-2.5 px-2 align-middle">
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-2.5 text-[11px] font-bold text-primary select-none">Rp</span>
          <Input 
            type="text" 
            inputMode="numeric"
            placeholder="0" 
            value={formatNumberWithDots(item.unit_price)} 
            onChange={e => handleItemChange(index, 'unit_price', parseDotsToNumber(e.target.value))} 
            className="h-9 rounded-xl pl-8 pr-2.5 border-primary/40 text-right text-xs font-bold text-foreground tabular-nums focus-visible:ring-primary" 
          />
        </div>
      </TableCell>

      {/* Total */}
      <TableCell className="w-36 text-right font-black text-xs text-foreground tabular-nums py-2.5 px-3 align-middle">
        {formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
      </TableCell>

      {/* Action */}
      <TableCell className="text-center w-10 py-2.5 px-1 align-middle">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors" onClick={() => removeItem(index)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

const DocumentGenerator = ({ docType }: DocumentGeneratorProps) => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [loading, setLoading] = useState(isEditMode);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [fromCompany, setFromCompany] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromWebsite, setFromWebsite] = useState("");
  const [toClient, setToClient] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [toPhone, setToPhone] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docTitle, setDocTitle] = useState(""); 
  const [docDate, setDocDate] = useState<Date | undefined>(new Date());
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [status, setStatus] = useState("Draf");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [downPaymentAmount, setDownPaymentAmount] = useState(0);
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<Item[]>([{ uid: crypto.randomUUID(), description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isItemLibraryOpen, setIsItemLibraryOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const config = useMemo(() => {
    if (docType === 'quote') {
      return {
        title: 'Penawaran',
        table: 'quotes' as const,
        itemTable: 'quote_items' as const,
        foreignKey: 'quote_id' as const,
        numberPrefix: 'Q-',
        numberLabel: 'Nomor Penawaran',
        dateLabel: 'Tanggal Penawaran',
        expiryLabel: 'Berlaku Hingga',
        navigateTo: (docId: string) => `/quote/${docId}`,
        fields: ['quote_number', 'created_at', 'valid_until'],
        statuses: ['Draf', 'Terkirim', 'Diterima', 'Ditolak'],
        icon: FileEdit
      };
    } else {
      return {
        title: 'Faktur',
        table: 'invoices' as const,
        itemTable: 'invoice_items' as const,
        foreignKey: 'invoice_id' as const,
        numberPrefix: 'INV-',
        numberLabel: 'Nomor Faktur',
        dateLabel: 'Tanggal Faktur',
        expiryLabel: 'Jatuh Tempo',
        navigateTo: (docId: string) => `/invoice/${docId}`,
        fields: ['invoice_number', 'created_at', 'due_date', 'down_payment_amount'],
        statuses: ['Draf', 'Terkirim', 'Lunas', 'Jatuh Tempo', 'Batal'],
        icon: ReceiptText
      };
    }
  }, [docType]);

  useEffect(() => {
    const fetchDependencies = async () => {
      if (!user) return;
      const { data: clientData } = await supabase.from('clients').select('*').eq('user_id', user.id);
      if (clientData) setClients(clientData);
      
      const { data: projectData } = await supabase.from('projects').select('*').eq('user_id', user.id);
      if (projectData) setProjects(projectData);
    };
    fetchDependencies();
  }, [user]);

  useEffect(() => {
    const generateNewDocNumber = async () => {
      if (!user || isEditMode) return;
      const datePart = new Date().toISOString().slice(2, 7).replace('-', '');
      const { count } = await supabase.from(config.table).select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      const counter = (count || 0) + 1;
      setDocNumber(`${config.numberPrefix}${datePart}-${counter.toString().padStart(3, '0')}`);
    };
    generateNewDocNumber();
  }, [user, isEditMode, config]);

  useEffect(() => {
    const fetchDocData = async () => {
      if (!isEditMode || !id || !user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from(config.table)
        .select(`*, ${config.itemTable}(*)`)
        .eq('id', id)
        .single();
      
      if (error || !data) {
        showError(`Gagal memuat ${config.title}.`);
        navigate(`/${docType}s`);
        return;
      }

      setFromCompany(data.from_company || "");
      setFromAddress(data.from_address || "");
      setFromWebsite(data.from_website || "");
      setToClient(data.to_client || "");
      setToAddress(data.to_address || "");
      setToPhone(data.to_phone || "");
      setSelectedClientId(data.client_id || null);
      setSelectedProjectId(data.project_id || undefined);
      setDocNumber(data[config.fields[0]] || "");
      setDocTitle(data.title || "");
      setDocDate(data[config.fields[1]] ? parseISO(data[config.fields[1]]) : undefined);
      setExpiryDate(data[config.fields[2]] ? parseISO(data[config.fields[2]]) : undefined);
      setStatus(data.status || config.statuses[0]);
      setDiscountAmount(data.discount_amount || 0);
      setTaxAmount(data.tax_amount || 0);
      if (docType === 'invoice') setDownPaymentAmount(data.down_payment_amount || 0);
      setTerms(data.terms || "");
      setAttachments(data.attachments || []);

      const fetchedItems = data[config.itemTable];
      if (fetchedItems && fetchedItems.length > 0) {
        setItems(fetchedItems.map((item: any) => ({ ...item, uid: crypto.randomUUID() })));
      }
      setLoading(false);
    };
    fetchDocData();
  }, [id, isEditMode, user, config, navigate, docType]);

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setToClient(client.name || "");
      setToAddress(client.address || "");
      setToPhone(client.phone || "");
    }
  };

  const handleApplyTemplate = (template: any) => {
    setDocTitle(template.content.title || docTitle);
    setTerms(template.content.terms || terms);
    setDiscountAmount(template.content.discount_amount || 0);
    setTaxAmount(template.content.tax_amount || 0);
    if (template.content.items && template.content.items.length > 0) {
        setItems(template.content.items.map((item: any) => ({ ...item, uid: crypto.randomUUID() })));
    }
  };

  const handleItemChange = (index: number, field: keyof Item, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { uid: crypto.randomUUID(), description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }]);
  };

  const addSectionHeader = () => {
    setItems([...items, { uid: crypto.randomUUID(), description: "", quantity: 0, unit: "", unit_price: 0, cost_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
    else setItems([{ uid: crypto.randomUUID(), description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }]);
  };

  const handleAddItemsFromLibrary = (libraryItems: any[]) => {
    const newItems = libraryItems.map(item => ({
        uid: crypto.randomUUID(),
        item_id: item.id, 
        description: item.description, 
        quantity: 1, 
        unit: item.unit || '',
        unit_price: item.unit_price, 
        cost_price: item.cost_price || 0,
    }));
    const existingItems = items.filter(item => item.description.trim() !== '');
    setItems([...existingItems, ...newItems]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.uid === active.id);
        const newIndex = items.findIndex((item) => item.uid === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const subtotal = useMemo(() => calculateSubtotal(items), [items]);
  const total = useMemo(() => calculateTotal(subtotal, discountAmount, taxAmount), [subtotal, discountAmount, taxAmount]);

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    let finalClientId = selectedClientId;

    // Otomatis Simpan / Hubungkan sebagai Klien Master tanpa perlu input manual
    if (toClient && toClient.trim()) {
      const trimmedName = toClient.trim();
      try {
        if (!finalClientId) {
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', trimmedName)
            .limit(1)
            .maybeSingle();

          if (existingClient?.id) {
            finalClientId = existingClient.id;
          } else {
            const { data: newClient } = await supabase
              .from('clients')
              .insert({
                user_id: user.id,
                name: trimmedName,
                address: toAddress || '',
                phone: toPhone || '',
              })
              .select('id')
              .single();

            if (newClient?.id) {
              finalClientId = newClient.id;
            }
          }
        }
      } catch (clientErr) {
        console.error('Error auto-syncing client:', clientErr);
      }
    }

    const docPayload: { [key: string]: any } = {
      user_id: user.id, from_company: fromCompany, from_address: fromAddress, from_website: fromWebsite,
      to_client: toClient, to_address: toAddress, to_phone: toPhone,
      discount_amount: discountAmount, tax_amount: taxAmount, terms: terms, status: status,
      client_id: finalClientId, project_id: selectedProjectId,
      attachments: attachments,
      title: docTitle, 
    };
    docPayload[config.fields[0]] = docNumber;
    docPayload[config.fields[1]] = docDate?.toISOString();
    docPayload[config.fields[2]] = expiryDate?.toISOString();
    if (docType === 'invoice') docPayload[config.fields[3]] = downPaymentAmount;

    let currentDocId = id;
    let createdNewDocument = false;
    const previousItemIds = isEditMode
      ? items.map(item => item.id).filter((itemId): itemId is string => Boolean(itemId))
      : [];

    if (isEditMode) {
      const { error } = await supabase.from(config.table).update(docPayload).match({ id });
      if (error) { 
        showError(`Gagal memperbarui ${config.title}.`); 
        setIsSubmitting(false); 
        return; 
      }
    } else {
      const { data, error } = await supabase.from(config.table).insert(docPayload).select().single();
      if (error || !data) { 
        showError(`Gagal membuat ${config.title}.`); 
        setIsSubmitting(false); 
        return; 
      }
      currentDocId = data.id;
      createdNewDocument = true;
    }

    const itemsPayload = items
        .filter(item => item.description)
        .map(({ uid, id, created_at, ...item }: any) => ({
            ...item,
            [config.foreignKey]: currentDocId
        }));
    
    let insertedItemIds: string[] = [];
    if (itemsPayload.length > 0) {
      const { data: insertedItems, error } = await supabase
        .from(config.itemTable)
        .insert(itemsPayload)
        .select('id');
      if (error) {
        if (createdNewDocument && currentDocId) {
          await supabase.from(config.table).delete().eq('id', currentDocId);
        }
        showError(`Gagal menyimpan item: ${error.message}`); 
        setIsSubmitting(false); 
        return; 
      }
      insertedItemIds = (insertedItems || []).map((item: { id: string }) => item.id);
    }

    if (isEditMode && previousItemIds.length > 0) {
      const { error: deleteError } = await supabase
        .from(config.itemTable)
        .delete()
        .in('id', previousItemIds);

      if (deleteError) {
        if (insertedItemIds.length > 0) {
          await supabase.from(config.itemTable).delete().in('id', insertedItemIds);
        }
        showError(`Gagal mengganti item lama: ${deleteError.message}`);
        setIsSubmitting(false); 
        return; 
      }
    }

    showSuccess(`${config.title} berhasil ${isEditMode ? 'diperbarui' : 'dibuat'}!`);
    setIsSubmitting(false);
    if (currentDocId) navigate(config.navigateTo(currentDocId));
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 lg:px-8">
        <Card className="mx-auto w-full rounded-2xl">
          <CardHeader><Skeleton className="h-8 w-64" /></CardHeader>
          <CardContent className="space-y-4"><Skeleton className="h-96 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  const Icon = isEditMode ? config.icon : (docType === 'quote' ? FilePlus2 : ReceiptText);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 lg:px-8 lg:py-6">
      <ItemLibraryDialog isOpen={isItemLibraryOpen} setIsOpen={setIsItemLibraryOpen} onAddItems={handleAddItemsFromLibrary} />
      <Card className="mx-auto w-full overflow-hidden rounded-3xl border border-border/80 shadow-md">
        <CardHeader className="space-y-4 border-b bg-card px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xl font-black tracking-tight sm:text-2xl text-foreground">
                    {isEditMode ? `Edit ${config.title}` : `Buat ${config.title} Baru`}
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs text-muted-foreground">
                    {isEditMode ? "Perbarui detail dokumen, barang dan jasa." : "Isi detail dokumen dan rincian item pekerjaan."}
                  </CardDescription>
                </div>
              </div>
            </div>
            <TemplateManager type={docType} currentData={{ docTitle, items, terms, taxAmount, discountAmount }} onApplyTemplate={handleApplyTemplate} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-4 py-6 sm:px-6 lg:space-y-8">
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <section className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-2xs">
              <h3 className="font-bold text-sm text-foreground">Dari (Penerbit)</h3>
              <Input className="h-11 rounded-xl text-sm font-medium" placeholder="Nama Perusahaan Anda" value={fromCompany} onChange={e => setFromCompany(e.target.value)} />
              <Textarea className="min-h-24 rounded-xl text-sm font-medium" placeholder="Alamat Perusahaan Anda" value={fromAddress} onChange={e => setFromAddress(e.target.value)} />
              <Input className="h-11 rounded-xl text-sm font-medium" placeholder="Website / Kontak Perusahaan" value={fromWebsite} onChange={e => setFromWebsite(e.target.value)} />
            </section>
            <section className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-2xs">
              <h3 className="font-bold text-sm text-foreground">Untuk (Klien Penerima)</h3>
              <Select onValueChange={handleClientSelect} value={selectedClientId || undefined}>
                <SelectTrigger className="h-11 rounded-xl text-sm font-medium"><SelectValue placeholder="Pilih dari daftar klien atau isi manual" /></SelectTrigger>
                <SelectContent>{clients.map(client => (<SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>))}</SelectContent>
              </Select>
              <Input className="h-11 rounded-xl text-sm font-medium" placeholder="Nama Klien" value={toClient} onChange={e => setToClient(e.target.value)} />
              <Textarea className="min-h-24 rounded-xl text-sm font-medium" placeholder="Alamat Klien" value={toAddress} onChange={e => setToAddress(e.target.value)} />
              <Input className="h-11 rounded-xl text-sm font-medium" placeholder="Nomor Telepon / WhatsApp Klien" value={toPhone} onChange={e => setToPhone(e.target.value)} />
            </section>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Proyek Terkait (Opsional)</Label><Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger className="h-11 rounded-xl text-sm"><SelectValue placeholder="Pilih proyek" /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status Dokumen</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="h-11 rounded-xl text-sm"><SelectValue placeholder="Pilih status" /></SelectTrigger><SelectContent>{config.statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Judul / Perihal</Label>
            <Input className="h-11 rounded-xl text-sm" placeholder={`Contoh: Paket CCTV 4 Channel, Renovasi Kantor, dll...`} value={docTitle} onChange={e => setDocTitle(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Judul ini akan tampil di laporan dan pesan WhatsApp ke klien.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{config.numberLabel}</Label><Input className="h-11 rounded-xl text-sm font-mono font-bold" value={docNumber} onChange={e => setDocNumber(e.target.value)} /></div>
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{config.dateLabel}</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("h-11 rounded-xl w-full justify-start text-left font-normal", !docDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4 text-primary" />{docDate ? safeFormat(docDate.toISOString(), 'PPP') : <span>Pilih tanggal</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-2xl"><Calendar mode="single" selected={docDate} onSelect={setDocDate} initialFocus /></PopoverContent></Popover></div>
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{config.expiryLabel}</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("h-11 rounded-xl w-full justify-start text-left font-normal", !expiryDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4 text-primary" />{expiryDate ? safeFormat(expiryDate.toISOString(), 'PPP') : <span>Pilih tanggal</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-2xl"><Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} /></PopoverContent></Popover></div>
          </div>
          <Separator />
          
          {/* ========================================================================= */}
          {/* SECTION: BARANG & JASA (DESAIN RAPI, FLUID & HARGA 2 KOLOM DI HP) */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-base text-foreground flex items-center gap-2">
                  <span>Barang & Jasa</span>
                  <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-[11px] font-bold">
                    {items.filter(i => Number(i.quantity) > 0).length} Item
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">Rincian item, kuantitas, modal HPP, dan harga jual.</p>
              </div>

              {/* Action Buttons: 3 Column Grid on Mobile, Flex on Desktop */}
              <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 rounded-xl text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 px-2 sm:px-3 justify-center" 
                  onClick={addItem}
                >
                  <PlusCircle className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="truncate">Tambah Item</span>
                </Button>

                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-9 rounded-xl text-xs font-bold px-2 sm:px-3 justify-center border border-border" 
                  onClick={addSectionHeader}
                >
                  <Heading className="h-3.5 w-3.5 sm:mr-1.5 text-primary" />
                  <span className="truncate">Kategori</span>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 rounded-xl text-xs font-bold px-2 sm:px-3 justify-center border-border hover:bg-muted" 
                  onClick={() => setIsItemLibraryOpen(true)}
                >
                  <Library className="h-3.5 w-3.5 sm:mr-1.5 text-sky-500" />
                  <span className="truncate">Pustaka</span>
                </Button>
              </div>
            </div>

            {/* Items List Container */}
            <div className={cn(!isMobile && "w-full rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs")}>
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                {!isMobile ? (
                  <Table className="w-full">
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="w-10 text-center py-3 px-1"></TableHead>
                        <TableHead className="py-3 px-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">Deskripsi Barang / Jasa</TableHead>
                        <TableHead className="w-20 text-center py-3 px-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">Qty</TableHead>
                        <TableHead className="w-24 text-center py-3 px-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">Satuan</TableHead>
                        <TableHead className="w-40 text-right py-3 px-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">Harga Modal (HPP)</TableHead>
                        <TableHead className="w-40 text-right py-3 px-2 font-bold text-xs uppercase tracking-wider text-primary">Harga Jual</TableHead>
                        <TableHead className="w-36 text-right py-3 px-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">Total</TableHead>
                        <TableHead className="w-10 text-center py-3 px-1"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      <SortableContext 
                        items={items.map(i => i.uid)}
                        strategy={verticalListSortingStrategy}
                      >
                        {items.map((item, index) => (
                          <SortableItemRow 
                            key={item.uid}
                            item={item}
                            index={index}
                            handleItemChange={handleItemChange}
                            removeItem={removeItem}
                            isMobile={false}
                          />
                        ))}
                      </SortableContext>
                    </TableBody>
                  </Table>
                ) : (
                  <div className="space-y-3">
                    <SortableContext 
                      items={items.map(i => i.uid)}
                      strategy={verticalListSortingStrategy}
                    >
                      {items.map((item, index) => (
                        <SortableItemRow 
                          key={item.uid}
                          item={item}
                          index={index}
                          handleItemChange={handleItemChange}
                          removeItem={removeItem}
                          isMobile={true}
                        />
                      ))}
                    </SortableContext>
                  </div>
                )}
              </DndContext>
            </div>
          </div>
          <Separator />
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="profit-analysis" className="border rounded-2xl px-4 bg-muted/20">
                <AccordionTrigger className="font-bold text-sm text-primary py-4 hover:no-underline"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Estimasi Profit & Analisis Margin (Live)</div></AccordionTrigger>
                <AccordionContent className="pb-4"><ProfitAnalysisCard items={items} discountAmount={discountAmount} taxAmount={taxAmount} type={docType === 'quote' ? 'Penawaran' : 'Faktur'}/></AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-3.5 rounded-2xl border border-border/80 bg-muted/20 p-5 shadow-xs">
              <div className="flex justify-between text-xs font-semibold"><span className="text-muted-foreground">Subtotal</span><span className="font-bold text-foreground tabular-nums">{formatCurrency(subtotal)}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-xs font-semibold text-muted-foreground">Diskon (Rp)</span><Input type="text" inputMode="numeric" className="h-10 w-36 rounded-xl text-right text-xs font-bold tabular-nums" value={formatNumberWithDots(discountAmount)} onChange={e => setDiscountAmount(parseDotsToNumber(e.target.value))} /></div>
              <div className="flex items-center justify-between gap-4"><span className="text-xs font-semibold text-muted-foreground">Pajak (Rp)</span><Input type="text" inputMode="numeric" className="h-10 w-36 rounded-xl text-right text-xs font-bold tabular-nums" value={formatNumberWithDots(taxAmount)} onChange={e => setTaxAmount(parseDotsToNumber(e.target.value))} /></div>
              <Separator />
              <div className="flex justify-between text-lg font-black"><span>Total Tagihan</span><span className="text-primary tabular-nums">{formatCurrency(total)}</span></div>
              {docType === 'invoice' && (<div className="flex items-center justify-between gap-4 pt-1"><span className="text-xs font-semibold text-muted-foreground">Uang Muka (DP) (Rp)</span><Input type="text" inputMode="numeric" className="h-10 w-36 rounded-xl text-right text-xs font-bold tabular-nums" value={formatNumberWithDots(downPaymentAmount)} onChange={e => setDownPaymentAmount(parseDotsToNumber(e.target.value))} /></div>)}
            </div>
          </div>
          <Separator />
          <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Syarat & Ketentuan</Label><Textarea className="min-h-28 rounded-xl text-sm font-medium" placeholder="Contoh: Pembayaran dilakukan via transfer BCA..." value={terms} onChange={e => setTerms(e.target.value)} /></div>
          {isEditMode && id && (<><Separator /><AttachmentManager docId={id} docType={docType} initialAttachments={attachments} onAttachmentsChange={setAttachments} /></>)}
        </CardContent>
        <CardFooter className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 border-t bg-card/95 px-4 py-3.5 backdrop-blur sm:static sm:px-6">
          <Button size="lg" className="h-12 w-full sm:w-auto rounded-xl font-bold text-sm shadow-md" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : (isEditMode ? `Simpan Perubahan ${config.title}` : `Buat & Lihat ${config.title}`)}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default DocumentGenerator;
