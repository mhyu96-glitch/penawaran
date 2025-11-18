import { createClient } from '@supabase/supabase-js';

// ====================================================================================================
// PENTING: Pastikan URL dan KUNCI ini sama persis dengan yang ada di dasbor proyek Supabase Anda!
// Anda dapat menemukannya di: Project Settings > API
// ====================================================================================================
const SUPABASE_URL = 'https://xukpisovkcflcwuhrzkx.supabase.co'; // GANTI DENGAN URL PROYEK SUPABASE ANDA
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0'; // GANTI DENGAN KUNCI ANON (PUBLIC) PROYEK SUPABASE ANDA

// Import klien supabase seperti ini:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);