import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Trash2, PlusCircle, Calendar as CalendarIcon, Library, FileEdit, FilePlus2, ReceiptText, TrendingUp, GripVertical, Heading, Plus, Sparkles, Search, ChevronsUpDown, Check, X } from "lucide-react";
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
import { parseClientType } from "@/components/ClientForm";
import ItemLibraryDialog from "@/components/ItemLibraryDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Project } from "./ProjectForm";
import AttachmentManager from "./AttachmentManager";
import TemplateManager from "./TemplateManager";
import ProfitAnalysisCard from "./ProfitAnalysisCard";
import { Building2, User, Wrench, Car, Hotel, HardHat, PackageCheck } from "lucide-react";
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
  isMobile,
  allItems
}: { 
  item: Item; 
  index: number; 
  handleItemChange: (index: number, field: keyof Item, value: any) => void; 
  removeItem: (index: number) => void;
  isMobile: boolean;
  allItems?: Item[];
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

  // Determine if this item is a store unit (non-tagihan)
  const isStoreUnit = useMemo(() => {
    if (isSectionHeader) return false;
    if (item.is_store_unit) return true;
    
    const desc = (item.description || '').toLowerCase();
    if (
      desc.includes('bawaan toko') || 
      desc.includes('non-tagihan') || 
      desc.includes('unit toko') || 
      desc.includes('dari toko') ||
      desc.includes('supply toko') ||
      desc.includes('disediakan toko')
    ) {
      return true;
    }

    if (allItems) {
      for (let i = index - 1; i >= 0; i--) {
        if (Number(allItems[i].quantity) === 0) {
          const headerDesc = (allItems[i].description || '').toLowerCase();
          if (
            headerDesc.includes('disediakan') ||
            headerDesc.includes('toko') ||
            headerDesc.includes('non-tagihan') ||
            headerDesc.includes('bawaan') ||
            headerDesc.includes('material partner')
          ) {
            return true;
          }
          break;
        }
      }
    }

    return false;
  }, [item, index, allItems, isSectionHeader]);

  // COMPACT & BALANCED MOBILE CARD VIEW
  if (isMobile) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
          "relative rounded-2xl border bg-card p-3.5 shadow-xs transition-all space-y-3",
          isDragging && "opacity-50 z-50",
          isSectionHeader ? "border-primary/30 bg-primary/5" : isStoreUnit ? "border-violet-500/30 bg-violet-500/5" : "border-border/80"
        )}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border/70 pb-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black",
              isStoreUnit ? "bg-violet-500/20 text-violet-500" : "bg-primary/10 text-primary"
            )}>
              {index + 1}
            </span>
            {isSectionHeader ? (
              <span className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-primary">
                <Heading className="h-3.5 w-3.5" /> Kategori Header
              </span>
            ) : isStoreUnit ? (
              <span className="flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400">
                📦 Unit Toko (Non-Tagihan)
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
          <Label className="text-[10px] font-bold text-muted-foreground uppercase">
            {isStoreUnit ? "Nama Perangkat / Unit Bawaan Toko" : "Deskripsi Item / Jasa"}
          </Label>
          <Input 
            placeholder={isSectionHeader ? "Nama Kategori (misal: Instalasi, Material, dll)" : isStoreUnit ? "Nama unit (misal: Kamera CCTV 2MP, NVR 8CH)" : "Deskripsi item produk atau layanan"} 
            value={item.description} 
            onChange={e => handleItemChange(index, 'description', e.target.value)} 
            className={cn("h-10 rounded-xl text-xs font-medium mt-1", isSectionHeader && "font-bold text-primary border-primary/40")}
          />
        </div>

        {!isSectionHeader && (
          <>
            {/* 2-Column Grid: Qty & Unit (TETAP ADA) */}
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
                  placeholder="Unit / Pcs" 
                  value={item.unit} 
                  onChange={e => handleItemChange(index, 'unit', e.target.value)} 
                  className="h-9 rounded-xl text-xs text-center font-medium mt-1" 
                />
              </div>
            </div>

            {/* Modal & Jual: Hidden for Store Units, replaced with Info Notice */}
            {isStoreUnit ? (
              <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-3 py-2 text-center text-xs font-semibold text-violet-600 dark:text-violet-400">
                📦 Unit disediakan pihak toko (Non-Tagihan / Tanpa Modal & Harga Jual)
              </div>
            ) : (
              /* 2-Column Grid: Modal (HPP) & Harga Jual SIDE-BY-SIDE */
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
            )}

            {/* Compact Subtotal Footer */}
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 border border-border/60">
              <div className="text-[10px] font-semibold text-muted-foreground">
                {isStoreUnit ? (
                  <span className="text-violet-600 dark:text-violet-400 font-bold">Unit Bawaan Toko</span>
                ) : Number(item.unit_price) > 0 && Number(item.cost_price) > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Profit: {formatCurrency((Number(item.unit_price) - Number(item.cost_price)) * (Number(item.quantity) || 1))}
                  </span>
                ) : (
                  <span>Total Item</span>
                )}
              </div>
              <span className="font-extrabold text-sm text-foreground tabular-nums">
                {isStoreUnit ? '-' : formatCurrency(calculateItemTotal(item.quantity, item.unit_price))}
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
    <TableRow ref={setNodeRef} style={style} className={cn("hover:bg-muted/30 transition-colors border-b border-border/60", isDragging && "opacity-50", isStoreUnit && "bg-violet-500/5")}>
      {/* Handle */}
      <TableCell className="text-center w-10 py-2.5 px-1 align-middle">
        <Button variant="ghost" size="icon" className="h-7 w-7 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="h-3.5 w-3.5" />
        </Button>
      </TableCell>

      {/* Deskripsi */}
      <TableCell className="py-2.5 px-3 align-middle">
        <div className="flex items-center gap-2">
          {isStoreUnit && (
            <span className="shrink-0 rounded-md bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-[10px] font-black text-violet-600 dark:text-violet-400">
              📦 Unit Toko
            </span>
          )}
          <Input 
            placeholder={isStoreUnit ? "Nama unit / perangkat bawaan toko (misal: Kamera CCTV 2MP)" : "Deskripsi barang atau jasa"} 
            value={item.description} 
            onChange={e => handleItemChange(index, 'description', e.target.value)} 
            className="h-9 rounded-xl text-xs font-medium"
          />
        </div>
      </TableCell>

      {/* Jumlah (Qty) - TETAP ADA */}
      <TableCell className="w-20 py-2.5 px-2 align-middle">
        <Input 
          type="number" 
          placeholder="1" 
          value={item.quantity} 
          onChange={e => handleItemChange(index, 'quantity', Number(e.target.value) || 0)} 
          className="h-9 rounded-xl text-center text-xs font-bold" 
        />
      </TableCell>

      {/* Satuan - TETAP ADA */}
      <TableCell className="w-24 py-2.5 px-2 align-middle">
        <Input 
          placeholder="Unit" 
          value={item.unit} 
          onChange={e => handleItemChange(index, 'unit', e.target.value)} 
          className="h-9 rounded-xl text-xs text-center font-medium"
        />
      </TableCell>

      {/* Harga Modal (HPP) with Dots - HIDDEN / DASH FOR STORE UNITS */}
      <TableCell className="w-40 py-2.5 px-2 align-middle text-center">
        {isStoreUnit ? (
          <span className="inline-block rounded-lg bg-muted/40 border border-border/80 px-3 py-1 text-[11px] font-bold text-muted-foreground select-none">
            -
          </span>
        ) : (
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
        )}
      </TableCell>

      {/* Harga Jual with Dots - HIDDEN / BADGE FOR STORE UNITS */}
      <TableCell className="w-40 py-2.5 px-2 align-middle text-center">
        {isStoreUnit ? (
          <span className="inline-block rounded-lg bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 select-none">
            Non-Tagihan
          </span>
        ) : (
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
        )}
      </TableCell>

      {/* Total - DASH FOR STORE UNITS */}
      <TableCell className="w-36 text-right font-black text-xs text-foreground tabular-nums py-2.5 px-3 align-middle">
        {isStoreUnit ? (
          <span className="text-muted-foreground font-semibold text-xs">-</span>
        ) : (
          formatCurrency(calculateItemTotal(item.quantity, item.unit_price))
        )}
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
  const [docCategory, setDocCategory] = useState<'standard' | 'partner_service'>('standard');
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
  const [downPaymentPercent, setDownPaymentPercent] = useState<string>('');
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<Item[]>([{ uid: crypto.randomUUID(), description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isItemLibraryOpen, setIsItemLibraryOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
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
      
      const loadedTerms = data.terms || "";
      if (loadedTerms.includes('[CATEGORY:partner_service]') || data.title?.toLowerCase().includes('jasa')) {
        setDocCategory('partner_service');
      }
      setTerms(loadedTerms.replace(/\[CATEGORY:[a-zA-Z0-9_-]+\]/g, '').trim());
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

      // Smart auto-detection of Partner/Store
      const cType = parseClientType(client.notes);
      if (cType === 'partner_store') {
        setDocCategory('partner_service');
        if (!terms || terms.trim() === '') {
          setTerms("1. Penawaran ini khusus mencakup jasa instalasi teknis, konfigurasi, dan biaya akomodasi lapangan.\n2. Seluruh unit/material utama disediakan langsung oleh pihak Toko/Pemberi Kerja.\n3. Pembayaran jasa diselesaikan setelah serah terima pekerjaan (BAST).");
        }
        showSuccess('Klien Toko/Partner terdeteksi: Mode Jasa & Akomodasi otomatis diaktifkan.');
      }
    }
  };

  const handleApplyTemplate = (data: any) => {
    if (!data) return;
    const templateData = data.content || data;

    const newTitle = templateData.docTitle ?? templateData.title;
    if (newTitle !== undefined) setDocTitle(newTitle);

    const newTerms = templateData.terms;
    if (newTerms !== undefined) {
      if (newTerms.includes('[CATEGORY:partner_service]')) {
        setDocCategory('partner_service');
      }
      setTerms(newTerms.replace(/\[CATEGORY:[a-zA-Z0-9_-]+\]/g, '').trim());
    }

    if (templateData.docCategory) {
      setDocCategory(templateData.docCategory);
    }

    const newDiscount = templateData.discountAmount ?? templateData.discount_amount;
    if (newDiscount !== undefined) setDiscountAmount(Number(newDiscount) || 0);

    const newTax = templateData.taxAmount ?? templateData.tax_amount;
    if (newTax !== undefined) setTaxAmount(Number(newTax) || 0);

    const templateItems = templateData.items;
    if (Array.isArray(templateItems) && templateItems.length > 0) {
      setItems(
        templateItems.map((item: any) => ({
          uid: crypto.randomUUID(),
          description: item.description || '',
          quantity: item.quantity !== undefined ? Number(item.quantity) : 1,
          unit: item.unit || '',
          unit_price: Number(item.unit_price) || 0,
          cost_price: Number(item.cost_price) || 0,
          is_store_unit: Boolean(item.is_store_unit),
          ...(item.item_id ? { item_id: item.item_id } : {})
        }))
      );
    }
  };

  const handleItemChange = (index: number, field: keyof Item, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const isInitialPristineBlank = (itemList: Item[]) => {
    return (
      itemList.length === 1 &&
      itemList[0].description.trim() === '' &&
      !itemList[0].unit &&
      itemList[0].unit_price === 0 &&
      itemList[0].cost_price === 0 &&
      !itemList[0].is_store_unit &&
      Number(itemList[0].quantity) === 1
    );
  };

  const addItem = () => {
    setItems(prev => [...prev, { uid: crypto.randomUUID(), description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }]);
  };

  const addSectionHeader = () => {
    setItems(prev => {
      const base = isInitialPristineBlank(prev) ? [] : prev;
      return [...base, { uid: crypto.randomUUID(), description: "", quantity: 0, unit: "", unit_price: 0, cost_price: 0 }];
    });
  };

  const addPresetItem = (type: 'install' | 'transport' | 'accommodation' | 'tool' | 'store_hardware_header') => {
    setItems(prev => {
      const base = isInitialPristineBlank(prev) ? [] : prev;

      if (type === 'install') {
        return [...base, { uid: crypto.randomUUID(), description: "Jasa Instalasi & Konfigurasi Teknis Perangkat", quantity: 1, unit: "Titik", unit_price: 150000, cost_price: 0 }];
      } else if (type === 'transport') {
        return [...base, { uid: crypto.randomUUID(), description: "Biaya Transportasi, BBM & Operasional Lapangan", quantity: 1, unit: "Trip", unit_price: 250000, cost_price: 150000 }];
      } else if (type === 'accommodation') {
        return [...base, { uid: crypto.randomUUID(), description: "Akomodasi Penginapan & Konsumsi Tim Lapangan", quantity: 1, unit: "Hari", unit_price: 200000, cost_price: 150000 }];
      } else if (type === 'tool') {
        return [...base, { uid: crypto.randomUUID(), description: "Sewa Alat Kerja Bantu / Scaffolding / Tangga", quantity: 1, unit: "Set", unit_price: 100000, cost_price: 50000 }];
      } else if (type === 'store_hardware_header') {
        return [
          ...base,
          { uid: crypto.randomUUID(), description: "", quantity: 1, unit: "Unit", unit_price: 0, cost_price: 0, is_store_unit: true }
        ];
      }
      return base;
    });
  };

  const removeItem = (index: number) => {
    setItems(prev => {
      if (prev.length > 1) return prev.filter((_, i) => i !== index);
      return [{ uid: crypto.randomUUID(), description: "", quantity: 1, unit: "", unit_price: 0, cost_price: 0 }];
    });
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
    setItems(prev => {
      const base = isInitialPristineBlank(prev) ? [] : prev;
      return [...base, ...newItems];
    });
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

  // Initial calculation of percentage if downPaymentAmount is present
  useEffect(() => {
    if (total > 0 && downPaymentAmount > 0) {
      const p = ((downPaymentAmount / total) * 100).toFixed(1);
      setDownPaymentPercent(p.endsWith('.0') ? p.slice(0, -2) : p);
    }
  }, [total, downPaymentAmount]);

  const handleDpPreset = (percent: number) => {
    if (percent === 0) {
      setDownPaymentPercent('');
      setDownPaymentAmount(0);
    } else {
      setDownPaymentPercent(String(percent));
      setDownPaymentAmount(Math.round((total * percent) / 100));
    }
  };

  const handleDpPercentChange = (valStr: string) => {
    setDownPaymentPercent(valStr);
    const p = parseFloat(valStr);
    if (!isNaN(p) && p >= 0 && p <= 100) {
      setDownPaymentAmount(Math.round((total * p) / 100));
    } else if (valStr === '') {
      setDownPaymentAmount(0);
    }
  };

  const handleDpAmountChange = (amountNum: number) => {
    setDownPaymentAmount(amountNum);
    if (total > 0 && amountNum > 0) {
      const p = ((amountNum / total) * 100).toFixed(1);
      setDownPaymentPercent(p.endsWith('.0') ? p.slice(0, -2) : p);
    } else {
      setDownPaymentPercent('');
    }
  };

  const handleInsertDpTerms = () => {
    if (downPaymentAmount <= 0) return;
    const dpStr = formatCurrency(downPaymentAmount);
    const balanceStr = formatCurrency(Math.max(0, total - downPaymentAmount));
    const pStr = downPaymentPercent ? ` (${downPaymentPercent}%)` : '';
    const dpClause = `Ketentuan Pembayaran:\n1. Uang Muka (DP${pStr}) sebesar ${dpStr} saat deal / konfirmasi pesanan.\n2. Pelunasan sebesar ${balanceStr} setelah pekerjaan selesai / serah terima.`;
    
    setTerms(prev => prev ? `${prev}\n\n${dpClause}` : dpClause);
    showSuccess('Ketentuan DP berhasil ditambahkan ke Syarat & Ketentuan!');
  };

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

    const packedTerms = docCategory === 'partner_service'
      ? `[CATEGORY:partner_service]\n${terms || ''}`.trim()
      : terms;

    const docPayload: { [key: string]: any } = {
      user_id: user.id, from_company: fromCompany, from_address: fromAddress, from_website: fromWebsite,
      to_client: toClient, to_address: toAddress, to_phone: toPhone,
      discount_amount: discountAmount, tax_amount: taxAmount, terms: packedTerms, status: status,
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
        .filter(item => item.description && item.description.trim())
        .map(({ uid, id, created_at, is_store_unit, ...item }: any) => ({
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
            <TemplateManager 
              type={docType} 
              currentData={{ 
                docTitle, 
                title: docTitle, 
                docCategory, 
                items, 
                terms, 
                taxAmount, 
                tax_amount: taxAmount, 
                discountAmount, 
                discount_amount: discountAmount 
              }} 
              onApplyTemplate={handleApplyTemplate} 
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-4 py-6 sm:px-6 lg:space-y-8">
          {/* Mode Selector: Reguler vs Jasa & Akomodasi Toko */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 sm:p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Tipe / Mode Dokumen
              </Label>
              {docCategory === 'partner_service' && (
                <span className="text-[11px] font-bold text-violet-500 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> Khusus Tagihan Toko / Partner
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDocCategory('standard')}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                  docCategory === 'standard'
                    ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40 font-bold"
                    : "border-border/80 bg-background text-muted-foreground hover:bg-muted/40 font-medium"
                )}
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">Proyek Mandiri (Barang & Jasa)</div>
                  <div className="text-[11px] text-muted-foreground font-normal">Penjualan lengkap pengadaan material & instalasi ke klien langsung.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDocCategory('partner_service')}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                  docCategory === 'partner_service'
                    ? "border-violet-500 bg-violet-500/10 text-violet-500 shadow-xs ring-1 ring-violet-500/40 font-bold"
                    : "border-border/80 bg-background text-muted-foreground hover:bg-muted/40 font-medium"
                )}
              >
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 shrink-0 mt-0.5">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">Subkon / Jasa & Akomodasi (Toko / Partner)</div>
                  <div className="text-[11px] text-muted-foreground font-normal">Hanya menagih jasa teknis, transportasi & akomodasi (Barang dari toko).</div>
                </div>
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <section className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-2xs">
              <h3 className="font-bold text-sm text-foreground">Dari (Penerbit)</h3>
              <Input className="h-11 rounded-xl text-sm font-medium" placeholder="Nama Perusahaan Anda" value={fromCompany} onChange={e => setFromCompany(e.target.value)} />
              <Textarea className="min-h-24 rounded-xl text-sm font-medium" placeholder="Alamat Perusahaan Anda" value={fromAddress} onChange={e => setFromAddress(e.target.value)} />
              <Input className="h-11 rounded-xl text-sm font-medium" placeholder="Website / Kontak Perusahaan" value={fromWebsite} onChange={e => setFromWebsite(e.target.value)} />
            </section>
            <section className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-2xs">
              <h3 className="font-bold text-sm text-foreground">Untuk ({docCategory === 'partner_service' ? 'Toko / Partner Penerima' : 'Klien Penerima'})</h3>
              
              {/* Searchable Client Selector Combobox */}
              <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isClientPopoverOpen}
                    className="w-full h-11 justify-between rounded-xl text-sm font-medium bg-background border-input hover:bg-muted/40 text-foreground"
                  >
                    <span className="truncate">
                      {selectedClientId
                        ? (() => {
                            const c = (clients || []).find((c) => c?.id === selectedClientId);
                            return c ? `${c.name || ''} ${parseClientType(c.notes) === 'partner_store' ? '(Toko)' : ''}` : "Pilih dari daftar klien atau isi manual";
                          })()
                        : (toClient ? `Klien: ${toClient}` : "Pilih dari daftar klien atau isi manual")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] sm:w-[360px] p-0 rounded-2xl shadow-xl border-border/80" align="start">
                  <div className="p-2 border-b">
                    <div className="relative flex items-center">
                      <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Ketik nama klien / toko..."
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs rounded-xl border-border/70 bg-background"
                        autoFocus
                      />
                      {clientSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setClientSearchQuery('')}
                          className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
                    {/* Manual input option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientId(null);
                        setIsClientPopoverOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors",
                        !selectedClientId ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <span>➕ Input Manual / Klien Baru</span>
                      {!selectedClientId && <Check className="h-3.5 w-3.5" />}
                    </button>

                    {/* Filtered Clients */}
                    {(clients || [])
                      .filter((c) => {
                        if (!c) return false;
                        if (!clientSearchQuery.trim()) return true;
                        const query = clientSearchQuery.toLowerCase();
                        const name = (c.name || '').toLowerCase();
                        const phone = (c.phone || '').toLowerCase();
                        const address = (c.address || '').toLowerCase();
                        return name.includes(query) || phone.includes(query) || address.includes(query);
                      })
                      .map((c) => {
                        const isStore = parseClientType(c.notes) === 'partner_store';
                        const isSelected = selectedClientId === c.id;

                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              handleClientSelect(c.id);
                              setIsClientPopoverOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors",
                              isSelected
                                ? "bg-primary/10 text-primary font-bold"
                                : "hover:bg-muted/60 text-foreground"
                            )}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold truncate">{c.name || 'Tanpa Nama'}</span>
                                {isStore && (
                                  <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                                    Toko
                                  </span>
                                )}
                              </div>
                              {c.phone && (
                                <span className="text-[10px] text-muted-foreground block truncate">
                                  {c.phone} {c.address ? `• ${c.address}` : ''}
                                </span>
                              )}
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                          </button>
                        );
                      })}

                    {(clients || []).filter((c) =>
                      (c?.name || '').toLowerCase().includes(clientSearchQuery.toLowerCase())
                    ).length === 0 && (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        Klien "{clientSearchQuery}" tidak ditemukan.
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Input className="h-11 rounded-xl text-sm font-medium" placeholder={docCategory === 'partner_service' ? 'Nama Toko / Partner' : 'Nama Klien'} value={toClient} onChange={e => setToClient(e.target.value)} />
              <Textarea className="min-h-24 rounded-xl text-sm font-medium" placeholder={docCategory === 'partner_service' ? 'Alamat Kantor Toko / Lokasi Proyek' : 'Alamat Klien'} value={toAddress} onChange={e => setToAddress(e.target.value)} />
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
            <Input className="h-11 rounded-xl text-sm" placeholder={docCategory === 'partner_service' ? `Contoh: Penawaran Jasa Instalasi CCTV 8 Titik - Toko Cahaya Mandiri` : `Contoh: Paket CCTV 4 Channel, Renovasi Kantor, dll...`} value={docTitle} onChange={e => setDocTitle(e.target.value)} />
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
                  <span>{docCategory === 'partner_service' ? 'Rincian Jasa & Akomodasi Lapangan' : 'Barang & Jasa'}</span>
                  <span className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                    docCategory === 'partner_service' 
                      ? "bg-violet-500/10 text-violet-500 border-violet-500/20" 
                      : "bg-primary/10 text-primary border-primary/20"
                  )}>
                    {items.filter(i => Number(i.quantity) > 0).length} Item
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  {docCategory === 'partner_service' 
                    ? "Rincian biaya jasa teknis, transportasi BBM, penginapan & operasional."
                    : "Rincian item, kuantitas, modal HPP, dan harga jual."}
                </p>
              </div>

              {/* Action Buttons */}
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

            {/* Quick Preset Buttons for Partner Service Mode */}
            {docCategory === 'partner_service' && (
              <div className="rounded-2xl bg-violet-500/10 border border-violet-500/20 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Preset Cepat Tagihan Toko:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addPresetItem('install')}
                    className="h-8 rounded-xl text-xs font-semibold bg-background hover:bg-violet-500/10 border-violet-500/30 text-foreground"
                  >
                    <Wrench className="h-3 w-3 mr-1 text-violet-500" /> + Jasa Instalasi/Setting
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addPresetItem('transport')}
                    className="h-8 rounded-xl text-xs font-semibold bg-background hover:bg-violet-500/10 border-violet-500/30 text-foreground"
                  >
                    <Car className="h-3 w-3 mr-1 text-emerald-500" /> + Transportasi & BBM
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addPresetItem('accommodation')}
                    className="h-8 rounded-xl text-xs font-semibold bg-background hover:bg-violet-500/10 border-violet-500/30 text-foreground"
                  >
                    <Hotel className="h-3 w-3 mr-1 text-amber-500" /> + Akomodasi & Makan
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addPresetItem('tool')}
                    className="h-8 rounded-xl text-xs font-semibold bg-background hover:bg-violet-500/10 border-violet-500/30 text-foreground"
                  >
                    <HardHat className="h-3 w-3 mr-1 text-sky-500" /> + Sewa Alat Bantu
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addPresetItem('store_hardware_header')}
                    className="h-8 rounded-xl text-xs font-semibold bg-background hover:bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400 font-bold"
                  >
                    <PackageCheck className="h-3 w-3 mr-1 text-violet-500" /> + Unit Dari Toko (Non-Tagihan)
                  </Button>
                </div>
              </div>
            )}

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
                            allItems={items}
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
                          allItems={items}
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
            <div className="w-full max-w-md space-y-3.5 rounded-3xl border border-border/80 bg-muted/20 p-5 shadow-xs">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold text-foreground tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-muted-foreground">Diskon (Rp)</span>
                <Input 
                  type="text" 
                  inputMode="numeric" 
                  className="h-10 w-40 rounded-xl text-right text-xs font-bold tabular-nums" 
                  value={formatNumberWithDots(discountAmount)} 
                  onChange={e => setDiscountAmount(parseDotsToNumber(e.target.value))} 
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-muted-foreground">Pajak (Rp)</span>
                <Input 
                  type="text" 
                  inputMode="numeric" 
                  className="h-10 w-40 rounded-xl text-right text-xs font-bold tabular-nums" 
                  value={formatNumberWithDots(taxAmount)} 
                  onChange={e => setTaxAmount(parseDotsToNumber(e.target.value))} 
                />
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-black">
                <span>Total {config.title}</span>
                <span className="text-primary tabular-nums">{formatCurrency(total)}</span>
              </div>

              {/* Uang Muka (DP) Section - Available for both Invoice & Quote */}
              <div className="pt-2 border-t border-border/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Uang Muka (DP)
                  </span>
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1">
                    {[
                      { label: '0%', val: 0 },
                      { label: '30%', val: 30 },
                      { label: '50%', val: 50 },
                      { label: '70%', val: 70 },
                    ].map(btn => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => handleDpPreset(btn.val)}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all",
                          (btn.val === 0 && downPaymentAmount === 0) || (downPaymentPercent === String(btn.val))
                            ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/80"
                        )}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dual Input: Percentage and Nominal (Rp) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative flex items-center">
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      max="100"
                      value={downPaymentPercent}
                      onChange={e => handleDpPercentChange(e.target.value)}
                      className="h-10 rounded-xl pr-8 text-xs font-bold text-right tabular-nums"
                    />
                    <span className="pointer-events-none absolute right-3 text-xs font-bold text-muted-foreground select-none">%</span>
                  </div>

                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground select-none">Rp</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      className="h-10 rounded-xl pl-9 text-right text-xs font-bold tabular-nums"
                      value={formatNumberWithDots(downPaymentAmount)}
                      onChange={e => handleDpAmountChange(parseDotsToNumber(e.target.value))}
                    />
                  </div>
                </div>

                {/* Sisa Tagihan / Pelunasan Live Preview */}
                {downPaymentAmount > 0 && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <span>DP Tercatat{downPaymentPercent ? ` (${downPaymentPercent}%)` : ''}:</span>
                      <span className="tabular-nums font-black">{formatCurrency(downPaymentAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-foreground">
                      <span className="text-muted-foreground">Sisa Pelunasan:</span>
                      <span className="tabular-nums font-black text-rose-600 dark:text-rose-400">
                        {formatCurrency(Math.max(0, total - downPaymentAmount))}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleInsertDpTerms}
                      className="w-full mt-1 h-7 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 rounded-lg"
                    >
                      + Tulis ke Syarat & Ketentuan
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Syarat & Ketentuan</Label>
            <Textarea className="min-h-28 rounded-xl text-sm font-medium" placeholder="Contoh: Pembayaran dilakukan via transfer BCA..." value={terms} onChange={e => setTerms(e.target.value)} />
          </div>
          
          <Separator />
          <AttachmentManager docId={id} docType={docType} initialAttachments={attachments} onAttachmentsChange={setAttachments} />
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
