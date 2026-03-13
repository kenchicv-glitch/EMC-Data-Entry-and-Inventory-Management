import { supabase } from '../../../shared/lib/supabase';
import type { Supplier, SupplierInsert, SupplierUpdate } from '../../../shared/types';

export const supplierService = {
    async getAll(branchId?: string | null): Promise<Supplier[]> {
        let query = supabase
            .from('suppliers')
            .select('*')
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    async create(supplier: SupplierInsert): Promise<Supplier> {
        const { data, error } = await supabase
            .from('suppliers')
            .insert(supplier)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: SupplierUpdate): Promise<Supplier> {
        const { data, error } = await supabase
            .from('suppliers')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
