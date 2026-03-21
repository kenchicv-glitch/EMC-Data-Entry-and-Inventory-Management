import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../shared/lib/supabase';
import { queryKeys } from '../../../shared/lib/queryKeys';
import { ReportService } from '../../reports/services/reportService';
import type { InventorySnap } from '../../reports/services/reportService';
import { startOfDay, endOfDay } from 'date-fns';

export function useInventoryReport(selectedDate: Date, branchId: string | null) {
    return useQuery({
        queryKey: queryKeys.reports.inventory(selectedDate.toISOString(), branchId),
        queryFn: async (): Promise<InventorySnap[]> => {
            if (!branchId) return [];

            const targetStart = startOfDay(selectedDate);
            const targetEnd = endOfDay(selectedDate);
            const isoTargetStart = targetStart.toISOString();
            const isoTargetEnd = targetEnd.toISOString();
            const afterStr = targetEnd.toISOString();

            // 1. Get ALL products
            const { data: products } = await supabase
                .from('products')
                .select('id, name, sku, stock_available, low_stock_threshold, selling_price')
                .eq('branch_id', branchId);

            if (!products) return [];

            // 2. Fetch ALL movements after the target date
            const [salesAfter, purchasesAfter, returnsAfter, refundsAfter, adjustmentsAfter, transfersAfter] = await Promise.all([
                supabase.from('sales').select('product_id, quantity, date').eq('branch_id', branchId).gt('date', afterStr),
                supabase.from('purchases').select('product_id, quantity, date').eq('branch_id', branchId).eq('status', 'received').gt('date', afterStr),
                supabase.from('supplier_returns').select('product_id, quantity, date').eq('branch_id', branchId).gt('date', afterStr),
                supabase.from('customer_refunds').select('product_id, quantity, date').eq('branch_id', branchId).gt('date', afterStr),
                supabase.from('inventory_adjustments').select('product_id, difference, created_at').eq('branch_id', branchId).gt('created_at', afterStr),
                supabase.from('stock_transfers')
                    .select('*')
                    .or(`source_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`)
                    .neq('status', 'cancelled')
                    .or(`shipped_at.gt.${afterStr},received_at.gt.${afterStr}`)
            ]);

            // 3. Fetch movements FOR THE TARGET DATE
            const [dSales, dPurchases, dReturns, dRefunds, dAdjustments, dTransfers] = await Promise.all([
                supabase.from('sales').select('product_id, quantity').eq('branch_id', branchId).gte('date', isoTargetStart).lte('date', isoTargetEnd),
                supabase.from('purchases').select('product_id, quantity, purchase_type, branches:source_branch_id(name)').eq('branch_id', branchId).eq('status', 'received').gte('date', isoTargetStart).lte('date', isoTargetEnd),
                supabase.from('supplier_returns').select('product_id, quantity').eq('branch_id', branchId).gte('date', isoTargetStart).lte('date', isoTargetEnd),
                supabase.from('customer_refunds').select('product_id, quantity').eq('branch_id', branchId).gte('date', isoTargetStart).lte('date', isoTargetEnd),
                supabase.from('inventory_adjustments').select('product_id, difference').eq('branch_id', branchId).gte('created_at', isoTargetStart).lte('created_at', isoTargetEnd),
                supabase.from('stock_transfers')
                    .select('*')
                    .or(`source_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`)
                    .neq('status', 'cancelled')
                    .or(`shipped_at.gte.${isoTargetStart},shipped_at.lte.${isoTargetEnd},received_at.gte.${isoTargetStart},received_at.lte.${isoTargetEnd}`)
            ]);

            return ReportService.calculateHistoricalStock({
                products,
                salesAfter: salesAfter.data || [],
                purchasesAfter: purchasesAfter.data || [],
                returnsAfter: returnsAfter.data || [],
                refundsAfter: refundsAfter.data || [],
                adjustmentsAfter: adjustmentsAfter.data || [],
                transfersAfter: transfersAfter.data || [],
                dSales: dSales.data || [],
                dPurchases: dPurchases.data || [],
                dReturns: dReturns.data || [],
                dRefunds: dRefunds.data || [],
                dAdjustments: dAdjustments.data || [],
                dTransfers: dTransfers.data || [],
                branchId,
                afterStr,
                isoTargetStart,
                isoTargetEnd
            });
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: !!branchId
    });
}
