import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, Fragment } from 'react';
import {
    Search, ChevronDown, Receipt, ShoppingBag, Download, Trash2, User, Truck, Clock, CheckCircle2, PackageSearch, RotateCcw, Grid, Tag, SlidersHorizontal
} from 'lucide-react';
import { isSameDay } from 'date-fns';
import { formatCurrency, formatDate } from '../../shared/lib/formatUtils';
import Calendar from '../../features/reports/components/Calendar';
import { useAuth } from '../../shared/hooks/useAuth';
import { useSales } from './hooks/useSales';
import { useModal } from '../../shared/hooks/useModal';
import { startOfMonth } from 'date-fns';
import { type Sale, type GroupedSale } from './types/sale';

export default function Sales() {
    const { role } = useAuth();
    const navigate = useNavigate();
    const { openSalesModal } = useModal();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const { sales, refunds, isLoading: hookLoading, deleteSales, fetchSales } = useSales(startOfMonth(selectedDate).toISOString());

    const [searchTerm, setSearchTerm] = useState('');
    const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
    const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
        pay_cash: false, pay_gcash: false, pay_cheque: false, pay_bank_transfer: false, pay_others: false,
        type_a: false, type_b: false, type_os: false,
        only_discounted: false, only_refunded: false,
    });
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

    const refundedInvoices = useMemo(() => 
        new Set(refunds.map(r => r.invoice_number).filter(Boolean)),
    [refunds]);

    const groupedSales = useMemo(() => {
        const groups: { [key: string]: GroupedSale } = {};
        sales.forEach(sale => {
            const key = sale.invoice_number;
            if (!key) return;
            if (!groups[key]) {
                groups[key] = {
                    invoice_number: key,
                    date: sale.date,
                    full_name: 'Staff',
                    customer_name: sale.customer_name || 'Walk-in Customer',
                    fulfillment_status: sale.fulfillment_status || 'pickup',
                    payment_mode: sale.payment_mode || 'cash',
                    is_os: sale.is_os || false,
                    edited_at: sale.edited_at || null,
                    items: [],
                    total_base: 0,
                    total_vat: 0,
                    total_discount: 0,
                    delivery_fee: sale.delivery_fee || 0,
                    grand_total: 0,
                    invoice_type: (sale.invoice_type as 'A' | 'B') || 'A',
                    transaction_label: sale.transaction_label || null,
                    customer_id: sale.customer_id || null
                };
            }
            const group = groups[key];
            group.items.push(sale as Sale);
            group.total_base += Number(sale.total_price);
            group.total_vat += Number(sale.vat_amount || 0);
            group.total_discount += Number(sale.discount_amount || 0);
        });

        Object.values(groups).forEach(group => {
            group.grand_total = group.total_base - group.total_discount + Number(group.delivery_fee);
        });

        return Object.values(groups).sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [sales]);

    // Listen for global shortcuts and navigation state
    useEffect(() => {
        const handleRefresh = () => { fetchSales(true); };
        window.addEventListener('refresh-data', handleRefresh);
        return () => window.removeEventListener('refresh-data', handleRefresh);
    }, [fetchSales]);

    const toggleExpand = (invoiceNumber: string) => {
        setExpandedInvoices(prev => {
            const next = new Set(prev);
            if (next.has(invoiceNumber)) next.delete(invoiceNumber);
            else next.add(invoiceNumber);
            return next;
        });
    };

    const filteredSales = useMemo(() => groupedSales.filter(group => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (group.invoice_number?.toLowerCase().includes(search) ?? false) ||
            (group.customer_name?.toLowerCase().includes(search) ?? false) ||
            group.items.some(item =>
                (item.products?.name?.toLowerCase().includes(search) ?? false)
            )
        );

        const anyPaymentChecked = activeFilters.pay_cash || activeFilters.pay_gcash || activeFilters.pay_cheque || activeFilters.pay_bank_transfer || activeFilters.pay_others;
        
        const paymentType = group.payment_mode?.toLowerCase() || 'cash';
        let payMatch = anyPaymentChecked ? false : true;
        
        if (anyPaymentChecked) {
            if (paymentType === 'cash' && activeFilters.pay_cash) payMatch = true;
            if (paymentType === 'gcash' && activeFilters.pay_gcash) payMatch = true;
            if (paymentType === 'cheque' && activeFilters.pay_cheque) payMatch = true;
            if (paymentType === 'bank_transfer' && activeFilters.pay_bank_transfer) payMatch = true;
            if (paymentType === 'others' && activeFilters.pay_others) payMatch = true;
            if (!['cash', 'gcash', 'cheque', 'bank_transfer', 'others'].includes(paymentType) && activeFilters.pay_others) payMatch = true;
        }

        const anyTypeChecked = activeFilters.type_a || activeFilters.type_b || activeFilters.type_os;
        
        let invTypeMatch = anyTypeChecked ? false : true;
        if (anyTypeChecked) {
            if (group.is_os && activeFilters.type_os) invTypeMatch = true;
            if (!group.is_os && group.invoice_type === 'A' && activeFilters.type_a) invTypeMatch = true;
            if (!group.is_os && group.invoice_type === 'B' && activeFilters.type_b) invTypeMatch = true;
        }

        const otherMatch = 
            (!activeFilters.only_discounted || group.total_discount > 0) &&
            (!activeFilters.only_refunded || refundedInvoices.has(group.invoice_number));

        return matchesSearch && isSameDay(new Date(group.date), selectedDate) && payMatch && invTypeMatch && otherMatch;
    }), [groupedSales, searchTerm, selectedDate, activeFilters, refundedInvoices]);

    const activeDates = Array.from(new Set(groupedSales.map(s => formatDate(s.date, 'yyyy-MM-dd'))));

    const handleEditInvoice = (group: GroupedSale) => {
        openSalesModal({
            invoiceNumber: group.invoice_number,
            customerName: group.customer_name,
            status: group.fulfillment_status,
            paymentMode: group.payment_mode,
            items: group.items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                name: item.products?.name || 'Unknown Product',
                brand: item.products?.brand || undefined
            })),
            isVatEnabled: group.total_vat > 0,
            isDiscountEnabled: group.total_discount > 0,
            grand_total: group.grand_total,
            isOs: group.is_os,
            date: group.date,
            deliveryFee: group.delivery_fee,
            invoiceType: (group.invoice_type as 'A' | 'B' | undefined),
            transactionLabel: group.transaction_label || undefined,
            customerId: group.customer_id
        });
    };

    const handleDeleteInvoice = async (invoiceNumber: string) => {
        if (!window.confirm(`Are you sure you want to delete invoice ${invoiceNumber}? This will restore stock to inventory.`)) return;

        try {
            await deleteSales(invoiceNumber);
        } catch (err) {
            console.error('Error deleting sale:', err);
            alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'delivered': return <CheckCircle2 className="text-emerald-500" size={14} />;
            case 'out': return <Truck className="text-amber-500" size={14} />;
            default: return <Clock className="text-slate-400" size={14} />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'delivered': return 'Delivered';
            case 'out': return 'In Transit';
            default: return 'Store Pickup';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-text-primary tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center shadow-red"><Receipt className="text-white" size={24} /></div>
                        Sales Dashboard
                    </h1>
                    <p className="text-text-secondary mt-1 font-medium">Customer Orders, List of Orders, Invoice & Inventory Sync</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/express-sales')}
                        className="flex items-center gap-2 bg-surface border border-border-default text-text-secondary px-5 py-3 rounded-2xl font-bold text-sm hover:bg-subtle transition-all shadow-sm"
                    >
                        <Grid size={18} /> OS ENCODING
                    </button>
                    <button className="flex items-center gap-2 bg-surface border border-border-default text-text-secondary px-5 py-3 rounded-2xl font-bold text-sm hover:bg-subtle transition-all shadow-sm"><Download size={18} /> Export</button>
                    <button onClick={() => openSalesModal()} className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red active:scale-95"><ShoppingBag size={18} /> CREATE SALE</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={18} />
                    <input type="text" placeholder="Search by Invoice, Customer or Item..." className="w-full pl-12 pr-4 py-3 bg-surface border border-border-default rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none transition-all shadow-sm placeholder:text-text-muted text-text-primary" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`p-2 rounded-xl transition-all flex items-center gap-2 border ${activeFilterCount > 0 ? 'bg-brand-red text-white shadow-red border-brand-red' : 'bg-surface border-border-default text-text-secondary hover:bg-subtle'}`}
                        title="Advanced Filters"
                    >
                        <SlidersHorizontal size={16} />
                        {activeFilterCount > 0 ? (
                            <span className="text-[10px] font-black pr-1">{activeFilterCount}</span>
                        ) : (
                            <span className="text-[10px] font-black pr-1 tracking-widest uppercase">FILTERS</span>
                        )}
                    </button>
                    {isFilterOpen && (
                        <div className="absolute right-0 top-full mt-3 w-72 bg-surface border border-border-default rounded-3xl shadow-xl z-50 p-5 animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center justify-between mb-4 border-b border-border-default pb-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-text-primary">Advanced Filters</h4>
                                <button onClick={() => setActiveFilters({
                                    pay_cash: false, pay_gcash: false, pay_cheque: false, pay_bank_transfer: false, pay_others: false,
                                    type_a: false, type_b: false, type_os: false,
                                    only_discounted: false, only_refunded: false,
                                })} className="text-[9px] font-black uppercase text-brand-red hover:underline decoration-2 underline-offset-4">CLEAR ALL</button>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Other Options</p>
                                    <div className="flex flex-col gap-2">
                                        {[
                                            { id: 'only_discounted', label: 'Discounted Only' },
                                            { id: 'only_refunded', label: 'Refunded Only' },
                                        ].map(opt => (
                                            <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" className="hidden" checked={activeFilters[opt.id]} onChange={() => setActiveFilters(p => ({ ...p, [opt.id]: !p[opt.id] }))} />
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${activeFilters[opt.id] ? 'bg-brand-red border-brand-red' : 'bg-white border-border-default'}`}>
                                                    {activeFilters[opt.id] && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                </div>
                                                <span className="text-xs font-bold text-text-secondary group-hover:text-text-primary">{opt.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Invoice Type</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'type_a', label: 'TYPE A' },
                                            { id: 'type_b', label: 'TYPE B' },
                                            { id: 'type_os', label: 'OS' },
                                        ].map(opt => (
                                            <button 
                                                key={opt.id}
                                                onClick={() => setActiveFilters(p => ({ ...p, [opt.id]: !p[opt.id] }))}
                                                className={`px-2 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${activeFilters[opt.id] ? 'bg-text-primary border-text-primary text-white' : 'bg-white border-border-default text-text-muted hover:bg-subtle'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Mode of Payment</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { id: 'pay_cash', label: 'Cash' },
                                            { id: 'pay_gcash', label: 'GCash' },
                                            { id: 'pay_cheque', label: 'Cheque' },
                                            { id: 'pay_bank_transfer', label: 'Transfer' },
                                            { id: 'pay_others', label: 'Others' },
                                        ].map(opt => (
                                            <button 
                                                key={opt.id}
                                                onClick={() => setActiveFilters(p => ({ ...p, [opt.id]: !p[opt.id] }))}
                                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${activeFilters[opt.id] ? 'bg-brand-red border-brand-red text-white' : 'bg-white border-border-default text-text-muted hover:bg-subtle'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setIsFilterOpen(false)} className="w-full mt-6 bg-brand-red text-white py-3 rounded-2xl font-black text-[10px] uppercase shadow-red active:scale-95 transition-all">Apply Filters</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-shrink-0">
                    <div className="sticky top-6 space-y-4">
                        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} activeDates={activeDates} />
                        <div className="bg-surface p-6 rounded-3xl border border-border-default shadow-sm overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/5 rounded-full -mr-12 -mt-12" />
                            <h3 className="text-[10px] font-black text-text-primary border-b border-border-default pb-3 mb-4 uppercase tracking-[0.2em]">Summary Statistics</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Standard Invoices</p>
                                        <p className="text-sm font-black text-text-primary font-data">{filteredSales.filter(s => !s.is_os).length}</p>
                                        <p className="text-[10px] font-bold text-text-secondary font-data">₱{filteredSales.filter(s => !s.is_os).reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">OS Invoices</p>
                                        <p className="text-sm font-black text-brand-red font-data">{filteredSales.filter(s => s.is_os).length}</p>
                                        <p className="text-[10px] font-bold text-text-secondary font-data">₱{filteredSales.filter(s => s.is_os).reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-border-default">
                                    <p className="text-[9px] font-black text-text-primary uppercase tracking-widest mb-1">Total Revenue</p>
                                    <p className="text-xl font-black text-text-primary font-data">₱{filteredSales.reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="bg-surface rounded-[32px] border border-border-default shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-subtle/50 border-b border-border-default">
                                        <th className="px-6 py-2.5 text-[11px] font-black text-text-primary uppercase tracking-widest">Sales Details</th>
                                        <th className="px-6 py-2.5 text-[11px] font-black text-text-primary uppercase tracking-widest">Customer</th>
                                        <th className="px-6 py-2.5 text-[11px] font-black text-text-primary uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-2.5 text-[11px] font-black text-text-primary uppercase tracking-widest">Payment</th>
                                        <th className="px-6 py-2.5 text-[11px] font-black text-text-primary uppercase tracking-widest text-right">Amount</th>
                                        <th className="px-6 py-2.5 text-[11px] font-black text-text-muted uppercase tracking-widest w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-subtle">
                                    {hookLoading ? (
                                        [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={5} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded w-full"></div></td></tr>)
                                    ) : filteredSales.length > 0 ? (
                                        filteredSales.map((sale) => (
                                            <Fragment key={sale.invoice_number}>
                                                <tr onClick={() => toggleExpand(sale.invoice_number)} className="group hover:bg-subtle transition-all cursor-pointer">
                                                    <td className="px-6 py-3.5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-8 h-8 bg-muted rounded-xl flex items-center justify-center text-text-muted group-hover:bg-brand-red group-hover:text-white transition-all"><Receipt size={14} /></div>
                                                            <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-xs font-black text-text-primary uppercase font-data">{sale.invoice_number}</p>{sale.transaction_label && (<span className="px-1.5 py-0.5 bg-brand-charcoal text-white text-[8px] font-black rounded uppercase tracking-tighter shadow-sm flex items-center gap-0.5 shrink-0"><Tag size={8} /> {sale.transaction_label}</span>)}
                                                                        <div className="flex items-center gap-1">
                                                                            {sale.is_os && (
                                                                                <span className="px-1.5 py-0.5 bg-brand-red text-white text-[8px] font-black rounded uppercase tracking-tighter shadow-sm">OS</span>
                                                                            )}
                                                                            {!sale.is_os && (
                                                                                <span className={`px-1.5 py-0.5 ${sale.invoice_type === 'B' ? 'bg-indigo-600' : 'bg-slate-700'} text-white text-[8px] font-black rounded uppercase tracking-tighter shadow-sm`}>
                                                                                    TYPE {sale.invoice_type}
                                                                                </span>
                                                                            )}
                                                                            {sale.total_discount > 0 && (
                                                                                <span className="px-1.5 py-0.5 bg-brand-orange text-white text-[8px] font-black rounded uppercase tracking-tighter shadow-sm">DISC</span>
                                                                            )}
                                                                            {refundedInvoices.has(sale.invoice_number) && (
                                                                                <span className="px-1.5 py-0.5 bg-brand-red/10 text-brand-red text-[8px] font-black rounded uppercase tracking-tighter border border-brand-red/20 shadow-sm flex items-center gap-0.5 shrink-0">
                                                                                    <RotateCcw size={8} /> REFUNDED
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                 <p className="text-[10px] font-bold text-text-muted uppercase">{formatDate(sale.date, 'MMM d, yyyy · p')}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <div className="flex items-center gap-2">
                                                            <User size={12} className="text-text-muted/30" />
                                                            <span className="text-[11px] font-black text-text-primary uppercase tracking-widest">{sale.customer_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full w-fit ${sale.fulfillment_status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                                                            sale.fulfillment_status === 'out' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-text-muted'
                                                            }`}>
                                                            {getStatusIcon(sale.fulfillment_status)}
                                                            <span className="text-[9px] font-black uppercase tracking-tight">{getStatusText(sale.fulfillment_status)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full w-fit border border-border-strong/10">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-red shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                                                            <span className="text-[10px] font-black text-text-primary uppercase tracking-wider">{sale.payment_mode || 'CASH'}</span>
                                                        </div>
                                                    </td>
                                                     <td className="px-6 py-3.5 text-right font-data font-black text-text-primary text-base">{formatCurrency(sale.grand_total)}</td>
                                                    <td className="px-6 py-3.5 text-right flex items-center justify-end gap-2">
                                                        {role === 'owner' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(sale.invoice_number); }}
                                                                className="p-2 text-text-muted/30 hover:text-brand-red hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                        <div className={`p-2 rounded-lg transition-all ${expandedInvoices.has(sale.invoice_number) ? 'bg-brand-red text-white rotate-180' : 'bg-muted text-text-muted/30'}`}><ChevronDown size={16} /></div>
                                                    </td>
                                                </tr>
                                                {expandedInvoices.has(sale.invoice_number) && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-4 bg-subtle/50">
                                                            <div className="p-6 border-l-4 border-brand-red bg-surface shadow-sm rounded-2xl space-y-6">
                                                                <div className="flex items-center justify-between border-b border-border-default pb-3">
                                                                    <div className="flex items-center gap-4">
                                                                        <h4 className="text-[10px] font-black uppercase text-text-primary tracking-widest flex items-center gap-2"><PackageSearch size={14} /> Invoice Breakdown</h4>
                                                                        {!sale.is_os && (
                                                                            <span className={`px-2 py-0.5 ${sale.invoice_type === 'B' ? 'bg-indigo-600' : 'bg-slate-700'} text-white text-[9px] font-black rounded uppercase tracking-tighter shadow-sm`}>
                                                                                TYPE {sale.invoice_type}
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] font-bold text-text-muted bg-muted px-2 py-0.5 rounded uppercase">{sale.full_name}</span>
                                                                        {sale.edited_at && (
                                                                            <span className="text-[9px] font-bold text-brand-orange bg-brand-orange/5 px-2 py-0.5 rounded-lg border border-brand-orange/10 flex items-center gap-1">
                                                                                <Clock size={10} /> Edited {formatDate(sale.edited_at, 'MMM d · p')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <button onClick={() => handleEditInvoice(sale)} className="text-[10px] font-black bg-text-primary text-text-inverse hover:bg-brand-red px-4 py-1.5 rounded-lg transition-all">EDIT INVOICE</button>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                    <div className="space-y-3">
                                                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Purchased Items</p>
                                                                        <div className="space-y-2">
                                                                            {sale.items.map(item => (
                                                                                <div key={item.id} className="flex justify-between items-start gap-4 text-xs p-2 rounded-lg hover:bg-subtle">
                                                                                    <div className="flex-1">
                                                                                        <p className="font-bold text-text-primary">{item.products?.name}</p>
                                                                                        <p className="text-[9px] text-text-muted uppercase font-data">{item.products?.brand || 'No Brand'}</p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="font-bold text-text-primary">x{item.quantity}</p>
                                                                                        <p className="text-[9px] text-text-muted font-data">UNIT: {formatCurrency(item.unit_price)}</p>
                                                          <p className="text-[10px] text-text-secondary font-data font-black">TOTAL: {formatCurrency(item.total_price)}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    <div className="bg-subtle/50 p-6 rounded-2xl space-y-4">
                                                                        <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest">Financial Summary</p>
                                                                        <div className="space-y-2">
                                                                            <div className="flex justify-between text-[10px] items-center">
                                                                                <span className="text-text-muted font-bold uppercase tracking-tight">Payment Mode</span>
                                                                                <span className="bg-brand-red/10 text-brand-red px-3 py-1 rounded-full font-black uppercase text-[9px]">{sale.payment_mode}</span>
                                                                            </div>
                                                                            {!(sale.is_os || sale.grand_total < 101) && (
                                                                                <>
                                                                                    <div className="flex justify-between text-xs pt-2">
                                                                                        <span className="text-text-muted font-medium">VATable Sales (Tax Base)</span>
                                                          <span className="font-data font-bold">{formatCurrency((sale.total_vat > 0 ? (sale.total_base / 1.12) : 0))}</span>
                                                      </div>
                                                      <div className="flex justify-between text-xs">
                                                          <span className="text-text-muted font-medium">VAT Amount (12%)</span>
                                                          <span className="font-data font-bold text-brand-red">{formatCurrency(sale.total_vat)}</span>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                            <div className="flex justify-between text-xs pt-1">
                                                                                <span className="text-text-muted font-medium">Initial Sub-Total</span>
                                                              <span className="font-data font-bold">{formatCurrency(sale.total_base)}</span>
                                              </div>
                                              {sale.total_discount > 0 && (
                                                  <div className="flex justify-between text-xs">
                                                      <span className="text-brand-orange font-medium">Applied Discount</span>
                                                      <span className="font-data font-bold text-brand-orange">- {formatCurrency(sale.total_discount)}</span>
                                                                                </div>
                                                                            )}
                                                                            {Number(sale.delivery_fee) > 0 && (
                                                                                <div className="flex justify-between text-xs pt-1 border-t border-border-default/50 mt-1">
                                                                                    <span className="text-text-muted font-bold uppercase tracking-tighter text-[9px]">Delivery Fee</span>
                                                              <span className="font-data font-black text-blue-500">+ {formatCurrency(sale.delivery_fee)}</span>
                                                  </div>
                                              )}
                                              <div className="pt-3 border-t-2 border-border-default flex justify-between items-center text-sm font-black text-text-primary">
                                                  <span className="uppercase tracking-widest text-[10px]">Grand Total</span>
                                                  <span className="text-2xl font-data">{formatCurrency(sale.grand_total)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        ))
                                    ) : (
                                        <tr><td colSpan={5} className="py-20 text-center text-text-muted transition-colors">No matching orders found for this date.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

        </div >
    );
}
