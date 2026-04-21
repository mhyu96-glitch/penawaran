import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Manual authentication handling
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const { searchTerm } = await req.json()
    if (!searchTerm) {
      return new Response(JSON.stringify({ results: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const query = `%${searchTerm}%`

    const [clientsRes, quotesRes, invoicesRes, projectsRes, itemsRes] = await Promise.all([
      supabaseAdmin.from('clients').select('id, name').eq('user_id', user.id).ilike('name', query).limit(5),
      supabaseAdmin.from('quotes').select('id, quote_number, to_client').eq('user_id', user.id).or(`quote_number.ilike.${query},to_client.ilike.${query}`).limit(5),
      supabaseAdmin.from('invoices').select('id, invoice_number, to_client').eq('user_id', user.id).or(`invoice_number.ilike.${query},to_client.ilike.${query}`).limit(5),
      supabaseAdmin.from('projects').select('id, name').eq('user_id', user.id).ilike('name', query).limit(5),
      supabaseAdmin.from('items').select('id, description').eq('user_id', user.id).ilike('description', query).limit(5)
    ])

    const results = {
      clients: clientsRes.data || [],
      quotes: quotesRes.data || [],
      invoices: invoicesRes.data || [],
      projects: projectsRes.data || [],
      items: itemsRes.data || [],
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})