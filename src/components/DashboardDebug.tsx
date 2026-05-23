import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DashboardDebug = () => {
  const { user } = useAuth();
  const [debugData, setDebugData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDebugData = async () => {
      if (!user) {
        setDebugData({ error: 'No user found' });
        setLoading(false);
        return;
      }

      try {
        // Test database connections
        const [quotesRes, invoicesRes, expensesRes, paymentsRes] = await Promise.all([
          supabase.from('quotes').select('id, status, created_at').eq('user_id', user.id).limit(5),
          supabase.from('invoices').select('id, status, created_at').eq('user_id', user.id).limit(5),
          supabase.from('expenses').select('id, amount, expense_date').eq('user_id', user.id).limit(5),
          supabase.from('payments').select('id, amount, payment_date').eq('user_id', user.id).limit(5)
        ]);

        setDebugData({
          user: {
            id: user.id,
            email: user.email
          },
          quotes: {
            count: quotesRes.data?.length || 0,
            error: quotesRes.error?.message,
            sample: quotesRes.data?.[0]
          },
          invoices: {
            count: invoicesRes.data?.length || 0,
            error: invoicesRes.error?.message,
            sample: invoicesRes.data?.[0]
          },
          expenses: {
            count: expensesRes.data?.length || 0,
            error: expensesRes.error?.message,
            sample: expensesRes.data?.[0]
          },
          payments: {
            count: paymentsRes.data?.length || 0,
            error: paymentsRes.error?.message,
            sample: paymentsRes.data?.[0]
          }
        });
      } catch (error) {
        setDebugData({ error: error.message });
      }
      
      setLoading(false);
    };

    fetchDebugData();
  }, [user]);

  if (loading) return <div>Loading debug info...</div>;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Dashboard Debug Info</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(debugData, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
};

export default DashboardDebug;