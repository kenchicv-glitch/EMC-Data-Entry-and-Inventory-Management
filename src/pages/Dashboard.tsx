import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { startOfDay, endOfDay, format, subDays, startOfWeek } from 'date-fns';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
    DollarSign, Package, ShoppingBag, ArrowUpRight, ArrowDownRight,
    Clock, AlertTriangle, RefreshCw, Target, Search, Download, TrendingUp,
    Plus, ShoppingCart
} from 'lucide-react';
import { exportToCSV } from '../lib/exportUtils';
import ProductModal from '../components/ProductModal';
import ReportModal from '../components/ReportModal';

interface DailyStat {
    totalSales: number;
    itemsSold: number;
    transactionCount: number;
    totalPurchases: number;
}

interface LowStockItem {
    id: string;
    sku: string;
    name: string;
    stock_available: number;
}

interface RecentSale {
    id: string;
    quantity: number;
    total_price: number;
    date: string;
    invoice_number: string;
    products: { name: string; sku: string } | null;
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
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const { role } = useAuth();
    const [selectedLowStockProduct, setSelectedLowStockProduct] = useState<LowStockItem | null>(null);
    const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const navigate = useNavigate();

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        const today = new Date();
        const todayStart = startOfDay(today).toISOString();
        const todayEnd = endOfDay(today).toISOString();
        const yesterdayStart = startOfDay(subDays(today, 1)).toISOString();
        const yesterdayEnd = endOfDay(subDays(today, 1)).toISOString();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 }).toISOString();

        const { data: todaySales } = await supabase
            .from('sales')
            .select('quantity, total_price, date, products(name, sku)')
            .gte('date', todayStart)
            .lte('date', todayEnd);

        const { data: yesterdaySales } = await supabase
            .from('sales')
            .select('quantity, total_price')
            .gte('date', yesterdayStart)
            .lte('date', yesterdayEnd);

        const { data: todayPurchases } = await supabase
            .from('purchases')
            .select('total_price, vat_amount, discount_amount')
            .gte('date', todayStart)
            .lte('date', todayEnd);

        const { data: weekSales } = await supabase
            .from('sales')
            .select('total_price, date')
            .gte('date', weekStart);

        const { data: weekPurchases } = await supabase
            .from('purchases')
            .select('total_price, vat_amount, discount_amount, date')
            .gte('date', weekStart);

        const { data: lowStock } = await supabase
            .from('products')
            .select('id, sku, name, stock_available')
            .lte('stock_available', 10)
            .order('stock_available', { ascending: true })
            .limit(5);

        const { data: recent } = await supabase
            .from('sales')
            .select('id, quantity, total_price, date, invoice_number, products(name, sku)')
            .order('date', { ascending: false })
            .limit(10);

        const sales = (todaySales as unknown as SupabaseSale[]) || [];
        const purchases = (todayPurchases as unknown as SupabasePurchase[]) || [];
        const ySales = (yesterdaySales as unknown as SupabaseSale[]) || [];

        const todayStats: DailyStat = {
            totalSales: sales.reduce((a, s) => a + (s.total_price || 0), 0),
            itemsSold: sales.reduce((a, s) => a + (s.quantity || 0), 0),
            transactionCount: sales.length,
            totalPurchases: purchases.reduce((a, p) => a + ((p.total_price || 0) - (p.discount_amount || 0)), 0),
        };
        const yStats: DailyStat = {
            totalSales: ySales.reduce((a, s) => a + (s.total_price || 0), 0),
            itemsSold: ySales.reduce((a, s) => a + (s.quantity || 0), 0),
            transactionCount: ySales.length,
            totalPurchases: 0,
        };

        setStats(todayStats);
        setPrevStats(yStats);

        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const weekMap: Record<string, { sales: number; purchases: number }> = {};
        dayNames.forEach(d => { weekMap[d] = { sales: 0, purchases: 0 }; });

        (weekSales as unknown as SupabaseSale[] || []).forEach(s => {
            const day = format(new Date(s.date), 'EEE');
            if (weekMap[day]) weekMap[day].sales += s.total_price || 0;
        });
        (weekPurchases as unknown as SupabasePurchase[] || []).forEach(p => {
            const day = format(new Date(p.date), 'EEE');
            if (weekMap[day]) weekMap[day].purchases += (p.total_price || 0) - (p.discount_amount || 0);
        });

        setWeeklyData(dayNames.map(day => ({ day, ...weekMap[day] })));
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

    const handleExport = () => {
        const dataToExport = [
            { Metric: "Total Sales Volume", Value: stats.totalSales },
            { Metric: "Items Sold", Value: stats.itemsSold },
            { Metric: "Transactions", Value: stats.transactionCount },
            { Metric: "Date", Value: new Date().toLocaleDateString() }
        ];
        exportToCSV(dataToExport, `Dashboard_Summary_${new Date().toISOString().split('T')[0]}`);
    };

    const getTrend = useCallback((current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    }, []);

    const revenueTrend = useMemo(() => getTrend(stats.totalSales, prevStats.totalSales), [stats.totalSales, prevStats.totalSales, getTrend]);
    const itemsTrend = useMemo(() => getTrend(stats.itemsSold, prevStats.itemsSold), [stats.itemsSold, prevStats.itemsSold, getTrend]);
    const txTrend = useMemo(() => getTrend(stats.transactionCount, prevStats.transactionCount), [stats.transactionCount, prevStats.transactionCount, getTrend]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-brand-charcoal tracking-tight font-data uppercase">Overview</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all active:scale-95"><Download size={14} /> Export</button>
                    <button onClick={fetchDashboardData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-brand-charcoal text-white rounded-xl text-sm font-medium hover:bg-black transition-all active:scale-95 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
                </div>
            </div>

            <div className="relative group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} /><input type="text" placeholder="Search..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>

            <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <MetricCard icon={<DollarSign size={20} />} label="Revenue" value={stats.totalSales} trend={revenueTrend} loading={loading} onClick={() => navigate('/summary')} isCurrency />
                    <MetricCard icon={<Package size={20} />} label="Items Sold" value={stats.itemsSold} trend={itemsTrend} loading={loading} onClick={() => navigate('/sales')} />
                    <MetricCard icon={<ShoppingBag size={20} />} label="Transactions" value={stats.transactionCount} trend={txTrend} loading={loading} onClick={() => navigate('/sales')} />
                </div>
                <div className="col-span-12 lg:col-span-4 lg:row-span-2 bento-card p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-5"><h3 className="font-bold text-brand-charcoal flex items-center gap-2"><AlertTriangle size={16} className="text-brand-orange" /> Low Stock</h3><span className="text-[10px] font-bold bg-brand-orange-light text-brand-orange px-2 py-1 rounded-full uppercase tracking-widest border border-orange-200">{lowStockItems.length} Items</span></div>
                    <div className="flex-1 space-y-3">
                        {loading ? [1, 2, 3, 4].map(i => <div key={i} className="h-14 skeleton rounded-xl" />) :
                            lowStockItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                                <div key={item.id} onClick={() => { setSelectedLowStockProduct(item); setIsLowStockModalOpen(true); }} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-brand-red transition-all cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center"><Package size={16} /></div>
                                        <div><p className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-brand-charcoal">{item.name}</p><p className="text-[10px] text-slate-400 font-data">{item.sku}</p></div>
                                    </div>
                                    <div className="text-right"><p className="text-sm font-black text-brand-red font-data">{item.stock_available}</p></div>
                                </div>
                            ))
                        }
                    </div>
                </div>
                <div className="col-span-12 lg:col-span-8 bento-card p-5">
                    <div className="flex items-center justify-between mb-6"><h3 className="font-bold text-brand-charcoal font-data tracking-tight">WEEKLY FLOW</h3><div className="flex gap-4 items-center"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-brand-red" /><span className="text-xs text-slate-500">Sales</span></div><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-brand-slate-blue" /><span className="text-xs text-slate-500">Purchases</span></div></div></div>
                    <div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F060" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} /><Tooltip cursor={{ fill: '#EE3E3E15' }} formatter={(v: any) => `₱${Number(v).toLocaleString()}`} /><Bar dataKey="sales" fill="#EE3E3E" radius={[6, 6, 0, 0]} barSize={28} /><Bar dataKey="purchases" fill="#5A6E8C" radius={[6, 6, 0, 0]} barSize={28} /></BarChart></ResponsiveContainer></div>
                </div>
                <div className="col-span-12 lg:col-span-12 bento-card p-5 bg-brand-charcoal text-white flex flex-col md:flex-row items-center justify-between relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #252627 0%, #3a3b3c 100%)' }}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="flex-1 flex flex-col items-center md:items-start relative z-10"><h3 className="font-bold flex items-center gap-2 mb-2"><Target size={16} className="text-brand-red" /> Quick Summary</h3><p className="text-xs text-slate-400 font-data uppercase tracking-widest">{format(new Date(), 'MMMM d, yyyy')}</p></div>
                    <div className="flex-1 flex justify-center py-6 md:py-0 relative z-10 text-center md:text-left"><div className="flex flex-col"><span className="text-6xl font-black font-data">{stats.transactionCount}</span><p className="text-[10px] font-black text-brand-red uppercase tracking-[0.3em]">Transactions</p></div></div>
                    <div className="flex-1 space-y-3 relative z-10 min-w-[240px]">
                        <div className="p-3 rounded-xl bg-white/10 border border-white/5 flex justify-between items-center"><span className="text-[10px] text-slate-400 font-bold uppercase">Today's Cost</span><span className="text-sm font-black font-data">₱{stats.totalPurchases.toLocaleString()}</span></div>
                        <div className="p-3 rounded-xl bg-brand-red/20 border border-brand-red/20 flex justify-between items-center"><span className="text-[10px] text-brand-red font-bold uppercase">Estimated Gross</span><span className="text-sm font-black font-data text-brand-red">₱{(stats.totalSales - stats.totalPurchases).toLocaleString()}</span></div>
                    </div>
                </div>
            </div>

            {/* Recent Activity Section */}
            <div className="grid grid-cols-12 gap-5 mt-5">
                <div className="col-span-12 lg:col-span-8 bento-card p-0 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="text-lg font-black text-brand-charcoal flex items-center gap-2 uppercase tracking-tight">
                            <Clock size={20} className="text-brand-red" /> Recent Activity
                        </h3>
                        <button onClick={() => navigate('/sales')} className="text-[10px] font-black text-slate-400 hover:text-brand-red uppercase tracking-widest transition-colors">View All History →</button>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {loading ? [1, 2, 3].map(i => <div key={i} className="p-6 skeleton h-16" />) :
                            recentSales.length > 0 ? recentSales.map((sale) => (
                                <div key={sale.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => navigate('/sales')}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-brand-red/10 group-hover:text-brand-red transition-all">
                                            <ShoppingCart size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-brand-charcoal">{sale.products?.name || 'Unknown Product'}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{sale.invoice_number}</span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{sale.quantity} Items sold</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-brand-charcoal font-data">₱{sale.total_price.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{format(new Date(sale.date), 'hh:mm a')}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-10 text-center"><p className="text-sm text-slate-400 font-medium">No recent activity found.</p></div>
                            )
                        }
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4 space-y-5">
                    <div className="bento-card p-6 bg-gradient-to-br from-brand-charcoal to-[#3a3b3c] text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-red/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-brand-red/20 transition-all duration-700" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <TrendingUp size={14} className="text-brand-red" /> Performance Goal
                        </h4>
                        <div className="flex items-end gap-3 mb-4">
                            <span className="text-4xl font-black font-data tracking-tight">84%</span>
                            <span className="text-[10px] text-green-400 font-bold uppercase mb-1">+12% vs target</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-brand-red w-[84%] rounded-full shadow-red" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">You are on track to reach your monthly distribution goal.</p>
                    </div>

                    <div
                        onClick={() => setIsReportModalOpen(true)}
                        className="bento-card p-6 border-dashed border-2 border-slate-200 bg-transparent flex flex-col items-center justify-center text-center group cursor-pointer hover:border-brand-red transition-all"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3 group-hover:bg-brand-red group-hover:text-white transition-all">
                            <Plus size={24} />
                        </div>
                        <h4 className="text-sm font-black text-brand-charcoal uppercase tracking-tight">Generate Report</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Custom Inventory Analysis</p>
                    </div>
                </div>
            </div>

            <ProductModal
                isOpen={isLowStockModalOpen}
                onClose={() => { setIsLowStockModalOpen(false); setSelectedLowStockProduct(null); }}
                product={selectedLowStockProduct as any}
                onSuccess={() => fetchDashboardData()}
                role={role as any}
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
            <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>{loading ? <div className="h-8 w-24 skeleton rounded-lg" /> : <p className="text-2xl font-black text-brand-charcoal font-data tracking-tight">{isCurrency ? `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : value.toLocaleString()}</p>}</div>
        </div>
    );
}
