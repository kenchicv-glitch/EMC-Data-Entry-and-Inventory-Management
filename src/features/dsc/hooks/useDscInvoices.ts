import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getInvoicesByDayId, batchUpsertInvoices, deleteInvoiceItem } from '../services/dscInvoiceService';
import { dscKeys } from './useDscDay';

export function useDscInvoices(dayId: string, series: 'A' | 'B') {
  return useQuery({
    queryKey: dscKeys.invoices(dayId, series),
    queryFn: () => getInvoicesByDayId(dayId, series),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, series, items }: {
      dayId: string;
      series: 'A' | 'B';
      items: Parameters<typeof batchUpsertInvoices>[2];
    }) => batchUpsertInvoices(dayId, series, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.invoices(vars.dayId, vars.series) });
      toast.success(`Invoice Series ${vars.series} saved`);
    },
    onError: (err: Error) => {
      toast.error(`Failed to save invoices: ${err.message}`);
    },
  });
}

export function useDeleteInvoiceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInvoiceItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });
}
