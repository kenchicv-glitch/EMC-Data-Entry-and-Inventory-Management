import { supabase } from '../../../shared/lib/supabase';
import type { Expense } from '../../../shared/types';

export const expenseService = {
    async getAll(branchId?: string | null): Promise<Expense[]> {
        let query = supabase
            .from('expenses')
            .select('id, category, description, amount, date, invoice_number, branch_id, user_id')
            .order('date', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async create(expense: Omit<Expense, 'id'>): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .insert(expense)
            .select('id, category, description, amount, date, invoice_number, branch_id, user_id')
            .single();

        if (error) throw error;
        return data as Expense;
    },

    async update(id: string, expense: Partial<Omit<Expense, 'id'>>): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .update(expense)
            .eq('id', id)
            .select('id, category, description, amount, date, invoice_number, branch_id, user_id')
            .single();

        if (error) throw error;
        return data as Expense;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
