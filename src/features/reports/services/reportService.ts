import { roundTo2 } from '../../../shared/lib/vatUtils';

export interface TaxMetrics {
    vatableSales: number;
    exemptSales: number;
    zeroRatedSales: number;
    outputVat: number;
    inputVat: number;
    grossSales: number;
    netSales: number;
    grossPurchases: number;
    vatPayable: number;
}

export interface ProfitMetrics {
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    netProfit: number;
    totalExpenses: number;
    vatAmount: number;
    totalRefunds: number;
}

export interface CategoryProfit {
    name: string;
    profit: number;
    revenue: number;
}

export interface InventoryStats {
    totalSKUs: number;
    lowStock: number;
    outOfStock: number;
    totalValue: number | null;
    dailyDelta: number;
}

export interface InventorySnap {
    id: string;
    name: string;
    opening: number;
    inwards: number;
    outwards: number;
    returns: number;
    adjustments: number;
    ending: number;
    transfers?: {
        type: 'in' | 'out' | 'in_transit_in' | 'in_transit_out',
        branch_name: string,
        quantity: number
    }[];
}

export interface ReportRow {
    Section?: string;
    Detail?: string;
    Amount?: string | number;
    Info?: string;
    [key: string]: string | number | undefined;
}

export class ReportService {
    /**
     * Calculates BIR-required tax metrics based on sales and purchases dataset
     */
    static calculateTaxMetrics(sales: any[], purchases: any[]): TaxMetrics {
        const vatableSales = sales.filter(s => s.vat_classification === 'vatable');
        const exemptSales = sales.filter(s => s.vat_classification === 'exempt');
        const zeroRatedSales = sales.filter(s => s.vat_classification === 'zero_rated');

        const outputVat = sales.reduce((sum, s) => sum + Number(s.vat_amount || 0), 0);
        const inputVat = purchases.reduce((sum, p) => sum + Number(p.input_vat_amount || 0), 0);

        const grossSales = sales.reduce((sum, s) => sum + Number(s.total_price || 0), 0);
        const netSales = sales.reduce((sum, s) => sum + (Number(s.total_price || 0) - Number(s.vat_amount || 0)), 0);

        const grossPurchases = purchases.reduce((sum, p) => sum + Number(p.total_price || 0), 0);
        const vatPayable = roundTo2(outputVat - inputVat);

        return {
            vatableSales: vatableSales.reduce((sum, s) => sum + Number(s.total_price || 0), 0),
            exemptSales: exemptSales.reduce((sum, s) => sum + Number(s.total_price || 0), 0),
            zeroRatedSales: zeroRatedSales.reduce((sum, s) => sum + Number(s.total_price || 0), 0),
            outputVat,
            inputVat,
            grossSales,
            netSales,
            grossPurchases,
            vatPayable
        };
    }

    /**
     * Calculates high-level profit metrics.
     * @param includeVat - If true, revenue = gross - discounts. If false (default), revenue = gross - vat - discounts.
     */
    static calculateProfitMetrics(
        sales: any[], 
        expenses: any[], 
        refunds: any[] = [], 
        returns: any[] = [],
        includeVat: boolean = false
    ): ProfitMetrics {
        const grossRevenue = sales.reduce((sum, s) => sum + Number(s.total_price || 0), 0);
        const totalVAT = sales.reduce((sum, s) => sum + Number(s.vat_amount || 0), 0);
        const totalDiscounts = sales.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0);
        
        // Revenue calculation based on user preference
        const netRevenueRaw = includeVat 
            ? grossRevenue - totalDiscounts
            : grossRevenue - totalVAT - totalDiscounts;

        const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.total_price || 0), 0);
        const totalRefundVAT = refunds.reduce((sum, r) => sum + Number(r.vat_amount || 0), 0);
        const refundRevenueImpact = includeVat ? totalRefunds : totalRefunds - totalRefundVAT;
        
        const netRevenue = netRevenueRaw - refundRevenueImpact;
        
        // Total COGS: (Sales Qty * Unit Cost) - (Returns Qty * Unit Cost)
        const salesCOGS = sales.reduce((sum, s) => sum + (Number(s.quantity || 0) * Number(s.cost_price || 0)), 0);
        const returnsCOGS = returns.reduce((sum, r) => sum + (Number(r.quantity || 0) * Number(r.cost_price || 0)), 0);
        const totalCOGS = salesCOGS - returnsCOGS;

        const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

        // Gross Profit is Revenue - COGS
        const grossProfit = netRevenue - totalCOGS;
        // Net Profit is Gross Profit - Operating Expenses
        const netProfit = grossProfit - totalExpenses;

        return {
            totalRevenue: netRevenue,
            totalCOGS,
            grossProfit,
            netProfit,
            totalExpenses,
            vatAmount: totalVAT - totalRefundVAT,
            totalRefunds
        };
    }

    /**
     * Groups sales by Master Category and calculates profit distribution
     */
    static calculateCategoryProfit(
        sales: any[], 
        refunds: any[] = [], 
        includeVat: boolean = false
    ): CategoryProfit[] {
        const cats: Record<string, { profit: number; revenue: number }> = {};
        
        const processItems = (items: any[], isRefund: boolean = false) => {
            items.forEach(s => {
                const nameParts = s.products?.name?.split(' > ') || ['Uncategorized'];
                const l1 = nameParts[0] || 'Uncategorized';
                if (!cats[l1]) cats[l1] = { profit: 0, revenue: 0 };
                
                const cost = Number(s.cost_price || 0);
                const vat = Number(s.vat_amount || 0);
                const discount = Number(s.discount_amount || 0);
                const grossRevenue = Number(s.total_price || 0);
                const quantity = Number(s.quantity || 0);

                const rev = includeVat 
                    ? grossRevenue - discount
                    : grossRevenue - vat - discount;
                
                const multi = isRefund ? -1 : 1;
                cats[l1].revenue += (rev * multi);
                cats[l1].profit += ((rev - (quantity * cost)) * multi);
            });
        };

        processItems(sales);
        processItems(refunds, true);

        return Object.entries(cats).map(([name, data]) => ({
            name,
            profit: data.profit,
            revenue: data.revenue
        })).sort((a, b) => b.profit - a.profit);
    }

    /**
     * Calculates inventory dashboard statistics
     */
    static calculateInventoryStats(products: any[], movements: any[], role: string): InventoryStats {
        const dailyDelta = movements.reduce((a, m) => a + (Number(m.purchases || 0) - Number(m.sales || 0) + Number(m.refunds || 0)), 0);
        
        return {
            totalSKUs: products.length,
            lowStock: products.filter(p => p.stock_available > 0 && p.stock_available <= (p.low_stock_threshold || 10)).length,
            outOfStock: products.filter(p => p.stock_available === 0).length,
            totalValue: role === 'owner' ? products.reduce((acc, p) => acc + (p.stock_available * (p.selling_price || 0)), 0) : null,
            dailyDelta
        };
    }

    /**
     * Calculates historical stock levels using "reverse playback" logic
     */
    static calculateHistoricalStock(params: {
        products: any[];
        salesAfter: any[];
        purchasesAfter: any[];
        returnsAfter: any[];
        refundsAfter: any[];
        adjustmentsAfter: any[];
        transfersAfter: any[];
        dSales: any[];
        dPurchases: any[];
        dReturns: any[];
        dRefunds: any[];
        dAdjustments: any[];
        dTransfers: any[];
        branchId: string;
        afterStr: string;
        isoTargetStart: string;
        isoTargetEnd: string;
    }): InventorySnap[] {
        const {
            products, salesAfter, purchasesAfter, returnsAfter, refundsAfter, adjustmentsAfter, transfersAfter,
            dSales, dPurchases, dReturns, dRefunds, dAdjustments, dTransfers,
            branchId, afterStr, isoTargetStart, isoTargetEnd
        } = params;

        return products.map(p => {
            const current = p.stock_available;

            // Adjustments AFTER the target date
            const sAfter = salesAfter?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.quantity || 0), 0) || 0;
            const pAfter = purchasesAfter?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.quantity || 0), 0) || 0;
            
            const tOutAfter = transfersAfter?.filter(t => String(t.source_branch_id) === String(branchId) && t.shipped_at && t.shipped_at > afterStr)
                .reduce((a, t) => {
                    const items = (t.items || []) as any[];
                    const item = items.find(i => i.sku === p.sku);
                    return a + Number(item?.quantity || 0);
                }, 0) || 0;

            const tInAfter = transfersAfter?.filter(t => String(t.destination_branch_id) === String(branchId) && t.received_at && t.received_at > afterStr)
                .reduce((a, t) => {
                    const items = (t.items || []) as any[];
                    const item = items.find(i => i.sku === p.sku);
                    return a + Number(item?.quantity || 0);
                }, 0) || 0;

            const rSAfter = returnsAfter?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.quantity || 0), 0) || 0;
            const rCAfter = refundsAfter?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.quantity || 0), 0) || 0;
            const aAfter = adjustmentsAfter?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.difference || 0), 0) || 0;

            // Past = Current + DeductionsAfter - AdditionsAfter
            const endingBalance = current + sAfter + rSAfter + tOutAfter - pAfter - rCAfter - tInAfter - aAfter;

            // Movements ON Target Date
            const transfers: InventorySnap['transfers'] = [];
            
            dTransfers?.filter(t => String(t.destination_branch_id) === String(branchId) && t.received_at && t.received_at >= isoTargetStart && t.received_at <= isoTargetEnd)
                .forEach(t => {
                    const items = (t.items || []) as any[];
                    const item = items.find(i => i.sku === p.sku);
                    if (item && item.quantity > 0) {
                        transfers.push({ type: 'in', branch_name: t.source_branch_name || 'Other Branch', quantity: item.quantity });
                    }
                });

            dTransfers?.filter(t => String(t.source_branch_id) === String(branchId) && t.shipped_at && t.shipped_at >= isoTargetStart && t.shipped_at <= isoTargetEnd)
                .forEach(t => {
                    const items = (t.items || []) as any[];
                    const item = items.find(i => i.sku === p.sku);
                    if (item && item.quantity > 0) {
                        transfers.push({ type: 'out', branch_name: t.destination_branch_name || 'Other Branch', quantity: item.quantity });
                    }
                });

            dTransfers?.filter(t => t.status === 'shipped')
                .forEach(t => {
                    const items = (t.items || []) as any[];
                    const item = items.find(i => i.sku === p.sku);
                    if (item && item.quantity > 0) {
                        if (String(t.source_branch_id) === String(branchId)) {
                            transfers.push({ type: 'in_transit_out', branch_name: t.destination_branch_name || 'Destination', quantity: item.quantity });
                        } else if (String(t.destination_branch_id) === String(branchId)) {
                            transfers.push({ type: 'in_transit_in', branch_name: t.source_branch_name || 'Source', quantity: item.quantity });
                        }
                    }
                });

            const transfersInTarget = transfers.filter(tr => tr.type === 'in').reduce((a, tr) => a + tr.quantity, 0);
            const transfersOutTarget = transfers.filter(tr => tr.type === 'out').reduce((a, tr) => a + tr.quantity, 0);

            const inwards = (dPurchases?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.quantity || 0), 0) || 0) + transfersInTarget;
            const outwards = (dSales?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.quantity || 0), 0) || 0) +
                (dReturns?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.quantity || 0), 0) || 0) + transfersOutTarget;
            const refundsTotal = dRefunds?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.quantity || 0), 0) || 0;
            const adjustmentsTotal = dAdjustments?.filter(s => s.product_id === p.id).reduce((a, s) => a + Number(s.difference || 0), 0) || 0;

            const opening = endingBalance - inwards + outwards - refundsTotal - adjustmentsTotal;

            return {
                id: p.id,
                name: p.name,
                opening,
                inwards,
                outwards,
                returns: refundsTotal,
                adjustments: adjustmentsTotal,
                ending: endingBalance,
                transfers
            };
        });
    }

    /**
     * Prepares row data for CSV/Journal export
     */
    static prepareDailyReport(
        date: string,
        sales: any[],
        purchases: any[],
        expenses: any[]
    ): ReportRow[] {
        const reportData: ReportRow[] = [];
        let totalSales = 0;
        let totalExpenses = 0;
        let totalPurchases = 0;

        // Summary Section
        reportData.push({ Section: 'DAILY SUMMARY', Detail: date });
        reportData.push({});

        // Sales Section
        reportData.push({ Section: 'SALES' });
        sales.forEach(s => {
            totalSales += s.total_price;
            reportData.push({
                Detail: s.products?.name || 'Unknown',
                Amount: s.total_price,
                Info: `Inv: ${s.invoice_number}, Qty: ${s.quantity}`
            });
        });
        reportData.push({ Detail: 'TOTAL SALES', Amount: totalSales });
        reportData.push({});

        // Expenses Section
        reportData.push({ Section: 'EXPENSES' });
        expenses.forEach(e => {
            totalExpenses += e.amount;
            reportData.push({
                Detail: e.category,
                Amount: e.amount,
                Info: e.description || ''
            });
        });
        reportData.push({ Detail: 'TOTAL EXPENSES', Amount: totalExpenses });
        reportData.push({});

        // Purchases Section
        reportData.push({ Section: 'PURCHASES' });
        purchases.forEach(p => {
            totalPurchases += p.total_price;
            reportData.push({
                Detail: p.products?.name || 'Unknown',
                Amount: p.total_price,
                Info: `Qty: ${p.quantity}`
            });
        });
        reportData.push({ Detail: 'TOTAL PURCHASES', Amount: totalPurchases });
        reportData.push({});

        // Net Section
        const netCash = totalSales - totalExpenses;
        reportData.push({ Section: 'NET POSITION' });
        reportData.push({ Detail: 'NET CASH (Sales - Expenses)', Amount: netCash });
        reportData.push({ Detail: 'NET FLOW (Sales - Expenses - Purchases)', Amount: netCash - totalPurchases });

        return reportData;
    }
}
