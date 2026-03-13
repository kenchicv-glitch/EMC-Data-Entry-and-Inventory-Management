import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supplierService } from '../services/supplierService';
import type { SupplierInsert, SupplierUpdate } from '../../../shared/types';
import { toast } from 'sonner';

import { useBranch } from '../../../shared/lib/BranchContext';

export const useSuppliers = () => {
    const queryClient = useQueryClient();
    const { activeBranchId } = useBranch();

    const suppliersQuery = useQuery({
        queryKey: ['suppliers', activeBranchId],
        queryFn: () => supplierService.getAll(activeBranchId),
    });

    const createSupplierMutation = useMutation({
        mutationFn: (newSupplier: SupplierInsert) => supplierService.create(newSupplier),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Supplier created successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to create supplier: ${error.message}`);
        },
    });

    const updateSupplierMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: SupplierUpdate }) =>
            supplierService.update(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Supplier updated successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to update supplier: ${error.message}`);
        },
    });

    const deleteSupplierMutation = useMutation({
        mutationFn: (id: string) => supplierService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Supplier deleted successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete supplier: ${error.message}`);
        },
    });

    return {
        suppliers: suppliersQuery.data ?? [],
        isLoading: suppliersQuery.isLoading,
        error: suppliersQuery.error,
        createSupplier: createSupplierMutation.mutateAsync,
        updateSupplier: updateSupplierMutation.mutateAsync,
        deleteSupplier: deleteSupplierMutation.mutateAsync,
        isCreating: createSupplierMutation.isPending,
        isUpdating: updateSupplierMutation.isPending,
        isDeleting: deleteSupplierMutation.isPending,
    };
};
