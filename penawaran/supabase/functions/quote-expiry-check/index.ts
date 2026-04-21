import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fungsi ini dirancang untuk dijalankan sebagai cron job terjadwal (misalnya, sekali sehari).
Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Temukan semua alur kerja aktif untuk penawaran yang akan kedaluwarsa
    const { data: workflows, error: workflowError } = await supabaseAdmin
      .from('workflows')
      .select('user_id')
      .eq('is_active', true)
      .eq('trigger_type', 'quote_expiring_3_days')
      .eq('action_type', 'send_internal_notification')

    if (workflowError) throw workflowError
    if (!workflows || workflows.length === 0) {
      return new Response(JSON.stringify({ message: "Tidak ada alur kerja aktif untuk penawaran yang akan kedaluwarsa." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Hitung tanggal target (3 hari dari sekarang)
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 3);
    
    const targetDateStringStart = targetDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const targetDateStringEnd = targetDate.toISOString().split('T')[0] + 'T23:59:59.999Z';

    // 3. Temukan semua penawaran yang akan kedaluwarsa pada tanggal target
    const userIds = workflows.map(w => w.user_id);
    const { data: quotes, error: quotesError } = await supabaseAdmin
      .from('quotes')
      .select('id, user_id, quote_number, to_client')
      .in('user_id', userIds)
      .eq('status', 'Terkirim') // Hanya periksa penawaran yang terkirim
      .gte('valid_until', targetDateStringStart)
      .lte('valid_until', targetDateStringEnd)

    if (quotesError) throw quotesError
    if (!quotes || quotes.length === 0) {
      return new Response(JSON.stringify({ message: "Tidak ada penawaran yang kedaluwarsa dalam 3 hari." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Buat notifikasi untuk setiap penawaran yang akan kedaluwarsa
    const notificationsToInsert = quotes.map(quote => ({
      user_id: quote.user_id,
      message: `Penawaran #${quote.quote_number} untuk klien "${quote.to_client}" akan kedaluwarsa dalam 3 hari. Segera follow-up!`,
      link: `/quote/${quote.id}`
    }));

    if (notificationsToInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert(notificationsToInsert)

        if (insertError) throw insertError
    }

    return new Response(JSON.stringify({ success: true, notifications_created: notificationsToInsert.length }), {
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