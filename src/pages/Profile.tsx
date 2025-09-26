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
import { User } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine on first load
        console.error('Error fetching profile:', error);
      } else if (data) {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setCompanyName(data.company_name || '');
        setCompanyAddress(data.company_address || '');
        setCompanyWebsite(data.company_website || '');
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

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
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      showError('Gagal memperbarui profil.');
      console.error('Profile update error:', error);
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
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <User className="h-7 w-7" />
            <CardTitle className="text-3xl">Profil Saya</CardTitle>
          </div>
          <CardDescription>Perbarui informasi pribadi dan perusahaan Anda di sini.</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateProfile}>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nama Depan</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nama Belakang</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
                <h3 className="font-semibold">Informasi Perusahaan</h3>
                <div className="space-y-2">
                    <Label htmlFor="companyName">Nama Perusahaan</Label>
                    <Input id="companyName" placeholder="Nama Perusahaan Anda" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="companyAddress">Alamat Perusahaan</Label>
                    <Textarea id="companyAddress" placeholder="Alamat Perusahaan Anda" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="companyWebsite">Website Perusahaan</Label>
                    <Input id="companyWebsite" placeholder="https://websiteanda.com" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} />
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
            <Button variant="outline" onClick={handleSignOut}>Keluar</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Profile;