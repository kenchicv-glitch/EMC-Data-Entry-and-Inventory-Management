import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    format, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameDay, addMonths, subMonths,
    startOfWeek, endOfWeek, isToday
} from 'date-fns';
import {
    DollarSign, ArrowUpRight, ArrowDownRight,
    RefreshCw, Download, Calendar as CalendarIcon, TrendingUp, ChevronLeft, ChevronRight, ShoppingCart, Wallet
} from 'lucide-react';
import { exportToCSV } from '../lib/exportUtils';

interface DailyStats {
    date: string;
    sales: number;
    purchases: number;
    expenses: number;
    refunds: number;
    returns: number;
}

export default function DailySalesSummary() {
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
            const [salesRes, purchasesRes, expensesRes, refundsRes, returnsRes] = await Promise.all([
                supabase.from('sales').select('total_price, date').gte('date', startStr).lte('date', endStr),
                supabase.from('purchases').select('total_price, date').gte('date', startStr).lte('date', endStr),
                supabase.from('expenses').select('amount, date').gte('date', startStr).lte('date', endStr),
                supabase.from('customer_refunds').select('total_price, date').gte('date', startStr).lte('date', endStr),
                supabase.from('supplier_returns').select('total_price, date').gte('date', startStr).lte('date', endStr)
            ]);

            const newStats: Record<string, DailyStats> = {};
            const getD = (d: string) => format(new Date(d), 'yyyy-MM-dd');

            salesRes.data?.forEach(s => {
                const d = getD(s.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0 };
                newStats[d].sales += s.total_price || 0;
            });

            purchasesRes.data?.forEach(p => {
                const d = getD(p.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0 };
                newStats[d].purchases += p.total_price || 0;
            });

            expensesRes.data?.forEach(e => {
                const d = getD(e.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0 };
                newStats[d].expenses += e.amount || 0;
            });

            refundsRes.data?.forEach(r => {
                const d = getD(r.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0 };
                newStats[d].refunds += r.total_price || 0;
            });

            returnsRes.data?.forEach(r => {
                const d = getD(r.date);
                if (!newStats[d]) newStats[d] = { date: d, sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0 };
                newStats[d].returns += r.total_price || 0;
            });

            setStats(newStats);
        } catch (error) {
            console.error('Error fetching summary data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

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
        sales: 0, purchases: 0, expenses: 0, refunds: 0, returns: 0
    };

    const netCashflow = selectedStats.sales - selectedStats.purchases - selectedStats.expenses - selectedStats.refunds + selectedStats.returns;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-charcoal tracking-tight font-data flex items-center gap-2 uppercase">
                        <CalendarIcon className="text-brand-red" size={24} /> Daily Performance
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">Track daily cash flow and transaction highlights</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-bento active:scale-95">
                        <Download size={14} /> Monthly Export
                    </button>
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-bento">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronLeft size={16} /></button>
                        <span className="px-3 text-sm font-bold text-brand-charcoal min-w-[120px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8 bento-card p-6">
                    <div className="grid grid-cols-7 gap-1 mb-4">
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                            <div key={day} className="text-center py-2 text-[10px] font-black text-slate-400 tracking-widest uppercase">{day}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayStats = stats[dateStr];
                            const isSelected = isSameDay(day, selectedDate);
                            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                            return (
                                <button key={dateStr} onClick={() => setSelectedDate(day)}
                                    className={`relative min-h-[90px] p-2 rounded-xl border-2 transition-all flex flex-col group ${isSelected ? 'border-brand-red bg-brand-red-light' : isCurrentMonth ? 'border-slate-50 bg-slate-50/50 hover:border-slate-200 hover:bg-white' : 'border-transparent opacity-30 pointer-events-none'}`}>
                                    <span className={`text-xs font-black ${isSelected ? 'text-brand-red' : 'text-slate-400'} ${isToday(day) ? 'bg-brand-red text-white w-5 h-5 flex items-center justify-center rounded-full' : ''}`}>{format(day, 'd')}</span>
                                    <div className="mt-auto space-y-1">
                                        {dayStats && dayStats.sales > 0 && <div className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-brand-red" /><span className="text-[10px] font-bold text-brand-charcoal">₱{Math.round(dayStats.sales / 1000)}k</span></div>}
                                        {dayStats && dayStats.purchases > 0 && <div className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-slate-400" /><span className="text-[10px] font-bold text-slate-500">₱{Math.round(dayStats.purchases / 1000)}k</span></div>}
                                    </div>
                                    {isSelected && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-brand-red rounded-full" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
                    <div className="bento-card p-6 border-l-4 border-l-brand-red">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-brand-charcoal text-sm uppercase tracking-wider">{format(selectedDate, 'MMMM d, yyyy')}</h3>
                            <div className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase tracking-widest">{format(selectedDate, 'EEEE')}</div>
                        </div>
                        <div className="space-y-4">
                            <DetailRow icon={<DollarSign size={16} />} label="Daily Sales" value={selectedStats.sales} color="text-brand-red" bg="bg-brand-red-light" />
                            <DetailRow icon={<ShoppingCart size={16} />} label="Purchases" value={selectedStats.purchases} color="text-slate-600" bg="bg-slate-100" />
                            <DetailRow icon={<Wallet size={16} />} label="Expenses" value={selectedStats.expenses} color="text-slate-600" bg="bg-slate-100" />
                            <DetailRow icon={<ArrowDownRight size={16} />} label="Refunds" value={selectedStats.refunds} color="text-orange-600" bg="bg-orange-50" />
                            <DetailRow icon={<ArrowUpRight size={16} />} label="Returns" value={selectedStats.returns} color="text-green-600" bg="bg-green-50" />
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Cashflow</p>
                                <p className={`text-xl font-black font-data ${netCashflow >= 0 ? 'text-brand-charcoal' : 'text-brand-red'}`}>₱{netCashflow.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${netCashflow >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-brand-red'}`}>
                                <TrendingUp size={20} className={netCashflow < 0 ? 'rotate-180' : ''} />
                            </div>
                        </div>
                    </div>
                    <div className="bento-card p-6 bg-brand-charcoal text-white relative overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-red/10 rounded-full transition-transform duration-500 group-hover:scale-110" />
                        <div className="relative z-10">
                            <h3 className="font-bold flex items-center gap-2 mb-6">Daily Flow</h3>
                            <p className="text-sm text-slate-300 italic leading-relaxed">
                                "{netCashflow > 50000 ? 'Excellent performance today. Stock up on trending items.' : netCashflow < 0 ? 'Negative cashflow today. Review high purchase volumes or expenses.' : 'Steady movement. Ensure all transactions are logged real-time.'}"
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {loading && <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50"><RefreshCw size={24} className="animate-spin text-brand-red" /></div>}
        </div>
    );
}

function DetailRow({ icon, label, value, color, bg }: { icon: React.ReactNode, label: string, value: number, color: string, bg: string }) {
    return (
        <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${color} transition-transform group-hover:scale-110`}>{icon}</div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{label}</span>
            </div>
            <span className={`text-sm font-black font-data ${color}`}>₱{value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
    );
}
