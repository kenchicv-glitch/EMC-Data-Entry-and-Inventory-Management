import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPurchasesByDayId, batchUpsertPurchases, deletePurchaseItem } from '../services/dscPurchaseService';
import { dscKeys } from './useDscDay';

export function useDscPurchases(dayId: string) {
  return useQuery({
    queryKey: dscKeys.purchases(dayId),
    queryFn: () => getPurchasesByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertPurchases() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Parameters<typeof batchUpsertPurchases>[1];
    }) => batchUpsertPurchases(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.purchases(vars.dayId) });
      toast.success('Purchases saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save purchases: ${err.message}`);
    },
  });
}

export function useDeletePurchaseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePurchaseItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
