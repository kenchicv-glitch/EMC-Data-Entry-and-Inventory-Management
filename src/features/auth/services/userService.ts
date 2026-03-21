import { supabase } from '../../../shared/lib/supabase';

export interface Profile {
    id: string;
    full_name: string;
    role: 'admin' | 'encoder';
    updated_at: string;
}

export const userService = {
    async getAll(): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name');
        
        if (error) throw error;
        return data as Profile[] || [];
    },

    async updateRole(id: string, role: 'admin' | 'encoder'): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', id);
        
        if (error) throw error;
    }
};
