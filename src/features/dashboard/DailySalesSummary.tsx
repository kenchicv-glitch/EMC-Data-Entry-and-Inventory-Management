import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../shared/lib/supabase';
import {
    format, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameDay, addMonths, subMonths,
    startOfWeek, endOfWeek, isToday
} from 'date-fns';
import {
    DollarSign, ArrowUpRight, ArrowDownRight,
    RefreshCw, Download, Calendar as CalendarIcon, TrendingUp, ChevronLeft, ChevronRight, ShoppingCart, Wallet, ArrowRightLeft
} from 'lucide-react';
import { exportToCSV } from '../../shared/lib/exportUtils';
import { useBranch } from '../../shared/hooks/useBranch';

interface DailyStats {
    date: string;
    sales: number;
    purchases: number;
    expenses: number;
    refunds: number;
    returns: number;
    transfersIn: number;
    transfersOut: number;
}

interface TransferItem {
    sku: string;
    quantity: number;
}

export default function DailySalesSummary() {
    const { activeBranchId } = useBranch();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [stats, setStats] = useState<Record<string, DailyStats>>({});
    const [loading, setLoading] = useState(true);

    const fetchMonthlyData = useCallback(async (date: Date) => {
        setLoading(true);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');

        try {
            let salesQuery = supabase.from('sales').select('total_price, date').gte('date', startStr).lte('date', endStr);
            let purchasesQuery = supabase.from('purchases').select('total_price, date').gte('date', startStr).lte('date', endStr);
            let expensesQuery = supabase.from('expenses').select('amount, date').gte('date', startStr).lte('date', endStr);
            let refundsQuery = supabase.from('customer_refunds').select('total_price, date').gte('date', startStr).lte('date', endStr);
            let returnsQuery = supabase.from('supplier_returns').select('total_price, date').gte('date', startStr).lte('date', endStr);
            const transfersQuery = supabase.from('stock_transfers')
                .select('items, created_at, source_branch_id, destination_branch_id, status, shipped_at, received_at')
                .or(`source_branch_id.eq.${activeBranchId},destination_branch_id.eq.${activeBranchId}`)
                .neq('status', 'cancelled')
                .or(`shipped_at.gte.${startStr},shipped_at.lte.${endStr}T23:59:59,received_at.gte.${startStr},received_at.lte.${endStr}T23:59:59`);

            if (activeBranchId) {
                salesQuery = salesQuery.eq('branch_id', activeBranchId);
                purchasesQuery = purchasesQuery.eq('branch_id', activeBranchId);
                expensesQuery = expensesQuery.eq('branch_id', activeBranchId);
                refundsQuery = refundsQuery.eq('branch_id', activeBranchId);
                returnsQuery = returnsQuery.eq('branch_id', activeBranchId);
            }

            const [salesRes, purchasesRes, expensesRes, refundsRes, returnsRes, transfersRes] = await Promise.all([
                salesQuery,
                purchasesQuery,
                expensesQuery,
                refundsQuery,
                returnsQuery,
                transfersQuery
            ]);

            const newStats: Record<string, DailyStats> = {};
            const getD = (d: string) => format(new Date(d), 'yyyy-MM-dd');

            salesRes.data?.forEach(s => {
                const d = getD(s.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0, transfersIn: 0, transfersOut: 0 };
                newStats[d].sales += s.total_price || 0;
            });

            purchasesRes.data?.forEach(p => {
                const d = getD(p.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0, transfersIn: 0, transfersOut: 0 };
                newStats[d].purchases += p.total_price || 0;
            });

            expensesRes.data?.forEach(e => {
                const d = getD(e.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0, transfersIn: 0, transfersOut: 0 };
                newStats[d].expenses += e.amount || 0;
            });

            refundsRes.data?.forEach(r => {
                const d = getD(r.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0, transfersIn: 0, transfersOut: 0 };
                newStats[d].refunds += r.total_price || 0;
            });

            returnsRes.data?.forEach(r => {
                const d = getD(r.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0, transfersIn: 0, transfersOut: 0 };
                newStats[d].returns += r.total_price || 0;
            });

            transfersRes.data?.forEach(t => {
                const itemsCount = (t.items as TransferItem[])?.reduce((a, it) => a + (it.quantity || 0), 0) || 0;

                if (String(t.source_branch_id) === String(activeBranchId) && t.shipped_at) {
                    const d = getD(t.shipped_at);
                    if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0, transfersIn: 0, transfersOut: 0 };
                    newStats[d].transfersOut += itemsCount;
                }
                if (String(t.destination_branch_id) === String(activeBranchId) && t.received_at) {
                    const d = getD(t.received_at);
                    if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0, transfersIn: 0, transfersOut: 0 };
                    newStats[d].transfersIn += itemsCount;
                }
            });

            setStats(newStats);
        } catch (error) {
            console.error('Error fetching summary data:', error);
        } finally {
            setLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchMonthlyData(currentMonth);
    }, [currentMonth, fetchMonthlyData]);

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const handleExport = () => {
        const dataToExport = Object.values(stats).sort((a, b) => a.date.localeCompare(b.date)).map(s => ({
            Date: s.date,
            Sales: s.sales,
            Purchases: s.purchases,
            Expenses: s.expenses,
            Refunds: s.refunds,
            Returns: s.returns,
            'Net Cashflow': s.sales - s.purchases - s.expenses - s.refunds + s.returns
        }));
        exportToCSV(dataToExport, `Daily_Summary_${format(currentMonth, 'yyyy_MM')}`);
    };

    const selectedStats = stats[format(selectedDate, 'yyyy-MM-dd')] || {
        date: format(selectedDate, 'yyyy-MM-dd'),
        sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0, transfersIn: 0, transfersOut: 0
    };

    const netCashflow = selectedStats.sales - selectedStats.purchases - selectedStats.expenses - selectedStats.refunds + selectedStats.returns;

    // Previous day stats for day-over-day comparison
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayStats = stats[format(prevDay, 'yyyy-MM-dd')] || undefined;

    // Monthly totals for Monthly Snapshot card
    const monthlyTotals = useMemo(() => {
        const vals = Object.values(stats);
        const totalSales = vals.reduce((a, s) => a + s.sales, 0);
        const activeDays = vals.filter(s => s.sales > 0 || s.purchases > 0).length;
        const peakSales = vals.reduce((max, s) => Math.max(max, s.sales), 0);
        return { sales: totalSales, activeDays, peakSales };
    }, [stats]);

    return (
        <div className="space-y-8 animate-fade-in pb-10 bg-base">
            {/* Standard Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-surface rounded-[24px] flex items-center justify-center shadow-xl border border-border-default group transition-all hover:scale-105 active:scale-95">
                        <CalendarIcon className="text-brand-red group-hover:rotate-12 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tight uppercase">Daily Performance</h1>
                        <p className="text-sm text-text-secondary mt-1 font-medium">Track daily cash flow and transaction highlights</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 bg-surface border border-border-default text-text-secondary px-5 py-3 rounded-2xl font-bold text-sm hover:bg-subtle transition-all shadow-sm active:scale-95">
                        <Download size={18} /> EXPORT MONTH
                    </button>
                    <div className="flex items-center bg-surface border border-border-default rounded-2xl p-1.5 shadow-sm">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-subtle rounded-xl text-text-muted transition-colors"><ChevronLeft size={20} /></button>
                        <span className="px-4 text-sm font-black text-text-primary min-w-[140px] text-center uppercase tracking-widest">{format(currentMonth, 'MMMM yyyy')}</span>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-subtle rounded-xl text-text-muted transition-colors"><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8 bg-surface p-6 rounded-[28px] border border-border-default shadow-sm">
                    <div className="grid grid-cols-7 gap-2 mb-6">
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                            <div key={day} className="text-center py-2 text-[10px] font-black text-text-muted tracking-[0.2em] uppercase">{day}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-3">
                        {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayStats = stats[dateStr];
                            const isSelected = isSameDay(day, selectedDate);
                            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                            return (
                                <button key={dateStr} onClick={() => setSelectedDate(day)}
                                    className={`relative min-h-[90px] p-2.5 rounded-[20px] border-2 transition-all flex flex-col group ${isSelected ? 'border-brand-red bg-brand-red/10' : isCurrentMonth ? 'border-border-default bg-subtle/50 hover:border-brand-red/50 hover:bg-surface' : 'border-transparent opacity-30 pointer-events-none'}`}>
                                    <span className={`text-xs font-black ${isSelected ? 'text-brand-red' : 'text-text-muted'} ${isToday(day) ? 'bg-brand-red text-white w-5 h-5 flex items-center justify-center rounded-full' : ''}`}>{format(day, 'd')}</span>
                                    <div className="mt-auto space-y-1.5">
                                        {dayStats && dayStats.sales > 0 && <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-brand-red shadow-red" /><span className="text-[10px] font-black text-text-primary">₱{Math.round(dayStats.sales / 1000)}k</span></div>}
                                        {dayStats && dayStats.purchases > 0 && <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-border-strong" /><span className="text-[10px] font-black text-text-secondary">₱{Math.round(dayStats.purchases / 1000)}k</span></div>}
                                    </div>
                                    {isSelected && <div className="absolute top-3 right-3 w-2 h-2 bg-brand-red rounded-full shadow-red animate-pulse" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-surface p-6 rounded-[28px] border border-border-default shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-brand-red" />
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-text-primary text-xs uppercase tracking-[0.2em]">{format(selectedDate, 'MMMM d, yyyy')}</h3>
                            <div className="px-3 py-1 bg-subtle rounded-full text-[9px] font-black text-text-muted uppercase tracking-widest">{format(selectedDate, 'EEEE')}</div>
                        </div>

                        {/* Enhanced Detail Rows with Progress Bars */}
                        <div className="space-y-4">
                            <EnhancedDetailRow
                                icon={<DollarSign size={16} />}
                                label="Daily Sales"
                                value={selectedStats.sales}
                                color="text-brand-red"
                                bg="bg-brand-red/10"
                                barColor="bg-brand-red"
                                total={Math.max(selectedStats.sales, selectedStats.purchases, selectedStats.expenses, selectedStats.refunds, selectedStats.returns, 1)}
                                prevValue={prevDayStats?.sales}
                            />
                            <EnhancedDetailRow
                                icon={<ShoppingCart size={16} />}
                                label="Purchases"
                                value={selectedStats.purchases}
                                color="text-blue-600"
                                bg="bg-blue-500/10"
                                barColor="bg-blue-500"
                                total={Math.max(selectedStats.sales, selectedStats.purchases, selectedStats.expenses, selectedStats.refunds, selectedStats.returns, 1)}
                                prevValue={prevDayStats?.purchases}
                            />
                            <EnhancedDetailRow
                                icon={<Wallet size={16} />}
                                label="Expenses"
                                value={selectedStats.expenses}
                                color="text-amber-600"
                                bg="bg-amber-500/10"
                                barColor="bg-amber-500"
                                total={Math.max(selectedStats.sales, selectedStats.purchases, selectedStats.expenses, selectedStats.refunds, selectedStats.returns, 1)}
                                prevValue={prevDayStats?.expenses}
                            />
                            <EnhancedDetailRow
                                icon={<ArrowDownRight size={16} />}
                                label="Refunds"
                                value={selectedStats.refunds}
                                color="text-brand-orange"
                                bg="bg-warning-subtle"
                                barColor="bg-brand-orange"
                                total={Math.max(selectedStats.sales, selectedStats.purchases, selectedStats.expenses, selectedStats.refunds, selectedStats.returns, 1)}
                                prevValue={prevDayStats?.refunds}
                            />
                            <EnhancedDetailRow
                                icon={<ArrowUpRight size={16} />}
                                label="Returns"
                                value={selectedStats.returns}
                                color="text-purple-600"
                                bg="bg-purple-500/10"
                                barColor="bg-purple-500"
                                total={Math.max(selectedStats.sales, selectedStats.purchases, selectedStats.expenses, selectedStats.refunds, selectedStats.returns, 1)}
                                prevValue={prevDayStats?.returns}
                            />
                            
                            <div className="pt-2 flex gap-3">
                                <div className="flex-1 bg-emerald-500/5 rounded-2xl p-3 border border-emerald-500/10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ArrowRightLeft size={14} className="text-emerald-600" />
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Incoming</span>
                                    </div>
                                    <p className="text-lg font-black font-data text-emerald-700">{selectedStats.transfersIn} <span className="text-[9px] font-bold opacity-60">PCS</span></p>
                                </div>
                                <div className="flex-1 bg-red-500/5 rounded-2xl p-3 border border-red-500/10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ArrowRightLeft size={14} className="text-red-600" />
                                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Outgoing</span>
                                    </div>
                                    <p className="text-lg font-black font-data text-red-700">{selectedStats.transfersOut} <span className="text-[9px] font-bold opacity-60">PCS</span></p>
                                </div>
                            </div>
                        </div>

                        {/* Net Cashflow with Status */}
                        <div className="mt-8 pt-6 border-t border-border-default">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Net Cashflow</p>
                                    <p className={`text-2xl font-black font-data ${netCashflow >= 0 ? 'text-emerald-600' : 'text-brand-red'}`}>₱{netCashflow.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all ${netCashflow >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-brand-red/10 text-brand-red shadow-red-light'}`}>
                                    <TrendingUp size={24} className={netCashflow < 0 ? 'rotate-180' : ''} />
                                </div>
                            </div>
                            {/* Status Badge */}
                            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                                netCashflow > 10000 ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                                netCashflow > 0 ? 'bg-subtle text-text-secondary border border-border-default' :
                                'bg-brand-red/10 text-brand-red border border-brand-red/20'
                            }`}>
                                <div className={`w-2 h-2 rounded-full ${netCashflow > 10000 ? 'bg-emerald-500 animate-pulse' : netCashflow > 0 ? 'bg-text-muted' : 'bg-brand-red animate-pulse'}`} />
                                {netCashflow > 10000 ? 'Strong Day' : netCashflow > 0 ? 'Normal Activity' : netCashflow === 0 ? 'No Activity' : 'Net Loss'}
                            </div>
                        </div>
                    </div>

                    {/* Monthly Summary Card */}
                    <div className="bg-surface p-6 rounded-[32px] border border-border-default shadow-sm">
                        <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4">Monthly Snapshot</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-subtle rounded-2xl p-3 border border-border-default">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Total Sales</p>
                                <p className="text-sm font-black text-text-primary font-data">₱{monthlyTotals.sales.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</p>
                            </div>
                            <div className="bg-subtle rounded-2xl p-3 border border-border-default">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Active Days</p>
                                <p className="text-sm font-black text-text-primary font-data">{monthlyTotals.activeDays} <span className="text-text-muted text-[9px] font-bold">days</span></p>
                            </div>
                            <div className="bg-subtle rounded-2xl p-3 border border-border-default">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Avg / Day</p>
                                <p className="text-sm font-black text-text-primary font-data">₱{monthlyTotals.activeDays > 0 ? Math.round(monthlyTotals.sales / monthlyTotals.activeDays).toLocaleString() : '0'}</p>
                            </div>
                            <div className="bg-subtle rounded-2xl p-3 border border-border-default">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Peak Day</p>
                                <p className="text-sm font-black text-brand-red font-data">₱{monthlyTotals.peakSales.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Efficiency Insight Card */}
                    <div className="bg-brand-charcoal p-8 rounded-[40px] text-white relative overflow-hidden group shadow-2xl">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-red/10 rounded-full transition-transform duration-700 group-hover:scale-125 blur-2xl" />
                        <div className="relative z-10">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Efficiency Insight</h3>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Sales Ratio</p>
                                    <p className="text-lg font-black font-data text-white">
                                        {selectedStats.sales > 0 && selectedStats.purchases > 0
                                            ? `${(selectedStats.sales / selectedStats.purchases).toFixed(1)}x`
                                            : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Expense Rate</p>
                                    <p className="text-lg font-black font-data text-brand-red">
                                        {selectedStats.sales > 0
                                            ? `${((selectedStats.purchases + selectedStats.expenses) / selectedStats.sales * 100).toFixed(0)}%`
                                            : '—'}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                "{netCashflow > 50000 ? 'Peak distribution performance. Maintain inventory buffers.' : netCashflow < 0 ? 'Liquidity warning. Optimize purchase cycles and overhead.' : 'Sustained throughput. Monitor daily transaction logs for outliers.'}"
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {loading && <div className="fixed inset-0 bg-surface/50 backdrop-blur-sm flex items-center justify-center z-50"><RefreshCw size={24} className="animate-spin text-brand-red" /></div>}
        </div>
    );
}

function EnhancedDetailRow({ icon, label, value, color, bg, barColor, total, prevValue }: { icon: React.ReactNode, label: string, value: number, color: string, bg: string, barColor: string, total: number, prevValue?: number }) {
    const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
    const change = prevValue !== undefined && prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : null;

    return (
        <div className="group">
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center ${color} transition-transform group-hover:scale-110`}>{icon}</div>
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-tight">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    {change !== null && (
                        <span className={`text-[9px] font-black flex items-center gap-0.5 ${change >= 0 ? 'text-emerald-600' : 'text-brand-red'}`}>
                            {change >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {Math.abs(Math.round(change))}%
                        </span>
                    )}
                    <span className={`text-sm font-black font-data ${color}`}>₱{value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-subtle rounded-full overflow-hidden ml-9">
                <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
