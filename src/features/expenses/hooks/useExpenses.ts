import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseService } from '../services/expenseService';
import type { Expense } from '../../../shared/types';
import { useBranch } from '../../../shared/hooks/useBranch';
import { queryKeys } from '../../../shared/lib/queryKeys';

export const useExpenses = () => {
    const queryClient = useQueryClient();
    const { activeBranchId } = useBranch();

    const expensesQuery = useQuery({
        queryKey: queryKeys.expenses.list(activeBranchId),
        queryFn: () => expenseService.getAll(activeBranchId),
    });

    const createExpenseMutation = useMutation({
        mutationFn: (newExpense: Omit<Expense, 'id'>) => expenseService.create(newExpense),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
        },
    });

    const updateExpenseMutation = useMutation({
        mutationFn: ({ id, expense }: { id: string; expense: Partial<Omit<Expense, 'id'>> }) =>
            expenseService.update(id, expense),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
        },
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: (id: string) => expenseService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
        },
    });

    return {
        expenses: expensesQuery.data ?? [],
        isLoading: expensesQuery.isLoading,
        error: expensesQuery.error,
        createExpense: createExpenseMutation.mutateAsync,
        updateExpense: updateExpenseMutation.mutateAsync,
        deleteExpense: deleteExpenseMutation.mutateAsync,
        isAdding: createExpenseMutation.isPending,
        isUpdating: updateExpenseMutation.isPending,
        isDeleting: deleteExpenseMutation.isPending,
    };
};
