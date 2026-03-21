import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../shared/lib/supabase';
import { useBranch } from '../../../shared/hooks/useBranch';
import { queryKeys } from '../../../shared/lib/queryKeys';
import { ReportService } from '../services/reportService';
import type { ProfitMetrics, CategoryProfit } from '../services/reportService';
import { useMemo } from 'react';

export interface ProfitDateRange {
    start: string;
    end: string;
}

/**
 * useProfitData: Fetches and calculates profit-related metrics and category performance.
 * Supports date range and optional branch filtering.
 */
// Default includeVat is now false as requested by the user
export const useProfitData = (dateRange: ProfitDateRange, branchIdOverride?: string | null, includeVat: boolean = false) => {
    const { activeBranchId } = useBranch();
    
    // Use override if provided (even if null), otherwise fallback to active branch
    const branchId = branchIdOverride !== undefined ? branchIdOverride : activeBranchId;

    // Fetch Sales for the period (including cost_price for profit calculation)
    const salesQuery = useQuery({
        queryKey: queryKeys.sales.profit(dateRange, branchId),
        queryFn: async () => {
            let query = supabase
                .from('sales')
                .select('total_price, quantity, vat_amount, discount_amount, date, cost_price, products(name)')
                .gte('date', `${dateRange.start}T00:00:00`)
                .lte('date', `${dateRange.end}T23:59:59`);
            
            if (branchId) {
                query = query.eq('branch_id', branchId);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000 // 5 minutes standard stale time
    });

    // Fetch Expenses for the period
    const expensesQuery = useQuery({
        queryKey: queryKeys.expenses.profit(dateRange, branchId),
        queryFn: async () => {
            let query = supabase
                .from('expenses')
                .select('amount, date')
                .gte('date', `${dateRange.start}T00:00:00`)
                .lte('date', `${dateRange.end}T23:59:59`);
            
            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000
    });

    // Fetch Refunds for the period
    const refundsQuery = useQuery({
        queryKey: ['refunds', 'profit', dateRange, branchId],
        queryFn: async () => {
            let query = supabase
                .from('customer_refunds')
                .select('total_price, quantity, vat_amount, discount_amount, date, products(name)')
                .gte('date', `${dateRange.start}T00:00:00`)
                .lte('date', `${dateRange.end}T23:59:59`);
            
            if (branchId) query = query.eq('branch_id', branchId);
            
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000
    });

    // Fetch Supplier Returns for the period (to adjust COGS)
    const returnsQuery = useQuery({
        queryKey: ['returns', 'profit', dateRange, branchId],
        queryFn: async () => {
            let query = supabase
                .from('supplier_returns')
                .select('quantity, unit_price, date')
                .gte('date', `${dateRange.start}T00:00:00`)
                .lte('date', `${dateRange.end}T23:59:59`);
            
            if (branchId) query = query.eq('branch_id', branchId);
            
            const { data, error } = await query;
            if (error) throw error;
            // Map unit_price to cost_price for the service
            return (data || []).map(r => ({ ...r, cost_price: r.unit_price }));
        },
        staleTime: 5 * 60 * 1000
    });

    // Pre-calculate aggregated metrics
    const metrics = useMemo((): ProfitMetrics => {
        return ReportService.calculateProfitMetrics(
            salesQuery.data || [], 
            expensesQuery.data || [], 
            refundsQuery.data || [],
            returnsQuery.data || [],
            includeVat
        );
    }, [salesQuery.data, expensesQuery.data, refundsQuery.data, returnsQuery.data, includeVat]);

    // Pre-calculate category breakdown
    const categoryData = useMemo((): CategoryProfit[] => {
        return ReportService.calculateCategoryProfit(
            salesQuery.data || [], 
            refundsQuery.data || [],
            includeVat
        );
    }, [salesQuery.data, refundsQuery.data, includeVat]);

    return {
        metrics,
        categoryData,
        sales: salesQuery.data ?? [],
        expenses: expensesQuery.data ?? [],
        isLoading: salesQuery.isLoading || expensesQuery.isLoading || refundsQuery.isLoading || returnsQuery.isLoading,
        error: salesQuery.error || expensesQuery.error || refundsQuery.error || returnsQuery.error,
        refetch: () => {
            salesQuery.refetch();
            expensesQuery.refetch();
            refundsQuery.refetch();
            returnsQuery.refetch();
        }
    };
};
