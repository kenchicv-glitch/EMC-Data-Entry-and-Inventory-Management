import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseService } from '../services/purchaseService';
import type { Purchase } from '../../../shared/types';

export const usePurchases = () => {
    const queryClient = useQueryClient();

    const purchasesQuery = useQuery({
        queryKey: ['purchases'],
        queryFn: purchaseService.getAll,
    });

    const returnsQuery = useQuery({
        queryKey: ['purchase_returns'],
        queryFn: purchaseService.getReturns,
    });

    const createPurchasesMutation = useMutation({
        mutationFn: (newPurchases: Omit<Purchase, 'id' | 'products'>[]) => purchaseService.create(newPurchases),
        onMutate: async (newPurchases) => {
            await queryClient.cancelQueries({ queryKey: ['purchases'] });
            const previousPurchases = queryClient.getQueryData<Purchase[]>(['purchases']);

            if (previousPurchases) {
                const optimisticPurchase: Purchase = {
                    id: crypto.randomUUID(),
                    invoice_number: newPurchases[0]?.invoice_number || 'PENDING',
                    created_at: new Date().toISOString(),
                    total_amount: newPurchases.reduce((sum, item) => sum + (item.total_price || 0), 0),
                    status: 'received',
                    items: newPurchases.map(item => ({
                        id: crypto.randomUUID(),
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: item.total_price
                    })) as any
                } as any;

                queryClient.setQueryData<Purchase[]>(['purchases'], [optimisticPurchase, ...previousPurchases]);
            }

            return { previousPurchases };
        },
        onError: (_err, _newPurchases, context) => {
            if (context?.previousPurchases) {
                queryClient.setQueryData(['purchases'], context.previousPurchases);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    const updatePurchasesMutation = useMutation({
        mutationFn: ({ invoiceNumber, purchase }: { invoiceNumber: string; purchase: Partial<Omit<Purchase, 'id' | 'invoice_number' | 'products'>> }) =>
            purchaseService.updateByInvoice(invoiceNumber, purchase),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
        },
    });

    const deletePurchasesMutation = useMutation({
        mutationFn: (invoiceNumber: string) => purchaseService.deleteByInvoice(invoiceNumber),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    return {
        purchases: purchasesQuery.data ?? [],
        returns: returnsQuery.data ?? [],
        isLoading: purchasesQuery.isLoading || returnsQuery.isLoading,
        error: purchasesQuery.error || returnsQuery.error,
        createPurchases: createPurchasesMutation.mutateAsync,
        updatePurchases: updatePurchasesMutation.mutateAsync,
        deletePurchases: deletePurchasesMutation.mutateAsync,
        isAdding: createPurchasesMutation.isPending,
        isUpdating: updatePurchasesMutation.isPending,
        isDeleting: deletePurchasesMutation.isPending,
    };
};
