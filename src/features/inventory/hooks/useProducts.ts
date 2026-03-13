import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services/productService';
import type { Product } from '../../../shared/types';

export const useProducts = () => {
    const queryClient = useQueryClient();

    const productsQuery = useQuery({
        queryKey: ['products'],
        queryFn: productService.getAll,
    });

    const createProductMutation = useMutation({
        mutationFn: (newProduct: Omit<Product, 'id' | 'created_at'>) => productService.create(newProduct),
        onMutate: async (newProduct) => {
            await queryClient.cancelQueries({ queryKey: ['products'] });
            const previousProducts = queryClient.getQueryData<Product[]>(['products']);
            if (previousProducts) {
                const optimisticProduct: Product = {
                    ...newProduct,
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString(),
                } as Product;
                queryClient.setQueryData<Product[]>(['products'], [...previousProducts, optimisticProduct]);
            }
            return { previousProducts };
        },
        onError: (_err, _newProduct, context) => {
            if (context?.previousProducts) {
                queryClient.setQueryData(['products'], context.previousProducts);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    const updateProductMutation = useMutation({
        mutationFn: ({ id, product }: { id: string; product: Partial<Omit<Product, 'id' | 'created_at'>> }) =>
            productService.update(id, product),
        onMutate: async ({ id, product }) => {
            await queryClient.cancelQueries({ queryKey: ['products'] });
            const previousProducts = queryClient.getQueryData<Product[]>(['products']);
            if (previousProducts) {
                queryClient.setQueryData<Product[]>(
                    ['products'],
                    previousProducts.map((p) => (p.id === id ? { ...p, ...product } : p))
                );
            }
            return { previousProducts };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousProducts) {
                queryClient.setQueryData(['products'], context.previousProducts);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    const deleteProductMutation = useMutation({
        mutationFn: (id: string) => productService.delete(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['products'] });
            const previousProducts = queryClient.getQueryData<Product[]>(['products']);
            if (previousProducts) {
                queryClient.setQueryData<Product[]>(
                    ['products'],
                    previousProducts.filter((p) => p.id !== id)
                );
            }
            return { previousProducts };
        },
        onError: (_err, _id, context) => {
            if (context?.previousProducts) {
                queryClient.setQueryData(['products'], context.previousProducts);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    return {
        products: productsQuery.data ?? [],
        isLoading: productsQuery.isLoading,
        error: productsQuery.error,
        createProduct: createProductMutation.mutateAsync,
        updateProduct: updateProductMutation.mutateAsync,
        deleteProduct: deleteProductMutation.mutateAsync,
        isAdding: createProductMutation.isPending,
        isUpdating: updateProductMutation.isPending,
        isDeleting: deleteProductMutation.isPending,
    };
};
