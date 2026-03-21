import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../shared/lib/supabase';
import { useBranch } from '../../../shared/hooks/useBranch';
import { queryKeys } from '../../../shared/lib/queryKeys';
import { ReportService } from '../services/reportService';
import type { TaxMetrics } from '../services/reportService';
import { useMemo } from 'react';

export interface TaxDateRange {
    start: string;
    end: string;
}

export const useTaxData = (dateRange: TaxDateRange) => {
    const { activeBranchId } = useBranch();

    // Fetch Sales for the period
    const salesQuery = useQuery({
        queryKey: queryKeys.sales.tax(dateRange, activeBranchId),
        queryFn: async () => {
            let query = supabase
                .from('sales')
                .select('*')
                .gte('date', `${dateRange.start}T00:00:00`)
                .lte('date', `${dateRange.end}T23:59:59`);
            
            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000 // 5 minutes
    });

    // Fetch Purchases for the period
    const purchasesQuery = useQuery({
        queryKey: queryKeys.purchases.tax(dateRange, activeBranchId),
        queryFn: async () => {
            let query = supabase
                .from('purchases')
                .select('*')
                .gte('date', `${dateRange.start}T00:00:00`)
                .lte('date', `${dateRange.end}T23:59:59`);
            
            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000 // 5 minutes
    });

    const metrics = useMemo((): TaxMetrics => {
        return ReportService.calculateTaxMetrics(salesQuery.data || [], purchasesQuery.data || []);
    }, [salesQuery.data, purchasesQuery.data]);

    return {
        metrics,
        sales: salesQuery.data ?? [],
        purchases: purchasesQuery.data ?? [],
        isLoading: salesQuery.isLoading || purchasesQuery.isLoading,
        error: salesQuery.error || purchasesQuery.error,
        refetch: () => {
            salesQuery.refetch();
            purchasesQuery.refetch();
        }
    };
};
