import { useEffect, useState } from 'react';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PWA_UPDATE_EVENT } from '@/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAStatus = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };
    const handleInstalled = () => setInstallPrompt(null);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleUpdate = (event: Event) => {
      setUpdateRegistration((event as CustomEvent<ServiceWorkerRegistration>).detail);
      setDismissed(false);
    };
    const handleControllerChange = () => window.location.reload();

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(PWA_UPDATE_EVENT, handleUpdate);
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(PWA_UPDATE_EVENT, handleUpdate);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
  };

  const applyUpdate = () => {
    updateRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!online) {
    return (
      <div
        role="status"
        className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-950 px-4 py-3 text-sm text-white shadow-xl"
      >
        <WifiOff className="h-5 w-5 shrink-0" />
        <div>
          <div className="font-semibold">Anda sedang offline</div>
          <div className="text-xs text-slate-300">Aplikasi tetap terbuka, tetapi sinkronisasi data menunggu koneksi.</div>
        </div>
      </div>
    );
  }

  if (dismissed || (!installPrompt && !updateRegistration)) return null;

  const hasUpdate = Boolean(updateRegistration);

  return (
    <aside className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-[70] mx-auto max-w-md rounded-2xl border bg-background/95 p-4 shadow-2xl backdrop-blur lg:bottom-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {hasUpdate ? <RefreshCw className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{hasUpdate ? 'Pembaruan tersedia' : 'Pasang QuoteApp'}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasUpdate ? 'Muat versi terbaru untuk mendapat perbaikan aplikasi.' : 'Akses lebih cepat dari layar utama dan gunakan saat koneksi terbatas.'}
          </p>
          <Button size="sm" className="mt-3" onClick={hasUpdate ? applyUpdate : installApp}>
            {hasUpdate ? 'Perbarui sekarang' : 'Pasang aplikasi'}
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-2 h-9 w-9 shrink-0" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4" />
          <span className="sr-only">Tutup</span>
        </Button>
      </div>
    </aside>
  );
};

export default PWAStatus;
