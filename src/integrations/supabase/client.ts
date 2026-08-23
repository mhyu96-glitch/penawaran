import { createClient } from '@supabase/supabase-js';

// Simple configuration without complex options
const SUPABASE_URL = 'https://xukpisovkcflcwuhrzkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0';

console.log('🔧 Supabase Config - Simple Mode');

// Create basic client without options that might cause header issues
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
