import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { showError, showSuccess } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { User, PenTool, Eraser } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SignatureCanvas from 'react-signature-canvas';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState('#000000');
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      } else if (data) {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setCompanyName(data.company_name || '');
        setCompanyAddress(data.company_address || '');
        setCompanyWebsite(data.company_website || '');
        setCompanyPhone(data.company_phone || '');
        setCompanyLogoUrl(data.company_logo_url || null);
        setBrandColor(data.brand_color || '#000000');
        setSignatureUrl(data.signature_url || null);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleUploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/logo.${fileExt}`;

    setIsUploadingLogo(true);
    const { error: uploadError } = await supabase.storage
      .from('company_assets')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      showError('Gagal mengunggah logo.');
      setIsUploadingLogo(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('company_assets').getPublicUrl(filePath);
    const newLogoUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ company_logo_url: newLogoUrl })
      .eq('id', user.id);

    if (updateError) showError('Gagal menyimpan URL logo.');
    else {
      setCompanyLogoUrl(newLogoUrl);
      showSuccess('Logo berhasil diunggah!');
    }
    setIsUploadingLogo(false);
  };

  const saveSignature = async () => {
    if (!user || !sigCanvas.current || sigCanvas.current.isEmpty()) {
        if (!signatureUrl) showError('Tanda tangan kosong.');
        return;
    }

    const dataURL = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    const res = await fetch(dataURL);
    const blob = await res.blob();
    const file = new File([blob], 'signature.png', { type: 'image/png' });

    const filePath = `${user.id}/signature.png`;
    
    const { error: uploadError } = await supabase.storage
        .from('company_assets')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        showError('Gagal menyimpan tanda tangan.');
        return;
    }

    const { data: urlData } = supabase.storage.from('company_assets').getPublicUrl(filePath);
    const newSigUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

    setSignatureUrl(newSigUrl);
    return newSigUrl;
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    let finalSigUrl = signatureUrl;
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        const savedUrl = await saveSignature();
        if (savedUrl) finalSigUrl = savedUrl;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        company_address: companyAddress,
        company_website: companyWebsite,
        company_phone: companyPhone,
        brand_color: brandColor,
        signature_url: finalSigUrl,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      showError('Gagal memperbarui profil.');
    } else {
      showSuccess('Profil berhasil diperbarui!');
    }
    setIsSubmitting(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64 mt-2" /></CardHeader>
          <CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3"><User className="h-7 w-7" /><CardTitle className="text-3xl">Profil Saya</CardTitle></div>
          <CardDescription>Perbarui informasi pribadi dan perusahaan Anda di sini.</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateProfile}>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="firstName">Nama Depan</Label><Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="lastName">Nama Belakang</Label><Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <Separator />
            <div className="space-y-4">
                <h3 className="font-semibold">Informasi Perusahaan & Branding</h3>
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20"><AvatarImage src={companyLogoUrl || undefined} /><AvatarFallback>{companyName.charAt(0)}</AvatarFallback></Avatar>
                    <div className="space-y-2">
                        <Label htmlFor="logo-upload">Logo Perusahaan</Label>
                        <Input id="logo-upload" type="file" accept="image/png, image/jpeg" onChange={handleUploadLogo} disabled={isUploadingLogo} />
                        {isUploadingLogo && <p className="text-sm text-muted-foreground">Mengunggah...</p>}
                    </div>
                </div>

                <div className="space-y-2 border p-4 rounded-md bg-slate-50">
                    <Label className="flex items-center gap-2"><PenTool className="h-4 w-4" /> Tanda Tangan Digital</Label>
                    <p className="text-xs text-muted-foreground mb-2">Gambar tanda tangan Anda di kotak ini. Tanda tangan ini akan otomatis muncul di semua dokumen.</p>
                    
                    <div className="border border-gray-300 bg-white rounded-md overflow-hidden" style={{ width: '100%', height: 150 }}>
                        <SignatureCanvas 
                            ref={sigCanvas}
                            penColor="black"
                            canvasProps={{ className: 'w-full h-full' }}
                        />
                    </div>
                    
                    <div className="flex justify-between items-center mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={clearSignature}><Eraser className="mr-2 h-3 w-3" /> Bersihkan</Button>
                        {signatureUrl && <p className="text-xs text-green-600 font-medium">Tanda tangan tersimpan ada.</p>}
                    </div>
                </div>

                <div className="space-y-2"><Label htmlFor="companyName">Nama Perusahaan</Label><Input id="companyName" placeholder="Nama Perusahaan Anda" value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="companyPhone">Nomor WhatsApp / Telepon</Label><Input id="companyPhone" placeholder="Contoh: 628123456789" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="companyAddress">Alamat Perusahaan</Label><Textarea id="companyAddress" placeholder="Alamat Perusahaan Anda" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="companyWebsite">Website Perusahaan</Label><Input id="companyWebsite" placeholder="https://websiteanda.com" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="brandColor">Warna Merek</Label>
                    <div className="flex items-center gap-2">
                        <Input id="brandColor" type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-12 h-10 p-1" />
                        <Input type="text" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-24" />
                    </div>
                    <p className="text-sm text-muted-foreground">Warna ini akan digunakan pada judul dokumen Anda.</p>
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}</Button>
            <Button variant="outline" onClick={handleSignOut}>Keluar</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Profile;