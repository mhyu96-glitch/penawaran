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
    if (!invoiceId) throw new Error('Invoice ID is required');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: invoice, error } = await supabaseAdmin
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) throw new Error('Invoice not found');

    const subtotal = invoice.invoice_items.reduce((acc: number, item: any) => acc + item.quantity * item.unit_price, 0);
    const total = subtotal - (invoice.discount_amount || 0) + (invoice.tax_amount || 0);

    const midtransApiUrl = Deno.env.get('MIDTRANS_API_URL') ?? 'https://api.sandbox.midtrans.com/snap/v1/transactions';
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');

    if (!midtransServerKey) throw new Error('Midtrans server key is not configured');

    const encodedKey = btoa(`${midtransServerKey}:`);

    const transactionPayload = {
      transaction_details: {
        order_id: invoice.id,
        gross_amount: Math.round(total),
      },
      customer_details: {
        first_name: invoice.to_client,
        email: invoice.to_email, // Assuming you have an email field, otherwise this can be omitted
        phone: invoice.to_phone,
      },
      item_details: invoice.invoice_items.map((item: any) => ({
        id: item.id,
        price: Math.round(item.unit_price),
        quantity: item.quantity,
        name: item.description.substring(0, 50),
      })),
    };

    const response = await fetch(midtransApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${encodedKey}`,
      },
      body: JSON.stringify(transactionPayload),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(JSON.stringify(errorBody));
    }

    const data = await response.json();

    return new Response(JSON.stringify({ token: data.token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})