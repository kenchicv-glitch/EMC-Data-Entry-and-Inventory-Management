import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCollectionsByDayId, batchUpsertCollections, deleteCollection } from '../services/dscCollectionService';
import { dscKeys } from './useDscDay';

export function useDscCollections(dayId: string) {
  return useQuery({
    queryKey: dscKeys.collections(dayId),
    queryFn: () => getCollectionsByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertCollections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Parameters<typeof batchUpsertCollections>[1];
    }) => batchUpsertCollections(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.collections(vars.dayId) });
      toast.success('Collections saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save collections: ${err.message}`);
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
