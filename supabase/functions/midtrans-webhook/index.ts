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

    // Handle Midtrans test notification
    if (!notification.signature_key || !notification.order_id) {
      console.log("Received a request without a signature key, likely a Midtrans test. Responding with success.");
      return new Response(JSON.stringify({ message: "Webhook test successful." }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { order_id, transaction_status, fraud_status, signature_key, gross_amount, status_code, custom_field1 } = notification;
    const invoiceId = custom_field1 || order_id;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Ambil invoice untuk mendapatkan user_id
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('user_id, invoice_number, to_client, discount_amount, tax_amount, down_payment_amount, invoice_items(quantity, unit_price), payments(amount, status, notes)')
      .eq('id', invoiceId)
      .single();
    
    if (!invoice) {
        console.error(`Invoice with id ${invoiceId} not found.`);
        return new Response(JSON.stringify({ received: true, message: "Invoice not found" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 2. Ambil Server Key dari profile user pemilik invoice
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('midtrans_server_key')
        .eq('id', invoice.user_id)
        .single();
    
    const midtransServerKey = profile?.midtrans_server_key || Deno.env.get('MIDTRANS_SERVER_KEY');
    
    if (!midtransServerKey) throw new Error('Midtrans server key is not configured for this user');

    // Midtrans memakai SHA-512(order_id + status_code + gross_amount + server_key).
    const signatureBuffer = await crypto.subtle.digest(
      "SHA-512",
      new TextEncoder().encode(order_id + status_code + gross_amount + midtransServerKey),
    );
    const hash = encodeToString(new Uint8Array(signatureBuffer));

    if (hash !== signature_key) {
      throw new Error('Invalid signature');
    }

    const isSuccessful =
      transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept');

    if (isSuccessful) {
      const duplicatePayment = (invoice.payments || []).some(
        (payment: any) => payment.notes?.includes(`Order ID: ${order_id}`)
      );

      if (duplicatePayment) {
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const paymentAmount = Number.parseFloat(gross_amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        throw new Error('Invalid payment amount');
      }

      const { error: paymentError } = await supabaseAdmin.from('payments').insert({
        invoice_id: invoiceId,
        user_id: invoice.user_id,
        amount: paymentAmount,
        payment_date: new Date().toISOString(),
        notes: `Pembayaran online via Midtrans. Order ID: ${order_id}. Tipe: ${notification.payment_type}.`,
        status: 'Lunas',
      });
      if (paymentError) throw paymentError;

      const subtotal = (invoice.invoice_items || []).reduce(
        (sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0,
      );
      const invoiceTotal = subtotal - Number(invoice.discount_amount || 0) + Number(invoice.tax_amount || 0);
      const previousPayments = (invoice.payments || [])
        .filter((payment: any) => payment.status === 'Lunas')
        .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
      const cumulativePaid = previousPayments + Number(invoice.down_payment_amount || 0) + paymentAmount;

      if (cumulativePaid >= invoiceTotal) {
        const { error: statusError } = await supabaseAdmin
          .from('invoices')
          .update({ status: 'Lunas' })
          .eq('id', invoiceId);
        if (statusError) throw statusError;
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
