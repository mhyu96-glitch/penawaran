import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// This function is designed to be run as a scheduled cron job (e.g., once a day).
Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Find all active workflows for overdue invoices
    const { data: workflows, error: workflowError } = await supabaseAdmin
      .from('workflows')
      .select('user_id')
      .eq('is_active', true)
      .eq('trigger_type', 'invoice_overdue')
      .eq('action_type', 'send_internal_notification')

    if (workflowError) throw workflowError
    if (!workflows || workflows.length === 0) {
      return new Response(JSON.stringify({ message: "No active workflows for overdue invoices." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Find all overdue invoices for users with active workflows
    const userIds = workflows.map(w => w.user_id);
    const { data: invoices, error: invoicesError } = await supabaseAdmin
      .from('invoices')
      .select('id, user_id, invoice_number, to_client')
      .in('user_id', userIds)
      .neq('status', 'Lunas')
      .lt('due_date', new Date().toISOString())

    if (invoicesError) throw invoicesError
    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ message: "No overdue invoices found." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Create notifications for each overdue invoice
    const notificationsToInsert = invoices.map(invoice => ({
      user_id: invoice.user_id,
      message: `Faktur #${invoice.invoice_number} untuk klien "${invoice.to_client}" telah jatuh tempo. Segera follow-up!`,
      link: `/invoice/${invoice.id}`
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