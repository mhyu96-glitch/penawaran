import { useEffect, useState } from 'react';
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
import { User, QrCode } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingQris, setIsUploadingQris] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState('#000000');

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
        setQrisUrl(data.qris_url || null);
        setBrandColor(data.brand_color || '#000000');
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

  const handleUploadQris = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/qris.${fileExt}`;

    setIsUploadingQris(true);
    const { error: uploadError } = await supabase.storage
      .from('company_assets')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      showError('Gagal mengunggah QRIS.');
      setIsUploadingQris(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('company_assets').getPublicUrl(filePath);
    const newQrisUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ qris_url: newQrisUrl })
      .eq('id', user.id);

    if (updateError) showError('Gagal menyimpan URL QRIS.');
    else {
      setQrisUrl(newQrisUrl);
      showSuccess('QRIS berhasil diunggah!');
    }
    setIsUploadingQris(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

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

                <div className="flex items-start gap-4 border p-4 rounded-md bg-slate-50">
                    <div className="h-20 w-20 flex items-center justify-center bg-white border rounded-md shrink-0 overflow-hidden">
                       {qrisUrl ? <img src={qrisUrl} alt="QRIS" className="w-full h-full object-contain" /> : <QrCode className="h-10 w-10 text-slate-300" />}
                    </div>
                    <div className="space-y-2 w-full">
                        <Label htmlFor="qris-upload">QRIS Statis (Opsional)</Label>
                        <Input id="qris-upload" type="file" accept="image/png, image/jpeg" onChange={handleUploadQris} disabled={isUploadingQris} />
                        <p className="text-xs text-muted-foreground">Unggah gambar QRIS toko Anda agar muncul di faktur.</p>
                        {isUploadingQris && <p className="text-sm text-muted-foreground">Mengunggah...</p>}
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