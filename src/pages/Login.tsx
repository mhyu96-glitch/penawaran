import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError, showSuccess } from '@/utils/toast';
import { 
  Eye, EyeOff, Lock, Mail, ArrowRight, Loader2, KeyRound, 
  Sparkles, ShieldCheck, CheckCircle2, Zap, ArrowLeft, RefreshCw
} from 'lucide-react';
import { AnimatedLoginMascot } from '@/components/AnimatedLoginMascot';
import { cn } from '@/lib/utils';

const Login = () => {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Animation Focus States for Mascot & Feedback
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasError, setHasError] = useState(false);

  // If already authenticated and not loading, redirect to dashboard
  if (session && !authLoading) {
    return <Navigate to="/dashboard" replace />;
  }

  // Calculate password strength
  const getPasswordStrength = () => {
    if (!password) return { score: 0, label: '', color: 'bg-muted' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 1:
        return { score: 25, label: 'Cukup', color: 'bg-amber-500' };
      case 2:
        return { score: 50, label: 'Sedang', color: 'bg-yellow-500' };
      case 3:
        return { score: 75, label: 'Kuat', color: 'bg-teal-500' };
      case 4:
        return { score: 100, label: 'Sangat Kuat', color: 'bg-emerald-500' };
      default:
        return { score: 10, label: 'Pendek', color: 'bg-rose-500' };
    }
  };

  const strength = getPasswordStrength();

  const triggerError = (msg: string) => {
    setHasError(true);
    showError(msg);
    setTimeout(() => setHasError(false), 800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (!password && mode !== 'forgot')) {
      triggerError('Mohon lengkapi alamat email dan kata sandi.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      triggerError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    setHasError(false);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          if (error.message.toLowerCase().includes('rate') || error.status === 429) {
            triggerError('Terlalu banyak percobaan login. Mohon tunggu 1 menit lalu coba lagi.');
          } else if (error.message.toLowerCase().includes('invalid')) {
            triggerError('Email atau kata sandi yang Anda masukkan salah.');
          } else {
            triggerError(error.message || 'Gagal masuk ke akun.');
          }
          setIsSubmitting(false);
          return;
        }

        if (data.session) {
          setIsSuccess(true);
          showSuccess('Login berhasil! Mengalihkan ke Dashboard...');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 600);
        }
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (error) {
          triggerError(error.message || 'Gagal mendaftarkan akun.');
          setIsSubmitting(false);
          return;
        }

        if (data.session) {
          setIsSuccess(true);
          showSuccess('Pendaftaran berhasil! Mengalihkan ke Dashboard...');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 600);
        } else {
          showSuccess('Pendaftaran berhasil! Silakan periksa email Anda untuk konfirmasi aktivasi.');
          setMode('login');
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login`,
        });

        if (error) {
          triggerError(error.message || 'Gagal mengirim instruksi reset kata sandi.');
        } else {
          showSuccess('Instruksi reset kata sandi telah dikirim ke email Anda.');
          setMode('login');
        }
      }
    } catch (err: any) {
      console.error('Auth submit error:', err);
      triggerError(err?.message || 'Terjadi kendala saat memproses otentikasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8 text-foreground overflow-hidden selection:bg-teal-500 selection:text-white">
      {/* Dynamic Animated Ambient Mesh Orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-teal-500/20 blur-[130px] animate-pulse" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[450px] w-[450px] rounded-full bg-indigo-500/20 blur-[120px] animate-pulse [animation-delay:2s]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full bg-emerald-500/15 blur-[110px] animate-pulse [animation-delay:4s]" />

      {/* Subtle Background Cyber Grid */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
        style={{
          backgroundImage: 'radial-gradient(circle, #14b8a6 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      <div className="w-full max-w-md mx-auto relative z-10 space-y-4">
        {/* Top Floating App Brand */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-xs font-bold shadow-xs backdrop-blur-md mb-2">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
            <span>Sistem Otentikasi Terenkripsi</span>
          </div>
        </div>

        {/* Main Card with Animated Border and Shake on Error */}
        <Card className={cn(
          "border border-slate-800/80 bg-slate-900/90 backdrop-blur-2xl shadow-2xl rounded-3xl overflow-hidden transition-all duration-300",
          hasError && "animate-[shake_0.4s_ease-in-out] border-rose-500/50 shadow-rose-500/20",
          isSuccess && "border-emerald-500/50 shadow-emerald-500/20"
        )}>
          {/* Card Header with Interactive Animated Mascot */}
          <CardHeader className="text-center pb-2 pt-6 px-6 relative">
            {/* Mascot Centerpiece */}
            <div className="mb-2">
              <AnimatedLoginMascot
                isEmailFocused={isEmailFocused}
                isPasswordFocused={isPasswordFocused}
                isPeeking={showPassword}
                emailLength={email.length}
                isSubmitting={isSubmitting}
                isSuccess={isSuccess}
                hasError={hasError}
              />
            </div>

            <CardTitle className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
              {mode === 'login' && 'QuoteApp'}
              {mode === 'register' && 'Buat Akun QuoteApp'}
              {mode === 'forgot' && 'Reset Kata Sandi'}
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">
              {mode === 'login' && 'Masuk untuk mengelola penawaran, faktur, dan laba proyek.'}
              {mode === 'register' && 'Daftarkan akun untuk mulai mengelola keuangan usaha Anda.'}
              {mode === 'forgot' && 'Masukkan email terdaftar untuk menerima tautan pemulihan.'}
            </CardDescription>

            {/* Segmented Mode Switcher Tabs */}
            {mode !== 'forgot' && (
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-950/70 border border-slate-800 mt-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setHasError(false); }}
                  className={cn(
                    "py-2 rounded-xl transition-all duration-200",
                    mode === 'login' 
                      ? "bg-teal-600 text-white shadow-md" 
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Masuk Akun
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setHasError(false); }}
                  className={cn(
                    "py-2 rounded-xl transition-all duration-200",
                    mode === 'register' 
                      ? "bg-teal-600 text-white shadow-md" 
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Daftar Baru
                </button>
              </div>
            )}
          </CardHeader>

          <CardContent className="px-6 pt-2 pb-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: Email / Username */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Alamat Email</span>
                  {isEmailFocused && (
                    <span className="text-[10px] text-teal-400 font-normal animate-pulse">Mengetik email...</span>
                  )}
                </Label>
                <div className="relative group">
                  <Mail className={cn(
                    "absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
                    isEmailFocused ? "text-teal-400" : "text-slate-500"
                  )} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@perusahaan.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    className={cn(
                      "pl-10 h-11 rounded-xl text-sm bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 transition-all",
                      "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    )}
                    required
                    disabled={isSubmitting}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Field 2: Password */}
              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <span>Kata Sandi</span>
                      {isPasswordFocused && !showPassword && (
                        <span className="text-[10px] text-indigo-400 font-normal">Terselubung rahasia 🙈</span>
                      )}
                      {isPasswordFocused && showPassword && (
                        <span className="text-[10px] text-teal-400 font-normal">Mengintip kata sandi 👁️</span>
                      )}
                    </Label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-xs text-teal-400 hover:text-teal-300 font-semibold hover:underline"
                      >
                        Lupa Kata Sandi?
                      </button>
                    )}
                  </div>
                  
                  <div className="relative group">
                    <Lock className={cn(
                      "absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
                      isPasswordFocused ? "text-teal-400" : "text-slate-500"
                    )} />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      className={cn(
                        "pl-10 pr-10 h-11 rounded-xl text-sm bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 transition-all",
                        "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      )}
                      required
                      disabled={isSubmitting}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      title={showPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-teal-400" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator when typing in Register mode */}
                  {mode === 'register' && password.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Kekuatan Kata Sandi:</span>
                        <span className={cn("font-bold", strength.score >= 75 ? "text-emerald-400" : "text-amber-400")}>
                          {strength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className={cn("h-full transition-all duration-300 rounded-full", strength.color)} 
                          style={{ width: `${strength.score}%` }} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Field 3: Confirm Password (Register Mode only) */}
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-bold text-slate-300">
                    Konfirmasi Kata Sandi
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 h-11 rounded-xl text-sm bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      required
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button with Animated State */}
              <Button
                type="submit"
                disabled={isSubmitting || isSuccess}
                className={cn(
                  "w-full h-11 rounded-xl font-bold text-sm text-white shadow-lg transition-all duration-200 active:scale-[0.98]",
                  isSuccess 
                    ? "bg-emerald-600 shadow-emerald-600/30" 
                    : "bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 shadow-teal-600/30"
                )}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Memverifikasi Akses...</span>
                  </span>
                ) : isSuccess ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-white animate-bounce" />
                    <span>Berhasil Masuk!</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>
                      {mode === 'login' && 'Masuk ke QuoteApp'}
                      {mode === 'register' && 'Daftar Akun Baru'}
                      {mode === 'forgot' && 'Kirim Link Pemulihan'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>

          {/* Card Footer */}
          <CardFooter className="flex flex-col items-center justify-center border-t border-slate-800/80 pt-4 pb-5 px-6 space-y-3">
            {mode === 'forgot' ? (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Halaman Masuk
              </button>
            ) : (
              <p className="text-xs text-slate-400">
                {mode === 'login' ? 'Belum memiliki akun? ' : 'Sudah memiliki akun? '}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="font-bold text-teal-400 hover:text-teal-300 hover:underline ml-1"
                >
                  {mode === 'login' ? 'Daftar sekarang' : 'Masuk di sini'}
                </button>
              </p>
            )}
          </CardFooter>
        </Card>

        {/* Bottom App Footer */}
        <p className="text-center text-[11px] text-slate-500">
          QuoteApp Executive ERP Suite &copy; {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
};

export default Login;
