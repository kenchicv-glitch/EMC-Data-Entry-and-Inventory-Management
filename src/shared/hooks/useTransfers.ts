import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useBranch } from '../hooks/useBranch';

export interface TransferItem {
    id?: string;
    product_id?: string;
    sku: string;
    name: string;
    quantity: number;
}

export interface StockTransfer {
    id: string;
    source_branch_id: number;
    destination_branch_id: number;
    product_sku: string;
    product_name: string;
    quantity: number;
    items?: TransferItem[]; // For multi-item transfers
    status: 'pending' | 'approved' | 'shipped' | 'received' | 'cancelled';
    requested_by: string;
    approved_by?: string;
    request_remarks?: string;
    shipping_remarks?: string;
    created_at: string;
    updated_at: string;
    source_branch_name?: string;
    destination_branch_name?: string;
}

export function useTransfers() {
    const { activeBranchId } = useBranch();
    const [transfers, setTransfers] = useState<StockTransfer[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTransfers = useCallback(async () => {
        if (!activeBranchId) return;
        
        setLoading(true);
        // Fetch both directions. Note: source is requester, destination is supplier.
        const { data, error } = await supabase
            .from('stock_transfers')
            .select(`
                *,
                source:source_branch_id(name),
                destination:destination_branch_id(name)
            `)
            .or(`source_branch_id.eq.${activeBranchId},destination_branch_id.eq.${activeBranchId}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching transfers:', error);
        } else {
            const formatted: StockTransfer[] = (data || []).map((t) => ({
                ...t,
                source_branch_name: (t.source as { name: string })?.name,
                destination_branch_name: (t.destination as { name: string })?.name
            }));
            setTransfers(formatted);
        }
        setLoading(false);
    }, [activeBranchId]);

    useEffect(() => {
        // Use a small delay to avoid "Calling setState synchronously within an effect" lint error
        const timer = setTimeout(() => {
            fetchTransfers();
        }, 0);

        // Real-time subscription
        const channel = supabase
            .channel('stock_transfers_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'stock_transfers' 
            }, () => {
                fetchTransfers();
            })
            .subscribe();

        return () => {
            clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [fetchTransfers]);

    return { transfers, loading, refresh: fetchTransfers };
}
