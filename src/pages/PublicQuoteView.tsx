import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Download, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency, safeFormat } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
        const { data: profileData } = await supabase.from('profiles').select('custom_footer, show_quantity_column, show_unit_column, show_unit_price_column, company_logo_url, brand_color').eq('id', quoteData.user_id).single();
        setProfile(profileData);

        // Track View (Execute only once per session/mount)
        if (!hasTracked.current) {
            hasTracked.current = true;
            // Use RPC to track view securely
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

  const handleSaveAsPDF = () => {
    if (!quoteRef.current || !quote) return;
    setIsGeneratingPDF(true);
    const input = quoteRef.current;
    
    // Save original styles
    const originalWidth = input.style.width;
    const originalHeight = input.style.height;
    const originalOverflow = input.style.overflow;
    
    // Force A4 dimensions
    input.style.width = '794px';
    input.style.height = 'auto';
    input.style.overflow = 'visible';

    const elementsToHide = input.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    // Slight delay for layout refresh
    setTimeout(() => {
        html2canvas(input, { 
            scale: 2, 
            useCORS: true,
            logging: false,
            windowWidth: 794
        })
        .then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            
            pdf.save(`Penawaran-${quote.quote_number || quote.id}.pdf`);
        })
        .finally(() => {
            elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
            input.style.width = originalWidth;
            input.style.height = originalHeight;
            input.style.overflow = originalOverflow;
            setIsGeneratingPDF(false);
        });
    }, 100);
  };

  const subtotal = useMemo(() => {
    if (!quote) return 0;
    return quote.quote_items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  }, [quote]);

  const discountAmount = useMemo(() => quote?.discount_amount || 0, [quote]);
  const taxAmount = useMemo(() => quote?.tax_amount || 0, [quote]);
  const total = useMemo(() => subtotal - discountAmount + taxAmount, [subtotal, discountAmount, taxAmount]);

  if (loading) {
    return <div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div>;
  }

  if (!quote) {
    return <div className="container mx-auto p-8 text-center"><h1>Penawaran tidak ditemukan atau tidak valid.</h1></div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto mb-4 flex justify-end no-pdf">
        <Button onClick={handleSaveAsPDF} disabled={isGeneratingPDF}>
          {isGeneratingPDF ? 'Membuat...' : <><Download className="mr-2 h-4 w-4" /> Unduh PDF</>}
        </Button>
      </div>
      <Card ref={quoteRef} className="max-w-4xl mx-auto shadow-lg">
        {actionTaken === '' && quote.status === 'Terkirim' && (
            <div className="p-6 bg-blue-50 border-b border-blue-200 no-pdf">
                <h3 className="font-semibold text-lg text-blue-800">Tinjau dan Konfirmasi Penawaran</h3>
                <p className="text-sm text-blue-700 mt-1">Silakan tinjau detail di bawah ini. Jika Anda setuju dengan persyaratan, klik "Terima Penawaran".</p>
                <div className="mt-4 flex gap-4">
                    <Button onClick={() => handleStatusUpdate('Diterima')} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="mr-2 h-4 w-4" /> {isSubmitting ? 'Memproses...' : 'Terima Penawaran'}
                    </Button>
                    <Button onClick={() => handleStatusUpdate('Ditolak')} disabled={isSubmitting} variant="destructive">
                        <XCircle className="mr-2 h-4 w-4" /> {isSubmitting ? 'Memproses...' : 'Tolak Penawaran'}
                    </Button>
                </div>
            </div>
        )}
        {actionTaken && (
            <Alert variant={actionTaken === 'Diterima' ? 'default' : 'destructive'} className="m-4 border-2 no-pdf">
                <AlertTitle className="font-bold flex items-center gap-2">
                    {actionTaken === 'Diterima' ? <><CheckCircle className="text-green-600"/>Anda Telah Menerima Penawaran Ini</> : <><XCircle className="text-red-600"/>Anda Telah Menolak Penawaran Ini</>}
                </AlertTitle>
                <AlertDescription>
                    Terima kasih atas tanggapan Anda. {quote.from_company} telah diberitahu.
                </AlertDescription>
            </Alert>
        )}
        <CardHeader className="bg-gray-50 p-8 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              {profile?.company_logo_url ? <img src={profile.company_logo_url} alt="Company Logo" className="max-h-20 mb-4" /> : <h1 className="text-2xl font-bold text-gray-800">{quote.from_company}</h1>}
              <p className="text-sm text-muted-foreground">{quote.from_address}</p>
              <p className="text-sm text-muted-foreground">{quote.from_website}</p>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold uppercase text-gray-400 tracking-widest" style={{ color: profile?.brand_color || undefined }}>Penawaran</h2>
              <p className="text-sm text-muted-foreground mt-2">No: {quote.quote_number}</p>
              <p className="text-sm text-muted-foreground">Tanggal: {safeFormat(quote.quote_date, 'PPP')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-500 mb-2 text-sm">Ditujukan Kepada:</h3>
              <p className="font-bold">{quote.to_client}</p>
              <p className="text-sm">{quote.to_address}</p>
              <p className="text-sm">{quote.to_phone}</p>
            </div>
            <div className="text-right">
                <h3 className="font-semibold text-gray-500 mb-2 text-sm">Perihal:</h3>
                <p className="font-bold text-lg">{quote.title || '-'}</p>
                <h3 className="font-semibold text-gray-500 mb-2 text-sm mt-4">Berlaku Hingga:</h3>
                <p className="text-sm">{safeFormat(quote.valid_until, 'PPP')}</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr className="border-b">
                  <th className="p-3 text-center font-medium text-gray-700 w-[40px]">No.</th>
                  <th className="p-3 text-left font-medium text-gray-700">Deskripsi</th>
                  {profile?.show_quantity_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Jumlah</th>}
                  {profile?.show_unit_column && <th className="p-3 text-center font-medium text-gray-700 w-[80px]">Satuan</th>}
                  {profile?.show_unit_price_column && <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Harga Satuan</th>}
                  <th className="p-3 text-right font-medium text-gray-700 w-[150px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.quote_items.map((item, index) => (
                  <tr key={index} className="border-b last:border-none">
                    <td className="p-3 text-center align-top">{index + 1}</td>
                    <td className="p-3 align-top">{item.description}</td>
                    {profile?.show_quantity_column && <td className="p-3 text-center align-top">{item.quantity}</td>}
                    {profile?.show_unit_column && <td className="p-3 text-center align-top">{item.unit || '-'}</td>}
                    {profile?.show_unit_price_column && <td className="p-3 text-right align-top">{formatCurrency(item.unit_price)}</td>}
                    <td className="p-3 text-right align-top">{formatCurrency(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>- {formatCurrency(discountAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>+ {formatCurrency(taxAmount)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span >Total</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>
          {quote.terms && (
            <div>
                <h3 className="font-semibold text-gray-500 mb-2">Syarat & Ketentuan:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.terms}</p>
            </div>
          )}
          {quote.attachments && quote.attachments.length > 0 && (
            <div className="no-pdf">
              <h3 className="font-semibold text-gray-500 mb-2">Lampiran:</h3>
              <div className="space-y-2">
                {quote.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center p-2 border rounded-md">
                    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                      <FileText className="h-4 w-4" />
                      {attachment.name}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        {profile?.custom_footer && (
            <CardFooter className="p-8 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center w-full whitespace-pre-wrap">{profile.custom_footer}</p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default PublicQuoteView;