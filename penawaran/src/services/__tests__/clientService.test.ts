import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, getClients, getClientById, updateClient, deleteClient } from '../clientService';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('clientService', () => {
  const mockUser = { id: 'user-123' };
  const mockClient = {
    id: 'client-1',
    user_id: 'user-123',
    company_name: 'Test Company',
    contact_person: 'John Doe',
    email: 'john@test.com',
    phone: '08123456789',
    address: 'Test Address',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe('createClient', () => {
    it('should create a new client successfully', async () => {
      const mockFrom = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockClient, error: null }),
      };
      
      (supabase.from as any).mockReturnValue(mockFrom);

      const clientData = {
        company_name: 'Test Company',
        contact_person: 'John Doe',
        email: 'john@test.com',
        phone: '08123456789',
        address: 'Test Address',
      };

      const result = await createClient(clientData);

      expect(supabase.from).toHaveBeenCalledWith('clients');
      expect(mockFrom.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          user_id: mockUser.id,
          ...clientData,
        }),
      ]);
      expect(result).toEqual(mockClient);
    });

    it('should throw error when user is not authenticated', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(createClient({
        company_name: 'Test',
        contact_person: 'Test',
        email: 'test@test.com',
        phone: '123',
        address: 'Test',
      })).rejects.toThrow('User not authenticated');
    });
  });

  describe('getClients', () => {
    it('should fetch all clients for current user', async () => {
      const mockClients = [mockClient];
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockClients, error: null }),
      };
      
      (supabase.from as any).mockReturnValue(mockFrom);

      const result = await getClients();

      expect(supabase.from).toHaveBeenCalledWith('clients');
      expect(mockFrom.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(result).toEqual(mockClients);
    });
  });

  describe('getClientById', () => {
    it('should fetch a single client by ID', async () => {
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockClient, error: null }),
      };
      
      (supabase.from as any).mockReturnValue(mockFrom);

      const result = await getClientById('client-1');

      expect(supabase.from).toHaveBeenCalledWith('clients');
      expect(result).toEqual(mockClient);
    });
  });

  describe('updateClient', () => {
    it('should update a client successfully', async () => {
      const updateData = { company_name: 'Updated Company' };
      const mockFrom = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockClient, ...updateData },
          error: null,
        }),
      };
      
      (supabase.from as any).mockReturnValue(mockFrom);

      const result = await updateClient('client-1', updateData);

      expect(supabase.from).toHaveBeenCalledWith('clients');
      expect(mockFrom.update).toHaveBeenCalledWith(updateData);
      expect(result.company_name).toBe('Updated Company');
    });
  });

  describe('deleteClient', () => {
    it('should delete a client successfully', async () => {
      const mockFrom = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      
      (supabase.from as any).mockReturnValue(mockFrom);

      const result = await deleteClient('client-1');

      expect(supabase.from).toHaveBeenCalledWith('clients');
      expect(mockFrom.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
