import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const Login = () => {
  const { session } = useAuth();

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Selamat Datang di QuoteApp</CardTitle>
          <CardDescription>Solusi cerdas untuk manajemen penawaran dan faktur.</CardDescription>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            theme="light"
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Alamat Email',
                  password_label: 'Kata Sandi',
                  button_label: 'Masuk ke Akun',
                  social_provider_text: 'Masuk dengan {{provider}}',
                  link_text: 'Belum punya akun? Daftar sekarang',
                },
                sign_up: {
                  email_label: 'Alamat Email',
                  password_label: 'Buat Kata Sandi',
                  button_label: 'Buat Akun Baru',
                  social_provider_text: 'Daftar dengan {{provider}}',
                  link_text: 'Sudah punya akun? Masuk di sini',
                },
                forgotten_password: {
                  email_label: 'Alamat Email Terdaftar',
                  button_label: 'Kirim Instruksi Reset',
                  link_text: 'Lupa Kata Sandi?',
                },
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;