import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const Login = () => {
  const { session } = useAuth();

  if (session) {
    return <Navigate to="/quotes" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle>Selamat Datang</CardTitle>
          <CardDescription>Masuk untuk membuat penawaran</CardDescription>
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
                  email_label: 'Alamat email',
                  password_label: 'Kata sandi',
                  button_label: 'Masuk',
                  social_provider_text: 'Masuk dengan {{provider}}',
                  link_text: 'Sudah punya akun? Masuk',
                },
                sign_up: {
                  email_label: 'Alamat email',
                  password_label: 'Kata sandi',
                  button_label: 'Daftar',
                  social_provider_text: 'Daftar dengan {{provider}}',
                  link_text: 'Belum punya akun? Daftar',
                },
                forgotten_password: {
                  email_label: 'Alamat email',
                  button_label: 'Kirim instruksi reset kata sandi',
                  link_text: 'Lupa kata sandi?',
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