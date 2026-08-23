import { createClient } from '@supabase/supabase-js';

// Production-ready configuration dengan fallback
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xukpisovkcflcwuhrzkx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0';

console.log('🔧 Supabase Config:', { 
  url: SUPABASE_URL, 
  hasKey: !!SUPABASE_PUBLISHABLE_KEY,
  keyPreview: SUPABASE_PUBLISHABLE_KEY.substring(0, 20) + '...'
});

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Create client with minimal realtime config to avoid connection errors
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Test connection on initialization
supabase.from('quotes').select('count').limit(1).then(({ data, error }) => {
  if (error) {
    console.error('❌ Supabase connection test failed:', error);
  } else {
    console.log('✅ Supabase connection test successful');
  }
}).catch(err => {
  console.error('❌ Supabase connection test error:', err);
});
