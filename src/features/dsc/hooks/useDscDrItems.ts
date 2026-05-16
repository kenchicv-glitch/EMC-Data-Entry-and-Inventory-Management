import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getDrItemsByDayId, batchUpsertDrItems, deleteDrItem } from '../services/dscDrService';
import { dscKeys } from './useDscDay';

export function useDscDrItems(dayId: string) {
  return useQuery({
    queryKey: dscKeys.drItems(dayId),
    queryFn: () => getDrItemsByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertDrItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Parameters<typeof batchUpsertDrItems>[1];
    }) => batchUpsertDrItems(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.drItems(vars.dayId) });
      toast.success('Delivery receipts saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save DR items: ${err.message}`);
    },
  });
}

export function useDeleteDrItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDrItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
