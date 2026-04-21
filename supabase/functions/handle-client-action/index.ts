import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

        const { docId, docType, action, accessKey } = await req.json();

        if (!docId || !docType || !action || !accessKey) {
            throw new Error("Missing parameters");
        }

        // 1. Verify access key
        const { data: client, error: clientError } = await supabaseClient
            .from('clients')
            .select('id')
            .eq('portal_access_key', accessKey)
            .single();

        if (clientError || !client) {
            throw new Error("Invalid access key");
        }

        // 2. Perform action
        const table = docType === 'Penawaran' ? 'quotes' : 'invoices';
        const status = action === 'approve' ? 'Diterima' : 'Ditolak';

        const { error: updateError } = await supabaseClient
            .from(table)
            .update({ status: status })
            .eq('id', docId)
            .eq('client_id', client.id);

        if (updateError) throw updateError;

        // 3. Log activity
        await supabaseClient.from('activity_logs').insert({
            activity_type: 'client_action',
            description: `Klien telah ${action === 'approve' ? 'menyetujui' : 'menolak'} ${docType} #${docId}`,
            metadata: { docId, docType, action }
        });

        return new Response(JSON.stringify({ success: true, status }), {
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
