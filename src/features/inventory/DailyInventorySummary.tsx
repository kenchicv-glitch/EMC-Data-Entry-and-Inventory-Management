import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../shared/lib/supabase';
import {
    RefreshCw,
    History, Search, Edit3, Filter
} from 'lucide-react';
import { format, startOfDay, endOfDay, isToday } from 'date-fns';
import Calendar from '../../features/reports/components/Calendar';
import { ShoppingCart, ArrowDownRight, RotateCcw, Package, AlertCircle } from 'lucide-react';
import { useAudit } from '../../shared/hooks/useAudit';
import { useBranch } from '../../shared/lib/BranchContext';

interface InventorySnap {
    id: string;
    name: string;
    opening: number;
    inwards: number;
    outwards: number;
    returns: number;
    adjustments: number;
    ending: number;
    transfers?: {
        type: 'in' | 'out';
        branch_name: string;
        quantity: number;
    }[];
}

export default function DailyInventorySummary() {
    const { activeBranchId } = useBranch();
    const [summary, setSummary] = useState<InventorySnap[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [showOnlyMoved, setShowOnlyMoved] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isReconcileMode, setIsReconcileMode] = useState(false);
    const [actualCounts, setActualCounts] = useState<Record<string, string>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const { logAction } = useAudit();

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Get ALL products (current state)
            let productsQuery = supabase
                .from('products')
                .select('id, name, sku, stock_available');
            
            if (activeBranchId) {
                productsQuery = productsQuery.eq('branch_id', activeBranchId);
            }

            const { data: products } = await productsQuery;

            if (!products) return;

            const targetStart = startOfDay(selectedDate);
            const targetEnd = endOfDay(selectedDate);

            // 2. Fetch ALL movements after the target date
            const afterStr = targetEnd.toISOString();
            let salesQuery = supabase.from('sales').select('product_id, quantity, date').gt('date', afterStr);
            let purchasesQuery = supabase.from('purchases').select('product_id, quantity, date').eq('status', 'received').gt('date', afterStr);
            let returnsQuery = supabase.from('supplier_returns').select('product_id, quantity, date').gt('date', afterStr);
            let refundsQuery = supabase.from('customer_refunds').select('product_id, quantity, date').gt('date', afterStr);
            let adjustmentsQuery = supabase.from('inventory_adjustments').select('product_id, difference, created_at').gt('created_at', afterStr);

            if (activeBranchId) {
                salesQuery = salesQuery.eq('branch_id', activeBranchId);
                purchasesQuery = purchasesQuery.eq('branch_id', activeBranchId);
                returnsQuery = returnsQuery.eq('branch_id', activeBranchId);
                refundsQuery = refundsQuery.eq('branch_id', activeBranchId);
                adjustmentsQuery = adjustmentsQuery.eq('branch_id', activeBranchId);
            }

            let transfersOutQuery = supabase
                .from('purchases')
                .select('quantity, date, products(sku), branches:branch_id(name)')
                .eq('source_branch_id', activeBranchId)
                .eq('status', 'received')
                .gt('date', afterStr);

            const [salesRes, purchasesRes, returnsRes, refundsRes, adjustmentsRes, transfersOutRes] = await Promise.all([
                salesQuery,
                purchasesQuery,
                returnsQuery,
                refundsQuery,
                adjustmentsQuery,
                transfersOutQuery
            ]);

            const sales = salesRes.data;
            const purchases = purchasesRes.data;
            const returns = returnsRes.data;
            const refunds = refundsRes.data;
            const adjustments = adjustmentsRes.data;
            const transfersOut = transfersOutRes.data;

            // 3. Fetch movements FOR THE TARGET DATE
            const isoTargetStart = targetStart.toISOString();
            const isoTargetEnd = targetEnd.toISOString();

            let dSalesQuery = supabase.from('sales').select('product_id, quantity').gte('date', isoTargetStart).lte('date', isoTargetEnd);
            let dPurchasesQuery = supabase.from('purchases').select('product_id, quantity, purchase_type, branches:source_branch_id(name)').eq('status', 'received').gte('date', isoTargetStart).lte('date', isoTargetEnd);
            let dReturnsQuery = supabase.from('supplier_returns').select('product_id, quantity').gte('date', isoTargetStart).lte('date', isoTargetEnd);
            let dRefundsQuery = supabase.from('customer_refunds').select('product_id, quantity').gte('date', isoTargetStart).lte('date', isoTargetEnd);
            let dAdjustmentsQuery = supabase.from('inventory_adjustments').select('product_id, difference').gte('created_at', isoTargetStart).lte('created_at', isoTargetEnd);

            if (activeBranchId) {
                dSalesQuery = dSalesQuery.eq('branch_id', activeBranchId);
                dPurchasesQuery = dPurchasesQuery.eq('branch_id', activeBranchId);
                dReturnsQuery = dReturnsQuery.eq('branch_id', activeBranchId);
                dRefundsQuery = dRefundsQuery.eq('branch_id', activeBranchId);
                dAdjustmentsQuery = dAdjustmentsQuery.eq('branch_id', activeBranchId);
            }

            let dTransfersOutQuery = supabase
                .from('purchases')
                .select('quantity, products(sku), branches:branch_id(name)')
                .eq('source_branch_id', activeBranchId)
                .eq('status', 'received')
                .gte('date', isoTargetStart)
                .lte('date', isoTargetEnd);

            const [dSalesRes, dPurchasesRes, dReturnsRes, dRefundsRes, dAdjustmentsRes, dTransfersOutRes] = await Promise.all([
                dSalesQuery,
                dPurchasesQuery,
                dReturnsQuery,
                dRefundsQuery,
                dAdjustmentsQuery,
                dTransfersOutQuery
            ]);

            const dSales = dSalesRes.data;
            const dPurchases = dPurchasesRes.data;
            const dReturns = dReturnsRes.data;
            const dRefunds = dRefundsRes.data;
            const dAdjustments = dAdjustmentsRes.data;
            const dTransfersOut = dTransfersOutRes.data;

            const snaps: InventorySnap[] = products.map(p => {
                const current = p.stock_available;

                // Adjust for movements AFTER the target date
                const salesAfter = sales?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const purchasesAfter = purchases?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const transfersOutAfter = transfersOut?.filter(s => {
                    const products = s.products as any;
                    const sku = Array.isArray(products) ? products[0]?.sku : products?.sku;
                    return sku === p.sku;
                }).reduce((a, s) => a + s.quantity, 0) || 0;
                const returnsAfter = returns?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const refundsAfter = refunds?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const adjustmentsAfter = adjustments?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.difference, 0) || 0;

                // Past = Current + SalesAfter + TransfersOutAfter - PurchasesAfter + ReturnsAfter - RefundsAfter - AdjustmentsAfter
                const endingBalance = current + salesAfter + transfersOutAfter - purchasesAfter + returnsAfter - refundsAfter - adjustmentsAfter;

                // Movements ON Target Date
                const inwards = dPurchases?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                
                // Track individual transfers for UI
                const transfers: InventorySnap['transfers'] = [];
                
                // 1. Incoming Transfers
                dPurchases?.filter(s => s.product_id === p.id && (s as any).purchase_type === 'transfer')
                    .forEach(s => {
                        const bName = Array.isArray((s as any).branches) ? (s as any).branches[0]?.name : (s as any).branches?.name;
                        transfers.push({
                            type: 'in',
                            branch_name: bName || 'Other Branch',
                            quantity: s.quantity
                        });
                    });

                // 2. Outgoing Transfers
                const dTransfersOutMatches = dTransfersOut?.filter(s => {
                    const products = (s as any).products;
                    const sku = Array.isArray(products) ? products[0]?.sku : products?.sku;
                    return sku === p.sku;
                }) || [];

                dTransfersOutMatches.forEach(s => {
                    const bName = Array.isArray((s as any).branches) ? (s as any).branches[0]?.name : (s as any).branches?.name;
                    transfers.push({
                        type: 'out',
                        branch_name: bName || 'Other Branch',
                        quantity: s.quantity
                    });
                });

                const transfersOutTarget = dTransfersOutMatches.reduce((a, s) => a + s.quantity, 0);
                const outwards = (dSales?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0) +
                    (dReturns?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0) +
                    transfersOutTarget;
                const refundsTotal = dRefunds?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const adjustmentsTotal = dAdjustments?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.difference, 0) || 0;

                // Opening = Ending - In + Out - Refunds - Adjustments
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

            setSummary(snaps);
        } catch (err) {
            console.error('Error calculating history:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate, activeBranchId]);

    const handleProcessReconciliation = async () => {
        if (!window.confirm('Are you sure you want to process these inventory adjustments? This will update physical stock levels.')) return;

        setIsProcessing(true);
        try {
            const adjustments = Object.entries(actualCounts).map(([pid, actual]) => {
                const item = summary.find(s => s.id === pid);
                if (!item) return null;
                const actualNum = parseFloat(actual);
                return {
                    product_id: pid,
                    previous_stock: item.ending,
                    actual_stock: actualNum,
                    difference: actualNum - item.ending,
                    type: 'Reconciliation',
                    reason: `Manual reconciliation for ${format(selectedDate, 'MMM d, yyyy')}`
                };
            }).filter(Boolean);

            for (const adj of adjustments) {
                // 1. Log adjustment
                const { error: adjError } = await supabase.from('inventory_adjustments').insert({
                    ...adj,
                    branch_id: activeBranchId,
                    adjusted_by: (await supabase.auth.getUser()).data.user?.id
                });
                if (adjError) throw adjError;

                // 2. Update product stock
                const { error: prodError } = await supabase.from('products').update({
                    stock_available: adj?.actual_stock
                }).eq('id', adj?.product_id);
                if (prodError) throw prodError;

                // 3. Audit Log
                await logAction({
                    action: 'INV_ADJUST',
                    table_name: 'products',
                    record_id: adj?.product_id || '',
                    old_data: { stock: adj?.previous_stock },
                    new_data: { stock: adj?.actual_stock }
                });
            }

            alert('Reconciliation complete! Stocks updated.');
            setActualCounts({});
            setIsReconcileMode(false);
            fetchHistory();
        } catch (err) {
            console.error('Reconciliation failed:', err);
            alert('Error processing adjustments.');
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === 'r' && isToday(selectedDate)) {
                e.preventDefault();
                setIsReconcileMode(prev => !prev);
            }

            if (e.ctrlKey && e.key === 'Enter' && isReconcileMode) {
                e.preventDefault();
                handleProcessReconciliation();
            }

            if (isReconcileMode && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' && target.dataset.index !== undefined) {
                    e.preventDefault();
                    const currentIndex = parseInt(target.dataset.index);
                    const nextIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
                    const nextInput = document.querySelector(`input[data-index="${nextIndex}"]`) as HTMLInputElement;
                    if (nextInput) {
                        nextInput.focus();
                        nextInput.select();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isReconcileMode, selectedDate, handleProcessReconciliation]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const filtered = useMemo(() => {
        return summary.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            if (!showOnlyMoved) return matchesSearch;
            const hasMovement = p.inwards !== 0 || p.outwards !== 0 || p.returns !== 0 || p.adjustments !== 0;
            return matchesSearch && hasMovement;
        });
    }, [summary, searchTerm, showOnlyMoved]);

    const totals = useMemo(() => {
        return {
            in: filtered.reduce((a, b) => a + b.inwards, 0),
            out: filtered.reduce((a, b) => a + b.outwards, 0),
            returns: filtered.reduce((a, b) => a + b.returns, 0),
            adjustments: filtered.reduce((a, b) => a + b.adjustments, 0)
        };
    }, [filtered]);

    return (
        <div className="space-y-8 animate-fade-in pb-10 bg-base">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-surface rounded-[24px] flex items-center justify-center shadow-xl border border-border-default group transition-all hover:scale-105 active:scale-95">
                        <History className="text-brand-red group-hover:rotate-12 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tight uppercase">Inventory History</h1>
                        <p className="text-sm text-text-secondary mt-1 font-medium">Reconstruct historical stock balances at any point in time</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowOnlyMoved(!showOnlyMoved)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 ${showOnlyMoved ? 'bg-brand-red text-white shadow-red' : 'bg-surface text-text-secondary border border-border-default hover:bg-subtle'}`}
                    >
                        <Filter size={18} /> {showOnlyMoved ? 'MOVED ONLY' : 'ALL PRODUCTS'}
                    </button>
                    {isToday(selectedDate) && (
                        <button
                            onClick={() => setIsReconcileMode(!isReconcileMode)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 ${isReconcileMode ? 'bg-text-primary text-bg-surface' : 'bg-bg-surface text-text-primary border border-border-default hover:bg-bg-subtle'}`}
                        >
                            {isReconcileMode ? <><Package size={18} /> VIEW HISTORY</> : <><Edit3 size={18} /> RECONCILE STOCK</>}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-shrink-0 w-full lg:w-80">
                    <div className="sticky top-6 space-y-6">
                        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} activeDates={[format(new Date(), 'yyyy-MM-dd')]} />

                        <div className="bg-surface p-6 rounded-[32px] border border-border-default shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Logic Mode</h3>
                                <RefreshCw size={12} className="text-brand-orange animate-spin-slow" />
                            </div>
                            <p className="text-[11px] text-text-secondary leading-relaxed font-medium">
                                Reverse playback calculations start from real-time levels and mathematically undo every transaction back to <span className="text-text-primary font-black">{format(selectedDate, 'MMM d')}</span>.
                            </p>
                        </div>

                        {isReconcileMode && (
                            <div className="bg-brand-red/5 p-6 rounded-[32px] border border-brand-red/10 shadow-sm space-y-4">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={16} className="text-brand-red" />
                                    <h3 className="text-[10px] font-black text-brand-red uppercase tracking-[0.2em]">Reconcile Mode</h3>
                                </div>
                                <p className="text-[11px] text-text-secondary leading-relaxed font-medium">
                                    Enter the <strong>Physical Count</strong> from your shelves. The system will calculate the variance and allow you to adjust stocks to match reality.
                                </p>
                                <button
                                    onClick={handleProcessReconciliation}
                                    disabled={Object.keys(actualCounts).length === 0 || isProcessing}
                                    className="w-full bg-brand-red text-white py-3 rounded-xl font-black text-xs shadow-red hover:bg-brand-red-dark transition-all disabled:opacity-50"
                                >
                                    {isProcessing ? 'PROCESSING...' : 'PROCESS ADJUSTMENTS'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-w-0 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-surface p-6 rounded-[32px] border border-border-default shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[18px] bg-success-subtle text-success flex items-center justify-center"><ShoppingCart size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Inwards (+)</p>
                                <p className="text-2xl font-black font-data text-text-primary">+{totals.in}</p>
                            </div>
                        </div>
                        <div className="bg-surface p-6 rounded-[32px] border border-border-default shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[18px] bg-danger-subtle text-brand-red flex items-center justify-center"><ArrowDownRight size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Outwards (-)</p>
                                <p className="text-2xl font-black font-data text-text-primary">-{totals.out}</p>
                            </div>
                        </div>
                        <div className="bg-surface p-6 rounded-[32px] border border-border-default shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[18px] bg-accent-subtle text-accent flex items-center justify-center"><RotateCcw size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Returns (+)</p>
                                <p className="text-2xl font-black font-data text-text-primary">+{totals.returns}</p>
                            </div>
                        </div>
                        <div className="bg-surface p-6 rounded-[32px] border border-border-default shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[18px] bg-warning-subtle text-amber-500 flex items-center justify-center"><Edit3 size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Adjustments (±)</p>
                                <p className="text-2xl font-black font-data text-text-primary">{totals.adjustments > 0 ? '+' : ''}{totals.adjustments}</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={18} />
                        <input type="text" placeholder="Search products in historical snapshot..." className="w-full pl-12 pr-4 py-4 bg-surface border border-border-default rounded-[28px] text-sm text-text-primary focus:ring-2 focus:border-brand-red outline-none shadow-sm transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="bg-surface rounded-[40px] border border-border-default shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-bg-subtle border-b border-border-muted font-bold">
                                        <th className="px-8 py-5 text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">Product Detail</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] text-center">Opening</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] text-center bg-emerald-500/5">In (+)</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-brand-red uppercase tracking-[0.2em] text-center bg-brand-red/5">Out (-)</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] text-center bg-blue-500/5">Return (+)</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] text-center bg-amber-500/5">Adj (±)</th>
                                        <th className="px-8 py-5 text-[11px] font-black text-text-primary uppercase tracking-[0.2em] text-center border-l border-border-muted bg-bg-subtle/20">Closing</th>
                                        {isReconcileMode && (
                                            <>
                                                <th className="px-8 py-5 text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] text-center bg-amber-500/5 border-l border-border-muted font-bold">Physical</th>
                                                <th className="px-8 py-5 text-[11px] font-black text-text-primary uppercase tracking-[0.2em] text-center bg-bg-surface border-l border-border-muted font-bold">Variance</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-default">
                                    {loading ? (
                                        [1, 2, 3, 4, 5].map(i => <tr key={i} className="animate-pulse"><td colSpan={7} className="px-8 py-8"><div className="h-4 bg-subtle rounded-full w-48"></div></td></tr>)
                                    ) : filtered.length > 0 ? filtered.map((item, idx) => {
                                        const actualStr = actualCounts[item.id] || '';
                                        const actualNum = parseFloat(actualStr);
                                        const variance = isNaN(actualNum) ? 0 : actualNum - item.ending;

                                        return (
                                            <tr key={item.id} className="hover:bg-subtle/50 transition-all font-data group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-subtle flex items-center justify-center text-text-muted group-hover:text-brand-red transition-colors"><Package size={14} /></div>
                                                        <p className="text-xs font-black text-text-primary leading-tight uppercase">{item.name}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center font-bold text-text-muted">{item.opening}</td>
                                                 <td className="px-6 py-5 text-center font-black text-success bg-success-subtle/5">
                                                     {(() => {
                                                         const inTransfers = item.transfers?.filter(t => t.type === 'in') || [];
                                                         const inTransfersTotal = inTransfers.reduce((a, t) => a + t.quantity, 0);
                                                         const supplierPurchases = item.inwards - inTransfersTotal;
                                                         
                                                         return (
                                                             <div className="flex flex-col gap-1.5 items-center">
                                                                 {supplierPurchases > 0 && (
                                                                     <div className="flex flex-col items-center">
                                                                         <span className="text-xs">+{supplierPurchases}</span>
                                                                         <span className="text-[9px] text-text-muted font-black uppercase tracking-tighter">SUPP PURCHASE</span>
                                                                     </div>
                                                                 )}
                                                                 {inTransfers.map((t, i) => (
                                                                     <div key={i} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase whitespace-nowrap border border-emerald-500/10">
                                                                         <span className="text-[12px]">↓</span> {t.quantity} FROM {t.branch_name}
                                                                     </div>
                                                                 ))}
                                                                 {item.inwards === 0 && <span className="text-text-muted/30 font-bold">0</span>}
                                                             </div>
                                                         );
                                                     })()}
                                                 </td>
                                                 <td className="px-6 py-5 text-center font-black text-brand-red bg-danger-subtle/5">
                                                     {(() => {
                                                         const outTransfers = item.transfers?.filter(t => t.type === 'out') || [];
                                                         const outTransfersTotal = outTransfers.reduce((a, t) => a + t.quantity, 0);
                                                         const regularOut = item.outwards - outTransfersTotal;

                                                         return (
                                                             <div className="flex flex-col gap-1.5 items-center">
                                                                 {regularOut > 0 && (
                                                                     <div className="flex flex-col items-center">
                                                                         <span className="text-xs">-{regularOut}</span>
                                                                         <span className="text-[9px] text-text-muted font-black uppercase tracking-tighter">SALES/RETS</span>
                                                                     </div>
                                                                 )}
                                                                 {outTransfers.map((t, i) => (
                                                                     <div key={i} className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-[10px] font-black uppercase whitespace-nowrap border border-red-500/10">
                                                                         <span className="text-[12px]">↑</span> {t.quantity} TO {t.branch_name}
                                                                     </div>
                                                                 ))}
                                                                 {item.outwards === 0 && <span className="text-text-muted/30 font-bold">0</span>}
                                                             </div>
                                                         );
                                                     })()}
                                                 </td>
                                                <td className="px-6 py-5 text-center font-black text-accent bg-accent-subtle/5">+{item.returns}</td>
                                                <td className="px-6 py-5 text-center font-black text-amber-500 bg-warning-subtle/5">{item.adjustments > 0 ? '+' : ''}{item.adjustments}</td>
                                                <td className="px-8 py-5 text-center font-black text-text-primary border-l border-border-default bg-subtle/20 text-sm">{item.ending}</td>
                                                {isReconcileMode && (
                                                    <>
                                                        <td className="px-6 py-5 text-center border-l border-border-default bg-warning-subtle/5">
                                                            <input
                                                                type="number"
                                                                data-index={idx}
                                                                value={actualStr}
                                                                onChange={(e) => setActualCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                                onFocus={(e) => e.target.select()}
                                                                placeholder={item.ending.toString()}
                                                                className="w-20 px-3 py-2 bg-surface border border-border-default rounded-xl text-center font-black text-xs text-text-primary focus:ring-2 focus:ring-brand-orange outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-5 text-center border-l border-border-default bg-subtle/10">
                                                            {!isNaN(actualNum) && (
                                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${variance === 0 ? 'bg-subtle text-text-muted' : variance > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-brand-red'}`}>
                                                                    {variance > 0 ? '+' : ''}{variance}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={isReconcileMode ? 9 : 7} className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 bg-bg-subtle rounded-full flex items-center justify-center">
                                                    <Package size={20} className="text-text-muted" />
                                                </div>
                                                <p className="text-sm text-text-muted font-medium">No matching product history found</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
