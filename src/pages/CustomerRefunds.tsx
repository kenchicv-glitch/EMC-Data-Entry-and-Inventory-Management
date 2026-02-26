import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RotateCcw, Plus, Search, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { format, isSameDay, subDays } from 'date-fns';
import RefundModal from '../components/RefundModal';
import Calendar from '../components/Calendar';

interface RefundItem {
    id: string;
    product_id: string;
    quantity: number;
    reason: string;
    date: string;
    invoice_number: string;
    unit_price: number;
    total_price: number;
    vat_amount: number;
    products: { name: string } | null;
}

interface GroupedRefund {
    invoice_number: string;
    date: string;
    reason: string;
    items: RefundItem[];
    total_base: number;
    total_vat: number;
    grand_total: number;
}

export default function CustomerRefunds() {
    const [refunds, setRefunds] = useState<GroupedRefund[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
        start: subDays(new Date(), 30),
        end: new Date()
    });
    const [isDateRangeActive, setIsDateRangeActive] = useState(false);

    const groupRefundsByInvoice = useCallback((data: RefundItem[]) => {
        const groups: { [key: string]: GroupedRefund } = {};

        data.forEach(item => {
            const key = item.invoice_number || 'UNGROUPED';
            if (!groups[key]) {
                groups[key] = {
                    invoice_number: key,
                    date: item.date,
                    reason: item.reason,
                    items: [],
                    total_base: 0,
                    total_vat: 0,
                    grand_total: 0
                };
            }
            const group = groups[key];
            group.items.push(item);
            group.total_base += item.total_price;
            group.total_vat += item.vat_amount || 0;
            group.grand_total = group.total_base;
        });

        setRefunds(Object.values(groups));
    }, []);

    const fetchRefunds = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        const { data, error } = await supabase
            .from('customer_refunds')
            .select('*, products(name)')
            .order('date', { ascending: false });

        if (error) console.error('Error fetching refunds:', error);
        else groupRefundsByInvoice((data as unknown as RefundItem[]) || []);
        setLoading(false);
    }, [groupRefundsByInvoice]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) await fetchRefunds();
        };
        load();

        const channel = supabase
            .channel('refund_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'customer_refunds' },
                () => { if (mounted) fetchRefunds(true); }
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel).catch(console.error);
        };
    }, [fetchRefunds]);

    const toggleRow = (id: string) => {
        const next = new Set(expandedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedRows(next);
    };

    const filtered = refunds.filter(group => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (group.invoice_number?.toLowerCase().includes(search) ?? false) ||
            (group.reason?.toLowerCase().includes(search) ?? false) ||
            group.items.some(item =>
                (item.products?.name?.toLowerCase().includes(search) ?? false)
            )
        );

        const refundDate = new Date(group.date);
        refundDate.setHours(0, 0, 0, 0);

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const matchesDate = refundDate >= start && refundDate <= end;

        return matchesSearch && matchesDate;
    });

    const activeDates = Array.from(new Set(refunds.map(r => format(new Date(r.date), 'yyyy-MM-dd'))));

    const handleDateSelect = (date: Date) => {
        if (!isDateRangeActive) {
            setDateRange({ start: date, end: date });
            return;
        }

        if (!dateRange.start || (dateRange.start && dateRange.end && !isSameDay(dateRange.start, dateRange.end))) {
            setDateRange({ start: date, end: date });
        } else {
            if (date < dateRange.start) {
                setDateRange({ start: date, end: dateRange.start });
            } else {
                setDateRange({ start: dateRange.start, end: date });
            }
        }
    };

    const stats = {
        totalRefunds: refunds.length,
        totalItems: refunds.reduce((acc, r) => acc + r.items.length, 0),
        totalValue: refunds.reduce((acc, r) => acc + r.grand_total, 0)
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-none">
            {/* Header Title Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center shadow-red">
                        <RotateCcw className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-brand-charcoal tracking-tight">Customer Refunds</h1>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Manage customer product returns and inventory restock</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red active:scale-95"
                >
                    <Plus size={18} />
                    LOG NEW REFUND
                </button>
            </div>

            {/* Action Row - Fixed search centering */}
            <div className="relative group max-w-4xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                <input
                    type="text"
                    placeholder="Search by invoice, product, or reason..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none transition-all shadow-sm placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters & Stats Sidebar */}
                <div className="flex-shrink-0 w-full lg:w-72">
                    <div className="sticky top-6 space-y-4">
                        {/* Calendar Filter Widget */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Date Filter</h3>
                                    <button
                                        onClick={() => setIsDateRangeActive(!isDateRangeActive)}
                                        className={`text-[9px] font-black px-2 py-0.5 rounded uppercase transition-all ${isDateRangeActive ? 'bg-brand-red text-white' : 'bg-slate-100 text-slate-400'}`}
                                    >
                                        {isDateRangeActive ? 'Range' : 'Single'}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                        {isDateRangeActive ? 'Selected Range' : 'Selected Date'}
                                    </span>
                                    {(dateRange.start && dateRange.end) && (
                                        <span className="text-[9px] font-black text-brand-red bg-red-50 px-2 py-0.5 rounded">
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

                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/5 rounded-full -mr-12 -mt-12" />
                            <h3 className="text-[10px] font-black text-brand-charcoal border-b border-slate-100 pb-3 mb-4 uppercase tracking-[0.2em]">Refund Statistics</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Refunds</p>
                                        <p className="text-lg font-black text-brand-charcoal font-data">{stats.totalRefunds}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Items</p>
                                        <p className="text-lg font-black text-brand-charcoal font-data">{stats.totalItems}</p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-slate-100">
                                    <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest mb-1">Total Refund Value</p>
                                    <p className="text-xl font-black text-brand-charcoal font-data">₱{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Date & Ref #</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Primary Reason</th>
                                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Items</th>
                                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Refunded</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    [1, 2, 3].map(i => <tr key={i}><td colSpan={4} className="px-5 py-3"><div className="h-10 skeleton rounded-lg" /></td></tr>)
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                                                    <RotateCcw size={20} className="text-slate-400" />
                                                </div>
                                                <p className="text-sm font-medium">No refunds logged yet</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((group) => (
                                        <React.Fragment key={group.invoice_number}>
                                            <tr
                                                onClick={() => toggleRow(group.invoice_number)}
                                                className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="transition-transform duration-200 group-hover:scale-110">
                                                            {expandedRows.has(group.invoice_number) ?
                                                                <ChevronDown size={14} className="text-brand-red" /> :
                                                                <ChevronRight size={14} className="text-slate-300" />
                                                            }
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-brand-charcoal font-data uppercase">{group.invoice_number}</p>
                                                            <p className="text-[10px] font-medium text-slate-400">{format(new Date(group.date), 'MMM d, yyyy HH:mm')}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-sm font-medium text-slate-600">{group.reason}</span>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className="px-2 py-1 rounded-md bg-slate-100 text-[10px] font-black font-data text-slate-500 uppercase">
                                                        {group.items.length} {group.items.length === 1 ? 'Item' : 'Items'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <p className="text-sm font-black text-brand-charcoal font-data">₱{group.grand_total.toLocaleString()}</p>
                                                </td>
                                            </tr>

                                            {expandedRows.has(group.invoice_number) && (
                                                <tr className="bg-slate-50 animate-slide-up">
                                                    <td colSpan={4} className="px-6 py-0">
                                                        <div className="py-8 px-10 border-l-4 border-brand-red bg-white shadow-inner m-4 rounded-[24px] space-y-6">
                                                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                                                <h4 className="text-[11px] font-black text-brand-charcoal uppercase tracking-[0.2em] flex items-center gap-2">
                                                                    <Package size={14} className="text-brand-red" /> Refunded Items
                                                                </h4>
                                                            </div>

                                                            <div className="space-y-3">
                                                                {group.items.map((item, idx) => (
                                                                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 group/item">
                                                                        <div className="flex items-center gap-4">
                                                                            <span className="text-[10px] font-black text-slate-300 font-data w-6">{(idx + 1).toString().padStart(2, '0')}</span>
                                                                            <div>
                                                                                <p className="text-sm font-bold text-slate-700">{item.products?.name}</p>
                                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-data">₱{item.unit_price.toLocaleString()} x {item.quantity}</p>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-sm font-black text-slate-600 font-data">₱{item.total_price.toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="bg-slate-50/50 rounded-3xl p-6 flex flex-col items-end gap-3 border border-slate-100">
                                                                <div className="flex items-center justify-between w-full max-w-xs">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Refund (VAT Inclusive)</span>
                                                                    <span className="text-sm font-bold text-slate-600 font-data">₱{group.total_base.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                </div>
                                                                {group.total_vat > 0 && (
                                                                    <div className="flex items-center justify-between w-full max-w-xs">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Less VAT (12%)</span>
                                                                        <span className="text-sm font-bold text-brand-red font-data">- ₱{group.total_vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                )}
                                                                <div className="w-full max-w-xs border-t border-slate-200 pt-3 flex items-center justify-between">
                                                                    <span className="text-[11px] font-black text-brand-charcoal uppercase tracking-[0.2em]">Net Refund Value</span>
                                                                    <span className="text-xl font-black text-brand-red font-data">₱{group.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <RefundModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSuccess={() => fetchRefunds(true)}
                    />
                </div>
            </div>
        </div>
    );
}
