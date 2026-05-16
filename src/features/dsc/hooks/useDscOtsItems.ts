import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getOtsItemsByDayId, batchUpsertOtsItems, deleteOtsItem } from '../services/dscOtsService';
import { dscKeys } from './useDscDay';

export function useDscOtsItems(dayId: string) {
  return useQuery({
    queryKey: dscKeys.otsItems(dayId),
    queryFn: () => getOtsItemsByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertOtsItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Parameters<typeof batchUpsertOtsItems>[1];
    }) => batchUpsertOtsItems(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.otsItems(vars.dayId) });
      toast.success('OTS items saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save OTS items: ${err.message}`);
    },
  });
}

export function useDeleteOtsItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteOtsItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
