import { supabase } from '../../../shared/lib/supabase';
import type { Expense } from '../../../shared/types';

export const expenseService = {
    async getAll(): Promise<Expense[]> {
        const { data, error } = await supabase
            .from('expenses')
            .select('id, category, description, amount, date, invoice_number, user_id')
            .order('date', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async create(expense: Omit<Expense, 'id'>): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .insert(expense)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, expense: Partial<Omit<Expense, 'id'>>): Promise<Expense> {
        const { data, error } = await supabase
            .from('expenses')
            .update(expense)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
