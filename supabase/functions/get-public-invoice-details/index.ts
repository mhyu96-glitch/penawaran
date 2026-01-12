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
    const { invoiceId } = await req.json()
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'invoiceId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*, invoice_items(*), payments(*)')
      .eq('id', invoiceId)
      .single()

    if (invoiceError) throw invoiceError
    if (!invoice) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('payment_instructions, custom_footer, show_quantity_column, show_unit_column, show_unit_price_column, company_phone, whatsapp_invoice_template')
      .eq('id', invoice.user_id)
      .single()

    const responsePayload = {
        ...invoice,
        payment_instructions: profile?.payment_instructions || 'Instruksi pembayaran belum diatur oleh penyedia jasa.',
        custom_footer: profile?.custom_footer || null,
        company_phone: profile?.company_phone || null,
        whatsapp_invoice_template: profile?.whatsapp_invoice_template || null,
        show_quantity_column: profile?.show_quantity_column ?? true,
        show_unit_column: profile?.show_unit_column ?? true,
        show_unit_price_column: profile?.show_unit_price_column ?? true,
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})