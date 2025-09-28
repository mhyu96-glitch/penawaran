import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from "https://esm.sh/stripe@15.8.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2024-04-10',
});

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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'idr',
          product_data: {
            name: `Pembayaran Faktur #${invoice.invoice_number}`,
            description: `Pembayaran untuk ${invoice.to_client}`,
          },
          unit_amount: total * 100, // Stripe expects amount in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/invoice/public/${invoice.id}?payment=success`,
      cancel_url: `${req.headers.get('origin')}/invoice/public/${invoice.id}`,
      metadata: {
        invoice_id: invoice.id,
        user_id: invoice.user_id,
        invoice_number: invoice.invoice_number,
        client_name: invoice.to_client,
      },
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})