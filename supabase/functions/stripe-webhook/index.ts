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
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    return new Response(err.message, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { invoice_id, user_id, invoice_number, client_name } = session.metadata!;
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update invoice status
    await supabaseAdmin.from('invoices').update({ status: 'Lunas' }).eq('id', invoice_id);

    // Create payment record
    await supabaseAdmin.from('payments').insert({
      invoice_id,
      user_id,
      amount: session.amount_total! / 100,
      payment_date: new Date(session.created * 1000).toISOString(),
      notes: `Pembayaran online via Stripe. ID Sesi: ${session.id}`,
      status: 'Lunas',
    });

    // Create notification
    const message = `Pembayaran sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(session.amount_total! / 100)} untuk faktur #${invoice_number} dari klien "${client_name}" telah berhasil.`;
    await supabaseAdmin.from('notifications').insert({
        user_id,
        message,
        link: `/invoice/${invoice_id}`
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
})