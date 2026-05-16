import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getExpensesByDayId, batchUpsertExpenses, deleteExpense } from '../services/dscExpenseService';
import { dscKeys } from './useDscDay';

export function useDscExpenses(dayId: string) {
  return useQuery({
    queryKey: dscKeys.expenses(dayId),
    queryFn: () => getExpensesByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertExpenses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Parameters<typeof batchUpsertExpenses>[1];
    }) => batchUpsertExpenses(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.expenses(vars.dayId) });
      toast.success('Expenses saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save expenses: ${err.message}`);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
