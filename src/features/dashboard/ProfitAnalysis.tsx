import { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import {
    TrendingUp, DollarSign, PieChart as PieChartIcon,
    Activity, Calendar as CalendarIcon
} from 'lucide-react';
import { isSameDay } from 'date-fns';
import Calendar from '../../features/reports/components/Calendar';
import { useBranch } from '../../shared/hooks/useBranch';
import { Building2 } from 'lucide-react';
import { useProfitData } from '../../features/reports/hooks/useProfitData';
import { formatCurrency, formatDate } from '../../shared/lib/formatUtils';

const COLORS = ['#EE3E3E', '#5A6E8C', '#F59E0B', '#10B981', '#6366F1', '#EC4899'];

export default function ProfitAnalysis() {
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
        start: new Date(),
        end: new Date()
    });
    const [isDateRangeActive, setIsDateRangeActive] = useState(false);

    const { branches } = useBranch();
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [isVatInclusive, setIsVatInclusive] = useState(false);

    const { metrics: stats, categoryData, sales, isLoading } = useProfitData({
        start: formatDate(dateRange.start, 'yyyy-MM-dd'),
        end: formatDate(dateRange.end, 'yyyy-MM-dd')
    }, selectedBranchId, isVatInclusive);

    // Group sales for calendar highlights
    const activeDates = sales.map(s => formatDate(s.date, 'yyyy-MM-dd'));

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
                                            ? `${formatDate(dateRange.start, 'MMM d')} - ${formatDate(dateRange.end, 'MMM d')}`
                                            : formatDate(dateRange.start, 'MMM d, yyyy')}
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
                                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Total Refunds & Returns</p>
                                    <p className="text-2xl font-black text-brand-red font-data">
                                        {formatCurrency(stats.totalRefunds || 0)}
                                    </p>
                                </div>
                                <div className="pt-4 border-t border-border-muted">
                                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">VAT Liability (Estimated)</p>
                                    <p className="text-2xl font-black text-text-primary font-data">
                                        {formatCurrency(stats.vatAmount)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-8 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                        <MetricCard 
                            icon={<DollarSign size={20} />} 
                            label={`Net Revenue ${isVatInclusive ? '(incl)' : '(excl)'}`} 
                            tooltip={isVatInclusive ? "Total SRP sales minus discounts" : "Gross Sales minus VAT and Discounts"}
                            value={stats.totalRevenue} 
                            color="text-text-primary" 
                            loading={isLoading}
                            action={
                                <div 
                                    onClick={(e) => { e.stopPropagation(); setIsVatInclusive(!isVatInclusive); }}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 ${isVatInclusive ? 'bg-brand-red' : 'bg-bg-subtle'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isVatInclusive ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            }
                        />
                        <MetricCard 
                            icon={<Activity size={20} />} 
                            label="Cost of Goods" 
                            tooltip="Total Unit Cost of items sold (Qty * Unit Cost)"
                            value={stats.totalCOGS} 
                            color="text-text-secondary" 
                            loading={isLoading} 
                        />
                        <MetricCard 
                            icon={<TrendingUp size={20} />} 
                            label="Gross Profit" 
                            tooltip="Net Revenue minus Cost of Goods"
                            value={stats.grossProfit} 
                            color="text-emerald-500" 
                            loading={isLoading} 
                        />
                        <MetricCard 
                            icon={<TrendingUp size={20} />} 
                            label="Net Profit" 
                            tooltip="Gross Profit minus Operating Expenses"
                            value={stats.netProfit} 
                            color="text-blue-500" 
                            loading={isLoading} 
                        />
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
                                            formatter={(value: any, name: any, props: any) => {
                                                const payload = props.payload;
                                                return [
                                                    <div className="space-y-1">
                                                        <div className="text-sm font-black text-text-primary">{formatCurrency(Number(value))}</div>
                                                        <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest">
                                                            Revenue: {formatCurrency(payload.revenue)}
                                                        </div>
                                                        {value < 0 && (
                                                            <div className="text-[9px] text-brand-red font-black uppercase mt-1 animate-pulse">
                                                                ! Negative Margin Alert
                                                            </div>
                                                        )}
                                                    </div>,
                                                    name
                                                ];
                                            }}
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
                                        <Tooltip cursor={{ fill: 'var(--bg-subtle)' }} contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-muted)', borderRadius: '12px' }} formatter={(v: any) => formatCurrency(Number(v))} />
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

function MetricCard({ icon, label, value, color, loading, tooltip, action }: { icon: React.ReactNode, label: string, value: number, color: string, loading: boolean, tooltip?: string, action?: React.ReactNode }) {
    return (
        <div className="bg-bg-surface p-6 rounded-3xl border border-border-muted shadow-sm hover:border-brand-red/30 transition-colors group relative">
            <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-bg-base/50 rounded-xl flex items-center justify-center text-text-muted transition-colors group-hover:bg-brand-red/10 group-hover:text-brand-red">{icon}</div>
                {action ? action : <div className="flex items-center gap-1 text-[10px] font-bold text-text-muted uppercase tracking-widest"><CalendarIcon size={12} /> Today</div>}
            </div>
            <div className="relative group/tooltip">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1 flex items-center gap-1">
                    {label}
                    {tooltip && <Activity size={10} className="opacity-30" />}
                </p>
                {tooltip && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-brand-charcoal text-[9px] text-white rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 font-medium">
                        {tooltip}
                    </div>
                )}
            </div>
            {loading ? <div className="h-8 bg-bg-subtle animate-pulse rounded w-24"></div> : (
                <p className={`text-2xl font-black ${color} font-data ${value < 0 ? 'animate-pulse text-brand-red' : ''}`}>
                    {formatCurrency(value)}
                </p>
            )}
        </div>
    );
}
