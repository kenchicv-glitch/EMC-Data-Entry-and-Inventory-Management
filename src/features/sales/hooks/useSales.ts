import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesService } from '../services/salesService';
import type { Sale } from '../../../shared/types';
import { useBranch } from '../../../shared/hooks/useBranch';
import { queryKeys } from '../../../shared/lib/queryKeys';
import { supabase } from '../../../shared/lib/supabase';
import { useEffect } from 'react';
import { startOfMonth } from 'date-fns';

export const useSales = (startDate?: string) => {
    const queryClient = useQueryClient();
    const { activeBranchId } = useBranch();

    const effectiveStartDate = startDate ?? startOfMonth(new Date()).toISOString();

    const salesQuery = useQuery({
        queryKey: queryKeys.sales.list(activeBranchId, effectiveStartDate),
        queryFn: () => salesService.getAll(activeBranchId, effectiveStartDate),
    });

    const refundsQuery = useQuery({
        queryKey: queryKeys.sales.refunds(activeBranchId),
        queryFn: () => salesService.getRefunds(activeBranchId),
    });

    const createSalesMutation = useMutation({
        mutationFn: (newSales: Omit<Sale, 'id' | 'products'>[]) => salesService.create(newSales),
        onMutate: async (newSales) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: queryKeys.sales.list(activeBranchId) });

            // Snapshot the previous value
            const previousSales = queryClient.getQueryData<Sale[]>(queryKeys.sales.list(activeBranchId));

            // Optimistically update to the new value
            if (previousSales) {
                // Since newSales is an array of items for the same invoice, 
                // we treat them as a single logical sale entry for the purpose of the list
                // For simplicity in the UI, we just invalidate after, but here we can try to prepend
                const optimisticSale: Sale = {
                    id: crypto.randomUUID(),
                    invoice_number: newSales[0]?.invoice_number || 'PENDING',
                    created_at: new Date().toISOString(),
                    total_amount: newSales.reduce((sum, item) => sum + item.total_price, 0),
                    status: 'completed',
                    items: newSales.map(item => ({
                        id: crypto.randomUUID(),
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: item.total_price
                    })) as any
                } as any;

                queryClient.setQueryData<Sale[]>(queryKeys.sales.list(activeBranchId), [optimisticSale, ...previousSales]);
            }

            return { previousSales };
        },
        onError: (_err, _newSales, context) => {
            if (context?.previousSales) {
                queryClient.setQueryData(queryKeys.sales.list(activeBranchId), context.previousSales);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        },
    });

    const updateSalesMutation = useMutation({
        mutationFn: ({ invoiceNumber, sale }: { invoiceNumber: string; sale: Partial<Omit<Sale, 'id' | 'invoice_number' | 'products'>> }) =>
            salesService.updateByInvoice(invoiceNumber, sale),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
        },
    });

    const deleteSalesMutation = useMutation({
        mutationFn: (invoiceNumber: string) => salesService.deleteByInvoice(invoiceNumber),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        },
    });

    useEffect(() => {
        if (!activeBranchId) return;

        const channel = supabase
            .channel('sales_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'sales' 
            }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeBranchId, queryClient]);

    return {
        sales: salesQuery.data ?? [],
        refunds: refundsQuery.data ?? [],
        isLoading: salesQuery.isLoading || refundsQuery.isLoading,
        error: salesQuery.error || refundsQuery.error,
        createSales: createSalesMutation.mutateAsync,
        updateSales: updateSalesMutation.mutateAsync,
        deleteSales: deleteSalesMutation.mutateAsync,
        fetchSales: (invalidate: boolean = false) => {
            if (invalidate) {
                queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
            }
            return salesQuery.refetch();
        },
        isAdding: createSalesMutation.isPending,
        isUpdating: updateSalesMutation.isPending,
        isDeleting: deleteSalesMutation.isPending,
    };
};
