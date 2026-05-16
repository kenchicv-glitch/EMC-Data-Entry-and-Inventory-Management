import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCashDenomByDayId, batchUpsertCashDenoms } from '../services/dscCashDenomService';
import { dscKeys } from './useDscDay';

export function useDscCashDenom(dayId: string) {
  return useQuery({
    queryKey: dscKeys.cashDenom(dayId),
    queryFn: () => getCashDenomByDayId(dayId),
    enabled: Boolean(dayId),
  });
}

export function useBatchUpsertCashDenom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, items }: {
      dayId: string;
      items: Array<{ denomination: number; count: number }>;
    }) => batchUpsertCashDenoms(dayId, items),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: dscKeys.cashDenom(vars.dayId) });
      toast.success('Cash denominations saved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to save denominations: ${err.message}`);
    },
  });
}
