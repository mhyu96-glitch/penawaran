import { supabase } from '@/integrations/supabase/client';

export interface QuoteItem {
  id?: string;
  quote_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  cost_price: number;
  total: number;
}

export interface Quote {
  id?: string;
  user_id?: string;
  quote_number: string;
  client_id: string;
  quote_date: string;
  valid_until: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  subtotal: number;
  discount_type: 'amount' | 'percentage';
  discount_value: number;
  discount_amount: number;
  tax_type: 'amount' | 'percentage';
  tax_value: number;
  tax_amount: number;
  grand_total: number;
  profit: number;
  profit_margin: number;
  notes?: string;
  terms?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

/**
 * Create a new quote with items
 */
export async function createQuote(quoteData: Omit<Quote, 'id' | 'user_id' | 'created_at' | 'updated_at'>, items: Omit<QuoteItem, 'id' | 'quote_id'>[]) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Start a transaction by creating the quote first
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert([
      {
        user_id: user.id,
        ...quoteData,
      }
    ])
    .select()
    .single();

  if (quoteError) {
    console.error('Error creating quote:', quoteError);
    throw quoteError;
  }

  // Then create the quote items
  if (items.length > 0) {
    const quoteItems = items.map(item => ({
      quote_id: quote.id,
      ...item,
    }));

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(quoteItems);

    if (itemsError) {
      console.error('Error creating quote items:', itemsError);
      // Rollback: delete the quote
      await supabase.from('quotes').delete().eq('id', quote.id);
      throw itemsError;
    }
  }

  return quote;
}

/**
 * Get all quotes for the current user
 */
export async function getQuotes() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('quotes')
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
    console.error('Error fetching quotes:', error);
    throw error;
  }

  return data;
}

/**
 * Get a single quote with items
 */
export async function getQuoteById(id: string): Promise<QuoteWithItems> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
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

  if (quoteError) {
    console.error('Error fetching quote:', quoteError);
    throw quoteError;
  }

  const { data: items, error: itemsError } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .order('created_at', { ascending: true });

  if (itemsError) {
    console.error('Error fetching quote items:', itemsError);
    throw itemsError;
  }

  return {
    ...quote,
    items: items || [],
  };
}

/**
 * Update a quote
 */
export async function updateQuote(
  id: string, 
  quoteData: Partial<Quote>, 
  items?: Omit<QuoteItem, 'quote_id'>[]
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Update the quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .update(quoteData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (quoteError) {
    console.error('Error updating quote:', quoteError);
    throw quoteError;
  }

  // Update items if provided
  if (items) {
    // Delete existing items
    const { error: deleteError } = await supabase
      .from('quote_items')
      .delete()
      .eq('quote_id', id);

    if (deleteError) {
      console.error('Error deleting old quote items:', deleteError);
      throw deleteError;
    }

    // Insert new items
    if (items.length > 0) {
      const quoteItems = items.map(item => ({
        quote_id: id,
        ...item,
      }));

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(quoteItems);

      if (itemsError) {
        console.error('Error creating quote items:', itemsError);
        throw itemsError;
      }
    }
  }

  return quote;
}

/**
 * Delete a quote (will cascade delete items)
 */
export async function deleteQuote(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting quote:', error);
    throw error;
  }

  return true;
}

/**
 * Update quote status
 */
export async function updateQuoteStatus(id: string, status: Quote['status']) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('quotes')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating quote status:', error);
    throw error;
  }

  return data;
}
