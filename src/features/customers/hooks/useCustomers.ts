import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerService } from '../services/customerService';
import type { CustomerInsert, CustomerUpdate } from '../../../shared/types';
import { toast } from 'sonner';

import { useBranch } from '../../../shared/lib/BranchContext';

export const useCustomers = () => {
    const queryClient = useQueryClient();
    const { activeBranchId } = useBranch();

    const customersQuery = useQuery({
        queryKey: ['customers', activeBranchId],
        queryFn: () => customerService.getAll(activeBranchId),
    });

    const createCustomerMutation = useMutation({
        mutationFn: (newCustomer: CustomerInsert) => customerService.create(newCustomer),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success('Customer created successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to create customer: ${error.message}`);
        },
    });

    const updateCustomerMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: CustomerUpdate }) =>
            customerService.update(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success('Customer updated successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to update customer: ${error.message}`);
        },
    });

    const deleteCustomerMutation = useMutation({
        mutationFn: (id: string) => customerService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success('Customer deleted successfully');
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete customer: ${error.message}`);
        },
    });

    return {
        customers: customersQuery.data ?? [],
        isLoading: customersQuery.isLoading,
        error: customersQuery.error,
        createCustomer: createCustomerMutation.mutateAsync,
        updateCustomer: updateCustomerMutation.mutateAsync,
        deleteCustomer: deleteCustomerMutation.mutateAsync,
        isCreating: createCustomerMutation.isPending,
        isUpdating: updateCustomerMutation.isPending,
        isDeleting: deleteCustomerMutation.isPending,
    };
};
