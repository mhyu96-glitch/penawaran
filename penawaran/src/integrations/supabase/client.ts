import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xukpisovkcflcwuhrzkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0';

const FAILED_REFRESH_TOKENS_KEY = 'quoteapp_failed_refresh_tokens_v4';
const RATE_LIMIT_UNTIL_KEY = 'quoteapp_auth_rate_limit_until_v4';

const failedRefreshTokens = new Set<string>();
let lastRefreshedSessionData: Record<string, any> | null = null;
let lastRefreshTimestamp = 0;
let inFlightRefreshPromise: Promise<{ status: number; bodyText: string }> | null = null;
let cachedUserJsonText: string | null = null;
let cachedUserTimestamp = 0;

function loadFailedTokensFromSession(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const raw = sessionStorage.getItem(FAILED_REFRESH_TOKENS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((t) => typeof t === 'string' && failedRefreshTokens.add(t));
      }
    }
  } catch {
    // ignore
  }
}

function markRefreshTokenFailed(token?: string): void {
  if (!token) return;
  failedRefreshTokens.add(token);
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const arr = Array.from(failedRefreshTokens).slice(-30);
    sessionStorage.setItem(FAILED_REFRESH_TOKENS_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function isRefreshTokenFailed(token?: string): boolean {
  if (!token) return true;
  loadFailedTokensFromSession();
  return failedRefreshTokens.has(token);
}

export function setAuthRateLimitCooldown(seconds = 60): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(RATE_LIMIT_UNTIL_KEY, String(Date.now() + seconds * 1000));
  } catch {
    // ignore
  }
}

export function clearAuthRateLimitCooldown(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.removeItem(RATE_LIMIT_UNTIL_KEY);
  } catch {
    // ignore
  }
}

export function getAuthRateLimitRemainingSeconds(): number {
  if (typeof window === 'undefined' || !window.sessionStorage) return 0;
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_UNTIL_KEY);
    if (!raw) return 0;
    const until = Number(raw);
    if (isNaN(until) || until <= Date.now()) {
      sessionStorage.removeItem(RATE_LIMIT_UNTIL_KEY);
      return 0;
    }
    return Math.ceil((until - Date.now()) / 1000);
  } catch {
    return 0;
  }
}

/**
 * Helper to purge corrupted or stale auth tokens from localStorage and sessionStorage.
 */
export const purgeStaleAuthStorage = () => {
  lastRefreshedSessionData = null;
  lastRefreshTimestamp = 0;
  cachedUserJsonText = null;
  cachedUserTimestamp = 0;

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
 * Normalize session expiry to the client computer's clock so timezone/clock skew
 * on desktop PCs (e.g. WIB vs WITA offset) never triggers immediate 429 refresh loops.
 */
function anchorSessionToClientClock(sessionObj: Record<string, any>): Record<string, any> {
  if (!sessionObj || typeof sessionObj !== 'object') return sessionObj;
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const expiresInSec =
    typeof sessionObj.expires_in === 'number' && sessionObj.expires_in > 300
      ? sessionObj.expires_in
      : 3600;

  sessionObj._client_anchored_at = nowMs;
  sessionObj.expires_in = expiresInSec;
  sessionObj.expires_at = nowSec + expiresInSec;
  return sessionObj;
}

/**
 * Custom storage adapter that protects GoTrueClient from clock-skew loops
 * and dead refresh tokens.
 */
const safeAuthStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;

      // Only inspect main auth token JSON objects
      if (!key.startsWith('sb-') || key.endsWith('-code-verifier') || key.endsWith('-user')) {
        return raw;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.access_token || !parsed.refresh_token) {
        window.localStorage.removeItem(key);
        return null;
      }

      // If this refresh token already failed, purge immediately
      if (isRefreshTokenFailed(parsed.refresh_token)) {
        window.localStorage.removeItem(key);
        return null;
      }

      const nowMs = Date.now();
      const nowSec = Math.floor(nowMs / 1000);

      // If token was anchored on this client within the last 55 minutes, guarantee valid expires_at
      if (typeof parsed._client_anchored_at === 'number') {
        const elapsedSec = Math.floor((nowMs - parsed._client_anchored_at) / 1000);
        const totalValiditySec = typeof parsed.expires_in === 'number' && parsed.expires_in > 300 ? parsed.expires_in : 3600;
        if (elapsedSec >= 0 && elapsedSec < totalValiditySec - 120) {
          parsed.expires_at = Math.floor(parsed._client_anchored_at / 1000) + totalValiditySec;
          return JSON.stringify(parsed);
        }
        // If expired more than 12 hours ago or currently in 429 cooldown, purge instead of refreshing
        if (elapsedSec > 12 * 3600 || getAuthRateLimitRemainingSeconds() > 0) {
          window.localStorage.removeItem(key);
          return null;
        }
        return JSON.stringify(parsed);
      }

      // Legacy / un-anchored token in localStorage:
      // If it appears expired or within 90s margin on this client clock, remove it so cold boot never loops
      if (!parsed.expires_at || parsed.expires_at <= nowSec + 90) {
        window.localStorage.removeItem(key);
        return null;
      }

      // Otherwise anchor it now
      parsed._client_anchored_at = nowMs;
      window.localStorage.setItem(key, JSON.stringify(parsed));
      return JSON.stringify(parsed);
    } catch {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (key.startsWith('sb-') && !key.endsWith('-code-verifier') && !key.endsWith('-user')) {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && parsed.access_token) {
          if (!parsed._client_anchored_at) {
            anchorSessionToClientClock(parsed);
          }
          if (parsed.user) {
            cachedUserJsonText = JSON.stringify(parsed.user);
            cachedUserTimestamp = Date.now();
          }
          window.localStorage.setItem(key, JSON.stringify(parsed));
          return;
        }
      }
      window.localStorage.setItem(key, value);
    } catch {
      // ignore storage write errors
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/**
 * Pre-init sanity check on cold load
 */
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    loadFailedTokensFromSession();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
        // Trigger safeAuthStorage validation
        safeAuthStorage.getItem(key);
      }
    }
  } catch {
    // Ignore storage read errors
  }
}

/**
 * Sequential mutex queue to serialize auth calls without deadlocks.
 * Respects acquireTimeout === 0 (used by GoTrueClient._autoRefreshTokenTick)
 * by skipping redundant ticks when the lock is already held.
 */
let lockQueue: Promise<unknown> = Promise.resolve();
let isLockBusy = false;

const safeAuthLock = async <R>(_name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  if (acquireTimeout === 0 && isLockBusy) {
    throw Object.assign(new Error('Auth lock currently busy, skipping tick'), { isAcquireTimeout: true });
  }

  const current = lockQueue;
  let release: () => void = () => {};
  lockQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  const timeoutMs = acquireTimeout > 0 ? Math.min(acquireTimeout, 8000) : 8000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error('Auth lock timeout'), { isAcquireTimeout: true })),
      timeoutMs
    );
  });

  try {
    return await Promise.race([
      (async () => {
        try {
          await current;
        } catch {
          // Continue even if previous queue item encountered an error
        }
        isLockBusy = true;
        return await fn();
      })(),
      timeoutPromise,
    ]);
  } finally {
    isLockBusy = false;
    if (timer) clearTimeout(timer);
    release();
  }
};

/**
 * Custom fetch interceptor:
 * 1. Deduplicates and caches grant_type=refresh_token for 60s so bursts are impossible.
 * 2. Anchors expires_at to client clock on every 200 OK token response (fixes Windows WIB/WITA clock skew loop).
 * 3. Converts any failed/429/CORS-blocked refresh_token attempt into a single non-retryable 400 + immediate storage purge (0 retries).
 * 4. Serves GET /auth/v1/user from active session user cache to avoid redundant network hits.
 */
const customFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

  // 1. Intercept Token Refresh: POST /auth/v1/token?grant_type=refresh_token
  if (url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')) {
    let reqRefreshToken = '';
    if (init?.body && typeof init.body === 'string') {
      try {
        reqRefreshToken = JSON.parse(init.body)?.refresh_token || '';
      } catch {
        // ignore
      }
    }

    // Return cached refreshed session if refreshed within the last 60 seconds
    if (lastRefreshedSessionData && Date.now() - lastRefreshTimestamp < 60_000) {
      const freshCopy = {
        ...lastRefreshedSessionData,
        expires_at: Math.floor(Date.now() / 1000) + (lastRefreshedSessionData.expires_in || 3600),
      };
      return new Response(JSON.stringify(freshCopy), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Block immediately if token is known bad or we are in rate-limit cooldown
    if (!reqRefreshToken || isRefreshTokenFailed(reqRefreshToken) || getAuthRateLimitRemainingSeconds() > 0) {
      purgeStaleAuthStorage();
      return new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_code: 'refresh_token_not_found',
          error_description: 'Session expired or rate-limited. Please sign in again.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Single-flight deduplication for concurrent refresh calls
    if (!inFlightRefreshPromise) {
      inFlightRefreshPromise = (async () => {
        try {
          const res = await fetch(input, init);
          if (!res.ok) {
            markRefreshTokenFailed(reqRefreshToken);
            if (res.status === 429) {
              console.warn('[Supabase Auth] 429 pada refresh_token. Mengaktifkan jeda keamanan & membersihkan sesi.');
              setAuthRateLimitCooldown(60);
            }
            purgeStaleAuthStorage();
            // Return 400 (non-retryable in GoTrueClient) so GoTrueClient stops immediately with 0 retries
            return {
              status: 400,
              bodyText: JSON.stringify({
                error: 'invalid_grant',
                error_code: 'refresh_token_not_found',
                error_description: 'Refresh token expired or rate-limited',
              }),
            };
          }

          const data = await res.json();
          anchorSessionToClientClock(data);
          lastRefreshedSessionData = data;
          lastRefreshTimestamp = Date.now();
          if (data?.user) {
            cachedUserJsonText = JSON.stringify(data.user);
            cachedUserTimestamp = Date.now();
          }
          clearAuthRateLimitCooldown();
          return {
            status: 200,
            bodyText: JSON.stringify(data),
          };
        } catch (err) {
          // Network or CORS error (often caused by Cloudflare/Kong 429 blocking without CORS headers)
          console.warn('[Supabase Auth] Gagal menghubungi endpoint refresh token (kemungkinan 429/CORS). Menghentikan retry loop:', err);
          markRefreshTokenFailed(reqRefreshToken);
          setAuthRateLimitCooldown(60);
          purgeStaleAuthStorage();
          return {
            status: 400,
            bodyText: JSON.stringify({
              error: 'invalid_grant',
              error_code: 'refresh_token_not_found',
              error_description: 'Network or rate-limit error during token refresh',
            }),
          };
        } finally {
          inFlightRefreshPromise = null;
        }
      })();
    }

    const result = await inFlightRefreshPromise;
    return new Response(result.bodyText, {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Intercept Login / Password / Other Token Grants: POST /auth/v1/token
  if (url.includes('/auth/v1/token')) {
    try {
      const response = await fetch(input, init);
      if (response.status === 429) {
        console.warn('[Supabase Auth] Rate limit 429 pada endpoint login token.');
        setAuthRateLimitCooldown(60);
        purgeStaleAuthStorage();
        return response;
      }
      if (response.ok) {
        const clone = response.clone();
        try {
          const data = await clone.json();
          anchorSessionToClientClock(data);
          lastRefreshedSessionData = data;
          lastRefreshTimestamp = Date.now();
          if (data?.user) {
            cachedUserJsonText = JSON.stringify(data.user);
            cachedUserTimestamp = Date.now();
          }
          clearAuthRateLimitCooldown();
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {
          return response;
        }
      }
      return response;
    } catch (err) {
      // Handle CORS-stripped 429 on login endpoint gracefully
      setAuthRateLimitCooldown(60);
      purgeStaleAuthStorage();
      return new Response(
        JSON.stringify({
          error: 'over_request_rate_limit',
          message: 'Terlalu banyak permintaan (Rate Limit 429). Harap tunggu 60 detik lalu coba lagi.',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 3. Intercept GET /auth/v1/user to avoid unnecessary network hits on every service call
  if (url.endsWith('/auth/v1/user') && method === 'GET') {
    if (cachedUserJsonText && Date.now() - cachedUserTimestamp < 300_000) {
      return new Response(cachedUserJsonText, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.user?.id) {
                cachedUserJsonText = JSON.stringify(parsed.user);
                cachedUserTimestamp = Date.now();
                return new Response(cachedUserJsonText, {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                });
              }
            }
          }
        }
      } catch {
        // fallback to network
      }
    }
  }

  return fetch(input, init);
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeAuthStorage,
    lock: safeAuthLock,
  },
  global: {
    fetch: customFetch,
  },
});
