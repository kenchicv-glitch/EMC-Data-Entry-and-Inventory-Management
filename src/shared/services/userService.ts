import { supabase } from '../lib/supabase';
import type { User } from '../types';

export const userService = {
    async getAll(): Promise<User[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, updated_at')
            .order('full_name');

        if (error) throw error;
        return data || [];
    },

    async getById(id: string): Promise<User | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, updated_at')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, user: Partial<Omit<User, 'id'>>): Promise<User> {
        const { data, error } = await supabase
            .from('profiles')
            .update(user)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
