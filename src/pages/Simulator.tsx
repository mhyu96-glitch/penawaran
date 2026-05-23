import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Smartphone, RotateCw, RefreshCw, ExternalLink, 
  ChevronRight, Database, Sparkles, Copy, Check, Info, ShieldAlert
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

type ClientItem = {
  id: string;
  name: string;
  access_key: string;
};

type QuoteItem = {
  id: string;
  quote_number: string;
  to_client?: string;
  clients?: { name: string };
};

type InvoiceItem = {
  id: string;
  invoice_number: string;
  to_client: string;
};

export default function Simulator() {
  const [iframeUrl, setIframeUrl] = useState('/dashboard');
  const [inputValue, setInputValue] = useState('/dashboard');
  const [scale, setScale] = useState(1);
  const [isPortrait, setIsPortrait] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Dynamic Data
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Status Bar live values
  const [currentTime, setCurrentTime] = useState('09:41');

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Update time inside mock status bar
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours().toString().padStart(2, '0');
      let minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Supabase Data for presets
  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);
      try {
        // Fetch Clients
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name, access_key')
          .limit(10);
        if (clientsData) setClients(clientsData as ClientItem[]);

        // Fetch Quotes
        const { data: quotesData } = await supabase
          .from('quotes')
          .select('id, quote_number, client_id')
          .limit(10);
        if (quotesData) setQuotes(quotesData as any[]);

        // Fetch Invoices
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, invoice_number, to_client')
          .limit(10);
        if (invoicesData) setInvoices(invoicesData as InvoiceItem[]);
      } catch (err) {
        console.error('Error fetching simulator presets:', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, []);

  // Listen to iframe navigation to sync the URL bar
  useEffect(() => {
    const handleIframeLoad = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        try {
          const path = iframeRef.current.contentWindow.location.pathname;
          const search = iframeRef.current.contentWindow.location.search;
          const fullPath = path + search;
          setIframeUrl(fullPath);
          setInputValue(fullPath);

          // Dynamic design style injection to make iframe page feel perfectly "pas" on mobile preview
          const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
          if (doc) {
            let styleEl = doc.getElementById('mockup-iframe-style');
            if (!styleEl) {
              styleEl = doc.createElement('style');
              styleEl.id = 'mockup-iframe-style';
              doc.head.appendChild(styleEl);
            }
            styleEl.innerHTML = `
              /* Hide main scrollbars on mobile simulator for absolute clean premium visual look */
              ::-webkit-scrollbar {
                width: 5px !important;
                height: 5px !important;
              }
              ::-webkit-scrollbar-track {
                background: transparent !important;
              }
              ::-webkit-scrollbar-thumb {
                background: rgba(156, 163, 175, 0.3) !important;
                border-radius: 9999px !important;
              }
              ::-webkit-scrollbar-thumb:hover {
                background: rgba(156, 163, 175, 0.5) !important;
              }
              
              /* Block page horizontal scrolling completely inside the device screen */
              html, body {
                overflow-x: hidden !important;
                max-width: 100vw !important;
                box-sizing: border-box !important;
              }
              
              /* Mobile responsive margins & paddings adjustments inside PWA view */
              .container {
                max-width: 100% !important;
                padding-left: 16px !important;
                padding-right: 16px !important;
              }
            `;
          }
        } catch (e) {
          // Cross-origin issues (if redirected outside localhost)
          console.warn('Cannot read iframe path due to origin restrictions:', e);
        }
      }
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad);
    }
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleIframeLoad);
      }
    };
  }, [iframeUrl]);

  const handleNavigate = (path: string) => {
    setIframeUrl(path);
    setInputValue(path);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let path = inputValue.trim();
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    setIframeUrl(path);
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${iframeUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    showSuccess('Link berhasil disalin!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      {/* Glow effects in background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Penawaran PWA Mockup
            </h1>
            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
              Device Simulator Pro
            </p>
          </div>
        </div>

        {/* Top Preset Tabs */}
        <div className="hidden md:flex items-center gap-2 bg-slate-900/85 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => handleNavigate('/dashboard')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${iframeUrl.includes('/dashboard') ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            ADMIN DASHBOARD
          </button>
          <button 
            onClick={() => handleNavigate('/login')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${iframeUrl.includes('/login') ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            LOGIN PAGE
          </button>
          {clients.length > 0 && (
            <button 
              onClick={() => handleNavigate(`/portal/${clients[0].access_key}`)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${iframeUrl.includes('/portal/') ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              CLIENT PORTAL
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="border-slate-800 hover:bg-slate-900 bg-slate-950 text-slate-300">
            <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium">
              Aplikasi Utama <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-7xl mx-auto w-full">
        
        {/* Left Control Panel */}
        <div className="w-full lg:w-[420px] flex flex-col gap-6 shrink-0">
          
          {/* Quick Presets & Navigation */}
          <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-md shadow-xl text-slate-100">
            <CardHeader className="pb-3 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                <CardTitle className="text-md font-semibold text-slate-200">Preset Navigasi</CardTitle>
              </div>
              <CardDescription className="text-slate-400 text-xs">
                Pilih halaman atau simulasikan akses pengguna tertentu.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-4">
              
              {/* Basic Routes */}
              <div>
                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase block mb-2">Halaman Utama</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleNavigate('/login')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 justify-start text-xs">
                    <ChevronRight className="h-3 w-3 mr-1 text-cyan-400" /> Login Page
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleNavigate('/dashboard')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 justify-start text-xs">
                    <ChevronRight className="h-3 w-3 mr-1 text-cyan-400" /> Admin Dashboard
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleNavigate('/quotes')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 justify-start text-xs">
                    <ChevronRight className="h-3 w-3 mr-1 text-cyan-400" /> Penawaran
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleNavigate('/invoices')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 justify-start text-xs">
                    <ChevronRight className="h-3 w-3 mr-1 text-cyan-400" /> Faktur
                  </Button>
                </div>
              </div>

              {/* Dynamic Database Presets */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Simulasi Data Supabase</span>
                </div>
                
                {/* Client Portal Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-400">Portal Klien (Client Access)</label>
                  <select 
                    onChange={(e) => {
                      if (e.target.value) handleNavigate(`/portal/${e.target.value}`);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Pilih Klien --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.access_key}>{c.name}</option>
                    ))}
                    {clients.length === 0 && !loadingData && (
                      <option disabled>Tidak ada klien (Database kosong)</option>
                    )}
                  </select>
                </div>

                {/* Public Invoice View Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-400">Preview Faktur Publik</label>
                  <select 
                    onChange={(e) => {
                      if (e.target.value) handleNavigate(`/invoice/public/${e.target.value}`);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Pilih Faktur --</option>
                    {invoices.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.invoice_number || 'N/A'} - {inv.to_client}</option>
                    ))}
                    {invoices.length === 0 && !loadingData && (
                      <option disabled>Tidak ada faktur (Database kosong)</option>
                    )}
                  </select>
                </div>

                {/* Public Quote View Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-400">Preview Penawaran Publik</label>
                  <select 
                    onChange={(e) => {
                      if (e.target.value) handleNavigate(`/quote/public/${e.target.value}`);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Pilih Penawaran --</option>
                    {quotes.map(q => (
                      <option key={q.id} value={q.id}>{q.quote_number || 'N/A'}</option>
                    ))}
                    {quotes.length === 0 && !loadingData && (
                      <option disabled>Tidak ada penawaran (Database kosong)</option>
                    )}
                  </select>
                </div>
              </div>
              
            </CardContent>
          </Card>

          {/* Viewport & Device Controls */}
          <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-md shadow-xl text-slate-100">
            <CardHeader className="pb-3 border-b border-slate-800/50">
              <CardTitle className="text-md font-semibold text-slate-200">Kontrol Simulator</CardTitle>
              <CardDescription className="text-slate-400 text-xs font-medium">
                Sesuaikan rotasi, zoom, dan tampilan visual mockup.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-4">
              
              {/* Orientation and Dark Mode toggles */}
              <div className="flex justify-between items-center gap-4">
                <span className="text-xs font-semibold text-slate-400">Orientasi Layar</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsPortrait(!isPortrait)}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:text-white flex items-center gap-2"
                >
                  <RotateCw className="h-3.5 w-3.5 text-cyan-400" />
                  {isPortrait ? 'Portrait (Tegak)' : 'Landscape (Mendatar)'}
                </Button>
              </div>

              {/* Scaling slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-400">Skala / Zoom Simulator</span>
                  <span className="text-xs font-bold text-cyan-400">{Math.round(scale * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1.2" 
                  step="0.05"
                  value={scale} 
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Developer Tip */}
              <div className="flex gap-2 bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg text-slate-400 text-xs">
                <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Simulator ini disinkronkan secara otomatis. Navigasi apa pun di dalam frame akan memicu pembaruan pada URL bar di atas mockup.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Simulator Canvas Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/40 border border-slate-850 rounded-2xl p-6 md:p-12 min-h-[700px] relative overflow-hidden">
          
          {/* Active URL bar on top of the phone mockup */}
          <div className="w-full max-w-[430px] mb-6 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 shadow-lg z-10">
            <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-2 py-1 rounded">URL</span>
              <Input 
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)}
                className="h-7 text-xs bg-transparent border-none text-slate-100 placeholder-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                placeholder="Masukkan path (misal: /dashboard)"
              />
            </form>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={handleRefresh} title="Muat Ulang Frame">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={handleCopyLink} title="Salin Tautan">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* iPhone 15 Pro Wrapper Container with scaling applied */}
          <div 
            className="transition-all duration-300 ease-out origin-center"
            style={{ transform: `scale(${scale})` }}
          >
            {/* Phone Body Shell */}
            <div className={`
              bg-[#1c1c1e] border-[8px] border-slate-800 rounded-[52px] relative shadow-[0_0_80px_rgba(0,0,0,0.85)] outline outline-1 outline-white/10
              ${isPortrait ? 'w-[393px] h-[852px]' : 'w-[852px] h-[393px]'}
              transition-all duration-300
            `}>
              
              {/* Dynamic Island (iPhone camera notch) - hidden or rotated in landscape */}
              {isPortrait ? (
                <div className="w-[110px] h-[30px] bg-black rounded-full absolute top-[12px] left-1/2 -translate-x-1/2 z-50 flex items-center justify-between px-3.5 pointer-events-none">
                  {/* Speaker slot & lens visual detail */}
                  <div className="w-[12px] h-[12px] rounded-full bg-slate-900/90 border border-slate-800/40" />
                  <div className="w-[4px] h-[4px] rounded-full bg-green-500/80 animate-pulse ml-auto" />
                </div>
              ) : (
                <div className="w-[30px] h-[110px] bg-black rounded-full absolute left-[12px] top-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-between py-3.5 pointer-events-none">
                  <div className="w-[12px] h-[12px] rounded-full bg-slate-900/90 border border-slate-800/40" />
                  <div className="w-[4px] h-[4px] rounded-full bg-green-500/80 animate-pulse mt-auto" />
                </div>
              )}

              {/* Status Bar */}
              {isPortrait && (
                <div className="absolute top-0 left-0 w-full h-[50px] px-8 flex items-center justify-between z-40 text-slate-900 pointer-events-none font-semibold text-[13px] mix-blend-difference select-none filter invert">
                  {/* Time */}
                  <span className="text-white tracking-tight">{currentTime}</span>
                  {/* Icons */}
                  <div className="flex items-center gap-1.5 text-white">
                    {/* Cellular Network icon */}
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M2 17h2v3H2zm4-4h2v7H6zm4-4h2v11h-2zm4-4h2v15h-2zm4-4h2v19h-2z" />
                    </svg>
                    {/* Wi-Fi Icon */}
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 21l-12-12c4.4-4.4 11.6-4.4 16 0zm-8.8-8.8l8.8 8.8 8.8-8.8c-2.4-2.4-6.4-2.4-8.8 0z" />
                    </svg>
                    {/* Battery Icon */}
                    <div className="w-5.5 h-3 border border-white/80 rounded-[3px] p-[1px] flex items-center relative">
                      <div className="bg-white h-full w-[85%] rounded-[1px]" />
                      <div className="w-[1px] h-[4px] bg-white absolute right-[-2.5px] rounded-r-[1px]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Screen Area Frame */}
              <div className="w-full h-full rounded-[44px] overflow-hidden bg-slate-50 relative flex flex-col">
                {/* Safe Area Top Spacing to push iframe content below the status bar/Dynamic Island */}
                {isPortrait ? (
                  <div className="h-[47px] bg-slate-50 shrink-0 w-full border-b border-slate-200/50" />
                ) : (
                  <div className="h-[12px] bg-slate-50 shrink-0 w-full border-b border-slate-200/50" />
                )}
                
                <div className="flex-1 w-full relative overflow-hidden bg-white">
                  <iframe 
                    ref={iframeRef}
                    src={iframeUrl} 
                    title="App Device Simulator Content"
                    className="w-full h-full border-none select-none bg-white"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  />
                </div>

                {/* Safe Area Bottom Spacing to push iframe content above the Home indicator */}
                {isPortrait && (
                  <div className="h-[34px] bg-slate-50 shrink-0 w-full border-t border-slate-200/50" />
                )}
              </div>

              {/* Home swipe indicator bar */}
              {isPortrait ? (
                <div className="w-[130px] h-[4.5px] bg-slate-900/60 rounded-full absolute bottom-2.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none mix-blend-difference filter invert" />
              ) : (
                <div className="w-[4.5px] h-[130px] bg-slate-900/60 rounded-full absolute right-2.5 top-1/2 -translate-y-1/2 z-50 pointer-events-none mix-blend-difference filter invert" />
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
