import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useBranch } from '../hooks/useBranch';
import { queryKeys } from '../lib/queryKeys';
import { transferService } from '../services/transferService';

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
    items?: TransferItem[];
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
    const queryClient = useQueryClient();
    const { activeBranchId } = useBranch();

    const transfersQuery = useQuery({
        queryKey: queryKeys.transfers.list(activeBranchId),
        queryFn: () => transferService.getAll(activeBranchId),
        enabled: !!activeBranchId,
    });

    const createTransferMutation = useMutation({
        mutationFn: (newTransfer: Omit<StockTransfer, 'id' | 'created_at' | 'updated_at' | 'status'>) =>
            transferService.create(newTransfer),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.transfers.all });
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status, remarks }: { id: string; status: StockTransfer['status']; remarks?: string }) =>
            transferService.updateStatus(id, status, remarks),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.transfers.all });
        },
    });

    useEffect(() => {
        if (!activeBranchId) return;

        // Real-time subscription for reactive UI
        const channel = supabase
            .channel('stock_transfers_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'stock_transfers' 
            }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.transfers.all });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeBranchId, queryClient]);

    return { 
        transfers: transfersQuery.data ?? [], 
        loading: transfersQuery.isLoading, 
        refresh: () => queryClient.invalidateQueries({ queryKey: queryKeys.transfers.list(activeBranchId) }),
        createTransfer: createTransferMutation.mutateAsync,
        updateStatus: updateStatusMutation.mutateAsync,
        isCreating: createTransferMutation.isPending,
        isUpdating: updateStatusMutation.isPending,
        error: transfersQuery.error
    };
}
