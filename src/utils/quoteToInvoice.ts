import { supabase } from '@/integrations/supabase/client';

export interface ConvertQuoteToInvoiceOptions {
  quoteId: string;
  userId: string;
  autoUpdateStatus?: boolean;
  allowDuplicate?: boolean;
  downPaymentAmount?: number;
}

export interface ConvertQuoteToInvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  alreadyExisted?: boolean;
  error?: string;
}

const isMissingColumnError = (error: { message?: string } | null | undefined) =>
  Boolean(error?.message?.toLowerCase().includes('schema cache') && error.message.toLowerCase().includes('column'));

/**
 * Converts a Quote into an Invoice.
 * Copies client details, terms, discounts, taxes, and all quote items.
 */
export async function convertQuoteToInvoice({
  quoteId,
  userId,
  autoUpdateStatus = true,
  allowDuplicate = false,
  downPaymentAmount = 0,
}: ConvertQuoteToInvoiceOptions): Promise<ConvertQuoteToInvoiceResult> {
  try {
    // 1. Check if an invoice already exists for this quote unless duplication is permitted
    if (!allowDuplicate) {
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingInvoices && existingInvoices.length > 0) {
        if (autoUpdateStatus) {
          await supabase.from('quotes').update({ status: 'Diterima' }).eq('id', quoteId);
        }
        return {
          success: true,
          invoiceId: existingInvoices[0].id,
          invoiceNumber: existingInvoices[0].invoice_number,
          alreadyExisted: true,
        };
      }
    }

    // 2. Fetch the quote and its items
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      return {
        success: false,
        error: quoteError?.message || 'Penawaran tidak ditemukan.',
      };
    }

    // 3. Generate sequential invoice number (INV-YYYY-XXX)
    const year = new Date().getFullYear();
    const { data: latestInvoices, error: numberError } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('user_id', userId)
      .like('invoice_number', `INV-${year}-%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (!numberError && latestInvoices && latestInvoices.length > 0 && latestInvoices[0]?.invoice_number) {
      const parts = latestInvoices[0].invoice_number.split('-');
      const lastNum = parts[parts.length - 1];
      if (lastNum && !Number.isNaN(Number.parseInt(lastNum, 10))) {
        nextNumber = Number.parseInt(lastNum, 10) + 1;
      }
    }
    const invoiceNumber = `INV-${year}-${String(nextNumber).padStart(3, '0')}`;

    // 4. Prepare invoice payload
    const newInvoicePayload: Record<string, any> = {
      user_id: userId,
      quote_id: quote.id,
      client_id: quote.client_id || null,
      project_id: quote.project_id || null,
      from_company: quote.from_company || '',
      from_address: quote.from_address || '',
      from_website: quote.from_website || '',
      to_client: quote.to_client || '',
      to_address: quote.to_address || '',
      to_phone: quote.to_phone || '',
      title: quote.title || `Faktur dari ${quote.quote_number || 'Penawaran'}`,
      discount_amount: quote.discount_amount || 0,
      tax_amount: quote.tax_amount || 0,
      terms: quote.terms || '',
      status: 'Draf',
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString(),
      due_date: quote.valid_until || null,
      down_payment_amount: downPaymentAmount || 0,
      attachments: quote.attachments || [],
    };

    let invoiceResult = await supabase
      .from('invoices')
      .insert(newInvoicePayload)
      .select('id, invoice_number')
      .single();

    // Fallback if schema cache is missing newer columns
    if (isMissingColumnError(invoiceResult.error)) {
      const { project_id, down_payment_amount, ...compatiblePayload } = newInvoicePayload;
      invoiceResult = await supabase
        .from('invoices')
        .insert(compatiblePayload)
        .select('id, invoice_number')
        .single();
    }

    if (invoiceResult.error || !invoiceResult.data) {
      return {
        success: false,
        error: invoiceResult.error?.message || 'Gagal menyimpan faktur baru.',
      };
    }

    const createdInvoice = invoiceResult.data;

    // 5. Copy quote items to invoice items
    if (quote.quote_items && quote.quote_items.length > 0) {
      const newInvoiceItemsPayload = quote.quote_items.map((item: any) => ({
        invoice_id: createdInvoice.id,
        item_id: item.item_id || null,
        description: item.description || '',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'Unit',
        unit_price: Number(item.unit_price) || 0,
        cost_price: Number(item.cost_price) || 0,
      }));

      let itemsResult = await supabase
        .from('invoice_items')
        .insert(newInvoiceItemsPayload);

      if (isMissingColumnError(itemsResult.error)) {
        const compatibleItems = newInvoiceItemsPayload.map(({ item_id, ...item }) => item);
        itemsResult = await supabase
          .from('invoice_items')
          .insert(compatibleItems);
      }

      if (itemsResult.error) {
        // Rollback invoice creation on item error
        await supabase.from('invoices').delete().match({ id: createdInvoice.id });
        return {
          success: false,
          error: `Gagal menyalin item barang: ${itemsResult.error.message}`,
        };
      }
    }

    // 6. Automatically mark quote as 'Diterima' if specified
    if (autoUpdateStatus) {
      await supabase
        .from('quotes')
        .update({ status: 'Diterima' })
        .eq('id', quote.id);
    }

    return {
      success: true,
      invoiceId: createdInvoice.id,
      invoiceNumber: createdInvoice.invoice_number || invoiceNumber,
      alreadyExisted: false,
    };
  } catch (error: any) {
    console.error('Error converting quote to invoice:', error);
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan tidak terduga saat memproses faktur.',
    };
  }
}
