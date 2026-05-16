import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSiSummariesByDayId, batchUpsertSiSummaries, deleteSiSummary } from '../services/dscSiSummaryService';
import { dscKeys } from './useDscDay';

export function useDscSiSummary(dayId: string) {
  return useQuery({
    queryKey: dscKeys.siSummary(dayId),
    queryFn: () => getSiSummariesByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertSiSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Parameters<typeof batchUpsertSiSummaries>[1];
    }) => batchUpsertSiSummaries(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.siSummary(vars.dayId) });
      toast.success('SI summaries saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save SI summaries: ${err.message}`);
    },
  });
}

export function useDeleteSiSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSiSummary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
