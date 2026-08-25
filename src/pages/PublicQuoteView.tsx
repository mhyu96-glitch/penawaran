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
  AlertCircle
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
      <div className="min-h-screen bg-slate-950 p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-4xl space-y-4">
          <Skeleton className="h-20 w-full rounded-3xl bg-slate-900" />
          <Skeleton className="h-[600px] w-full rounded-3xl bg-slate-900" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 flex items-center justify-center text-center">
        <div className="max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 text-white space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold">Dokumen Tidak Ditemukan</h2>
          <p className="text-sm text-slate-400">Tautan penawaran mungkin sudah tidak berlaku atau salah nomor ID.</p>
        </div>
      </div>
    );
  }

  const isPending = actionTaken === '' && (quote.status === 'Terkirim' || quote.status === 'Draf' || quote.status === 'Menunggu');
  const isAccepted = actionTaken === 'Diterima' || quote.status === 'Diterima';
  const isRejected = actionTaken === 'Ditolak' || quote.status === 'Ditolak';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 px-3 sm:px-6 lg:px-8">
      {/* ========================================================================= */}
      {/* TOP FLOATING CLIENT ACTION BAR */}
      {/* ========================================================================= */}
      <div className="max-w-4xl mx-auto mb-6 no-pdf">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-3.5 sm:p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">Portal Klien Resmi</span>
                {isAccepted && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                    ✓ DISETUJUI
                  </Badge>
                )}
                {isRejected && (
                  <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] font-bold">
                    ✕ DITOLAK
                  </Badge>
                )}
                {isPending && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] font-bold">
                    MENUNGGU RESPON
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
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
              className="rounded-xl h-10 px-4 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
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
                  className="rounded-xl h-10 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30"
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
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-950/80 to-indigo-950/80 border border-blue-800/60 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-sm sm:text-base text-blue-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" /> Tinjau & Konfirmasi Penawaran
              </h3>
              <p className="text-xs text-blue-300/80">
                Silakan periksa rincian barang, jasa, dan biaya di bawah ini. Jika Anda menyetujui, klik tombol <strong>"Terima Penawaran"</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                onClick={() => handleStatusUpdate('Diterima')} 
                disabled={isSubmitting}
                className="rounded-xl font-bold text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
              >
                <CheckCircle className="mr-1.5 h-4 w-4" /> Setujui Sekarang
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAccepted && (
        <div className="max-w-4xl mx-auto mb-6 no-pdf">
          <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 shadow-lg flex items-center gap-3 text-emerald-300">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-sm text-emerald-200">Penawaran Telah Diterima & Disetujui</p>
              <p className="text-xs text-emerald-400/80">Terima kasih atas persetujuan Anda. Pihak {quote.from_company} telah menerima notifikasi dan akan segera menindaklanjuti.</p>
            </div>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="max-w-4xl mx-auto mb-6 no-pdf">
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/60 shadow-lg flex items-center gap-3 text-rose-300">
            <XCircle className="h-6 w-6 text-rose-400 shrink-0" />
            <div>
              <p className="font-bold text-sm text-rose-200">Penawaran Ditolak</p>
              <p className="text-xs text-rose-400/80">Pihak {quote.from_company} telah diberitahu mengenai penolakan penawaran ini.</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN QUOTATION PAPER CARD (Pristine White Document) */}
      {/* ========================================================================= */}
      <Card ref={quoteRef} className="max-w-4xl mx-auto bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Document Header Bar */}
        <div className="p-6 sm:p-10 border-b border-slate-200 bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            {/* Sender / Company Info */}
            <div className="space-y-3 max-w-md">
              {profile?.company_logo_url ? (
                <img src={profile.company_logo_url} alt="Company Logo" className="max-h-16 object-contain" />
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                    {quote.from_company.slice(0, 1) || 'P'}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {quote.from_company}
                  </h1>
                </div>
              )}

              <div className="text-xs text-slate-500 space-y-1">
                {quote.from_address && (
                  <p className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{quote.from_address}</span>
                  </p>
                )}
                {quote.from_website && (
                  <p className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{quote.from_website}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Document Number & Metadata */}
            <div className="sm:text-right space-y-2">
              <div className="inline-block px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-black tracking-widest uppercase">
                SURAT PENAWARAN
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                #{quote.quote_number || quote.id.slice(0, 8)}
              </h2>
              <div className="text-xs text-slate-500 space-y-1">
                <p><strong>Tanggal:</strong> {safeFormat(quote.quote_date, 'd MMMM yyyy')}</p>
                <p><strong>Berlaku Hingga:</strong> {safeFormat(quote.valid_until, 'd MMMM yyyy')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Client Destination & Subject */}
        <CardContent className="p-6 sm:p-10 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-50 border border-slate-100">
            {/* Bill To */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Ditujukan Kepada:
              </span>
              <h3 className="font-black text-base text-slate-900">{quote.to_client}</h3>
              {quote.to_address && (
                <p className="text-xs text-slate-600 flex items-start gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{quote.to_address}</span>
                </p>
              )}
              {quote.to_phone && (
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{quote.to_phone}</span>
                </p>
              )}
            </div>

            {/* Subject */}
            <div className="sm:text-right space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Perihal / Proyek:
              </span>
              <h3 className="font-extrabold text-base text-slate-900">
                {quote.title || 'Penawaran Barang & Jasa'}
              </h3>
              <p className="text-xs text-slate-500">
                Dokumen penawaran resmi dan sah diterbitkan untuk keperluan pengadaan.
              </p>
            </div>
          </div>

          {/* Rincian Item Penawaran */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Rincian Barang & Jasa
            </h4>
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
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
            <div className="w-full sm:w-80 rounded-2xl bg-slate-50 p-5 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between font-medium text-slate-600">
                <span>Subtotal Barang & Jasa:</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(subtotal)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Potongan Diskon:</span>
                  <span className="font-bold tabular-nums">- {formatCurrency(discountAmount)}</span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Pajak (PPN):</span>
                  <span className="font-bold text-slate-900 tabular-nums">+ {formatCurrency(taxAmount)}</span>
                </div>
              )}

              <Separator className="my-2 bg-slate-300" />

              <div className="flex justify-between text-sm sm:text-base font-black text-slate-900">
                <span>Total Penawaran:</span>
                <span className="text-primary tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          {quote.terms && (
            <div className="space-y-2 p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-slate-500" /> Syarat & Ketentuan:
              </h4>
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">
                {quote.terms}
              </div>
            </div>
          )}

          {/* Attachments */}
          {quote.attachments && quote.attachments.length > 0 && (
            <div className="space-y-3 no-pdf">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Paperclip className="h-4 w-4" /> Berkas & Lampiran Pendukung ({quote.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quote.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <a 
                      href={attachment.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline truncate"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">{attachment.name}</span>
                    </a>
                    <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] font-bold text-slate-600">
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer" download>
                        Unduh
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        {/* Document Footer */}
        {profile?.custom_footer && (
          <CardFooter className="p-6 sm:p-8 pt-4 border-t border-slate-200 bg-slate-50 text-center">
            <p className="text-xs text-slate-500 text-center w-full whitespace-pre-wrap leading-relaxed">
              {profile.custom_footer}
            </p>
          </CardFooter>
        )}
      </Card>

      {/* Print styles */}
      <style>{`@media print { body { background-color: white !important; } .no-pdf { display: none !important; } }`}</style>
    </div>
  );
};

export default PublicQuoteView;