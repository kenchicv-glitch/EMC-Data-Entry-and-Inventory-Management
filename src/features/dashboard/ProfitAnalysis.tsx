import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../shared/lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import {
    TrendingUp, DollarSign, PieChart as PieChartIcon,
    Activity, Calendar as CalendarIcon
} from 'lucide-react';
import { startOfDay, endOfDay, format, isSameDay } from 'date-fns';
import Calendar from '../../features/reports/components/Calendar';
import { useBranch } from '../../shared/lib/BranchContext';
import { Building2 } from 'lucide-react';

interface ProfitStats {
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    netProfit: number;
    totalExpenses: number;
    vatAmount: number;
}

interface CategoryProfit {
    name: string;
    profit: number;
    revenue: number;
}

interface SupabaseSale {
    total_price: number;
    quantity: number;
    vat_amount: number;
    date: string;
    cost_price: number;
    products: {
        name: string;
    } | null;
}

interface GroupedSale {
    total_price: number;
    quantity: number;
    vat_amount: number;
}

const COLORS = ['#EE3E3E', '#5A6E8C', '#F59E0B', '#10B981', '#6366F1', '#EC4899'];

export default function ProfitAnalysis() {
    const [stats, setStats] = useState<ProfitStats>({
        totalRevenue: 0,
        totalCOGS: 0,
        grossProfit: 0,
        netProfit: 0,
        totalExpenses: 0,
        vatAmount: 0
    });
    const [categoryData, setCategoryData] = useState<CategoryProfit[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
        start: new Date(),
        end: new Date()
    });
    const [isDateRangeActive, setIsDateRangeActive] = useState(false);
    const [groupedSales, setGroupedSales] = useState<Record<string, GroupedSale>>({});

    const { branches } = useBranch();
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null); // null = all branches

    const fetchProfitData = useCallback(async () => {
        setLoading(true);
        const rangeStart = startOfDay(dateRange.start).toISOString();
        const rangeEnd = endOfDay(dateRange.end).toISOString();

        // 1. Fetch Sales
        let salesQuery = supabase
            .from('sales')
            .select('total_price, quantity, vat_amount, date, cost_price, products(name)')
            .gte('date', rangeStart)
            .lte('date', rangeEnd);

        // 2. Fetch Expenses
        let expensesQuery = supabase
            .from('expenses')
            .select('amount, date')
            .gte('date', rangeStart)
            .lte('date', rangeEnd);
            
        const branchFilter = selectedBranchId || null;
        if (branchFilter) {
            salesQuery = salesQuery.eq('branch_id', branchFilter);
            expensesQuery = expensesQuery.eq('branch_id', branchFilter);
        }

        const { data: salesData } = await salesQuery;
        const { data: expensesData } = await expensesQuery;

        const sales = (salesData as unknown as SupabaseSale[]) || [];
        const expenses = expensesData || [];


        // Group sales for calendar highlights
        const salesByDate: Record<string, GroupedSale> = {};
        sales.forEach(s => {
            const d = format(new Date(s.date), 'yyyy-MM-dd');
            if (!salesByDate[d]) salesByDate[d] = { total_price: 0, quantity: 0, vat_amount: 0 };
            salesByDate[d].total_price += s.total_price;
            salesByDate[d].quantity += s.quantity;
            salesByDate[d].vat_amount += s.vat_amount || 0;
        });
        setGroupedSales(salesByDate);

        // All aggregated stats for the selected range
        const totalRevenue = sales.reduce((sum, s) => sum + s.total_price, 0);
        const totalVAT = sales.reduce((sum, s) => sum + (s.vat_amount || 0), 0);
        const totalCOGS = sales.reduce((sum, s) => sum + (s.quantity * (s.cost_price || 0)), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        setStats({
            totalRevenue,
            totalCOGS,
            grossProfit: totalRevenue - totalCOGS,
            netProfit: (totalRevenue - totalCOGS) - totalExpenses,
            totalExpenses,
            vatAmount: totalVAT
        });

        // Category Breakdown
        const cats: Record<string, { profit: number; revenue: number }> = {};
        sales.forEach(s => {
            const nameParts = s.products?.name.split(' > ') || ['Uncategorized'];
            const l1 = nameParts[0];
            if (!cats[l1]) cats[l1] = { profit: 0, revenue: 0 };
            const cost = s.cost_price || 0;
            cats[l1].revenue += s.total_price;
            cats[l1].profit += (s.total_price - (s.quantity * cost));
        });

        setCategoryData(Object.entries(cats).map(([name, data]) => ({
            name,
            profit: data.profit,
            revenue: data.revenue
        })).sort((a, b) => b.profit - a.profit));

        setLoading(false);
    }, [dateRange, selectedBranchId]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) await fetchProfitData();
        };
        load();
        return () => { mounted = false; };
    }, [fetchProfitData]);

    const handleDateSelect = (date: Date) => {
        if (!isDateRangeActive) {
            setDateRange({ start: date, end: date });
            return;
        }

        if (!dateRange.start || (dateRange.start && dateRange.end && !isSameDay(dateRange.start, dateRange.end))) {
            setDateRange({ start: date, end: date });
        } else {
            const newRange = date < dateRange.start
                ? { start: date, end: dateRange.start }
                : { start: dateRange.start, end: date };
            setDateRange(newRange);
        }
    };

    const activeDates = Object.keys(groupedSales);

    return (
        <div className="space-y-8 animate-fade-in pb-10 bg-bg-base">
            {/* Standard Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-bg-surface rounded-[24px] flex items-center justify-center shadow-xl border border-border-muted group transition-all hover:scale-105 active:scale-95">
                        <TrendingUp className="text-brand-red group-hover:rotate-12 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tight uppercase">Profit Analysis</h1>
                        <p className="text-sm text-text-secondary mt-1 font-medium">Real-time profitability and margin tracking</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Controls */}
                <div className="flex-shrink-0 w-full lg:w-80">
                    <div className="sticky top-6 space-y-6">
                        <div className="bg-bg-surface p-6 rounded-[32px] border border-border-muted shadow-sm space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Summary Period</h3>
                                <button
                                    onClick={() => setIsDateRangeActive(!isDateRangeActive)}
                                    className={`text-[9px] font-black px-3 py-1 rounded-full uppercase transition-all ${isDateRangeActive ? 'bg-brand-red text-text-inverse shadow-red' : 'bg-bg-subtle text-text-muted'}`}
                                >
                                    {isDateRangeActive ? 'Range' : 'Single Day'}
                                </button>
                            </div>
                            <div className="flex items-center justify-between bg-bg-subtle p-3 rounded-2xl border border-border-muted/50">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                    Selection
                                </span>
                                {(dateRange.start && dateRange.end) && (
                                    <span className="text-[10px] font-black text-brand-red">
                                        {isDateRangeActive && !isSameDay(dateRange.start, dateRange.end)
                                            ? `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d')}`
                                            : format(dateRange.start, 'MMM d, yyyy')}
                                    </span>
                                )}
                            </div>
                            <Calendar
                                selectedDate={dateRange.start}
                                onDateSelect={handleDateSelect}
                                rangeStart={isDateRangeActive ? dateRange.start : null}
                                rangeEnd={isDateRangeActive ? dateRange.end : null}
                                activeDates={activeDates}
                            />
                        </div>

                        {/* Branch Filter */}
                        <div className="bg-bg-surface p-5 rounded-[28px] border border-border-muted shadow-sm">
                            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-3">Branch Filter</h3>
                            <div className="space-y-1.5">
                                <button
                                    onClick={() => setSelectedBranchId(null)}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!selectedBranchId ? 'bg-brand-red text-white shadow-red' : 'bg-bg-subtle text-text-muted hover:bg-bg-muted'}`}
                                >
                                    <Building2 size={12} /> All Branches
                                </button>
                                {branches.map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => setSelectedBranchId(b.id)}
                                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedBranchId === b.id ? 'bg-brand-red text-white shadow-red' : 'bg-bg-subtle text-text-muted hover:bg-bg-muted'}`}
                                    >
                                        <Building2 size={12} /> {b.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-bg-surface p-7 rounded-[32px] border border-border-muted shadow-sm">
                            <h3 className="text-[10px] font-black text-text-muted border-b border-border-muted pb-4 mb-5 uppercase tracking-[0.2em]">Efficiency KPIs</h3>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Effective Gross Margin</p>
                                    <p className="text-2xl font-black text-emerald-500 font-data">
                                        {stats.totalRevenue > 0 ? ((stats.grossProfit / stats.totalRevenue) * 100).toFixed(1) : '0.0'}%
                                    </p>
                                </div>
                                <div className="pt-4 border-t border-border-muted">
                                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">VAT Liability (Estimated)</p>
                                    <p className="text-2xl font-black text-text-primary font-data">
                                        ₱{stats.vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-8 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                        <MetricCard icon={<DollarSign size={20} />} label="Total Revenue" value={stats.totalRevenue} color="text-text-primary" loading={loading} />
                        <MetricCard icon={<Activity size={20} />} label="Cost of Goods" value={stats.totalCOGS} color="text-text-secondary" loading={loading} />
                        <MetricCard icon={<TrendingUp size={20} />} label="Gross Profit" value={stats.grossProfit} color="text-emerald-500" loading={loading} />
                        <MetricCard icon={<TrendingUp size={20} />} label="Net Profit" value={stats.netProfit} color="text-blue-500" loading={loading} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* CHART 1: Category Breakdown */}
                        <div className="bg-bg-surface p-8 rounded-[40px] border border-border-muted shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <PieChartIcon size={64} className="text-brand-red" />
                            </div>
                            <div className="mb-10">
                                <h3 className="text-sm font-black text-text-primary uppercase tracking-[0.1em]">Profit by Master Category</h3>
                                <p className="text-xs text-text-secondary font-medium mt-1">Weighted distribution of net earnings</p>
                            </div>
                            <div className="h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={8} dataKey="profit" stroke="none">
                                            {categoryData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--bg-surface)', borderRadius: '20px', border: '1px solid var(--border-muted)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '15px' }}
                                            formatter={(v: any) => [`₱${Number(v).toLocaleString()}`, 'Profit']}
                                        />
                                        <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', paddingTop: '20px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* CHART 2: Revenue vs Profit */}
                        <div className="bg-bg-surface p-8 rounded-[40px] border border-border-muted shadow-sm">
                            <div className="mb-10">
                                <h3 className="text-sm font-black text-text-primary uppercase tracking-[0.1em]">Revenue vs Margin</h3>
                                <p className="text-xs text-text-secondary font-medium mt-1">Comparative top-line and bottom-line growth</p>
                            </div>
                            <div className="h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={categoryData.slice(0, 5)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-muted)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: 'var(--text-muted)' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: 'var(--text-muted)' }} />
                                        <Tooltip cursor={{ fill: 'var(--bg-subtle)' }} contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-muted)', borderRadius: '12px' }} formatter={(v: any) => `₱${Number(v).toLocaleString()}`} />
                                        <Bar dataKey="revenue" fill="var(--color-brand-red)" radius={[10, 10, 0, 0]} barSize={28} name="Revenue" />
                                        <Bar dataKey="profit" fill="var(--color-success)" radius={[10, 10, 0, 0]} barSize={28} name="Profit" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, color, loading }: { icon: React.ReactNode, label: string, value: number, color: string, loading: boolean }) {
    return (
        <div className="bg-bg-surface p-6 rounded-3xl border border-border-muted shadow-sm hover:border-brand-red/30 transition-colors group">
            <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-bg-base/50 rounded-xl flex items-center justify-center text-text-muted transition-colors group-hover:bg-brand-red/10 group-hover:text-brand-red">{icon}</div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-text-muted uppercase tracking-widest"><CalendarIcon size={12} /> Today</div>
            </div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1">{label}</p>
            {loading ? <div className="h-8 bg-bg-subtle animate-pulse rounded w-24"></div> : <p className={`text-2xl font-black ${color} font-data`}>₱{value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>}
        </div>
    );
}
