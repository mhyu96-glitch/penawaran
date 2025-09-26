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
import { Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [defaultTerms, setDefaultTerms] = useState('');
  const [defaultTax, setDefaultTax] = useState(0);
  const [defaultDiscount, setDefaultDiscount] = useState(0);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('default_terms, default_tax_percentage, default_discount_percentage')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error);
        showError('Gagal memuat pengaturan.');
      } else if (data) {
        setDefaultTerms(data.default_terms || '');
        setDefaultTax(data.default_tax_percentage || 0);
        setDefaultDiscount(data.default_discount_percentage || 0);
      }
      setLoading(false);
    };

    fetchSettings();
  }, [user]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        default_terms: defaultTerms,
        default_tax_percentage: defaultTax,
        default_discount_percentage: defaultDiscount,
      })
      .eq('id', user.id);

    if (error) {
      showError('Gagal menyimpan pengaturan.');
      console.error('Settings update error:', error);
    } else {
      showSuccess('Pengaturan berhasil disimpan!');
    }
    setIsSubmitting(false);
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
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
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
            <SettingsIcon className="h-7 w-7" />
            <CardTitle className="text-3xl">Pengaturan Default</CardTitle>
          </div>
          <CardDescription>
            Atur nilai default untuk penawaran baru untuk menghemat waktu.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateSettings}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="defaultTerms">Syarat & Ketentuan Default</Label>
              <Textarea
                id="defaultTerms"
                placeholder="Contoh: Pembayaran 50% di muka..."
                value={defaultTerms}
                onChange={(e) => setDefaultTerms(e.target.value)}
                rows={5}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultTax">Pajak Default (%)</Label>
                <Input
                  id="defaultTax"
                  type="number"
                  value={defaultTax}
                  onChange={(e) => setDefaultTax(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultDiscount">Diskon Default (%)</Label>
                <Input
                  id="defaultDiscount"
                  type="number"
                  value={defaultDiscount}
                  onChange={(e) => setDefaultDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Settings;