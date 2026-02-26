import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { startOfDay, endOfDay, format } from 'date-fns';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
    DollarSign, Package, ArrowUpRight, ArrowDownRight,
    Clock,
    Plus, ShoppingCart, LayoutDashboard, Receipt, RotateCcw
} from 'lucide-react';
import ProductModal from '../components/ProductModal';
import ReportModal from '../components/ReportModal';
import Calendar from '../components/Calendar';
import { isSameDay } from 'date-fns';

interface DailyStat {
    totalSales: number;
    itemsSold: number;
    transactionCount: number;
    totalPurchases: number;
}

interface LowStockItem {
    id: string;
    name: string;
    stock_available: number;
}

interface RecentSale {
    id: string;
    quantity: number;
    total_price: number;
    date: string;
    invoice_number: string;
    products: { name: string } | null;
}

interface WeeklyPoint {
    day: string;
    sales: number;
    purchases: number;
}

interface SupabaseSale {
    total_price: number;
    date: string;
    quantity: number;
}

interface SupabasePurchase {
    total_price: number;
    discount_amount: number;
    date: string;
}

export default function Dashboard() {
    const [stats, setStats] = useState<DailyStat>({ totalSales: 0, itemsSold: 0, transactionCount: 0, totalPurchases: 0 });
    const [prevStats, setPrevStats] = useState<DailyStat>({ totalSales: 0, itemsSold: 0, transactionCount: 0, totalPurchases: 0 });
    const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>([]);
    const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
    const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
        start: new Date(),
        end: new Date()
    });
    const [isDateRangeActive, setIsDateRangeActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const { role } = useAuth();
    const [selectedLowStockProduct, setSelectedLowStockProduct] = useState<LowStockItem | null>(null);
    const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const navigate = useNavigate();

    const fetchDashboardData = useCallback(async (start?: Date, end?: Date) => {
        setLoading(true);
        const filterStart = start || dateRange.start;
        const filterEnd = end || dateRange.end;

        const rangeStart = startOfDay(filterStart).toISOString();
        const rangeEnd = endOfDay(filterEnd).toISOString();

        // Previous period for trend calculation
        const diff = filterEnd.getTime() - filterStart.getTime();
        const prevEnd = new Date(filterStart.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - diff);
        const yesterdayStart = startOfDay(prevStart).toISOString();
        const yesterdayEnd = endOfDay(prevEnd).toISOString();

        const { data: currentSales } = await supabase
            .from('sales')
            .select('quantity, total_price, date, products(name)')
            .gte('date', rangeStart)
            .lte('date', rangeEnd);

        const { data: previousSales } = await supabase
            .from('sales')
            .select('quantity, total_price')
            .gte('date', yesterdayStart)
            .lte('date', yesterdayEnd);

        const { data: currentPurchases } = await supabase
            .from('purchases')
            .select('total_price, vat_amount, discount_amount, date')
            .gte('date', rangeStart)
            .lte('date', rangeEnd);

        const { data: allProducts } = await supabase
            .from('products')
            .select('id, name, stock_available, low_stock_threshold')
            .order('stock_available', { ascending: true });

        const lowStock = (allProducts || []).filter(p => p.stock_available <= (p.low_stock_threshold || 10)).slice(0, 5);

        const { data: recent } = await supabase
            .from('sales')
            .select('id, quantity, total_price, date, invoice_number, products(name)')
            .order('date', { ascending: false })
            .limit(10);

        const sales = (currentSales as unknown as SupabaseSale[]) || [];
        const purchases = (currentPurchases as unknown as SupabasePurchase[]) || [];
        const prevSales = (previousSales as unknown as SupabaseSale[]) || [];

        const currentStats: DailyStat = {
            totalSales: sales.reduce((a, s) => a + (s.total_price || 0), 0),
            itemsSold: sales.reduce((a, s) => a + (s.quantity || 0), 0),
            transactionCount: sales.length,
            totalPurchases: purchases.reduce((a, p) => a + ((p.total_price || 0) - (p.discount_amount || 0)), 0),
        };
        const pStats: DailyStat = {
            totalSales: prevSales.reduce((a, s) => a + (s.total_price || 0), 0),
            itemsSold: prevSales.reduce((a, s) => a + (s.quantity || 0), 0),
            transactionCount: prevSales.length,
            totalPurchases: 0,
        };

        setStats(currentStats);
        setPrevStats(pStats);

        // Map data for chart based on selection
        const chartData: WeeklyPoint[] = [];
        if (!isDateRangeActive || isSameDay(filterStart, filterEnd)) {
            // Show hourly trend if single day? Actually user asked for summary day ONLY.
            // Let's show day of week comparison or just the single point for now.
            chartData.push({
                day: format(filterStart, 'MMM d'),
                sales: currentStats.totalSales,
                purchases: currentStats.totalPurchases
            });
        } else {
            // Show trend over range
            const dayMap: Record<string, { sales: number; purchases: number }> = {};
            sales.forEach(s => {
                const day = format(new Date(s.date), 'MMM d');
                if (!dayMap[day]) dayMap[day] = { sales: 0, purchases: 0 };
                dayMap[day].sales += s.total_price || 0;
            });
            purchases.forEach(p => {
                const day = format(new Date(p.date), 'MMM d');
                if (!dayMap[day]) dayMap[day] = { sales: 0, purchases: 0 };
                dayMap[day].purchases += (p.total_price || 0) - (p.discount_amount || 0);
            });
            Object.entries(dayMap).forEach(([day, vals]) => {
                chartData.push({ day, ...vals });
            });
        }
        setWeeklyData(chartData);
        setLowStockItems((lowStock as LowStockItem[]) || []);
        setRecentSales((recent as unknown as RecentSale[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) await fetchDashboardData();
        };
        load();
        const channel = supabase.channel('dashboard_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => { if (mounted) fetchDashboardData(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => { if (mounted) fetchDashboardData(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => { if (mounted) fetchDashboardData(); })
            .subscribe();
        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [fetchDashboardData]);

    const handleDateSelect = (date: Date) => {
        if (!isDateRangeActive) {
            const newRange = { start: date, end: date };
            setDateRange(newRange);
            fetchDashboardData(newRange.start, newRange.end);
            return;
        }

        if (!dateRange.start || (dateRange.start && dateRange.end && !isSameDay(dateRange.start, dateRange.end))) {
            setDateRange({ start: date, end: date });
        } else {
            const newRange = date < dateRange.start
                ? { start: date, end: dateRange.start }
                : { start: dateRange.start, end: date };
            setDateRange(newRange);
            fetchDashboardData(newRange.start, newRange.end);
        }
    };

    const activeDates = useMemo(() => {
        // This is expensive if we have 1000s of sales, but okay for overview
        return []; // Dynamic fetch would be better but let's keep it simple
    }, []);


    const getTrend = useCallback((current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    }, []);

    const revenueTrend = useMemo(() => getTrend(stats.totalSales, prevStats.totalSales), [stats.totalSales, prevStats.totalSales, getTrend]);
    const txTrend = useMemo(() => getTrend(stats.transactionCount, prevStats.transactionCount), [stats.transactionCount, prevStats.transactionCount, getTrend]);

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Calming Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-[24px] flex items-center justify-center shadow-xl border border-slate-100 group transition-all hover:scale-105 active:scale-95">
                        <LayoutDashboard className="text-brand-red group-hover:rotate-12 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-brand-charcoal tracking-tight">Overview</h1>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Business health and distribution performance at a glance</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsReportModalOpen(true)} className="flex items-center gap-2 bg-brand-charcoal text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg active:scale-95">
                        <Plus size={18} /> GENERATE REPORT
                    </button>
                </div>
            </div>


            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Controls Sidebar */}
                <div className="flex-shrink-0 w-full lg:w-80">
                    <div className="sticky top-6 space-y-6">
                        {/* Dynamic Calendar */}
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-5">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Summary Period</h3>
                                    <button
                                        onClick={() => setIsDateRangeActive(!isDateRangeActive)}
                                        className={`text-[9px] font-black px-3 py-1 rounded-full uppercase transition-all ${isDateRangeActive ? 'bg-brand-red text-white shadow-red' : 'bg-slate-100 text-slate-400'}`}
                                    >
                                        {isDateRangeActive ? 'Range' : 'Single Day'}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50/80 p-3 rounded-2xl border border-slate-100/50">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Active Selection
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
                        </div>

                        {/* Low Stock Indicator */}
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Critical Stock</h3>
                                <span className="text-[10px] font-bold bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full">{lowStockItems.length}</span>
                            </div>
                            <div className="space-y-4">
                                {loading ? [1, 2, 3].map(i => <div key={i} className="h-12 skeleton rounded-2xl" />) :
                                    lowStockItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate('/inventory')}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center"><Package size={14} /></div>
                                                <p className="text-xs font-bold text-slate-700 group-hover:text-brand-red transition-colors">{item.name}</p>
                                            </div>
                                            <span className="text-xs font-black text-brand-red font-data">{item.stock_available}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 space-y-8">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <MetricCard icon={<DollarSign size={20} />} label="Total Revenue" value={stats.totalSales} trend={revenueTrend} loading={loading} onClick={() => navigate('/summary')} isCurrency />
                        <MetricCard icon={<Receipt size={20} />} label="Transactions" value={stats.transactionCount} trend={txTrend} loading={loading} onClick={() => navigate('/sales')} />
                        <MetricCard icon={<RotateCcw size={20} />} label="Return Volume" value={stats.totalPurchases} trend={0} loading={loading} onClick={() => navigate('/returns')} isCurrency />
                    </div>

                    {/* Performance Visualization */}
                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-black text-brand-charcoal uppercase tracking-tight">Flow Analysis</h3>
                                <p className="text-xs text-slate-400 font-medium mt-1">Movement of sales and purchases across the period</p>
                            </div>
                            <div className="flex gap-6 items-center">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-red shadow-red" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Revenue</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-300" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expenses</span></div>
                            </div>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#E2E8F060" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94A3B8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94A3B8' }} />
                                    <Tooltip
                                        cursor={{ fill: '#EE3E3E08' }}
                                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '16px' }}
                                        formatter={(v: any) => [`₱${Number(v).toLocaleString()}`, 'Value']}
                                    />
                                    <Bar dataKey="sales" fill="#EE3E3E" radius={[8, 8, 0, 0]} barSize={32} />
                                    <Bar dataKey="purchases" fill="#CBD5E1" radius={[8, 8, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Activity & Health */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Recent Activity Mini-Feed */}
                        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-sm font-black text-brand-charcoal uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={16} className="text-brand-red" /> Recent Activity
                                </h3>
                                <button onClick={() => navigate('/sales')} className="text-[10px] font-black text-slate-400 hover:text-brand-red transition-colors group">VIEW ALL <ArrowUpRight size={12} className="inline ml-1" /></button>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {loading ? [1, 2, 3].map(i => <div key={i} className="p-5 h-16 skeleton" />) :
                                    recentSales.slice(0, 5).map((sale) => (
                                        <div key={sale.id} className="p-5 flex items-center justify-between hover:bg-slate-50/80 transition-all cursor-pointer group" onClick={() => navigate('/sales')}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-brand-red/10 group-hover:text-brand-red transition-all"><ShoppingCart size={18} /></div>
                                                <div>
                                                    <p className="text-xs font-black text-brand-charcoal">{sale.products?.name}</p>
                                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{sale.invoice_number}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-brand-charcoal font-data">₱{sale.total_price.toLocaleString()}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>

                        {/* Health Summary Card */}
                        <div className="bg-brand-charcoal rounded-[32px] p-8 text-white relative overflow-hidden flex flex-col justify-between group shadow-2xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red/10 rounded-full blur-[80px] -mr-32 -mt-32 group-hover:bg-brand-red/20 transition-all duration-1000" />
                            <div className="relative z-10">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Quick Health Summary</h4>
                                <div className="space-y-6">
                                    <div>
                                        <span className="text-5xl font-black font-data tracking-tight">{stats.transactionCount}</span>
                                        <p className="text-[10px] font-black text-brand-red uppercase tracking-[0.2em] mt-1">Confirmed Transactions</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Items Dispatched</p>
                                            <p className="text-xl font-black font-data">{stats.itemsSold}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fulfillment Target</p>
                                            <p className="text-xl font-black font-data text-brand-red">94%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsReportModalOpen(true)} className="relative z-10 w-full mt-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-red hover:border-brand-red transition-all">Detailed Analysis Report</button>
                        </div>
                    </div>
                </div>
            </div>


            <ProductModal
                isOpen={isLowStockModalOpen}
                onClose={() => { setIsLowStockModalOpen(false); setSelectedLowStockProduct(null); }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                product={selectedLowStockProduct as any}
                onSuccess={() => fetchDashboardData()}
                role={role as 'admin' | 'encoder' | null}
            />

            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            />
        </div>
    );
}

function MetricCard({ icon, label, value, trend, loading, onClick, isCurrency }: { icon: React.ReactNode; label: string; value: number; trend: number; loading: boolean; onClick?: () => void; isCurrency?: boolean; }) {
    const isPositive = trend >= 0;
    return (
        <div onClick={onClick} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer group">
            <div className="flex items-center justify-between mb-4"><div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand-red group-hover:text-white transition-colors">{icon}</div>{!loading && (<div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-brand-red'}`}>{isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{Math.abs(Math.round(trend))}%</div>)}</div>
            <div><p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{label}</p>{loading ? <div className="h-8 w-24 skeleton rounded-lg" /> : <p className="text-2xl font-black text-brand-charcoal font-data tracking-tight">{isCurrency ? `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : value.toLocaleString()}</p>}</div>
        </div>
    );
}
