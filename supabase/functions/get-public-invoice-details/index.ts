import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('Function get-public-invoice-details invoked.'); // Added log
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { invoiceId } = await req.json()
    console.log('Received invoiceId:', invoiceId); // Added log
    if (!invoiceId) {
      console.error('Error: invoiceId is required'); // Added log
      return new Response(JSON.stringify({ error: 'invoiceId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    console.log('Supabase client created.'); // Added log

    console.log('Fetching invoice with ID:', invoiceId); // Added log
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*, invoice_items(*), payments(*)')
      .eq('id', invoiceId)
      .single()

    if (invoiceError) {
      console.error('Error fetching invoice:', invoiceError); // Added log
      throw invoiceError
    }
    if (!invoice) {
        console.error('Error: Invoice not found for ID:', invoiceId); // Added log
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
    console.log('Invoice fetched successfully:', invoice.id); // Added log

    console.log('Fetching profile for user_id:', invoice.user_id); // Added log
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('payment_instructions, custom_footer, show_quantity_column, show_unit_column, show_unit_price_column')
      .eq('id', invoice.user_id)
      .single()

    if (profileError) {
        console.warn('Could not fetch profile for payment instructions', profileError)
    }
    console.log('Profile fetched (or warning logged).'); // Added log

    const responsePayload = {
        ...invoice,
        payment_instructions: profile?.payment_instructions || 'Instruksi pembayaran belum diatur oleh penyedia jasa.',
        custom_footer: profile?.custom_footer || null,
        show_quantity_column: profile?.show_quantity_column ?? true,
        show_unit_column: profile?.show_unit_column ?? true,
        show_unit_price_column: profile?.show_unit_price_column ?? true,
    }
    console.log('Returning response payload.'); // Added log

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('Function error in catch block:', e); // Modified log
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})