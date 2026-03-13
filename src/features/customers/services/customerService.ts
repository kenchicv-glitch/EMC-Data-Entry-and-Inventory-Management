import { supabase } from '../../../shared/lib/supabase';
import type { Customer, CustomerInsert, CustomerUpdate } from '../../../shared/types';

export const customerService = {
    async getAll(branchId?: string | null): Promise<Customer[]> {
        let query = supabase
            .from('customers')
            .select('*')
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    async create(customer: CustomerInsert): Promise<Customer> {
        const { data, error } = await supabase
            .from('customers')
            .insert(customer)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: CustomerUpdate): Promise<Customer> {
        const { data, error } = await supabase
            .from('customers')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
