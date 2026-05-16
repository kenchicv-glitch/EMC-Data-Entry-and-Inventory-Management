import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getReturnsByDayId, batchUpsertReturns, deleteReturn } from '../services/dscReturnService';
import { dscKeys } from './useDscDay';

export function useDscReturns(dayId: string) {
  return useQuery({
    queryKey: dscKeys.returns(dayId),
    queryFn: () => getReturnsByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertReturns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Parameters<typeof batchUpsertReturns>[1];
    }) => batchUpsertReturns(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.returns(vars.dayId) });
      toast.success('Returns saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save returns: ${err.message}`);
    },
  });
}

export function useDeleteReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteReturn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
