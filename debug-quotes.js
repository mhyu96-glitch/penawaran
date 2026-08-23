// Debug script untuk memeriksa data quotes di Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xukpisovkcflcwuhrzkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a3Bpc292a2NmbGN3dWhyemt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTk0NTMsImV4cCI6MjA3NDQ3NTQ1M30.HZHCy_T5SVV3QZRpIb6sU8zOm27SKIyyVikELzbQ5u0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugQuotes() {
  console.log('🔍 Checking database connection...');
  
  // Test basic connection
  const { data: testData, error: testError } = await supabase
    .from('quotes')
    .select('count')
    .limit(1);
    
  if (testError) {
    console.error('❌ Database connection error:', testError);
    return;
  }
  
  console.log('✅ Database connection successful');
  
  // Get all quotes (without user filter first)
  console.log('\n🔍 Fetching all quotes...');
  const { data: allQuotes, error: allError } = await supabase
    .from('quotes')
    .select('id, user_id, quote_number, to_client, created_at, status');
    
  if (allError) {
    console.error('❌ Error fetching all quotes:', allError);
  } else {
    console.log(`📊 Total quotes in database: ${allQuotes.length}`);
    
    // Group by user_id
    const userGroups = allQuotes.reduce((acc, quote) => {
      if (!acc[quote.user_id]) acc[quote.user_id] = [];
      acc[quote.user_id].push(quote);
      return acc;
    }, {});
    
    console.log('\n👥 Quotes by user:');
    Object.entries(userGroups).forEach(([userId, quotes]) => {
      console.log(`  User ${userId}: ${quotes.length} quotes`);
      quotes.forEach(quote => {
        console.log(`    - ${quote.quote_number || 'No Number'}: ${quote.to_client}`);
      });
    });
  }
  
  // Test with specific columns
  console.log('\n🔍 Testing column existence...');
  const columns = ['id', 'user_id', 'quote_number', 'to_client', 'created_at', 'status', 'view_count', 'last_viewed_at'];
  
  for (const col of columns) {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(col)
        .limit(1);
        
      if (error) {
        console.log(`❌ Column '${col}': ${error.message}`);
      } else {
        console.log(`✅ Column '${col}': exists`);
      }
    } catch (err) {
      console.log(`❌ Column '${col}': ${err.message}`);
    }
  }
}

debugQuotes().catch(console.error);