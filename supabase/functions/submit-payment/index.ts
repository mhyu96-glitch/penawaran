import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('proof') as File
    const invoiceId = formData.get('invoiceId') as string
    const amount = formData.get('amount') as string
    const paymentDate = formData.get('paymentDate') as string
    const notes = formData.get('notes') as string

    if (!file || !invoiceId || !amount || !paymentDate) {
      return new Response(JSON.stringify({ error: 'Data tidak lengkap.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Ambil invoice untuk mendapatkan user_id
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('user_id')
      .eq('id', invoiceId)
      .single()
    if (invoiceError) throw invoiceError

    // 2. Unggah file ke Storage
    const filePath = `${invoice.user_id}/${invoiceId}-${Date.now()}-${file.name}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('payment_proofs')
      .upload(filePath, file)
    if (uploadError) throw uploadError

    // 3. Dapatkan URL publik dari file yang diunggah
    const { data: urlData } = supabaseAdmin.storage
      .from('payment_proofs')
      .getPublicUrl(filePath)

    // 4. Masukkan catatan pembayaran ke database
    const paymentPayload = {
      invoice_id: invoiceId,
      user_id: invoice.user_id,
      amount: parseFloat(amount),
      payment_date: paymentDate,
      notes,
      proof_url: urlData.publicUrl,
      status: 'Pending',
    }
    const { error: insertError } = await supabaseAdmin.from('payments').insert(paymentPayload)
    if (insertError) throw insertError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('Function error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})