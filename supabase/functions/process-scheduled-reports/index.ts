import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // This function is intended to be called by a CRON job or manually to process all due schedules
        // For simplicity in this implementation, we will process one user's report at a time if triggered via UI
        // Or scan the report_schedules table if it's a cron trigger

        // Check if it's a specific trigger or a batch process
        const body = await req.json().catch(() => ({}));
        const { userId, frequency } = body;

        let schedulesQuery = supabaseClient.from('report_schedules').select('*');
        if (userId) schedulesQuery = schedulesQuery.eq('user_id', userId);
        if (frequency) schedulesQuery = schedulesQuery.eq('frequency', frequency);

        const { data: schedules, error: scheduleError } = await schedulesQuery;

        if (scheduleError) throw scheduleError;

        const results = [];

        for (const schedule of schedules) {
            // 1. Calculate date range based on frequency
            const now = new Date();
            let fromDate = new Date();
            if (schedule.frequency === 'daily') fromDate.setDate(now.getDate() - 1);
            else if (schedule.frequency === 'weekly') fromDate.setDate(now.getDate() - 7);
            else if (schedule.frequency === 'monthly') fromDate.setMonth(now.getMonth() - 1);

            const fromISO = fromDate.toISOString();
            const nowISO = now.toISOString();

            // 2. Fetch User Profile for Branding
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', schedule.user_id)
                .single();

            // 3. Aggregate Financial Data
            const { data: payments } = await supabaseClient
                .from('payments')
                .select('amount')
                .eq('user_id', schedule.user_id)
                .gte('payment_date', fromISO)
                .lt('payment_date', nowISO);

            const { data: expenses } = await supabaseClient
                .from('expenses')
                .select('amount')
                .eq('user_id', schedule.user_id)
                .gte('expense_date', fromISO)
                .lt('expense_date', nowISO);

            const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
            const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
            const netProfit = totalRevenue - totalExpenses;

            // 4. Prepare HTML Report
            const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: #0a0c10; padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase;">Laporan Keuangan ${schedule.frequency === 'daily' ? 'Harian' : schedule.frequency === 'weekly' ? 'Mingguan' : 'Bulanan'}</h1>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 10px;">${profile?.company_name || 'Executive Command Center'}</p>
          </div>
          <div style="padding: 40px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px;">Halo,</p>
            <p>Berikut adalah ringkasan performa keuangan Anda untuk periode <strong>${fromDate.toLocaleDateString('id-ID')} - ${now.toLocaleDateString('id-ID')}</strong>.</p>
            
            <div style="margin: 30px 0; border-collapse: collapse; width: 100%;">
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #10b981;">
                <span style="color: #64748b; font-size: 12px; display: block;">TOTAL PENDAPATAN</span>
                <span style="font-size: 20px; font-weight: bold; color: #10b981;">Rp ${totalRevenue.toLocaleString('id-ID')}</span>
              </div>
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #ef4444;">
                <span style="color: #64748b; font-size: 12px; display: block;">TOTAL PENGELUARAN</span>
                <span style="font-size: 20px; font-weight: bold; color: #ef4444;">Rp ${totalExpenses.toLocaleString('id-ID')}</span>
              </div>
              <div style="background: #0f172a; padding: 15px; border-radius: 8px; border-left: 4px solid #6366f1;">
                <span style="color: #94a3b8; font-size: 12px; display: block;">LABA BERSIH</span>
                <span style="font-size: 20px; font-weight: bold; color: #ffffff;">Rp ${netProfit.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <p style="font-size: 14px; text-align: center; margin-top: 40px;">
              <a href="${Deno.env.get("PUBLIC_APP_URL")}/reports" style="background: #000000; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">LIHAT LAPORAN LENGKAP</a>
            </p>
          </div>
        </div>
      `;

            // 5. Send emails to all recipients
            for (const email of schedule.recipients) {
                await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${RESEND_API_KEY}`,
                    },
                    body: JSON.stringify({
                        from: "Financial Ops <onboarding@resend.dev>",
                        to: [email],
                        subject: `Laporan Keuangan ${schedule.frequency.toUpperCase()} - ${profile?.company_name || ''}`,
                        html: htmlContent,
                    }),
                });
            }

            // 6. Update last_sent_at
            await supabaseClient
                .from('report_schedules')
                .update({ last_sent_at: nowISO })
                .eq('id', schedule.id);

            results.push({ userId: schedule.user_id, status: 'success' });
        }

        return new Response(JSON.stringify({ success: true, processed: results.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
