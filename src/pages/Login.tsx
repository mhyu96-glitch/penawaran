import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError, showSuccess } from '@/utils/toast';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2, KeyRound } from 'lucide-react';

const Login = () => {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated and not loading, redirect to dashboard
  if (session && !authLoading) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (!password && mode !== 'forgot')) {
      showError('Mohon lengkapi alamat email dan kata sandi.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          if (error.message.toLowerCase().includes('rate') || error.status === 429) {
            showError('Terlalu banyak percobaan login. Mohon tunggu 1 menit lalu coba lagi.');
          } else if (error.message.toLowerCase().includes('invalid')) {
            showError('Email atau kata sandi yang Anda masukkan salah.');
          } else {
            showError(error.message || 'Gagal masuk ke akun.');
          }
          setIsSubmitting(false);
          return;
        }

        if (data.session) {
          showSuccess('Berhasil masuk! Mengalihkan ke Dashboard...');
          navigate('/dashboard', { replace: true });
        }
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (error) {
          showError(error.message || 'Gagal mendaftarkan akun.');
          setIsSubmitting(false);
          return;
        }

        if (data.session) {
          showSuccess('Pendaftaran berhasil! Mengalihkan ke Dashboard...');
          navigate('/dashboard', { replace: true });
        } else {
          showSuccess('Pendaftaran berhasil! Silakan periksa email Anda untuk konfirmasi aktivasi.');
          setMode('login');
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login`,
        });

        if (error) {
          showError(error.message || 'Gagal mengirim instruksi reset kata sandi.');
        } else {
          showSuccess('Instruksi reset kata sandi telah dikirim ke email Anda.');
          setMode('login');
        }
      }
    } catch (err: any) {
      console.error('Auth submit error:', err);
      showError(err?.message || 'Terjadi kendala saat memproses otentikasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-foreground relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />

      <Card className="w-full max-w-md mx-4 border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl rounded-2xl relative z-10">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 shadow-inner">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-foreground">
            {mode === 'login' && 'Selamat Datang'}
            {mode === 'register' && 'Buat Akun Baru'}
            {mode === 'forgot' && 'Reset Kata Sandi'}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {mode === 'login' && 'Masuk untuk mengelola penawaran, faktur, dan keuangan bisnis Anda.'}
            {mode === 'register' && 'Daftar sekarang untuk mulai mengelola bisnis Anda.'}
            {mode === 'forgot' && 'Masukkan email terdaftar untuk menerima tautan reset.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Alamat Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 rounded-xl text-sm bg-muted/40 border-border/80 focus:ring-2 focus:ring-teal-500"
                  required
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Kata Sandi
                  </Label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs text-teal-600 hover:text-teal-500 dark:text-teal-400 font-semibold hover:underline"
                    >
                      Lupa Kata Sandi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-xl text-sm bg-muted/40 border-border/80 focus:ring-2 focus:ring-teal-500"
                    required
                    disabled={isSubmitting}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-lg shadow-teal-600/20 active:scale-[0.98] transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'login' && 'Masuk ke Akun'}
                    {mode === 'register' && 'Daftar Akun'}
                    {mode === 'forgot' && 'Kirim Link Reset'}
                  </span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col items-center justify-center border-t border-border/60 pt-4 pb-6">
          {mode === 'login' && (
            <p className="text-xs text-muted-foreground">
              Belum memiliki akun?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="font-bold text-teal-600 hover:text-teal-500 dark:text-teal-400 hover:underline"
              >
                Daftar sekarang
              </button>
            </p>
          )}

          {mode === 'register' && (
            <p className="text-xs text-muted-foreground">
              Sudah memiliki akun?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="font-bold text-teal-600 hover:text-teal-500 dark:text-teal-400 hover:underline"
              >
                Masuk di sini
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-xs font-bold text-teal-600 hover:text-teal-500 dark:text-teal-400 hover:underline"
            >
              Kembali ke Halaman Masuk
            </button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
