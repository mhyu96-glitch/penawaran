import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';

const DebugPanel = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const { user, session } = useAuth();

  const runTests = async () => {
    setTesting(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      environment: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'fallback-used'
      },
      auth: {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        hasSession: !!session
      },
      tests: {}
    };

    // Test 1: Basic connection
    try {
      const { data, error } = await supabase.from('quotes').select('count').limit(1);
      results.tests.connection = { success: !error, error: error?.message, data };
    } catch (err: any) {
      results.tests.connection = { success: false, error: err.message };
    }

    // Test 2: Get all quotes for user
    if (user) {
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select('id, quote_number, to_client, created_at')
          .eq('user_id', user.id)
          .limit(5);
        results.tests.userQuotes = { 
          success: !error, 
          error: error?.message, 
          count: data?.length || 0,
          samples: data?.slice(0, 3)
        };
      } catch (err: any) {
        results.tests.userQuotes = { success: false, error: err.message };
      }
    }

    // Test 3: Get all quotes (without user filter)
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('user_id, id')
        .limit(10);
      const userGroups = data?.reduce((acc: any, quote) => {
        if (!acc[quote.user_id]) acc[quote.user_id] = 0;
        acc[quote.user_id]++;
        return acc;
      }, {});
      results.tests.allQuotes = { 
        success: !error, 
        error: error?.message, 
        totalCount: data?.length || 0,
        userDistribution: userGroups
      };
    } catch (err: any) {
      results.tests.allQuotes = { success: false, error: err.message };
    }

    setDebugInfo(results);
    setTesting(false);
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">Debug Panel</CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={runTests} 
          disabled={testing}
          size="sm"
          variant="outline"
        >
          {testing ? 'Testing...' : 'Run Diagnostics'}
        </Button>
        
        {debugInfo && (
          <div className="mt-4 p-3 bg-muted rounded text-xs">
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DebugPanel;