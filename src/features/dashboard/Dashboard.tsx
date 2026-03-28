import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { isSameDay, startOfDay, endOfDay, format } from 'date-fns';
import { useBranch } from '../../shared/hooks/useBranch';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';
import {
    DollarSign, Package, ArrowUpRight, ArrowDownRight,
    Clock,
    Plus, ShoppingCart, LayoutDashboard, RotateCcw,
    Zap, BarChart3, TrendingUp
} from 'lucide-react';
import { useTheme } from '../../shared/hooks/useTheme';
import ProductModal from '../inventory/components/ProductModal';
import type { Product as ModalProduct } from '../inventory/types/product';
import SalesModal, { type SalesModalProps } from '../sales/components/SalesModal';
import ReportModal from '../../features/reports/components/ReportModal';
import Calendar from '../../features/reports/components/Calendar';
import OsEncodingModal from '../sales/components/OsEncodingModal';

interface DailyStat {
    totalSales: number;
    itemsSold: number;
    transactionCount: number;
    totalPurchases: number;
    totalRefunds: number;
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
    is_finalized?: boolean;
    customer_name?: string;
    fulfillment_status?: string;
    payment_mode?: string;
    is_os?: boolean;
    products: { name: string; brand?: string; id: string; selling_price: number; stock_available: number; } | null;
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
    const [stats, setStats] = useState<DailyStat>({ totalSales: 0, itemsSold: 0, transactionCount: 0, totalPurchases: 0, totalRefunds: 0 });
    const [prevStats, setPrevStats] = useState<DailyStat>({ totalSales: 0, itemsSold: 0, transactionCount: 0, totalPurchases: 0, totalRefunds: 0 });
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
    const { activeBranchId } = useBranch();
    const [selectedLowStockProduct, setSelectedLowStockProduct] = useState<LowStockItem | null>(null);
    const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [selectedSaleForEdit, setSelectedSaleForEdit] = useState<SalesModalProps['editData']>();
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [isOsEncodingOpen, setIsOsEncodingOpen] = useState(false);
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [chartMode, setChartMode] = useState<'bar' | 'area'>('bar');

    const chartColors = {
        grid: isDark ? '#30363D' : '#DEE2E6',
        text: isDark ? '#8B949E' : '#495057',
        tooltip: isDark ? '#161B22' : '#FFFFFF',
        series: ['#388BFD', '#3FB950', '#D29922', '#F85149', '#A371F7']
    };

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

        let sQuery = supabase
            .from('sales')
            .select('quantity, total_price, date, products(name)')
            .gte('date', rangeStart)
            .lte('date', rangeEnd);

        let psQuery = supabase
            .from('sales')
            .select('quantity, total_price')
            .gte('date', yesterdayStart)
            .lte('date', yesterdayEnd);

        let pQuery = supabase
            .from('purchases')
            .select('total_price, vat_amount, discount_amount, date')
            .gte('date', rangeStart)
            .lte('date', rangeEnd);

        let rQuery = supabase
            .from('customer_refunds')
            .select('total_price, date')
            .gte('date', rangeStart)
            .lte('date', rangeEnd);

        let prodQuery = supabase
            .from('products')
            .select('id, name, stock_available, low_stock_threshold')
            .order('stock_available', { ascending: true });

        let recentQuery = supabase
            .from('sales')
            .select('id, quantity, total_price, date, invoice_number, is_finalized, customer_name, fulfillment_status, payment_mode, is_os, products(id, name, brand, selling_price, stock_available)')
            .order('date', { ascending: false })
            .limit(10);

        if (activeBranchId) {
            sQuery = sQuery.eq('branch_id', activeBranchId);
            psQuery = psQuery.eq('branch_id', activeBranchId);
            pQuery = pQuery.eq('branch_id', activeBranchId);
            rQuery = rQuery.eq('branch_id', activeBranchId);
            prodQuery = prodQuery.eq('branch_id', activeBranchId);
            recentQuery = recentQuery.eq('branch_id', activeBranchId);
        }

        const [{ data: currentSales }, { data: previousSales }, { data: currentPurchases }, { data: currentRefunds }, { data: allProducts }, { data: recent }] = await Promise.all([
            sQuery, psQuery, pQuery, rQuery, prodQuery, recentQuery
        ]);

        const lowStock = (allProducts || []).filter(p => p.stock_available <= (p.low_stock_threshold || 10)).slice(0, 5);

        const sales = (currentSales as unknown as SupabaseSale[]) || [];
        const purchases = (currentPurchases as unknown as SupabasePurchase[]) || [];
        const prevSales = (previousSales as unknown as SupabaseSale[]) || [];

        const refunds = (currentRefunds as unknown as { total_price: number; date: string }[]) || [];

        const currentStats: DailyStat = {
            totalSales: sales.reduce((a, s) => a + (s.total_price || 0), 0),
            itemsSold: sales.reduce((a, s) => a + (s.quantity || 0), 0),
            transactionCount: sales.length,
            totalPurchases: purchases.reduce((a, p) => a + ((p.total_price || 0) - (p.discount_amount || 0)), 0),
            totalRefunds: refunds.reduce((a, r) => a + (r.total_price || 0), 0),
        };
        const pStats: DailyStat = {
            totalSales: prevSales.reduce((a, s) => a + (s.total_price || 0), 0),
            itemsSold: prevSales.reduce((a, s) => a + (s.quantity || 0), 0),
            transactionCount: prevSales.length,
            totalPurchases: 0,
            totalRefunds: 0,
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
            // Show trend over range — use ISO date keys for proper sorting
            const dayMap: Record<string, { sales: number; purchases: number }> = {};
            sales.forEach(s => {
                const day = format(new Date(s.date), 'yyyy-MM-dd');
                if (!dayMap[day]) dayMap[day] = { sales: 0, purchases: 0 };
                dayMap[day].sales += s.total_price || 0;
            });
            purchases.forEach(p => {
                const day = format(new Date(p.date), 'yyyy-MM-dd');
                if (!dayMap[day]) dayMap[day] = { sales: 0, purchases: 0 };
                dayMap[day].purchases += (p.total_price || 0) - (p.discount_amount || 0);
            });
            Object.entries(dayMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([isoDay, vals]) => {
                    chartData.push({ day: format(new Date(isoDay), 'MMM d'), ...vals });
                });
        }
        setWeeklyData(chartData);
        setLowStockItems((lowStock as LowStockItem[]) || []);
        setRecentSales((recent as unknown as RecentSale[]) || []);
        setLoading(false);
    }, [isDateRangeActive, dateRange, activeBranchId]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) await fetchDashboardData();
        };
        load();
        const channel = supabase.channel('dashboard_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => { if (mounted) { const reload = async () => await fetchDashboardData(); reload(); } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => { if (mounted) { const reload = async () => await fetchDashboardData(); reload(); } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => { if (mounted) { const reload = async () => await fetchDashboardData(); reload(); } })
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


    const revenueTrend = useMemo(() => {
        if (!prevStats.totalSales) return 0;
        return ((stats.totalSales - prevStats.totalSales) / prevStats.totalSales) * 100;
    }, [stats.totalSales, prevStats.totalSales]);


    const handleEditSale = (sale: RecentSale) => {
        if (sale.is_finalized) {
            alert('This transaction is finalized and cannot be edited.');
            return;
        }

        setSelectedSaleForEdit({
            invoiceNumber: sale.invoice_number,
            customerName: sale.customer_name,
            fulfillmentStatus: sale.fulfillment_status,
            paymentMode: sale.payment_mode,
            isOs: sale.is_os,
            date: sale.date,
            items: [{
                product_id: sale.products?.id || '',
                name: sale.products?.name || '',
                brand: sale.products?.brand || '',
                quantity: sale.quantity,
                unit_price: (sale.products?.selling_price || 0),
                total_price: sale.total_price,
                stock_available: sale.products?.stock_available || 0
            }],
            isVatEnabled: !sale.is_os,
            isDiscountEnabled: false
        });
        setIsSalesModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Calming Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-bg-surface rounded-[20px] flex items-center justify-center shadow-lg border border-border-default group transition-all hover:scale-105 active:scale-95">
                        <LayoutDashboard className="text-brand-red group-hover:rotate-12 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-text-primary tracking-tight">Overview</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsOsEncodingOpen(true)}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
                    >
                        <Zap size={18} /> OS ENCODING
                    </button>
                    <button onClick={() => setIsReportModalOpen(true)} className="flex items-center gap-2 bg-text-primary text-text-inverse px-5 py-2.5 rounded-2xl font-black text-xs hover:opacity-90 transition-all shadow-lg active:scale-95">
                        <Plus size={18} /> GENERATE REPORT
                    </button>
                </div>
            </div>


            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left Controls Sidebar */}
                <div className="flex-shrink-0 w-full lg:w-80">
                    <div className="sticky top-6 space-y-5">
                        {/* Dynamic Calendar */}
                        <div className="bg-bg-surface p-5 rounded-[28px] border border-border-default shadow-sm space-y-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">Summary Period</h3>
                                    <button
                                        onClick={() => setIsDateRangeActive(!isDateRangeActive)}
                                        className={`text-[9px] font-black px-3 py-1 rounded-full uppercase transition-all ${isDateRangeActive ? 'bg-brand-red text-white shadow-red' : 'bg-muted text-text-muted'}`}
                                    >
                                        {isDateRangeActive ? 'Range' : 'Single Day'}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between bg-bg-subtle/80 p-3 rounded-2xl border border-border-default/50">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
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
                        <div className="bg-bg-surface p-5 rounded-[28px] border border-border-default shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">Critical Stock</h3>
                                <span className="text-[10px] font-bold bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full">{lowStockItems.length}</span>
                            </div>
                            <div className="space-y-4">
                                {loading ? [1, 2, 3].map(i => <div key={i} className="h-12 skeleton rounded-2xl" />) :
                                    lowStockItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate('/inventory')}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-brand-orange flex items-center justify-center"><Package size={14} /></div>
                                                <p className="text-xs font-bold text-text-primary group-hover:text-brand-red transition-colors">{item.name}</p>
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
                <div className="flex-1 min-w-0 space-y-6">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard icon={<DollarSign size={18} />} label="Sales" value={stats.totalSales} trend={revenueTrend} loading={loading} onClick={() => navigate('/sales')} isCurrency />
                        <MetricCard icon={<ShoppingCart size={18} />} label="Purchases" value={stats.totalPurchases} trend={0} loading={loading} onClick={() => navigate('/purchases')} isCurrency />
                        <MetricCard icon={<RotateCcw size={18} />} label="Returns" value={stats.totalRefunds} trend={0} loading={loading} onClick={() => navigate('/customer-refunds')} isCurrency />
                    </div>

                    {/* Performance Visualization */}
                    <div className="bg-bg-surface p-6 rounded-[28px] border border-border-default shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-black text-text-primary uppercase tracking-tight">Flow Analysis</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex gap-4 items-center mr-4">
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-red shadow-red" /><span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Revenue</span></div>
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-bg-muted border border-border-default" /><span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Expenses</span></div>
                                </div>
                                <div className="flex bg-subtle rounded-xl p-1 border border-border-default">
                                    <button
                                        onClick={() => setChartMode('bar')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chartMode === 'bar' ? 'bg-brand-charcoal text-white shadow-lg' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        <BarChart3 size={12} /> Bar
                                    </button>
                                    <button
                                        onClick={() => setChartMode('area')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chartMode === 'area' ? 'bg-brand-charcoal text-white shadow-lg' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        <TrendingUp size={12} /> Area
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Summary Stat Chips */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <div className="bg-subtle rounded-2xl p-4 border border-border-default">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Total Revenue</p>
                                <p className="text-lg font-black text-text-primary font-data">₱{stats.totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-subtle rounded-2xl p-4 border border-border-default">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Total Expenses</p>
                                <p className="text-lg font-black text-text-secondary font-data">₱{stats.totalPurchases.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-subtle rounded-2xl p-4 border border-border-default">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Net Flow</p>
                                <p className={`text-lg font-black font-data ${(stats.totalSales - stats.totalPurchases) >= 0 ? 'text-emerald-600' : 'text-brand-red'}`}>
                                    {(stats.totalSales - stats.totalPurchases) >= 0 ? '+' : ''}₱{(stats.totalSales - stats.totalPurchases).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="bg-subtle rounded-2xl p-4 border border-border-default">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Margin</p>
                                <p className={`text-lg font-black font-data ${stats.totalSales > 0 && ((stats.totalSales - stats.totalPurchases) / stats.totalSales * 100) > 0 ? 'text-emerald-600' : 'text-brand-red'}`}>
                                    {stats.totalSales > 0 ? `${(((stats.totalSales - stats.totalPurchases) / stats.totalSales) * 100).toFixed(1)}%` : '—'}
                                </p>
                            </div>
                        </div>

                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                {chartMode === 'bar' ? (
                                    <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="8 8" vertical={false} stroke={chartColors.grid} />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: chartColors.text }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: chartColors.text }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip
                                            cursor={{ fill: isDark ? '#FFFFFF05' : '#EE3E3E08' }}
                                            contentStyle={{
                                                borderRadius: '20px',
                                                border: 'none',
                                                boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                                                padding: '16px 20px',
                                                backgroundColor: chartColors.tooltip,
                                                color: chartColors.text
                                            }}
                                            formatter={(v: number | string | undefined, name?: string) => [
                                                `₱${Number(v || 0).toLocaleString()}`,
                                                name === 'Revenue' ? '● Revenue' : '● Expense'
                                            ]}
                                            itemStyle={{ fontWeight: 900, fontSize: 12 }}
                                            labelStyle={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, marginBottom: 6 }}
                                        />
                                        <Bar dataKey="sales" name="Revenue" fill="#EE3E3E" radius={[8, 8, 0, 0]} barSize={32} />
                                        <Bar dataKey="purchases" name="Expense" fill={isDark ? '#30363D' : '#CBD5E1'} radius={[8, 8, 0, 0]} barSize={32} />
                                    </BarChart>
                                ) : (
                                    <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#EE3E3E" stopOpacity={0.3} />
                                                <stop offset="100%" stopColor="#EE3E3E" stopOpacity={0.02} />
                                            </linearGradient>
                                            <linearGradient id="purchasesGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={isDark ? '#30363D' : '#94A3B8'} stopOpacity={0.3} />
                                                <stop offset="100%" stopColor={isDark ? '#30363D' : '#94A3B8'} stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="8 8" vertical={false} stroke={chartColors.grid} />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: chartColors.text }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: chartColors.text }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: '20px',
                                                border: 'none',
                                                boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                                                padding: '16px 20px',
                                                backgroundColor: chartColors.tooltip,
                                                color: chartColors.text
                                            }}
                                            formatter={(v: number | string | undefined, name?: string) => [
                                                `₱${Number(v || 0).toLocaleString()}`,
                                                name === 'Revenue' ? '● Revenue' : '● Expense'
                                            ]}
                                            itemStyle={{ fontWeight: 900, fontSize: 12 }}
                                            labelStyle={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, marginBottom: 6 }}
                                        />
                                        <Area type="linear" dataKey="sales" name="Revenue" stroke="#EE3E3E" strokeWidth={3} fill="url(#salesGrad)" dot={{ r: 4, fill: '#EE3E3E', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#EE3E3E', stroke: '#fff', strokeWidth: 3 }} />
                                        <Area type="linear" dataKey="purchases" name="Expense" stroke={isDark ? '#4B5563' : '#94A3B8'} strokeWidth={2} fill="url(#purchasesGrad)" dot={{ r: 3, fill: isDark ? '#4B5563' : '#94A3B8', stroke: '#fff', strokeWidth: 2 }} />
                                    </AreaChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Activity & Health */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Recent Activity Mini-Feed */}
                        <div className="bg-bg-surface rounded-[28px] border border-border-default shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-border-default flex items-center justify-between bg-bg-subtle/30">
                                <h3 className="text-xs font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={14} className="text-brand-red" /> Activity
                                </h3>
                                <button onClick={() => navigate('/sales')} className="text-[10px] font-black text-text-muted hover:text-brand-red transition-colors group">VIEW ALL <ArrowUpRight size={12} className="inline ml-1" /></button>
                            </div>
                            <div className="divide-y divide-border-default">
                                {loading ? [1, 2, 3].map(i => <div key={i} className="p-5 h-16 skeleton" />) :
                                    recentSales.slice(0, 5).map((sale) => (
                                        <div key={sale.id} className="p-5 flex items-center justify-between hover:bg-bg-subtle/80 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-bg-muted text-text-muted flex items-center justify-center group-hover:bg-brand-red/10 group-hover:text-brand-red transition-all"><ShoppingCart size={18} /></div>
                                                <div>
                                                    <p className="text-xs font-black text-text-primary">{sale.products?.name}</p>
                                                    <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest">{sale.invoice_number}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-text-primary font-data">₱{sale.total_price.toLocaleString()}</p>
                                                    {sale.is_finalized ? (
                                                    <span className="text-[8px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1 justify-end">FINALIZED</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleEditSale(sale)}
                                                            className="text-[8px] font-black text-brand-red hover:underline uppercase tracking-widest"
                                                        >
                                                            QUICK CORRECT
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>

                        {/* Health Summary Card */}
                        <div className="bg-[#0D1117] rounded-[28px] p-6 text-[#E6EDF3] relative overflow-hidden flex flex-col justify-between group shadow-2xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red/10 rounded-full blur-[80px] -mr-32 -mt-32 group-hover:bg-brand-red/20 transition-all duration-1000" />
                            <div className="relative z-10">
                                <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] mb-4">Quick Health Summary</h4>
                                <div className="space-y-6">
                                    <div>
                                        <span className="text-5xl font-black font-data tracking-tight">{stats.transactionCount}</span>
                                        <p className="text-[10px] font-black text-brand-red uppercase tracking-[0.2em] mt-1">Confirmed Transactions</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-text-inverse/10">
                                        <div>
                                            <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Items Dispatched</p>
                                            <p className="text-xl font-black font-data">{stats.itemsSold}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Fulfillment Target</p>
                                            <p className="text-xl font-black font-data text-brand-red">94%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsReportModalOpen(true)} className="relative z-10 w-full mt-8 py-4 bg-text-inverse/5 border border-text-inverse/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-red hover:border-brand-red transition-all">Detailed Analysis Report</button>
                        </div>
                    </div>
                </div>
            </div>


            <ProductModal
                isOpen={isLowStockModalOpen}
                onClose={() => { setIsLowStockModalOpen(false); setSelectedLowStockProduct(null); }}
                product={selectedLowStockProduct as unknown as ModalProduct}
                onSuccess={() => fetchDashboardData()}
                role={role}
            />

            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            />

            <SalesModal
                isOpen={isSalesModalOpen}
                onClose={() => { setIsSalesModalOpen(false); setSelectedSaleForEdit(undefined); }}
                onSuccess={() => fetchDashboardData()}
                editData={selectedSaleForEdit}
            />

            {isOsEncodingOpen && (
                <OsEncodingModal onClose={() => setIsOsEncodingOpen(false)} />
            )}
        </div>
    );
}

function MetricCard({ icon, label, value, trend, loading, onClick, isCurrency }: { icon: React.ReactNode; label: string; value: number; trend: number; loading: boolean; onClick?: () => void; isCurrency?: boolean; }) {
    const isPositive = trend >= 0;
    return (
        <div onClick={onClick} className="bg-bg-surface p-5 rounded-[24px] border border-border-default shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer group">
            <div className="flex items-center justify-between mb-3"><div className="w-9 h-9 bg-bg-subtle rounded-xl flex items-center justify-center text-text-muted group-hover:bg-brand-red group-hover:text-white transition-colors">{icon}</div>{!loading && (<div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-brand-red/10 text-brand-red'}`}>{isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{Math.abs(Math.round(trend))}%</div>)}</div>
            <div><p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-0.5">{label}</p>{loading ? <div className="h-7 w-24 skeleton rounded-lg" /> : <p className="text-xl font-black text-text-primary font-data tracking-tight">{isCurrency ? `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : value.toLocaleString()}</p>}</div>
        </div>
    );
}
