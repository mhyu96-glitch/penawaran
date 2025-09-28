import { useState, useEffect } from 'react';

const useMidtransSnap = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const snapUrl = import.meta.env.VITE_MIDTRANS_SNAP_URL;
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;

    if (!snapUrl || !clientKey) {
      console.error("Midtrans Snap URL or Client Key is not configured in .env file.");
      return;
    }

    const scriptId = 'midtrans-snap-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const handleLoad = () => setIsReady(true);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = snapUrl;
      script.setAttribute('data-client-key', clientKey);
      script.onload = handleLoad;
      document.head.appendChild(script);
    } else if (window.snap) {
      setIsReady(true);
    } else {
      script.addEventListener('load', handleLoad);
    }

    return () => {
      if (script) {
        script.removeEventListener('load', handleLoad);
      }
    };
  }, []);

  return isReady;
};

export default useMidtransSnap;