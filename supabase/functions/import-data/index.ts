import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const DELETION_ORDER = [
    'payments', 'invoice_items', 'quote_items', 'project_tasks', 'time_entries', 'expenses',
    'invoices', 'quotes', 'projects', 'clients', 'items'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) throw new Error('Unauthorized');

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const backupData = await req.json();

    // --- DELETION PHASE ---
    const { data: quotesToDelete } = await serviceSupabase.from('quotes').select('id').eq('user_id', user.id);
    const quoteIds = quotesToDelete?.map(q => q.id) || [];
    if (quoteIds.length > 0) await serviceSupabase.from('quote_items').delete().in('quote_id', quoteIds);

    const { data: invoicesToDelete } = await serviceSupabase.from('invoices').select('id').eq('user_id', user.id);
    const invoiceIds = invoicesToDelete?.map(i => i.id) || [];
    if (invoiceIds.length > 0) {
        await serviceSupabase.from('invoice_items').delete().in('invoice_id', invoiceIds);
        await serviceSupabase.from('payments').delete().in('invoice_id', invoiceIds);
    }

    const { data: projectsToDelete } = await serviceSupabase.from('projects').select('id').eq('user_id', user.id);
    const projectIds = projectsToDelete?.map(p => p.id) || [];
    if (projectIds.length > 0) {
        await serviceSupabase.from('project_tasks').delete().in('project_id', projectIds);
        await serviceSupabase.from('time_entries').delete().in('project_id', projectIds);
    }

    for (const table of DELETION_ORDER) {
        if (['payments', 'invoice_items', 'quote_items', 'project_tasks', 'time_entries'].includes(table)) continue;
        await serviceSupabase.from(table).delete().eq('user_id', user.id);
    }

    // --- INSERTION PHASE ---
    const idMaps = { clients: new Map(), projects: new Map(), quotes: new Map(), invoices: new Map() };
    const prepareRecord = (record: any) => { const { id, created_at, user_id, ...rest } = record; return { ...rest, user_id: user.id }; };

    if (backupData.clients) for (const client of backupData.clients) { const oldId = client.id; const { data, error } = await serviceSupabase.from('clients').insert(prepareRecord(client)).select('id').single(); if (error) throw error; idMaps.clients.set(oldId, data.id); }
    if (backupData.items) for (const item of backupData.items) { const { error } = await serviceSupabase.from('items').insert(prepareRecord(item)); if (error) throw error; }
    if (backupData.projects) for (const project of backupData.projects) { const oldId = project.id; const record = prepareRecord(project); record.client_id = idMaps.clients.get(project.client_id) || null; const { data, error } = await serviceSupabase.from('projects').insert(record).select('id').single(); if (error) throw error; idMaps.projects.set(oldId, data.id); }
    if (backupData.quotes) for (const quote of backupData.quotes) { const oldId = quote.id; const record = prepareRecord(quote); record.client_id = idMaps.clients.get(quote.client_id) || null; record.project_id = idMaps.projects.get(quote.project_id) || null; const { data, error } = await serviceSupabase.from('quotes').insert(record).select('id').single(); if (error) throw error; idMaps.quotes.set(oldId, data.id); }
    if (backupData.invoices) for (const invoice of backupData.invoices) { const oldId = invoice.id; const record = prepareRecord(invoice); record.client_id = idMaps.clients.get(invoice.client_id) || null; record.project_id = idMaps.projects.get(invoice.project_id) || null; record.quote_id = idMaps.quotes.get(invoice.quote_id) || null; const { data, error } = await serviceSupabase.from('invoices').insert(record).select('id').single(); if (error) throw error; idMaps.invoices.set(oldId, data.id); }
    
    const insertChildItems = async (tableName: string, parentIdKey: string, parentMap: Map<any, any>) => {
        if (!backupData[tableName]) return;
        const itemsToInsert = backupData[tableName].map((item: any) => {
            const { id, created_at, ...rest } = item;
            const parentId = parentMap.get(item[parentIdKey]);
            if (!parentId) return null;
            const record = { ...rest, [parentIdKey]: parentId };
            if (tableName === 'payments') record.user_id = user.id;
            return record;
        }).filter(Boolean);
        if (itemsToInsert.length > 0) { const { error } = await serviceSupabase.from(tableName).insert(itemsToInsert); if (error) throw error; }
    };

    await insertChildItems('quote_items', 'quote_id', idMaps.quotes);
    await insertChildItems('invoice_items', 'invoice_id', idMaps.invoices);
    await insertChildItems('payments', 'invoice_id', idMaps.invoices);
    await insertChildItems('project_tasks', 'project_id', idMaps.projects);
    await insertChildItems('time_entries', 'project_id', idMaps.projects);

    if (backupData.expenses) { const itemsToInsert = backupData.expenses.map((item: any) => { const record = prepareRecord(item); record.project_id = idMaps.projects.get(item.project_id) || null; return record; }); if (itemsToInsert.length > 0) { const { error } = await serviceSupabase.from('expenses').insert(itemsToInsert); if (error) throw error; } }

    return new Response(JSON.stringify({ message: 'Import successful' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})