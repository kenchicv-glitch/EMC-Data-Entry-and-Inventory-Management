import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    getAllCategories,
    getCategoryTree,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryProductCounts,
} from '../services/categoryService';


export const categoryKeys = {
    all:    ['inventory', 'categories'] as const,
    tree:   () => ['inventory', 'categories', 'tree'] as const,
    counts: (branchId: string | null) => ['inventory', 'categories', 'counts', branchId] as const,
};

export function useCategories() {
    return useQuery({
        queryKey: categoryKeys.all,
        queryFn:  getAllCategories,
    });
}

export function useCategoryTree() {
    return useQuery({
        queryKey: categoryKeys.tree(),
        queryFn:  getCategoryTree,
    });
}

export function useCategoryProductCounts(branchId: string | null) {
    return useQuery({
        queryKey: categoryKeys.counts(branchId),
        queryFn:  () => getCategoryProductCounts(branchId),
        enabled:  Boolean(branchId),
    });
}

export function useCreateCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createCategory,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: categoryKeys.all });
            toast.success('Category created');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useUpdateCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCategory>[1] }) =>
            updateCategory(id, input),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: categoryKeys.all });
            toast.success('Category updated');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useDeleteCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteCategory,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: categoryKeys.all });
            toast.success('Category deleted');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}
