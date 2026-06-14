import { useState, useEffect } from 'react';

const useMidtransSnap = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (window.snap) {
      setIsReady(true);
      return;
    }

    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
    if (!clientKey) {
      console.error('VITE_MIDTRANS_CLIENT_KEY is not configured.');
      return;
    }

    const production = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';
    const script = document.createElement('script');
    script.src = production
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.dataset.clientKey = clientKey;
    script.async = true;
    script.onload = () => setIsReady(Boolean(window.snap));
    script.onerror = () => console.error('Midtrans Snap script failed to load.');
    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  return isReady;
};

export default useMidtransSnap;
