import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseService } from '../services/purchaseService';
import type { Purchase } from '../../../shared/types';
import { useBranch } from '../../../shared/hooks/useBranch';
import { queryKeys } from '../../../shared/lib/queryKeys';
import { supabase } from '../../../shared/lib/supabase';
import { useEffect } from 'react';
import { startOfMonth } from 'date-fns';

export const usePurchases = (startDate?: string) => {
    const queryClient = useQueryClient();
    const { activeBranchId } = useBranch();

    const effectiveStartDate = startDate ?? startOfMonth(new Date()).toISOString();

    const purchasesQuery = useQuery({
        queryKey: queryKeys.purchases.list(activeBranchId, effectiveStartDate),
        queryFn: () => purchaseService.getAll(activeBranchId, effectiveStartDate),
    });

    const returnsQuery = useQuery({
        queryKey: queryKeys.purchases.returns(activeBranchId),
        queryFn: () => purchaseService.getReturns(activeBranchId),
    });

    const createPurchasesMutation = useMutation({
        mutationFn: (newPurchases: Omit<Purchase, 'id' | 'products'>[]) => purchaseService.create(newPurchases),
        onMutate: async (newPurchases) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.purchases.list(activeBranchId) });
            const previousPurchases = queryClient.getQueryData<Purchase[]>(queryKeys.purchases.list(activeBranchId));

            if (previousPurchases) {
                const optimisticPurchase: Purchase = {
                    id: crypto.randomUUID(),
                    invoice_number: newPurchases[0]?.invoice_number || 'PENDING',
                    created_at: new Date().toISOString(),
                    total_amount: newPurchases.reduce((sum, item) => sum + (item.total_price || 0), 0),
                    status: 'received',
                    branch_id: activeBranchId || '',
                    items: newPurchases.map(item => ({
                        id: crypto.randomUUID(),
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: item.total_price
                    })) as any
                } as any;

                queryClient.setQueryData<Purchase[]>(queryKeys.purchases.list(activeBranchId), [optimisticPurchase, ...previousPurchases]);
            }

            return { previousPurchases };
        },
        onError: (_err, _newPurchases, context) => {
            if (context?.previousPurchases) {
                queryClient.setQueryData(queryKeys.purchases.list(activeBranchId), context.previousPurchases);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        },
    });

    const updatePurchasesMutation = useMutation({
        mutationFn: ({ invoiceNumber, purchase }: { invoiceNumber: string; purchase: Partial<Omit<Purchase, 'id' | 'invoice_number' | 'products'>> }) =>
            purchaseService.updateByInvoice(invoiceNumber, purchase),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all });
        },
    });

    const deletePurchasesMutation = useMutation({
        mutationFn: (invoiceNumber: string) => purchaseService.deleteByInvoice(invoiceNumber),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        },
    });

    useEffect(() => {
        if (!activeBranchId) return;

        const channel = supabase
            .channel('purchases_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'purchases' 
            }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all });
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeBranchId, queryClient]);

    useEffect(() => {
        if (!activeBranchId) return;

        const channel = supabase
            .channel('purchases_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'purchases' 
            }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all });
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeBranchId, queryClient]);

    return {
        purchases: purchasesQuery.data ?? [],
        returns: returnsQuery.data ?? [],
        isLoading: purchasesQuery.isLoading || returnsQuery.isLoading,
        error: purchasesQuery.error || returnsQuery.error,
        createPurchases: createPurchasesMutation.mutateAsync,
        updatePurchases: updatePurchasesMutation.mutateAsync,
        deletePurchases: deletePurchasesMutation.mutateAsync,
        markPurchaseAsReceived: (invoiceNumber: string) => 
            updatePurchasesMutation.mutateAsync({ 
                invoiceNumber, 
                purchase: { status: 'received', received_date: new Date().toISOString() } 
            }),
        markPurchaseAsPaid: (invoiceNumber: string) => 
            updatePurchasesMutation.mutateAsync({ 
                invoiceNumber, 
                purchase: { payment_status: 'paid', payment_date: new Date().toISOString() } 
            }),
        fetchPurchases: (invalidate: boolean = false) => {
            if (invalidate) {
                queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all });
            }
            return purchasesQuery.refetch();
        },
        isAdding: createPurchasesMutation.isPending,
        isUpdating: updatePurchasesMutation.isPending,
        isDeleting: deletePurchasesMutation.isPending,
    };
};
