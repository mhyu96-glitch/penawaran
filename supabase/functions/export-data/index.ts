import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const tables = [
      'clients', 'items', 'projects', 'quotes', 'invoices', 'expenses', 'time_entries',
      'quote_items', 'invoice_items', 'payments', 'project_tasks'
    ];

    const exportData: { [key: string]: any[] } = {};

    const parentTables = ['clients', 'items', 'projects', 'quotes', 'invoices', 'expenses'];
    for (const table of parentTables) {
      const { data, error } = await supabase.from(table).select('*').eq('user_id', user.id);
      if (error) throw new Error(`Error fetching ${table}: ${error.message}`);
      exportData[table] = data;
    }
    
    const quoteIds = exportData.quotes.map(q => q.id);
    if (quoteIds.length > 0) {
      const { data, error } = await supabase.from('quote_items').select('*').in('quote_id', quoteIds);
      if (error) throw error;
      exportData['quote_items'] = data;
    } else {
      exportData['quote_items'] = [];
    }

    const invoiceIds = exportData.invoices.map(i => i.id);
    if (invoiceIds.length > 0) {
      const { data: items, error: itemsError } = await supabase.from('invoice_items').select('*').in('invoice_id', invoiceIds);
      if (itemsError) throw itemsError;
      exportData['invoice_items'] = items;

      const { data: payments, error: paymentsError } = await supabase.from('payments').select('*').in('invoice_id', invoiceIds);
      if (paymentsError) throw paymentsError;
      exportData['payments'] = payments;
    } else {
      exportData['invoice_items'] = [];
      exportData['payments'] = [];
    }

    const projectIds = exportData.projects.map(p => p.id);
    if (projectIds.length > 0) {
        const { data: tasks, error: tasksError } = await supabase.from('project_tasks').select('*').in('project_id', projectIds);
        if (tasksError) throw tasksError;
        exportData['project_tasks'] = tasks;

        const { data: time, error: timeError } = await supabase.from('time_entries').select('*').in('project_id', projectIds);
        if (timeError) throw timeError;
        exportData['time_entries'] = time;
    } else {
        exportData['project_tasks'] = [];
        exportData['time_entries'] = [];
    }

    return new Response(JSON.stringify(exportData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})