import { supabase } from '../lib/supabase';
import type { StockTransfer } from '../hooks/useTransfers';

export const transferService = {
    async getAll(branchId: string | null) {
        if (!branchId) return [];

        const { data, error } = await supabase
            .from('stock_transfers')
            .select(`
                *,
                source:source_branch_id(name),
                destination:destination_branch_id(name)
            `)
            .or(`source_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((t) => ({
            ...t,
            source_branch_name: (t.source as { name: string })?.name,
            destination_branch_name: (t.destination as { name: string })?.name
        })) as StockTransfer[];
    },

    async updateStatus(id: string, status: StockTransfer['status'], remarks?: string) {
        const updateData: any = { status, updated_at: new Date().toISOString() };
        if (remarks) {
            if (status === 'shipped') updateData.shipping_remarks = remarks;
        }

        const { data, error } = await supabase
            .from('stock_transfers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as StockTransfer;
    },

    async create(transfer: Omit<StockTransfer, 'id' | 'created_at' | 'updated_at' | 'status'>) {
        const { data, error } = await supabase
            .from('stock_transfers')
            .insert({
                ...transfer,
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data as StockTransfer;
    }
};
