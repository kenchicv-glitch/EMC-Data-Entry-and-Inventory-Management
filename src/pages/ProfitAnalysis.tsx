import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import {
    TrendingUp, DollarSign, PieChart as PieChartIcon,
    Activity, Calendar as CalendarIcon
} from 'lucide-react';
import { startOfMonth, endOfMonth, format, isSameDay } from 'date-fns';
import Calendar from '../components/Calendar';

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
    products: {
        name: string;
        buying_price: number;
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
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [groupedSales, setGroupedSales] = useState<Record<string, GroupedSale>>({});

    const fetchProfitData = useCallback(async () => {
        setLoading(true);
        const monthStart = startOfMonth(selectedDate).toISOString();
        const monthEnd = endOfMonth(selectedDate).toISOString();

        // 1. Fetch Sales with Product Buying Price
        const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('total_price, quantity, vat_amount, date, products(name, buying_price)')
            .gte('date', monthStart)
            .lte('date', monthEnd);

        if (salesError) console.error(salesError);

        // 2. Fetch Expenses for the month
        const { data: expensesData } = await supabase
            .from('expenses')
            .select('amount, date')
            .gte('date', monthStart)
            .lte('date', monthEnd);

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

        // Calculate Stats for the SELECTED DATE
        const dailySales = sales.filter(s => isSameDay(new Date(s.date), selectedDate));
        const dailyExpenses = expenses.filter(e => isSameDay(new Date(e.date), selectedDate));

        const revenue = dailySales.reduce((sum, s) => sum + s.total_price, 0);
        const vat = dailySales.reduce((sum, s) => sum + (s.vat_amount || 0), 0);
        const cogs = dailySales.reduce((sum, s) => {
            const buyingPrice = s.products?.buying_price || 0;
            return sum + (s.quantity * buyingPrice);
        }, 0);
        const expenseTotal = dailyExpenses.reduce((sum, e) => sum + e.amount, 0);

        setStats({
            totalRevenue: revenue,
            totalCOGS: cogs,
            grossProfit: revenue - cogs,
            netProfit: (revenue - cogs) - expenseTotal,
            totalExpenses: expenseTotal,
            vatAmount: vat
        });

        // 3. Category Breakdown (for the whole month or selected date? Let's do month for better chart)
        const cats: Record<string, { profit: number; revenue: number }> = {};
        sales.forEach(s => {
            const nameParts = s.products?.name.split(' > ') || ['Uncategorized'];
            const l1 = nameParts[0];
            if (!cats[l1]) cats[l1] = { profit: 0, revenue: 0 };
            const buyingPrice = s.products?.buying_price || 0;
            cats[l1].revenue += s.total_price;
            cats[l1].profit += (s.total_price - (s.quantity * buyingPrice));
        });

        setCategoryData(Object.entries(cats).map(([name, data]) => ({
            name,
            profit: data.profit,
            revenue: data.revenue
        })).sort((a, b) => b.profit - a.profit));

        setLoading(false);
    }, [selectedDate]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) await fetchProfitData();
        };
        load();
        return () => { mounted = false; };
    }, [fetchProfitData]);

    const activeDates = Object.keys(groupedSales);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-brand-charcoal tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200"><TrendingUp className="text-white" size={24} /></div>
                        Profit Analysis
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">Real-time profitability and margin tracking</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-shrink-0">
                    <div className="sticky top-6">
                        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} activeDates={activeDates} />
                        <div className="mt-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 border-b border-slate-50 pb-3 mb-4 uppercase tracking-[0.2em]">Quick Metrics</h3>
                            <div className="space-y-4">
                                <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Margin</p><p className="text-xl font-black text-emerald-600 font-data">{stats.totalRevenue > 0 ? ((stats.grossProfit / stats.totalRevenue) * 100).toFixed(1) : 0}%</p></div>
                                <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">VAT Payable</p><p className="text-xl font-black text-brand-charcoal font-data">₱{stats.vatAmount.toLocaleString()}</p></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-6 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                        <MetricCard icon={<DollarSign size={20} />} label="Total Revenue" value={stats.totalRevenue} color="text-brand-charcoal" loading={loading} />
                        <MetricCard icon={<Activity size={20} />} label="Total COGS" value={stats.totalCOGS} color="text-slate-500" loading={loading} />
                        <MetricCard icon={<TrendingUp size={20} />} label="Gross Profit" value={stats.grossProfit} color="text-emerald-600" loading={loading} />
                        <MetricCard icon={<TrendingUp size={20} />} label="Net Profit" value={stats.netProfit} color="text-blue-600" loading={loading} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div><h3 className="text-lg font-black text-brand-charcoal flex items-center gap-2 tracking-tight"><PieChartIcon size={20} className="text-brand-red" /> PROFIT BY CATEGORY</h3><p className="text-xs text-slate-400 font-medium">Monthly breakdown by Master Category</p></div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="profit">
                                            {categoryData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                        </Pie>
                                        <Tooltip formatter={(v: number | string | undefined) => v !== undefined ? `₱${Number(v).toLocaleString()}` : ''} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div><h3 className="text-lg font-black text-brand-charcoal flex items-center gap-2 tracking-tight"><Activity size={20} className="text-brand-red" /> REVENUE VS PROFIT</h3><p className="text-xs text-slate-400 font-medium">Comparative performance analysis</p></div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={categoryData.slice(0, 5)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v: number | string | undefined) => v !== undefined ? `₱${Number(v).toLocaleString()}` : ''} />
                                        <Bar dataKey="revenue" fill="#EE3E3E" radius={[4, 4, 0, 0]} barSize={24} name="Revenue" />
                                        <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} name="Profit" />
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
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">{icon}</div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><CalendarIcon size={12} /> Today</div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
            {loading ? <div className="h-8 bg-slate-50 animate-pulse rounded w-24"></div> : <p className={`text-2xl font-black ${color} font-data`}>₱{value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>}
        </div>
    );
}
