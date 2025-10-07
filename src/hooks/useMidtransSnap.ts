import { useState, useEffect } from 'react';

const useMidtransSnap = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if snap is already available
    if (window.snap) {
      setIsReady(true);
      return;
    }

    // Poll for the snap script to be loaded, as it's now in index.html
    const intervalId = setInterval(() => {
      if (window.snap) {
        setIsReady(true);
        clearInterval(intervalId);
      }
    }, 500); // Check every 500ms

    // Cleanup on component unmount
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return isReady;
};

export default useMidtransSnap;