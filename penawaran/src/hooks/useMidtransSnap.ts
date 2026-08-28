import { useState, useEffect } from 'react';

const useMidtransSnap = (clientKey: string | null, isProduction: boolean) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!clientKey) {
      setIsReady(false);
      return;
    }

    const scriptId = 'midtrans-script';
    const scriptUrl = isProduction 
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript) {
      const keyMatches = existingScript.dataset.clientKey === clientKey;
      const environmentMatches = existingScript.src === scriptUrl;
      if (keyMatches && environmentMatches) {
        if (window.snap) {
          setIsReady(true);
        } else {
          existingScript.addEventListener('load', () => setIsReady(true), { once: true });
        }
        return;
      }
      existingScript.remove();
      setIsReady(false);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = scriptUrl;
    script.setAttribute('data-client-key', clientKey);
    script.dataset.clientKey = clientKey;
    script.async = true;
    
    script.onload = () => {
      setIsReady(true);
    };

    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [clientKey, isProduction]);

  return isReady;
};

export default useMidtransSnap;
