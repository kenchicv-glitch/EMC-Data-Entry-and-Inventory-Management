import React, { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { useAuth } from '../../shared/hooks/useAuth';
import {
    Plus, Search, ChevronDown, ChevronRight,
    Package, RotateCcw, Trash2
} from 'lucide-react';
import ReturnModal from './components/ReturnModal';
import { format, isSameDay, subDays } from 'date-fns';
import Calendar from '../../features/reports/components/Calendar';
import { useBranch } from '../../shared/hooks/useBranch';

interface ReturnItem {
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

interface GroupedReturn {
    invoice_number: string;
    date: string;
    reason: string;
    items: ReturnItem[];
    total_base: number;
    total_vat: number;
    grand_total: number;
}

export default function Returns() {
    const { role } = useAuth();
    const { activeBranchId } = useBranch();
    const [returns, setReturns] = useState<GroupedReturn[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
        start: subDays(new Date(), 30),
        end: new Date()
    });
    const [isDateRangeActive, setIsDateRangeActive] = useState(false);

    const fetchReturns = async () => {
        setLoading(true);
        let query = supabase
            .from('supplier_returns')
            .select('*, products(name)')
            .order('date', { ascending: false });

        if (activeBranchId) {
            query = query.eq('branch_id', activeBranchId);
        }

        const { data, error } = await query;

        if (error) console.error('Error fetching returns:', error);
        else groupReturnsByInvoice(data || []);
        setLoading(false);
    };

    const groupReturnsByInvoice = (data: ReturnItem[]) => {
        const groups: { [key: string]: GroupedReturn } = {};

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

        setReturns(Object.values(groups));
    };

    useEffect(() => {
        let mounted = true;
        const fetch = async () => {
            setLoading(true);
            let query = supabase
                .from('supplier_returns')
                .select('*, products(name)')
                .order('date', { ascending: false });

            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }

            const { data, error } = await query;

            if (mounted) {
                if (error) console.error('Error fetching returns:', error);
                else {
                    const dataItems = data as ReturnItem[];
                    const groups: { [key: string]: GroupedReturn } = {};

                    dataItems.forEach(item => {
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

                    setReturns(Object.values(groups));
                }
                setLoading(false);
            }
        };
        fetch();
        return () => { mounted = false; };
    }, []);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDelete = async (invoiceNumber: string) => {
        if (!window.confirm('Delete this return record? This will delete all items in this return.')) return;
        const { error } = await supabase
            .from('supplier_returns')
            .delete()
            .eq('invoice_number', invoiceNumber);
        if (error) alert('Error: ' + error.message);
        else fetchReturns();
    };

    const filtered = returns.filter(group => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (group.invoice_number?.toLowerCase().includes(search) ?? false) ||
            (group.reason?.toLowerCase().includes(search) ?? false) ||
            group.items.some(item =>
                (item.products?.name?.toLowerCase().includes(search) ?? false)
            )
        );

        const returnDate = new Date(group.date);
        returnDate.setHours(0, 0, 0, 0);

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const matchesDate = returnDate >= start && returnDate <= end;

        return matchesSearch && matchesDate;
    });

    const activeDates = Array.from(new Set(returns.map(r => format(new Date(r.date), 'yyyy-MM-dd'))));

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
        totalReturns: returns.length,
        totalItems: returns.reduce((acc, r) => acc + r.items.length, 0),
        totalValue: returns.reduce((acc, r) => acc + r.grand_total, 0)
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
                        <h1 className="text-3xl font-black text-text-primary tracking-tight">Supplier Returns</h1>
                        <p className="text-sm text-text-secondary mt-1 font-medium">Track items sent back to suppliers and manage inventory adjustments</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red active:scale-95"
                >
                    <Plus size={18} />
                    LOG NEW RETURN
                </button>
            </div>

            {/* Action Row - Fixed search centering */}
            <div className="relative group max-w-4xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={18} />
                <input
                    type="text"
                    placeholder="Search by invoice, product, or reason..."
                    className="w-full pl-12 pr-4 py-3 bg-bg-surface border border-border-default rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none transition-all shadow-sm placeholder:text-text-muted text-text-primary"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters & Stats Sidebar */}
                <div className="flex-shrink-0 w-full lg:w-72">
                    <div className="sticky top-6 space-y-4">
                        {/* Calendar Filter Widget */}
                        <div className="bg-bg-surface p-6 rounded-3xl border border-border-muted shadow-sm space-y-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">Date Filter</h3>
                                    <button
                                        onClick={() => setIsDateRangeActive(!isDateRangeActive)}
                                        className={`text-[9px] font-black px-2 py-0.5 rounded uppercase transition-all ${isDateRangeActive ? 'bg-brand-red text-white' : 'bg-bg-subtle text-text-muted'}`}
                                    >
                                        {isDateRangeActive ? 'Range' : 'Single'}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">
                                        {isDateRangeActive ? 'Selected Range' : 'Selected Date'}
                                    </span>
                                    {(dateRange.start && dateRange.end) && (
                                        <span className="text-[9px] font-black text-brand-red bg-brand-red/10 px-2 py-0.5 rounded">
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

                        <div className="bg-bg-surface p-6 rounded-3xl border border-border-muted shadow-sm overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/5 rounded-full -mr-12 -mt-12" />
                            <h3 className="text-[10px] font-black text-text-primary border-b border-border-muted pb-3 mb-4 uppercase tracking-[0.2em]">Return Statistics</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Total Returns</p>
                                        <p className="text-lg font-black text-text-primary font-data">{stats.totalReturns}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Total Items</p>
                                        <p className="text-lg font-black text-text-primary font-data">{stats.totalItems}</p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-border-muted">
                                    <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest mb-1">Total Return Value</p>
                                    <p className="text-xl font-black text-text-primary font-data">₱{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="bg-bg-surface rounded-[32px] border border-border-muted shadow-sm overflow-hidden">
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-bg-subtle/50 border-b border-border-muted">
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-text-secondary">Date & Ref #</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-text-secondary">Primary Reason</th>
                                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-text-secondary">Items</th>
                                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-text-secondary">Total Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-muted">
                                {loading ? (
                                    [1, 2, 3].map(i => <tr key={i}><td colSpan={4} className="px-5 py-3"><div className="h-10 skeleton rounded-lg" /></td></tr>)
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 bg-bg-subtle rounded-full flex items-center justify-center">
                                                    <RotateCcw size={20} className="text-text-muted" />
                                                </div>
                                                <p className="text-sm text-text-muted font-medium">No returns recorded yet</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((group) => (
                                        <React.Fragment key={group.invoice_number}>
                                            <tr
                                                onClick={() => toggleRow(group.invoice_number)}
                                                className="hover:bg-bg-subtle/80 transition-colors cursor-pointer group"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="transition-transform duration-200 group-hover:scale-110">
                                                            {expandedRows.has(group.invoice_number) ?
                                                                <ChevronDown size={14} className="text-brand-red" /> :
                                                                <ChevronRight size={14} className="text-text-muted opacity-50" />
                                                            }
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-text-primary font-data uppercase">{group.invoice_number}</p>
                                                            <p className="text-[10px] font-medium text-text-muted">{format(new Date(group.date), 'MMM d, yyyy')}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-sm font-medium text-text-secondary">{group.reason}</span>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className="px-2 py-1 rounded-md bg-bg-base text-[10px] font-black font-data text-text-muted uppercase">
                                                        {group.items.length} {group.items.length === 1 ? 'Item' : 'Items'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <p className="text-sm font-black text-text-primary font-data">₱{group.grand_total.toLocaleString()}</p>
                                                        {role === 'owner' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(group.invoice_number); }}
                                                                className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-brand-red/10 transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {expandedRows.has(group.invoice_number) && (
                                                <tr className="bg-bg-base animate-slide-up">
                                                    <td colSpan={4} className="px-6 py-0">
                                                        <div className="py-8 px-10 border-l-4 border-brand-red bg-bg-surface shadow-inner m-4 rounded-[24px] space-y-6">
                                                            <div className="flex items-center justify-between border-b border-border-muted pb-4">
                                                                <h4 className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                                                    <Package size={14} className="text-brand-red" /> Returned Items
                                                                </h4>
                                                            </div>

                                                            <div className="space-y-3">
                                                                {group.items.map((item, idx) => (
                                                                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-border-muted last:border-0 group/item">
                                                                        <div className="flex items-center gap-4">
                                                                            <span className="text-[10px] font-black text-text-muted font-data w-6">{(idx + 1).toString().padStart(2, '0')}</span>
                                                                            <div>
                                                                                <p className="text-sm font-bold text-text-primary">{item.products?.name}</p>
                                                                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest font-data">₱{item.unit_price.toLocaleString()} x {item.quantity}</p>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-sm font-black text-text-secondary font-data">₱{item.total_price.toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="bg-bg-base/50 rounded-3xl p-6 flex flex-col items-end gap-3 border border-border-muted">
                                                                <div className="flex items-center justify-between w-full max-w-xs">
                                                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Gross Value (VAT Inclusive)</span>
                                                                    <span className="text-sm font-bold text-text-secondary font-data">₱{group.total_base.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                </div>
                                                                {group.total_vat > 0 && (
                                                                    <div className="flex items-center justify-between w-full max-w-xs">
                                                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Less VAT (12%)</span>
                                                                        <span className="text-sm font-bold text-brand-red font-data">- ₱{group.total_vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                )}
                                                                <div className="w-full max-w-xs border-t border-border-muted pt-3 flex items-center justify-between">
                                                                    <span className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em]">Net Return Value</span>
                                                                    <span className="text-xl font-black text-text-primary font-data">₱{group.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                    <ReturnModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchReturns} />
                </div>
            </div>
        </div>
    );
}

