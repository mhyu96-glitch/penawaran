import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xukpisovkcflcwuhrzkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0';

// Proactively sanitize expired or corrupted auth tokens to prevent 429 (Too Many Requests) refresh loops
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            // If token expired by more than 1 minute, purge it so auto-refresh doesn't spam GoTrue
            if (parsed && parsed.expires_at && (parsed.expires_at * 1000 < Date.now() - 60000)) {
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Auth token cleanup skipped:', e);
  }
}

// Custom safe lock implementation to completely eliminate Navigator LockManager lock failures
const noOpAuthLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  return await fn();
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: noOpAuthLock,
  },
});
