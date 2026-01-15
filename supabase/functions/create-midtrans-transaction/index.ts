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

    // 1. Ambil data invoice beserta data user pemilik invoice
    const { data: invoice, error } = await supabaseAdmin
      .from('invoices')
      .select('*, invoice_items(*), clients(email)')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) throw new Error('Invoice not found');

    // 2. Ambil Server Key dari profil user pemilik invoice
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('midtrans_server_key, midtrans_is_production')
      .eq('id', invoice.user_id)
      .single();

    // 3. Gunakan Server Key user, fallback ke Env Var jika user belum setting (untuk backward compatibility)
    const midtransServerKey = profile?.midtrans_server_key || Deno.env.get('MIDTRANS_SERVER_KEY');
    const isProduction = profile?.midtrans_is_production ?? false;

    if (!midtransServerKey) throw new Error('Konfigurasi Midtrans (Server Key) belum diatur oleh pemilik faktur.');

    // 4. Hitung total
    const subtotal = invoice.invoice_items.reduce((acc: number, item: any) => acc + item.quantity * item.unit_price, 0);
    const total = subtotal - (invoice.discount_amount || 0) + (invoice.tax_amount || 0);

    // 5. Tentukan URL API
    const midtransApiUrl = isProduction 
        ? 'https://app.midtrans.com/snap/v1/transactions'
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    const encodedKey = btoa(`${midtransServerKey}:`);

    const transactionPayload = {
      transaction_details: {
        order_id: `${invoice.id}-${Date.now()}`, // Unique order ID for each attempt
        gross_amount: Math.round(total),
      },
      customer_details: {
        first_name: invoice.to_client,
        email: invoice.clients?.email, // Get email from related client table
        phone: invoice.to_phone,
      },
      item_details: invoice.invoice_items.map((item: any) => ({
        id: item.id,
        price: Math.round(item.unit_price),
        quantity: item.quantity,
        name: item.description.substring(0, 50),
      })),
      custom_field1: invoice.id, // Pass original invoice ID for webhook
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
      console.error("Midtrans Error:", errorBody);
      // Kirim error yang lebih mudah dibaca
      throw new Error(errorBody.error_messages ? errorBody.error_messages.join(', ') : 'Gagal membuat transaksi Midtrans.');
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