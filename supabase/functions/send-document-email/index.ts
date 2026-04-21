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

        const { docId, docType, recipientEmail, recipientName } = await req.json();

        // 1. Fetch document and user profile
        const table = docType === 'quote' ? 'quotes' : 'invoices';
        const itemTable = docType === 'quote' ? 'quote_items' : 'invoice_items';
        const foreignKey = docType === 'quote' ? 'quote_id' : 'invoice_id';

        const { data: doc, error: docError } = await supabaseClient
            .from(table)
            .select(`*, user:profiles(*), items:${itemTable}(*)`)
            .eq('id', docId)
            .single();

        if (docError || !doc) {
            throw new Error("Document not found");
        }

        const docNumber = docType === 'quote' ? doc.quote_number : doc.invoice_number;
        const docDate = docType === 'quote' ? doc.quote_date : doc.invoice_date;

        // 2. Prepare HTML Template (Professional Executive Style)
        const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #0a0c10; padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">${doc.from_company}</h1>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 10px;">Executive Business Document</p>
        </div>
        <div style="padding: 40px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="font-size: 20px; color: #0f172a;">Halo ${recipientName || 'Klien Kami'},</h2>
          <p style="line-height: 1.6;">Terlampir adalah dokumen <strong>${docType === 'quote' ? 'Penawaran' : 'Faktur'}</strong> untuk proyek Anda.</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <table style="width: 100%; font-size: 14px;">
              <tr><td style="color: #64748b;">Nomor:</td><td style="text-align: right; font-weight: bold;">${docNumber}</td></tr>
              <tr><td style="color: #64748b;">Tanggal:</td><td style="text-align: right;">${new Date(docDate).toLocaleDateString('id-ID')}</td></tr>
              <tr><td style="color: #64748b;">Total:</td><td style="text-align: right; font-weight: bold; color: #10b981;">Rp ${doc.total?.toLocaleString('id-ID') || 0}</td></tr>
            </table>
          </div>

          <p style="font-size: 14px; text-align: center; margin-top: 40px;">
            <a href="${Deno.env.get("PUBLIC_APP_URL")}/public/${docType}/${docId}" style="background: #000000; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">LIHAT DOKUMEN LENGKAP</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 40px 0;">
          <p style="font-size: 12px; color: #64748b; text-align: center;">Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi kami di ${doc.from_company}.</p>
        </div>
      </div>
    `;

        // 3. Send via Resend
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: `${doc.from_company} <onboarding@resend.dev>`, // Dynamic in production
                to: [recipientEmail],
                subject: `${docType === 'quote' ? 'Penawaran' : 'Faktur'} dari ${doc.from_company} (${docNumber})`,
                html: htmlContent,
            }),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
        }

        // 4. Update Document Status to 'Terkirim'
        await supabaseClient
            .from(table)
            .update({ status: 'Terkirim' })
            .eq('id', docId);

        return new Response(JSON.stringify({ success: true }), {
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
