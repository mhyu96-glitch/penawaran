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
    const notification = await req.json();

    // Handle Midtrans test notification which may not have a signature key
    if (!notification.signature_key || !notification.order_id) {
      console.log("Received a request without a signature key, likely a Midtrans test. Responding with success.");
      return new Response(JSON.stringify({ message: "Webhook test successful." }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { order_id, transaction_status, fraud_status, signature_key, gross_amount, status_code, custom_field1 } = notification;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!midtransServerKey) throw new Error('Midtrans server key is not configured');

    const signatureBuffer = await crypto.subtle.digest(
      'SHA-512',
      new TextEncoder().encode(order_id + status_code + gross_amount + midtransServerKey),
    );
    const hash = Array.from(new Uint8Array(signatureBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    if (hash !== signature_key) {
      throw new Error('Invalid signature');
    }

    const invoiceId = custom_field1 || order_id; // Use custom_field1 to get the real invoice ID

    let newStatus = null;
    if (transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept')) {
      newStatus = 'Lunas';
    } else if (transaction_status == 'cancel' || transaction_status == 'deny' || transaction_status == 'expire') {
      // Handle failed transactions if needed
    }

    if (newStatus === 'Lunas') {
      const paymentNote = `Pembayaran online via Midtrans. Order: ${order_id}. Tipe: ${notification.payment_type}.`;
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('invoice_id', invoiceId)
        .eq('notes', paymentNote)
        .maybeSingle();

      if (existingPayment) {
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('user_id, invoice_number, to_client, discount_amount, tax_amount, down_payment_amount, invoice_items(quantity, unit_price), payments(amount, status)')
        .eq('id', invoiceId)
        .single();
      if (!invoice) {
        console.error(`Invoice with id ${invoiceId} not found.`);
        // Still return 200 to Midtrans to prevent retries
        return new Response(JSON.stringify({ received: true, message: "Invoice not found" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const paymentAmount = parseFloat(gross_amount);
      await supabaseAdmin.from('payments').insert({
        invoice_id: invoiceId,
        user_id: invoice.user_id,
        amount: paymentAmount,
        payment_date: new Date().toISOString(),
        notes: paymentNote,
        status: 'Lunas',
      });

      const invoiceTotal = invoice.invoice_items.reduce(
        (sum: number, item: { quantity: number; unit_price: number }) => sum + item.quantity * item.unit_price,
        0
      ) - (invoice.discount_amount || 0) + (invoice.tax_amount || 0);
      const previousPaid = (invoice.payments || [])
        .filter((payment: { status: string }) => payment.status === 'Lunas')
        .reduce((sum: number, payment: { amount: number }) => sum + Number(payment.amount || 0), 0);
      const totalPaid = (invoice.down_payment_amount || 0) + previousPaid + paymentAmount;

      if (totalPaid >= invoiceTotal) {
        await supabaseAdmin.from('invoices').update({ status: 'Lunas' }).eq('id', invoiceId);
      }

      const message = `Pembayaran sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(paymentAmount)} untuk faktur #${invoice.invoice_number} dari klien "${invoice.to_client}" telah berhasil.`;
      await supabaseAdmin.from('notifications').insert({
          user_id: invoice.user_id,
          message,
          link: `/invoice/${invoiceId}`
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error("Midtrans webhook error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
