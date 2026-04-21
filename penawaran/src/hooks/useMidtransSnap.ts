import { useState, useEffect } from 'react';

const useMidtransSnap = (clientKey: string | null, isProduction: boolean) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!clientKey) return;

    // Cek jika script sudah ada
    const scriptId = 'midtrans-script';
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      // Jika script sudah ada, cek apakah window.snap sudah siap
      if (window.snap) {
        setIsReady(true);
      } else {
        // Jika belum, tunggu load
        existingScript.addEventListener('load', () => setIsReady(true));
      }
      return;
    }

    // Tentukan URL script berdasarkan environment
    const scriptUrl = isProduction 
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = scriptUrl;
    script.setAttribute('data-client-key', clientKey);
    script.async = true;
    
    script.onload = () => {
      setIsReady(true);
    };

    document.body.appendChild(script);

    return () => {
      // Optional: Cleanup script if needed, but usually we keep it
      // document.body.removeChild(script);
    };
  }, [clientKey, isProduction]);

  return isReady;
};

export default useMidtransSnap;