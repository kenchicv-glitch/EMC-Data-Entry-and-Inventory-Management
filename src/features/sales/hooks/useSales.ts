import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesService } from '../services/salesService';
import type { Sale } from '../../../shared/types';

export const useSales = () => {
    const queryClient = useQueryClient();

    const salesQuery = useQuery({
        queryKey: ['sales'],
        queryFn: salesService.getAll,
    });

    const refundsQuery = useQuery({
        queryKey: ['refunds'],
        queryFn: salesService.getRefunds,
    });

    const createSalesMutation = useMutation({
        mutationFn: (newSales: Omit<Sale, 'id' | 'products'>[]) => salesService.create(newSales),
        onMutate: async (newSales) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['sales'] });

            // Snapshot the previous value
            const previousSales = queryClient.getQueryData<Sale[]>(['sales']);

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

                queryClient.setQueryData<Sale[]>(['sales'], [optimisticSale, ...previousSales]);
            }

            return { previousSales };
        },
        onError: (_err, _newSales, context) => {
            if (context?.previousSales) {
                queryClient.setQueryData(['sales'], context.previousSales);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    const updateSalesMutation = useMutation({
        mutationFn: ({ invoiceNumber, sale }: { invoiceNumber: string; sale: Partial<Omit<Sale, 'id' | 'invoice_number' | 'products'>> }) =>
            salesService.updateByInvoice(invoiceNumber, sale),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] });
        },
    });

    const deleteSalesMutation = useMutation({
        mutationFn: (invoiceNumber: string) => salesService.deleteByInvoice(invoiceNumber),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    return {
        sales: salesQuery.data ?? [],
        refunds: refundsQuery.data ?? [],
        isLoading: salesQuery.isLoading || refundsQuery.isLoading,
        error: salesQuery.error || refundsQuery.error,
        createSales: createSalesMutation.mutateAsync,
        updateSales: updateSalesMutation.mutateAsync,
        deleteSales: deleteSalesMutation.mutateAsync,
        isAdding: createSalesMutation.isPending,
        isUpdating: updateSalesMutation.isPending,
        isDeleting: deleteSalesMutation.isPending,
    };
};
