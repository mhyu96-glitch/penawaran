import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const today = new Date().toISOString().split('T')[0];

    // 1. Cari profil recurring yang aktif dan harus jalan hari ini (atau sebelumnya jika terlewat)
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from('recurring_invoices')
      .select('*')
      .eq('status', 'active')
      .lte('next_run_date', today);

    if (fetchError) throw fetchError;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No recurring invoices to process today." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = [];

    // 2. Proses setiap profil
    for (const profile of profiles) {
      const template = profile.template_data;
      
      // Generate Nomor Faktur Baru (Simple logic: INV-{Year}-{Random/Seq})
      // Note: Di production sebaiknya query last number dulu, tapi untuk simplicity di sini kita pakai timestamp
      const year = new Date().getFullYear();
      const randomStr = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-${year}-${randomStr}-AUTO`;

      // a. Buat Faktur Baru
      const { data: newInvoice, error: invError } = await supabaseAdmin
        .from('invoices')
        .insert({
          user_id: profile.user_id,
          client_id: profile.client_id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString(), // Tanggal hari ini
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default due +7 hari
          status: 'Draf', // Dibuat sebagai Draf dulu agar aman
          from_company: template.from_company,
          from_address: template.from_address,
          from_website: template.from_website,
          to_client: template.to_client,
          to_address: template.to_address,
          to_phone: template.to_phone,
          terms: template.terms,
          discount_amount: template.discount_amount || 0,
          tax_amount: template.tax_amount || 0,
          title: `[Rutin] ${template.title || 'Tagihan Berkala'}`,
        })
        .select()
        .single();

      if (invError) {
        console.error(`Failed to create invoice for profile ${profile.id}:`, invError);
        continue;
      }

      // b. Masukkan Item Faktur
      if (template.items && template.items.length > 0) {
        const itemsToInsert = template.items.map((item: any) => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          item_id: item.item_id || null // Link ke inventory jika ada
        }));
        
        await supabaseAdmin.from('invoice_items').insert(itemsToInsert);
      }

      // c. Hitung Next Run Date
      let nextDate = new Date(profile.next_run_date);
      if (profile.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (profile.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      else if (profile.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

      // Cek End Date
      let newStatus = 'active';
      if (profile.end_date && nextDate > new Date(profile.end_date)) {
        newStatus = 'completed';
      }

      // d. Update Profil Recurring
      await supabaseAdmin
        .from('recurring_invoices')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_date: nextDate.toISOString().split('T')[0],
          status: newStatus
        })
        .eq('id', profile.id);

      // e. Kirim Notifikasi Internal
      await supabaseAdmin.from('notifications').insert({
        user_id: profile.user_id,
        message: `Faktur rutin #${newInvoice.invoice_number} berhasil dibuat otomatis.`,
        link: `/invoice/${newInvoice.id}`
      });

      results.push({ profileId: profile.id, newInvoiceId: newInvoice.id });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, details: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})