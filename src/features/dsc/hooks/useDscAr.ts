import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getArEntriesByDayId, batchUpsertArEntries, deleteArEntry } from '../services/dscArService';
import { dscKeys } from './useDscDay';

export function useDscAr(dayId: string) {
  return useQuery({
    queryKey: dscKeys.ar(dayId),
    queryFn: () => getArEntriesByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertAr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Parameters<typeof batchUpsertArEntries>[1];
    }) => batchUpsertArEntries(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.ar(vars.dayId) });
      toast.success('AR entries saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save AR entries: ${err.message}`);
    },
  });
}

export function useDeleteArEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteArEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
