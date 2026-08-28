import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { quoteId, status } = await req.json()

    if (!quoteId || !status) {
      return new Response(JSON.stringify({ error: 'quoteId and status are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!['Diterima', 'Ditolak'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status value' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create a Supabase client with the service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update quote status
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .update({ status: status })
      .eq('id', quoteId)
      .select('*, quote_items(*)')
      .single()

    if (quoteError || !quote) {
      console.error('Supabase error updating quote:', quoteError)
      return new Response(JSON.stringify({ error: quoteError?.message || 'Quote not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let createdInvoice = null

    // If accepted, automatically create an invoice if one does not exist
    if (status === 'Diterima') {
      const { data: existingInvoices } = await supabaseAdmin
        .from('invoices')
        .select('id, invoice_number')
        .eq('quote_id', quoteId)
        .limit(1)

      if (existingInvoices && existingInvoices.length > 0) {
        createdInvoice = existingInvoices[0]
      } else {
        const year = new Date().getFullYear()
        const { data: latestInvoices } = await supabaseAdmin
          .from('invoices')
          .select('invoice_number')
          .eq('user_id', quote.user_id)
          .like('invoice_number', `INV-${year}-%`)
          .order('created_at', { ascending: false })
          .limit(1)

        let nextNumber = 1
        if (latestInvoices && latestInvoices.length > 0 && latestInvoices[0]?.invoice_number) {
          const parts = latestInvoices[0].invoice_number.split('-')
          const lastNum = parts[parts.length - 1]
          if (lastNum && !Number.isNaN(Number.parseInt(lastNum, 10))) {
            nextNumber = Number.parseInt(lastNum, 10) + 1
          }
        }
        const invoiceNumber = `INV-${year}-${String(nextNumber).padStart(3, '0')}`

        const newInvoicePayload: Record<string, any> = {
          user_id: quote.user_id,
          quote_id: quote.id,
          client_id: quote.client_id || null,
          project_id: quote.project_id || null,
          from_company: quote.from_company || '',
          from_address: quote.from_address || '',
          from_website: quote.from_website || '',
          to_client: quote.to_client || '',
          to_address: quote.to_address || '',
          to_phone: quote.to_phone || '',
          title: quote.title || `Faktur dari ${quote.quote_number || 'Penawaran'}`,
          discount_amount: quote.discount_amount || 0,
          tax_amount: quote.tax_amount || 0,
          terms: quote.terms || '',
          status: 'Draf',
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString(),
          due_date: quote.valid_until || null,
          down_payment_amount: 0,
          attachments: quote.attachments || [],
        }

        const { data: insertedInvoice, error: invoiceInsertError } = await supabaseAdmin
          .from('invoices')
          .insert(newInvoicePayload)
          .select('id, invoice_number')
          .single()

        if (invoiceInsertError) {
          console.error('Error auto-creating invoice from quote:', invoiceInsertError)
        } else if (insertedInvoice) {
          createdInvoice = insertedInvoice

          if (quote.quote_items && quote.quote_items.length > 0) {
            const itemsPayload = quote.quote_items.map((item: any) => ({
              invoice_id: insertedInvoice.id,
              item_id: item.item_id || null,
              description: item.description || '',
              quantity: Number(item.quantity) || 1,
              unit: item.unit || 'Unit',
              unit_price: Number(item.unit_price) || 0,
              cost_price: Number(item.cost_price) || 0,
            }))

            const { error: itemsError } = await supabaseAdmin
              .from('invoice_items')
              .insert(itemsPayload)

            if (itemsError) {
              console.error('Error inserting auto-created invoice items:', itemsError)
            }
          }
        }
      }
    }

    // Create a notification for the user
    const statusText = status === 'Diterima' ? 'menerima' : 'menolak'
    let message = `Klien "${quote.to_client}" telah ${statusText} penawaran #${quote.quote_number}.`
    let notificationLink = `/quote/${quoteId}`

    if (createdInvoice) {
      message += ` Faktur #${createdInvoice.invoice_number} telah otomatis dibuat.`
      notificationLink = `/invoice/${createdInvoice.id}`
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: quote.user_id,
      message: message,
      link: notificationLink,
    })

    return new Response(JSON.stringify({ quote, invoice: createdInvoice }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('Function error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})