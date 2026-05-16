import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getDscDay, getDscDaysForMonth, createDscDay, updateDscDay } from '../services/dscDayService';

// Query key factory for all DSC entities
export const dscKeys = {
  all: ['dsc'] as const,
  day: (date: string, branchId: string) => ['dsc', 'day', date, branchId] as const,
  daysMonth: (year: number, month: number, branchId: string) =>
    ['dsc', 'daysMonth', year, month, branchId] as const,
  purchases: (dayId: string) => ['dsc', 'purchases', dayId] as const,
  invoices: (dayId: string, series: 'A' | 'B') => ['dsc', 'invoices', dayId, series] as const,
  drItems: (dayId: string) => ['dsc', 'dr', dayId] as const,
  otsItems: (dayId: string) => ['dsc', 'ots', dayId] as const,
  salary: (dayId: string) => ['dsc', 'salary', dayId] as const,
  expenses: (dayId: string) => ['dsc', 'expenses', dayId] as const,
  returns: (dayId: string) => ['dsc', 'returns', dayId] as const,
  ar: (dayId: string) => ['dsc', 'ar', dayId] as const,
  collections: (dayId: string) => ['dsc', 'collections', dayId] as const,
  cashDenom: (dayId: string) => ['dsc', 'cashDenom', dayId] as const,
  siSummary: (dayId: string) => ['dsc', 'siSummary', dayId] as const,
  monthly: (year: number, month: number, branchId: string) =>
    ['dsc', 'monthly', year, month, branchId] as const,
};

export function useDscDay(date: string, branchId: string) {
  return useQuery({
    queryKey: dscKeys.day(date, branchId),
    queryFn: () => getDscDay(date, branchId),
    enabled: Boolean(date && branchId),
  });
}

export function useDscDaysForMonth(year: number, month: number, branchId: string) {
  return useQuery({
    queryKey: dscKeys.daysMonth(year, month, branchId),
    queryFn: () => getDscDaysForMonth(year, month, branchId),
    enabled: Boolean(year && month && branchId),
  });
}

export function useCreateDscDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, branchId, createdBy }: {
      date: string; branchId: string; createdBy: string;
    }) => createDscDay(date, branchId, createdBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
      toast.success('Day opened successfully');
    },
    onError: (err: Error) => {
      toast.error(`Failed to open day: ${err.message}`);
    },
  });
}

export function useUpdateDscDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string; updates: Parameters<typeof updateDscDay>[1];
    }) => updateDscDay(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dscKeys.all });
      toast.success('Day updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update day: ${err.message}`);
    },
  });
}
