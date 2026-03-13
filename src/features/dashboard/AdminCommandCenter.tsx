import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { useBranch } from '../../shared/lib/BranchContext';
import { startOfDay, endOfDay, format } from 'date-fns';
import Calendar from '../../features/reports/components/Calendar';
import {
    TrendingUp, TrendingDown, DollarSign, ShoppingCart, Wallet, Package,
    Activity, Building2, BarChart3, X
} from 'lucide-react';

interface BranchData {
    branchId: string;
    branchName: string;
    sales: number;
    purchases: number;
    expenses: number;
    netProfit: number;
    salesCount: number;
    purchasesCount: number;
    expensesCount: number;
}

interface ActivityItem {
    id: string;
    type: 'sale' | 'purchase' | 'expense';
    description: string;
    amount: number;
    branch: string;
    branchId: string;
    time: string;
    invoiceNumber?: string;
}

export default function AdminCommandCenter() {
    const { branches } = useBranch();
    const [branchData, setBranchData] = useState<BranchData[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'sale' | 'purchase' | 'expense'>('all');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null); // null = all branches

    const fetchAllBranchData = useCallback(async (date?: Date) => {
        if (branches.length === 0) return;
        setLoading(true);

        const targetDate = date || selectedDate;
        const rangeStart = startOfDay(targetDate).toISOString();
        const rangeEnd = endOfDay(targetDate).toISOString();

        const allActivities: ActivityItem[] = [];
        const results: BranchData[] = await Promise.all(branches.map(async (branch) => {
            const [
                { data: salesData },
                { data: purchasesData },
                { data: expensesData }
            ] = await Promise.all([
                supabase
                    .from('sales')
                    .select('id, total_price, quantity, cost_price, date, invoice_number, products(name)')
                    .eq('branch_id', branch.id)
                    .gte('date', rangeStart)
                    .lte('date', rangeEnd)
                    .order('date', { ascending: false }),
                supabase
                    .from('purchases')
                    .select('id, total_price, discount_amount, date, invoice_number, products(name)')
                    .eq('branch_id', branch.id)
                    .gte('date', rangeStart)
                    .lte('date', rangeEnd)
                    .order('date', { ascending: false }),
                supabase
                    .from('expenses')
                    .select('id, amount, description, date, category')
                    .eq('branch_id', branch.id)
                    .gte('date', rangeStart)
                    .lte('date', rangeEnd)
                    .order('date', { ascending: false })
            ]);

            const sales = salesData || [];
            const purchases = purchasesData || [];
            const expenses = expensesData || [];

            const totalSales = sales.reduce((sum: number, s: any) => sum + (s.total_price || 0), 0);
            const totalCOGS = sales.reduce((sum: number, s: any) => sum + ((s.quantity || 0) * (s.cost_price || 0)), 0);
            const totalPurchases = purchases.reduce((sum: number, p: any) => sum + ((p.total_price || 0) - (p.discount_amount || 0)), 0);
            const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

            // Build activity feed
            sales.forEach((s: any) => {
                const prod = Array.isArray(s.products) ? s.products[0] : s.products;
                allActivities.push({
                    id: s.id, type: 'sale',
                    description: prod?.name || s.invoice_number || 'Sale',
                    amount: s.total_price || 0,
                    branch: branch.name, branchId: branch.id,
                    time: s.date, invoiceNumber: s.invoice_number
                });
            });
            purchases.forEach((p: any) => {
                const prod = Array.isArray(p.products) ? p.products[0] : p.products;
                allActivities.push({
                    id: p.id, type: 'purchase',
                    description: prod?.name || p.invoice_number || 'Purchase',
                    amount: (p.total_price || 0) - (p.discount_amount || 0),
                    branch: branch.name, branchId: branch.id,
                    time: p.date, invoiceNumber: p.invoice_number
                });
            });
            expenses.forEach((e: any) => {
                allActivities.push({
                    id: e.id, type: 'expense',
                    description: e.description || e.category || 'Expense',
                    amount: e.amount || 0,
                    branch: branch.name, branchId: branch.id,
                    time: e.date
                });
            });

            return {
                branchId: branch.id,
                branchName: branch.name,
                sales: totalSales,
                purchases: totalPurchases,
                expenses: totalExpenses,
                netProfit: totalSales - totalCOGS - totalExpenses,
                salesCount: sales.length,
                purchasesCount: purchases.length,
                expensesCount: expenses.length
            };
        }));

        allActivities.sort((a: ActivityItem, b: ActivityItem) => new Date(b.time).getTime() - new Date(a.time).getTime());
        results.sort((a: BranchData, b: BranchData) => a.branchName.localeCompare(b.branchName, undefined, { numeric: true }));
        setBranchData(results);
        setActivities(allActivities);
        setLoading(false);
    }, [branches, selectedDate]);

    useEffect(() => {
        fetchAllBranchData();
    }, [fetchAllBranchData]);

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        fetchAllBranchData(date);
    };

    const handleBranchClick = (branchId: string) => {
        setSelectedBranch(prev => prev === branchId ? null : branchId);
    };

    // Compute totals — respect branch filter
    const visibleBranches = selectedBranch ? branchData.filter(b => b.branchId === selectedBranch) : branchData;
    const totals = visibleBranches.reduce((acc, b) => ({
        sales: acc.sales + b.sales,
        purchases: acc.purchases + b.purchases,
        expenses: acc.expenses + b.expenses,
        netProfit: acc.netProfit + b.netProfit,
        salesCount: acc.salesCount + b.salesCount,
        purchasesCount: acc.purchasesCount + b.purchasesCount,
        expensesCount: acc.expensesCount + b.expensesCount
    }), { sales: 0, purchases: 0, expenses: 0, netProfit: 0, salesCount: 0, purchasesCount: 0, expensesCount: 0 });

    // Filter activities — respect branch + tab
    const branchFiltered = selectedBranch ? activities.filter(a => a.branchId === selectedBranch) : activities;
    const filteredActivities = activeTab === 'all' ? branchFiltered : branchFiltered.filter(a => a.type === activeTab);

    const selectedBranchName = selectedBranch ? branchData.find(b => b.branchId === selectedBranch)?.branchName : null;

    const fmt = (v: number) => `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

    const typeColors: Record<string, string> = {
        sale: 'bg-emerald-500/10 text-emerald-600',
        purchase: 'bg-blue-500/10 text-blue-600',
        expense: 'bg-amber-500/10 text-amber-600'
    };
    const typeIcons: Record<string, React.ReactNode> = {
        sale: <DollarSign size={12} />,
        purchase: <ShoppingCart size={12} />,
        expense: <Wallet size={12} />
    };

    return (
        <div className="animate-fade-in pb-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-bg-surface rounded-[18px] flex items-center justify-center shadow-lg border border-border-default">
                        <BarChart3 className="text-brand-red" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-text-primary tracking-tight">Command Center</h1>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{format(selectedDate, 'EEEE, MMMM d yyyy')}</p>
                    </div>
                </div>
                <button
                    onClick={() => fetchAllBranchData()}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-bg-subtle hover:bg-bg-muted border border-border-default text-text-secondary text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                >
                    <Activity size={14} /> Refresh
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-5">
                {/* Left: Calendar */}
                <div className="flex-shrink-0 w-full lg:w-72">
                    <div className="sticky top-6 space-y-4">
                        <Calendar
                            selectedDate={selectedDate}
                            onDateSelect={handleDateSelect}
                        />

                        {/* Branch Filter Indicator */}
                        {selectedBranch && (
                            <div className="bg-brand-red/5 border border-brand-red/20 rounded-2xl p-3 flex items-center justify-between animate-fade-in">
                                <div className="flex items-center gap-2">
                                    <Building2 size={14} className="text-brand-red" />
                                    <span className="text-[10px] font-black text-brand-red uppercase tracking-widest">Filtering: {selectedBranchName}</span>
                                </div>
                                <button
                                    onClick={() => setSelectedBranch(null)}
                                    className="p-1 hover:bg-brand-red/10 rounded-lg transition-colors"
                                >
                                    <X size={14} className="text-brand-red" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Main Content */}
                <div className="flex-1 min-w-0 space-y-5">
                    {/* Totals Strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <TotalChip label="Total Sales" value={totals.sales} count={totals.salesCount} color="emerald" loading={loading} />
                        <TotalChip label="Total Purchases" value={totals.purchases} count={totals.purchasesCount} color="blue" loading={loading} />
                        <TotalChip label="Total Expenses" value={totals.expenses} count={totals.expensesCount} color="amber" loading={loading} />
                        <TotalChip label="Net Profit" value={totals.netProfit} count={null} color={totals.netProfit >= 0 ? 'emerald' : 'red'} loading={loading} isProfit />
                    </div>

                    {/* Branch Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {loading
                            ? [1, 2, 3].map(i => <div key={i} className="h-44 skeleton rounded-[24px]" />)
                            : branchData.map(b => (
                                <div
                                    key={b.branchId}
                                    onClick={() => handleBranchClick(b.branchId)}
                                    className={`bg-bg-surface rounded-[24px] border-2 shadow-sm p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer select-none ${
                                        selectedBranch === b.branchId
                                            ? 'border-brand-red shadow-red/10 ring-2 ring-brand-red/10'
                                            : selectedBranch && selectedBranch !== b.branchId
                                                ? 'border-border-default opacity-40'
                                                : 'border-border-default'
                                    }`}
                                >
                                    {/* Branch Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${selectedBranch === b.branchId ? 'bg-brand-red text-white' : 'bg-brand-red/10 text-brand-red'}`}>
                                                <Building2 size={16} />
                                            </div>
                                            <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">{b.branchName}</h3>
                                        </div>
                                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${b.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                                            {b.netProfit >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                            {fmt(Math.abs(b.netProfit))}
                                        </div>
                                    </div>

                                    {/* Metrics Row */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-bg-subtle rounded-xl p-2.5 text-center">
                                            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">Sales</p>
                                            <p className="text-xs font-black text-emerald-600 font-data">{fmt(b.sales)}</p>
                                            <p className="text-[8px] font-bold text-text-muted mt-0.5">{b.salesCount} txns</p>
                                        </div>
                                        <div className="bg-bg-subtle rounded-xl p-2.5 text-center">
                                            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">Purchases</p>
                                            <p className="text-xs font-black text-blue-600 font-data">{fmt(b.purchases)}</p>
                                            <p className="text-[8px] font-bold text-text-muted mt-0.5">{b.purchasesCount} txns</p>
                                        </div>
                                        <div className="bg-bg-subtle rounded-xl p-2.5 text-center">
                                            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">Expenses</p>
                                            <p className="text-xs font-black text-amber-600 font-data">{fmt(b.expenses)}</p>
                                            <p className="text-[8px] font-bold text-text-muted mt-0.5">{b.expensesCount} txns</p>
                                        </div>
                                    </div>

                                    {/* Profit Bar */}
                                    <div className="mt-3 bg-bg-subtle rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${b.netProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                            style={{ width: `${Math.min(100, Math.abs(b.sales > 0 ? (b.netProfit / b.sales) * 100 : 0))}%` }}
                                        />
                                    </div>
                                    <p className="text-[8px] font-black text-text-muted mt-1 text-right uppercase tracking-widest">
                                        {b.sales > 0 ? `${((b.netProfit / b.sales) * 100).toFixed(1)}% margin` : 'No sales'}
                                    </p>
                                </div>
                            ))
                        }
                    </div>

                    {/* Activity Feed */}
                    <div className="bg-bg-surface rounded-[24px] border border-border-default shadow-sm overflow-hidden">
                        {/* Tabs */}
                        <div className="flex items-center gap-1 p-3 border-b border-border-default bg-bg-subtle/30 flex-wrap">
                            {(['all', 'sale', 'purchase', 'expense'] as const).map(tab => {
                                const tabCount = tab === 'all' ? branchFiltered.length : branchFiltered.filter(a => a.type === tab).length;
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                            activeTab === tab
                                                ? 'bg-brand-charcoal text-white shadow-lg'
                                                : 'text-text-muted hover:text-text-primary hover:bg-bg-subtle'
                                        }`}
                                    >
                                        {tab === 'all' ? `All (${tabCount})` :
                                         tab === 'sale' ? `Sales (${tabCount})` :
                                         tab === 'purchase' ? `Purchases (${tabCount})` :
                                         `Expenses (${tabCount})`}
                                    </button>
                                );
                            })}
                            {selectedBranch && (
                                <span className="ml-auto text-[9px] font-black text-brand-red uppercase tracking-widest flex items-center gap-1">
                                    <Building2 size={10} /> {selectedBranchName} only
                                </span>
                            )}
                        </div>

                        {/* Activity List */}
                        <div className="divide-y divide-border-default max-h-[400px] overflow-y-auto custom-scrollbar">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => <div key={i} className="p-4 h-14 skeleton" />)
                            ) : filteredActivities.length === 0 ? (
                                <div className="p-10 text-center">
                                    <Package size={28} className="mx-auto text-text-muted mb-2 opacity-30" />
                                    <p className="text-xs font-bold text-text-muted">No activity {selectedBranch ? `for ${selectedBranchName}` : ''} on this date</p>
                                </div>
                            ) : (
                                filteredActivities.slice(0, 50).map((item) => (
                                    <div key={`${item.type}-${item.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-bg-subtle/50 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${typeColors[item.type]}`}>
                                                {typeIcons[item.type]}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-text-primary truncate">{item.description}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {item.invoiceNumber && (
                                                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{item.invoiceNumber}</span>
                                                    )}
                                                    <span className="text-[9px] font-bold text-text-muted">{format(new Date(item.time), 'h:mm a')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {!selectedBranch && (
                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-bg-subtle text-text-muted uppercase tracking-wider">{item.branch}</span>
                                            )}
                                            <span className={`text-xs font-black font-data ${item.type === 'sale' ? 'text-emerald-600' : 'text-text-primary'}`}>
                                                {item.type === 'sale' ? '+' : '-'}{fmt(item.amount)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TotalChip({ label, value, count, color, loading, isProfit }: {
    label: string;
    value: number;
    count: number | null;
    color: string;
    loading: boolean;
    isProfit?: boolean;
}) {
    const fmt = (v: number) => `₱${Math.abs(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

    return (
        <div className="bg-bg-surface p-3.5 rounded-[20px] border border-border-default shadow-sm">
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">{label}</p>
            {loading ? (
                <div className="h-6 w-20 skeleton rounded-lg" />
            ) : (
                <>
                    <p className={`text-base font-black font-data tracking-tight ${
                        isProfit ? (value >= 0 ? 'text-emerald-600' : 'text-red-600') :
                        color === 'emerald' ? 'text-emerald-600' :
                        color === 'blue' ? 'text-blue-600' :
                        color === 'amber' ? 'text-amber-600' : 'text-text-primary'
                    }`}>
                        {isProfit && value >= 0 ? '+' : isProfit && value < 0 ? '-' : ''}{fmt(value)}
                    </p>
                    {count !== null && (
                        <p className="text-[8px] font-bold text-text-muted mt-0.5">{count} txns</p>
                    )}
                </>
            )}
        </div>
    );
}
