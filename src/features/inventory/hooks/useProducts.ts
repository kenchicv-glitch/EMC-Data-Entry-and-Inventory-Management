import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services/productService';
import type { Product } from '../../../shared/types';
import { supabase } from '../../../shared/lib/supabase';
import { useBranch } from '../../../shared/hooks/useBranch';
import { queryKeys } from '../../../shared/lib/queryKeys';
import { useEffect } from 'react';
import type { RawProductData } from '../../../shared/lib/ExcelImportService';
import { toast } from 'sonner';

export const useProducts = () => {
    const queryClient = useQueryClient();
    const { activeBranchId } = useBranch();

    const productsQuery = useQuery({
        queryKey: queryKeys.products.list(activeBranchId),
        queryFn: () => productService.getAll(activeBranchId),
        enabled: !!activeBranchId,
    });

    const movementsQuery = useQuery({
        queryKey: [...queryKeys.products.all, 'movements', { activeBranchId }],
        queryFn: () => productService.getMovements(activeBranchId),
        enabled: !!activeBranchId,
    });

    const choicesQuery = useQuery({
        queryKey: [...queryKeys.products.all, 'choices', { activeBranchId }],
        queryFn: () => productService.getCategoryChoices(activeBranchId),
        enabled: !!activeBranchId,
    });

    const createProductMutation = useMutation({
        mutationFn: (newProduct: Omit<Product, 'id' | 'created_at'>) => productService.create(newProduct),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            toast.success('Product created successfully');
        },
    });

    const updateProductMutation = useMutation({
        mutationFn: ({ id, product }: { id: string; product: Partial<Omit<Product, 'id' | 'created_at'>> }) =>
            productService.update(id, product),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            toast.success('Product updated successfully');
        },
    });

    const deleteProductMutation = useMutation({
        mutationFn: (id: string) => productService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            toast.success('Product deleted successfully');
        },
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: (pattern: string) => productService.bulkDelete(activeBranchId, pattern),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            toast.success('Bulk delete successful');
        },
    });

    const importProductsMutation = useMutation({
        mutationFn: (productsToUpsert: RawProductData[]) => productService.importProducts(activeBranchId, productsToUpsert),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            toast.success('Products imported successfully');
        },
    });

    const renameCategoryMutation = useMutation({
        mutationFn: ({ currentName, newName, level }: { currentName: string; newName: string; level: 1 | 2 | 3 }) =>
            productService.renameCategory(activeBranchId, currentName, newName, level),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            toast.success('Category renamed successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to rename category: ${error.message}`);
        },
    });

    useEffect(() => {
        if (!activeBranchId) return;

        const channel = supabase
            .channel('products_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'products' 
            }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeBranchId, queryClient]);

    return {
        products: productsQuery.data ?? [],
        movements: movementsQuery.data ?? {},
        isLoading: productsQuery.isLoading || movementsQuery.isLoading,
        error: productsQuery.error || movementsQuery.error,
        createProduct: createProductMutation.mutateAsync,
        updateProduct: updateProductMutation.mutateAsync,
        deleteProduct: deleteProductMutation.mutateAsync,
        bulkDelete: bulkDeleteMutation.mutateAsync,
        importProducts: importProductsMutation.mutateAsync,
        renameCategory: renameCategoryMutation.mutateAsync,
        isAdding: createProductMutation.isPending,
        isUpdating: updateProductMutation.isPending,
        isDeleting: deleteProductMutation.isPending,
        isImporting: importProductsMutation.isPending,
        isBulkDeleting: bulkDeleteMutation.isPending,
        isRenaming: renameCategoryMutation.isPending,
        refresh: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        },
        choices: choicesQuery.data || { l1s: [], l2s: [], l3s: [] },
        isChoicesLoading: choicesQuery.isLoading
    };
};
