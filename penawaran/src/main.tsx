import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// Auto-clean stale Service Workers in dev/local mode to prevent auth loops
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
