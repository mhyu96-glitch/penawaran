import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle, 
  XCircle, 
  Download, 
  FileText, 
  Building2, 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Phone, 
  Globe, 
  ShieldCheck, 
  Sparkles,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Camera,
  Eye,
  X
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency, safeFormat, calculateSubtotal, calculateTotal, calculateItemTotal, cn } from '@/lib/utils';
import { generatePdf } from '@/utils/pdfGenerator';
import { DocumentItemsTable } from '@/components/DocumentItemsTable';
import { Badge } from '@/components/ui/badge';

interface Attachment {
  name: string;
  url: string;
  path: string;
  caption?: string;
  type?: 'image' | 'file';
}

type QuoteDetails = {
  id: string;
  user_id: string;
  from_company: string;
  from_address: string;
  from_website: string;
  to_client: string;
  to_address: string;
  to_phone: string;
  quote_number: string;
  quote_date: string;
  valid_until: string;
  discount_amount: number;
  tax_amount: number;
  terms: string;
  status: string;
  attachments: Attachment[];
  title: string;
  quote_items: {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    cost_price: number;
  }[];
};

type ProfileInfo = {
  custom_footer: string | null;
  show_quantity_column: boolean;
  show_unit_column: boolean;
  show_unit_price_column: boolean;
  company_logo_url: string | null;
  brand_color: string | null;
};

const PublicQuoteView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionTaken, setActionTaken] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [activePhotoPreview, setActivePhotoPreview] = useState<{ url: string; title: string } | null>(null);
  const quoteRef = useRef<HTMLDivElement>(null);
  const hasTracked = useRef(false);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching quote:', error);
        setQuote(null);
      } else {
        const quoteData = data as QuoteDetails;
        setQuote(quoteData);
        if (data.status === 'Diterima' || data.status === 'Ditolak') {
          setActionTaken(data.status);
        }
        
        // Fetch profile settings
        const { data: profileData } = await supabase
          .from('profiles')
          .select('custom_footer, show_quantity_column, show_unit_column, show_unit_price_column, company_logo_url, brand_color')
          .eq('id', quoteData.user_id)
          .single();
        setProfile(profileData);

        // Track View
        if (!hasTracked.current) {
          hasTracked.current = true;
          await supabase.rpc('track_document_view', { p_id: id, p_type: 'quote' });
        }
      }
      setLoading(false);
    };

    fetchQuote();
  }, [id, navigate]);

  const handleStatusUpdate = async (newStatus: 'Diterima' | 'Ditolak') => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('update-quote-status', {
        body: { quoteId: id, status: newStatus }
      });

      if (error) throw error;
      
      setActionTaken(newStatus);
      if (quote) setQuote({ ...quote, status: newStatus });
    } catch (error) {
      console.error("Gagal memperbarui status:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAsPDF = async () => {
    if (!quoteRef.current || !quote) return;
    setIsGeneratingPDF(true);
    await generatePdf(quoteRef.current, `Penawaran-${quote.quote_number || quote.id}.pdf`);
    setIsGeneratingPDF(false);
  };

  const subtotal = useMemo(() => calculateSubtotal(quote?.quote_items || []), [quote]);
  const discountAmount = useMemo(() => quote?.discount_amount || 0, [quote]);
  const taxAmount = useMemo(() => quote?.tax_amount || 0, [quote]);
  const total = useMemo(() => calculateTotal(subtotal, discountAmount, taxAmount), [subtotal, discountAmount, taxAmount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-4xl space-y-4">
          <Skeleton className="h-20 w-full rounded-3xl" />
          <Skeleton className="h-[600px] w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center text-center">
        <div className="max-w-md p-8 rounded-3xl bg-card border border-border/80 text-foreground space-y-4 shadow-sm">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold">Dokumen Tidak Ditemukan</h2>
          <p className="text-sm text-muted-foreground">Tautan penawaran mungkin sudah tidak berlaku atau salah nomor ID.</p>
        </div>
      </div>
    );
  }

  const isPending = actionTaken === '' && (quote.status === 'Terkirim' || quote.status === 'Draf' || quote.status === 'Menunggu');
  const isAccepted = actionTaken === 'Diterima' || quote.status === 'Diterima';
  const isRejected = actionTaken === 'Ditolak' || quote.status === 'Ditolak';

  return (
    <div className="min-h-screen bg-background text-foreground py-6 px-3 sm:px-6 lg:px-8">
      {/* ========================================================================= */}
      {/* TOP FLOATING CLIENT ACTION BAR */}
      {/* ========================================================================= */}
      <div className="max-w-4xl mx-auto mb-6 no-pdf">
        <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Portal Klien Resmi</span>
                {isAccepted && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                    ✓ DISETUJUI
                  </Badge>
                )}
                {isRejected && (
                  <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                    ✕ DITOLAK
                  </Badge>
                )}
                {isPending && (
                  <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold">
                    MENUNGGU RESPON
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                Penawaran #{quote.quote_number || quote.id.slice(0, 8)} • {quote.from_company}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button 
              onClick={handleSaveAsPDF} 
              disabled={isGeneratingPDF}
              variant="outline"
              size="sm"
              className="rounded-xl h-10 px-4 text-xs font-bold border-border/80 hover:bg-muted"
            >
              <Download className="mr-2 h-4 w-4 text-primary" />
              {isGeneratingPDF ? 'Membuat PDF...' : 'Unduh PDF'}
            </Button>

            {isPending && (
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => handleStatusUpdate('Diterima')} 
                  disabled={isSubmitting}
                  size="sm"
                  className="rounded-xl h-10 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                >
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  {isSubmitting ? 'Menyimpan...' : 'Terima Penawaran'}
                </Button>

                <Button 
                  onClick={() => handleStatusUpdate('Ditolak')} 
                  disabled={isSubmitting}
                  variant="destructive"
                  size="sm"
                  className="rounded-xl h-10 px-3 text-xs font-bold"
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Tolak
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STATUS NOTIFICATION ALERT */}
      {/* ========================================================================= */}
      {isPending && (
        <div className="max-w-4xl mx-auto mb-6 no-pdf">
          <div className="p-4 sm:p-5 rounded-3xl bg-card border border-primary/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Tinjau & Konfirmasi Penawaran
              </h3>
              <p className="text-xs text-muted-foreground">
                Silakan periksa rincian barang, jasa, dan biaya di bawah ini. Jika Anda menyetujui, klik tombol <strong>"Terima Penawaran"</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                onClick={() => handleStatusUpdate('Diterima')} 
                disabled={isSubmitting}
                className="rounded-xl font-bold text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
              >
                <CheckCircle className="mr-1.5 h-4 w-4" /> Setujui Sekarang
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAccepted && (
        <div className="max-w-4xl mx-auto mb-6 no-pdf">
          <div className="p-4 rounded-3xl bg-card border border-emerald-500/30 shadow-xs flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-sm text-foreground">Penawaran Telah Diterima & Disetujui</p>
              <p className="text-xs text-muted-foreground">Terima kasih atas persetujuan Anda. Pihak {quote.from_company} telah menerima notifikasi dan akan segera menindaklanjuti.</p>
            </div>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="max-w-4xl mx-auto mb-6 no-pdf">
          <div className="p-4 rounded-3xl bg-card border border-rose-500/30 shadow-xs flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <XCircle className="h-6 w-6 text-rose-500 shrink-0" />
            <div>
              <p className="font-bold text-sm text-foreground">Penawaran Ditolak</p>
              <p className="text-xs text-muted-foreground">Pihak {quote.from_company} telah diberitahu mengenai penolakan penawaran ini.</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN QUOTATION CARD (Consistent Theme Aesthetic) */}
      {/* ========================================================================= */}
      <Card ref={quoteRef} className="max-w-4xl mx-auto bg-card text-foreground rounded-3xl shadow-sm overflow-hidden border border-border/80 quote-print-container">
        {/* Document Header Bar */}
        <div className="p-6 sm:p-8 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            {/* Sender / Company Info */}
            <div className="space-y-3 max-w-md">
              {profile?.company_logo_url ? (
                <img src={profile.company_logo_url} alt="Company Logo" className="max-h-16 object-contain" />
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black text-lg">
                    {quote.from_company.slice(0, 1) || 'P'}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    {quote.from_company}
                  </h1>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                {quote.from_address && (
                  <p className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{quote.from_address}</span>
                  </p>
                )}
                {quote.from_website && (
                  <p className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{quote.from_website}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Document Number & Metadata */}
            <div className="sm:text-right space-y-2">
              <div className="inline-block px-3 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-black tracking-wider uppercase">
                SURAT PENAWARAN
              </div>
              <h2 className="text-lg sm:text-xl font-black text-foreground font-mono">
                #{quote.quote_number || quote.id.slice(0, 8)}
              </h2>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Tanggal:</strong> {safeFormat(quote.quote_date, 'd MMMM yyyy')}</p>
                <p><strong>Berlaku Hingga:</strong> {safeFormat(quote.valid_until, 'd MMMM yyyy')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Client Destination & Subject */}
        <CardContent className="p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 rounded-2xl bg-muted/20 border border-border/70">
            {/* Bill To */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Ditujukan Kepada:
              </span>
              <h3 className="font-black text-base text-foreground">{quote.to_client}</h3>
              {quote.to_address && (
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{quote.to_address}</span>
                </p>
              )}
              {quote.to_phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{quote.to_phone}</span>
                </p>
              )}
            </div>

            {/* Subject */}
            <div className="sm:text-right space-y-1.5 sm:border-l sm:border-border/70 sm:pl-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Perihal / Proyek:
              </span>
              <h3 className="font-extrabold text-base text-foreground">
                {quote.title || 'Penawaran Barang & Jasa'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Dokumen penawaran resmi dan sah diterbitkan untuk keperluan pengadaan.
              </p>
            </div>
          </div>

          {/* Rincian Item Penawaran */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Rincian Barang & Jasa
            </h4>
            <div className="rounded-2xl border border-border/80 overflow-hidden">
              <DocumentItemsTable 
                items={quote.quote_items} 
                config={{
                  showQuantity: profile?.show_quantity_column,
                  showUnit: profile?.show_unit_column,
                  showUnitPrice: profile?.show_unit_price_column
                }}
              />
            </div>
          </div>

          {/* Financial Calculation Summary */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-80 rounded-2xl bg-muted/20 p-5 border border-border/80 space-y-2.5 text-xs">
              <div className="flex justify-between font-medium text-muted-foreground">
                <span>Subtotal Barang & Jasa:</span>
                <span className="font-bold text-foreground tabular-nums">{formatCurrency(subtotal)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                  <span>Potongan Diskon:</span>
                  <span className="font-bold tabular-nums">- {formatCurrency(discountAmount)}</span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground font-medium">
                  <span>Pajak (PPN):</span>
                  <span className="font-bold text-foreground tabular-nums">+ {formatCurrency(taxAmount)}</span>
                </div>
              )}

              <Separator className="my-2 border-border/60" />

              <div className="flex justify-between text-sm sm:text-base font-black text-foreground">
                <span>Total Penawaran:</span>
                <span className="text-primary tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          {quote.terms && (
            <div className="space-y-2 p-5 rounded-2xl bg-muted/20 border border-border/80">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Syarat & Ketentuan:
              </h4>
              <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">
                {quote.terms}
              </div>
            </div>
          )}

          {/* Survey Photos & Attachments */}
          {quote.attachments && quote.attachments.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-primary" /> Dokumentasi & Lampiran Foto Survei Lapangan ({quote.attachments.length})
              </h4>

              {/* Photo Gallery Grid */}
              {quote.attachments.some(att => (att as any).type === 'image' || ['jpg', 'jpeg', 'png', 'webp'].includes(att.name.split('.').pop()?.toLowerCase() || '') || att.url.startsWith('data:image/')) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {quote.attachments.map((attachment, index) => {
                    const isImg = (attachment as any).type === 'image' || ['jpg', 'jpeg', 'png', 'webp'].includes(attachment.name.split('.').pop()?.toLowerCase() || '') || attachment.url.startsWith('data:image/');
                    if (!isImg) return null;

                    return (
                      <div 
                        key={index}
                        onClick={() => setActivePhotoPreview({ url: attachment.url, title: attachment.caption || attachment.name })}
                        className="group relative rounded-xl border border-border/80 bg-muted/10 overflow-hidden shadow-2xs cursor-pointer hover:border-primary/50 transition-all"
                      >
                        <div className="aspect-video sm:aspect-square w-full overflow-hidden bg-black/20 relative">
                          <img 
                            src={attachment.url} 
                            alt={attachment.caption || attachment.name} 
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center no-pdf">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-1.5">
                              <Eye className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        </div>
                        <div className="p-1.5 space-y-0.5 bg-background/80 border-t border-border/60">
                          <p className="font-bold text-[10px] text-foreground truncate">
                            {attachment.caption || attachment.name}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Non-image File Documents List */}
              {quote.attachments.some(att => !(att as any).type?.includes('image') && !['jpg', 'jpeg', 'png', 'webp'].includes(att.name.split('.').pop()?.toLowerCase() || '') && !att.url.startsWith('data:image/')) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 no-pdf">
                  {quote.attachments.map((attachment, index) => {
                    const isImg = (attachment as any).type === 'image' || ['jpg', 'jpeg', 'png', 'webp'].includes(attachment.name.split('.').pop()?.toLowerCase() || '') || attachment.url.startsWith('data:image/');
                    if (isImg) return null;

                    return (
                      <div key={index} className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors">
                        <a 
                          href={attachment.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-2 text-xs font-bold text-primary hover:underline truncate"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{attachment.name}</span>
                        </a>
                        <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] font-bold text-muted-foreground">
                          <a href={attachment.url} target="_blank" rel="noopener noreferrer" download>
                            Unduh
                          </a>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>

        {/* Document Footer */}
        {profile?.custom_footer && (
          <CardFooter className="p-6 sm:p-8 pt-4 border-t border-border/70 bg-muted/20 text-center">
            <p className="text-xs text-muted-foreground text-center w-full whitespace-pre-wrap leading-relaxed">
              {profile.custom_footer}
            </p>
          </CardFooter>
        )}
      </Card>

      {/* Lightbox Modal for Survey Photo Preview */}
      {activePhotoPreview && (
        <div 
          onClick={() => setActivePhotoPreview(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div 
            onClick={e => e.stopPropagation()} 
            className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-3 p-4 text-white"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">{activePhotoPreview.title}</h4>
              <Button 
                onClick={() => setActivePhotoPreview(null)}
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[75vh] overflow-hidden rounded-2xl bg-black flex items-center justify-center">
              <img src={activePhotoPreview.url} alt={activePhotoPreview.title} className="max-h-[75vh] w-auto object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Print styles for PDF export */}
      <style>{`
        @media print {
          body { background-color: white !important; color: black !important; }
          .no-pdf { display: none !important; }
          .quote-print-container { background-color: white !important; color: black !important; border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
};

export default PublicQuoteView;