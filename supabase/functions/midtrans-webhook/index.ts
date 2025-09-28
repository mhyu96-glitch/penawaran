import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { encodeToString } from "https://deno.land/std@0.190.0/encoding/hex.ts";

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

    // Verify signature key using Web Crypto API
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(midtransServerKey),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(order_id + status_code + gross_amount),
    );
    const hash = encodeToString(new Uint8Array(signatureBuffer));

    if (hash !== signature_key) {
      throw new Error('Invalid signature');
    }

    const invoiceId = custom_field1 || order_id; // Use custom_field1 to get the real invoice ID

    let newStatus = null;
    if (transaction_status == 'capture' || transaction_status == 'settlement') {
      if (fraud_status == 'accept') {
        newStatus = 'Lunas';
      }
    } else if (transaction_status == 'cancel' || transaction_status == 'deny' || transaction_status == 'expire') {
      // Handle failed transactions if needed
    }

    if (newStatus === 'Lunas') {
      // 1. Update invoice status
      await supabaseAdmin.from('invoices').update({ status: 'Lunas' }).eq('id', invoiceId);

      // 2. Get invoice details for notification
      const { data: invoice } = await supabaseAdmin.from('invoices').select('user_id, invoice_number, to_client').eq('id', invoiceId).single();
      if (!invoice) {
        console.error(`Invoice with id ${invoiceId} not found.`);
        // Still return 200 to Midtrans to prevent retries
        return new Response(JSON.stringify({ received: true, message: "Invoice not found" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Create payment record
      await supabaseAdmin.from('payments').insert({
        invoice_id: invoiceId,
        user_id: invoice.user_id,
        amount: parseFloat(gross_amount),
        payment_date: new Date().toISOString(),
        notes: `Pembayaran online via Midtrans. Tipe: ${notification.payment_type}.`,
        status: 'Lunas',
      });

      // 4. Create notification for the user
      const message = `Pembayaran sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(parseFloat(gross_amount))} untuk faktur #${invoice.invoice_number} dari klien "${invoice.to_client}" telah berhasil.`;
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