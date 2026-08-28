import { supabase } from '@/integrations/supabase/client';

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id?: string;
  user_id?: string;
  invoice_number: string;
  client_id: string;
  quote_id?: string;
  invoice_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  discount_type: 'amount' | 'percentage';
  discount_value: number;
  discount_amount: number;
  tax_type: 'amount' | 'percentage';
  tax_value: number;
  tax_amount: number;
  grand_total: number;
  amount_paid: number;
  notes?: string;
  terms?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

/**
 * Create a new invoice with items
 */
export async function createInvoice(
  invoiceData: Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at'>, 
  items: Omit<InvoiceItem, 'id' | 'invoice_id'>[]
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Create the invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert([
      {
        user_id: user.id,
        ...invoiceData,
      }
    ])
    .select()
    .single();

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError);
    throw invoiceError;
  }

  // Create the invoice items
  if (items.length > 0) {
    const invoiceItems = items.map(item => ({
      invoice_id: invoice.id,
      ...item,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsError) {
      console.error('Error creating invoice items:', itemsError);
      // Rollback: delete the invoice
      await supabase.from('invoices').delete().eq('id', invoice.id);
      throw itemsError;
    }
  }

  return invoice;
}

/**
 * Get all invoices for the current user
 */
export async function getInvoices() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients (
        id,
        company_name,
        contact_person,
        email
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }

  return data;
}

/**
 * Get a single invoice with items
 */
export async function getInvoiceById(id: string): Promise<InvoiceWithItems> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      *,
      clients (
        id,
        company_name,
        contact_person,
        email,
        phone,
        address
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (invoiceError) {
    console.error('Error fetching invoice:', invoiceError);
    throw invoiceError;
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('created_at', { ascending: true });

  if (itemsError) {
    console.error('Error fetching invoice items:', itemsError);
    throw itemsError;
  }

  return {
    ...invoice,
    items: items || [],
  };
}

/**
 * Update an invoice
 */
export async function updateInvoice(
  id: string, 
  invoiceData: Partial<Invoice>, 
  items?: Omit<InvoiceItem, 'invoice_id'>[]
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Update the invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .update(invoiceData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (invoiceError) {
    console.error('Error updating invoice:', invoiceError);
    throw invoiceError;
  }

  // Update items if provided
  if (items) {
    // Delete existing items
    const { error: deleteError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', id);

    if (deleteError) {
      console.error('Error deleting old invoice items:', deleteError);
      throw deleteError;
    }

    // Insert new items
    if (items.length > 0) {
      const invoiceItems = items.map(item => ({
        invoice_id: id,
        ...item,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) {
        console.error('Error creating invoice items:', itemsError);
        throw itemsError;
      }
    }
  }

  return invoice;
}

/**
 * Delete an invoice (will cascade delete items)
 */
export async function deleteInvoice(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting invoice:', error);
    throw error;
  }

  return true;
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(id: string, status: Invoice['status']) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating invoice status:', error);
    throw error;
  }

  return data;
}

/**
 * Record a payment for an invoice
 */
export async function recordPayment(invoiceId: string, amount: number) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get current invoice
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('amount_paid, grand_total')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    console.error('Error fetching invoice:', fetchError);
    throw fetchError;
  }

  // Calculate new amount paid
  const newAmountPaid = (invoice.amount_paid || 0) + amount;
  const isPaid = newAmountPaid >= invoice.grand_total;

  // Update invoice
  const { data, error } = await supabase
    .from('invoices')
    .update({
      amount_paid: newAmountPaid,
      status: isPaid ? 'paid' : 'sent',
    })
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error recording payment:', error);
    throw error;
  }

  return data;
}
