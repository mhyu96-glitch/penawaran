import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xukpisovkcflcwuhrzkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0';

/**
 * Helper to purge corrupted or stale auth tokens from localStorage and sessionStorage.
 */
export const purgeStaleAuthStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch (e) {
    console.warn('[Supabase Auth] Gagal membersihkan storage:', e);
  }
};

/**
 * Pre-init sanity check:
 * If the stored session expired more than 7 days ago or has corrupted JSON,
 * purge it immediately to avoid useless 400/429 network loops on cold launch.
 */
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            // 24 hours in milliseconds: 24 * 60 * 60 * 1000 = 86400000 ms
            if (parsed && parsed.expires_at && (parsed.expires_at * 1000 < Date.now() - 86400000)) {
              console.warn('[Supabase Auth] Menghapus token kedaluwarsa usang (>24 jam) untuk mencegah rate-limit.');
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
}

/**
 * Sequential mutex queue to serialize auth calls and prevent concurrent refresh token bursts
 * without causing deadlocks in Firefox / Private Browsing Mode.
 */
let lockQueue: Promise<unknown> = Promise.resolve();

const safeAuthLock = async <R>(_name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const current = lockQueue;
  let release: () => void = () => {};
  lockQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  const timeoutMs = acquireTimeout > 0 ? Math.min(acquireTimeout, 8000) : 8000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Auth lock timeout')), timeoutMs);
  });

  try {
    return await Promise.race([
      (async () => {
        try {
          await current;
        } catch {
          // Continue even if previous queue item encountered an error
        }
        return await fn();
      })(),
      timeoutPromise,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    release();
  }
};

/**
 * Custom fetch interceptor:
 * Catches HTTP 429 (Too Many Requests) on token endpoints to break perpetual refresh loops
 * and clean up stale local storage.
 */
const customFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
  const response = await fetch(input, init);

  if (response.status === 429 && url.includes('/auth/v1/token')) {
    console.warn('[Supabase Auth] Rate limit 429 terdeteksi pada endpoint token. Membersihkan sesi basi.');
    purgeStaleAuthStorage();
  }

  return response;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: safeAuthLock,
  },
  global: {
    fetch: customFetch,
  },
});
