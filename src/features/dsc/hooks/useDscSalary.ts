import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSalaryEntriesByDayId, batchUpsertSalaryEntries, deleteSalaryEntry } from '../services/dscSalaryService';
import { dscKeys } from './useDscDay';

export function useDscSalary(dayId: string) {
  return useQuery({
    queryKey: dscKeys.salary(dayId),
    queryFn: () => getSalaryEntriesByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Parameters<typeof batchUpsertSalaryEntries>[1];
    }) => batchUpsertSalaryEntries(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.salary(vars.dayId) });
      toast.success('Salary entries saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save salary entries: ${err.message}`);
    },
  });
}

export function useDeleteSalaryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSalaryEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
