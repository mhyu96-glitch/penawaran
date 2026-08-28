import { supabase } from '@/integrations/supabase/client';

export interface Client {
  id?: string;
  user_id?: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Create a new client
 */
export async function createClient(clientData: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('clients')
    .insert([
      {
        user_id: user.id,
        company_name: clientData.company_name,
        contact_person: clientData.contact_person,
        email: clientData.email,
        phone: clientData.phone,
        address: clientData.address,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating client:', error);
    throw error;
  }

  return data;
}

/**
 * Get all clients for the current user
 */
export async function getClients() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }

  return data;
}

/**
 * Get a single client by ID
 */
export async function getClientById(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching client:', error);
    throw error;
  }

  return data;
}

/**
 * Update a client
 */
export async function updateClient(id: string, clientData: Partial<Client>) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('clients')
    .update(clientData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating client:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a client
 */
export async function deleteClient(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting client:', error);
    throw error;
  }

  return true;
}
