import { useEffect, useState, useCallback, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import {
    Search, ChevronDown, Receipt, ShoppingBag, Download, Filter, Trash2, User, Truck, Clock, CheckCircle2, PackageSearch, RotateCcw
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import SalesModal from '../components/SalesModal';
import Calendar from '../components/Calendar';
import { useAuth } from '../hooks/useAuth';

interface Sale {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    date: string;
    invoice_number: string;
    user_id: string;
    vat_amount: number;
    discount_amount: number;
    is_discounted: boolean;
    is_os?: boolean;
    full_name: string;
    customer_name?: string;
    fulfillment_status?: 'pickup' | 'delivered' | 'out';
    payment_mode?: string;
    edited_at?: string;
    delivery_fee?: number;
    products: {
        name: string;
        brand?: string;
    };
}

interface SupabaseSale {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    date: string;
    invoice_number: string;
    user_id: string;
    vat_amount: number;
    discount_amount: number;
    is_discounted: boolean;
    is_os?: boolean;
    customer_name?: string;
    fulfillment_status?: 'pickup' | 'delivered' | 'out';
    payment_mode?: string;
    edited_at?: string;
    delivery_fee?: number;
    products: {
        name: string;
        brand?: string;
    };
}

interface GroupedSale {
    invoice_number: string;
    date: string;
    full_name: string;
    customer_name: string;
    fulfillment_status: 'pickup' | 'delivered' | 'out';
    payment_mode: string;
    items: Sale[];
    is_os: boolean;
    edited_at: string | null;
    total_base: number;
    total_vat: number;
    total_discount: number;
    delivery_fee: number;
    grand_total: number;
}

interface SalesEditData {
    invoiceNumber: string;
    customerName?: string;
    fulfillmentStatus?: string;
    paymentMode?: string;
    items: {
        product_id: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        name?: string;
        brand?: string;
    }[];
    isVatEnabled: boolean;
    isDiscountEnabled: boolean;
    is_os?: boolean;
    date?: string;
    delivery_fee?: number;
}

export default function Sales() {
    const { role } = useAuth();
    const [groupedSales, setGroupedSales] = useState<GroupedSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editData, setEditData] = useState<SalesEditData | null>(null);
    const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [filterType, setFilterType] = useState<'all' | 'standard' | 'os' | 'discounted' | 'refunded'>('all');
    const [refundedInvoices, setRefundedInvoices] = useState<Set<string>>(new Set());
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const fetchSales = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        const [salesRes, refundsRes] = await Promise.all([
            supabase.from('sales').select(`*, products(name, brand)`).order('date', { ascending: false }),
            supabase.from('customer_refunds').select('invoice_number')
        ]);

        if (refundsRes.data) {
            setRefundedInvoices(new Set(refundsRes.data.map(r => r.invoice_number).filter(Boolean)));
        }

        const { data, error } = salesRes;

        if (error) {
            console.error('Error fetching sales:', error);
        } else {
            const groups: { [key: string]: GroupedSale } = {};
            (data as unknown as SupabaseSale[]).forEach(sale => {
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
                        grand_total: 0
                    };
                }
                const group = groups[key];
                const s = { ...sale, full_name: 'Staff' } as Sale;
                group.items.push(s);
                group.total_base += Number(s.total_price);
                group.total_vat += Number(s.vat_amount || 0);
                group.total_discount += Number(s.discount_amount || 0);
            });

            Object.values(groups).forEach(group => {
                group.grand_total = group.total_base - group.total_discount + Number(group.delivery_fee);
            });

            setGroupedSales(Object.values(groups).sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            ));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        let mounted = true;
        const load = async () => { if (mounted) await fetchSales(); };
        load();
        const channel = supabase.channel('sales_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => { if (mounted) fetchSales(true); }).subscribe();
        return () => { mounted = false; supabase.removeChannel(channel); };
    }, [fetchSales]);

    const toggleExpand = (invoiceNumber: string) => {
        setExpandedInvoices(prev => {
            const next = new Set(prev);
            if (next.has(invoiceNumber)) next.delete(invoiceNumber);
            else next.add(invoiceNumber);
            return next;
        });
    };

    const filteredSales = groupedSales.filter(group => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (group.invoice_number?.toLowerCase().includes(search) ?? false) ||
            (group.customer_name?.toLowerCase().includes(search) ?? false) ||
            group.items.some(item =>
                (item.products?.name?.toLowerCase().includes(search) ?? false)
            )
        );
        return matchesSearch && isSameDay(new Date(group.date), selectedDate) && (
            filterType === 'all' ||
            (filterType === 'standard' && !group.is_os) ||
            (filterType === 'os' && group.is_os) ||
            (filterType === 'discounted' && group.total_discount > 0) ||
            (filterType === 'refunded' && refundedInvoices.has(group.invoice_number))
        );
    });

    const activeDates = Array.from(new Set(groupedSales.map(s => format(new Date(s.date), 'yyyy-MM-dd'))));

    const handleSuccess = () => { setEditData(null); fetchSales(); };

    const handleEditInvoice = (group: GroupedSale) => {
        setEditData({
            invoiceNumber: group.invoice_number,
            customerName: group.customer_name,
            fulfillmentStatus: group.fulfillment_status,
            paymentMode: group.payment_mode,
            items: group.items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                name: item.products.name,
                brand: item.products.brand
            })),
            isVatEnabled: group.total_vat > 0,
            isDiscountEnabled: group.total_discount > 0,
            is_os: group.is_os,
            date: group.date,
            delivery_fee: group.delivery_fee
        });
        setIsModalOpen(true);
    };

    const handleDeleteInvoice = async (invoiceNumber: string) => {
        if (!window.confirm(`Are you sure you want to delete invoice ${invoiceNumber}? This will restore stock to inventory.`)) return;

        setLoading(true);
        try {
            const { error: deleteError } = await supabase
                .from('sales')
                .delete()
                .eq('invoice_number', invoiceNumber);

            if (deleteError) throw deleteError;

            if (deleteError) throw deleteError;
            fetchSales();

            fetchSales();
        } catch (err) {
            console.error('Error deleting sale:', err);
            alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setLoading(false);
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
                    <h1 className="text-3xl font-black text-brand-charcoal tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center shadow-red"><Receipt className="text-white" size={24} /></div>
                        Sales Dashboard
                    </h1>
                    <p className="text-slate-700 mt-1 font-medium">Customer Orders, List of Orders, Invoice & Inventory Sync</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"><Download size={18} /> Export</button>
                    <button onClick={() => { setEditData(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red active:scale-95"><ShoppingBag size={18} /> CREATE SALE</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                    <input type="text" placeholder="Search by Invoice, Customer or Item..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none transition-all shadow-sm placeholder:text-slate-500 text-slate-900" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`px-5 py-3 border rounded-2xl transition-all shadow-sm flex items-center gap-2 font-bold text-sm ${filterType !== 'all' ? 'bg-brand-red text-white border-brand-red' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'}`}
                    >
                        <Filter size={18} /> {filterType === 'all' ? 'Filters' : filterType.toUpperCase()}
                    </button>
                    {isFilterOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-slide-up">
                            {[
                                { id: 'all', label: 'All Invoices' },
                                { id: 'standard', label: 'Regular Invoices' },
                                { id: 'os', label: 'OS Invoices' },
                                { id: 'discounted', label: 'Discounted Sales' },
                                { id: 'refunded', label: 'Refunded' }
                            ].map(option => (
                                <button
                                    key={option.id}
                                    onClick={() => { setFilterType(option.id as 'all' | 'standard' | 'os' | 'discounted' | 'refunded'); setIsFilterOpen(false); }}
                                    className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors ${filterType === option.id ? 'bg-brand-red text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-shrink-0">
                    <div className="sticky top-6 space-y-4">
                        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} activeDates={activeDates} />
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/5 rounded-full -mr-12 -mt-12" />
                            <h3 className="text-[10px] font-black text-brand-charcoal border-b border-slate-100 pb-3 mb-4 uppercase tracking-[0.2em]">Summary Statistics</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Standard Invoices</p>
                                        <p className="text-sm font-black text-brand-charcoal font-data">{filteredSales.filter(s => !s.is_os).length}</p>
                                        <p className="text-[10px] font-bold text-slate-500 font-data">₱{filteredSales.filter(s => !s.is_os).reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">OS Invoices</p>
                                        <p className="text-sm font-black text-brand-red font-data">{filteredSales.filter(s => s.is_os).length}</p>
                                        <p className="text-[10px] font-bold text-slate-500 font-data">₱{filteredSales.filter(s => s.is_os).reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-slate-100">
                                    <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest mb-1">Total Revenue</p>
                                    <p className="text-xl font-black text-brand-charcoal font-data">₱{filteredSales.reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-[11px] font-black text-brand-charcoal uppercase tracking-widest">Sales Details</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-brand-charcoal uppercase tracking-widest">Customer</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-brand-charcoal uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-brand-charcoal uppercase tracking-widest">Payment</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-brand-charcoal uppercase tracking-widest text-right">Amount</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-600 uppercase tracking-widest w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={5} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded w-full"></div></td></tr>)
                                    ) : filteredSales.length > 0 ? (
                                        filteredSales.map((sale) => (
                                            <Fragment key={sale.invoice_number}>
                                                <tr onClick={() => toggleExpand(sale.invoice_number)} className="group hover:bg-slate-50 transition-all cursor-pointer">
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-red group-hover:text-white transition-all"><Receipt size={18} /></div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-sm font-black text-brand-charcoal uppercase font-data">{sale.invoice_number}</p>
                                                                    <div className="flex items-center gap-1">
                                                                        {sale.is_os && (
                                                                            <span className="px-1.5 py-0.5 bg-brand-red text-white text-[8px] font-black rounded uppercase tracking-tighter shadow-sm">OS</span>
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
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{format(new Date(sale.date), 'MMM d, yyyy · p')}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-2">
                                                            <User size={12} className="text-slate-300" />
                                                            <span className="text-[11px] font-black text-brand-charcoal uppercase tracking-widest">{sale.customer_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full w-fit ${sale.fulfillment_status === 'delivered' ? 'bg-emerald-50 text-emerald-600' :
                                                            sale.fulfillment_status === 'out' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'
                                                            }`}>
                                                            {getStatusIcon(sale.fulfillment_status)}
                                                            <span className="text-[9px] font-black uppercase tracking-tight">{getStatusText(sale.fulfillment_status)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100/50 rounded-full w-fit border border-slate-200/50">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-red shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                                                            <span className="text-[10px] font-black text-brand-charcoal uppercase tracking-wider">{sale.payment_mode || 'CASH'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-data font-black text-brand-charcoal text-base">₱{sale.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                                                        {role === 'admin' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(sale.invoice_number); }}
                                                                className="p-2 text-slate-200 hover:text-brand-red hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                        <div className={`p-2 rounded-lg transition-all ${expandedInvoices.has(sale.invoice_number) ? 'bg-brand-red text-white rotate-180' : 'bg-slate-50 text-slate-300'}`}><ChevronDown size={16} /></div>
                                                    </td>
                                                </tr>
                                                {expandedInvoices.has(sale.invoice_number) && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-4 bg-slate-50/50">
                                                            <div className="p-6 border-l-4 border-brand-red bg-white shadow-sm rounded-2xl space-y-6">
                                                                <div className="flex items-center justify-between border-b pb-3">
                                                                    <div className="flex items-center gap-4">
                                                                        <h4 className="text-[10px] font-black uppercase text-brand-charcoal tracking-widest flex items-center gap-2"><PackageSearch size={14} /> Invoice Breakdown</h4>
                                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">{sale.full_name}</span>
                                                                        {sale.edited_at && (
                                                                            <span className="text-[9px] font-bold text-brand-orange bg-brand-orange/5 px-2 py-0.5 rounded-lg border border-brand-orange/10 flex items-center gap-1">
                                                                                <Clock size={10} /> Edited {format(new Date(sale.edited_at), 'MMM d · p')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <button onClick={() => handleEditInvoice(sale)} className="text-[10px] font-black bg-brand-charcoal text-white hover:bg-brand-red px-4 py-1.5 rounded-lg transition-all">EDIT INVOICE</button>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                    <div className="space-y-3">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Purchased Items</p>
                                                                        <div className="space-y-2">
                                                                            {sale.items.map(item => (
                                                                                <div key={item.id} className="flex justify-between items-start gap-4 text-xs p-2 rounded-lg hover:bg-slate-50">
                                                                                    <div className="flex-1">
                                                                                        <p className="font-bold text-brand-charcoal">{item.products?.name}</p>
                                                                                        <p className="text-[9px] text-slate-400 uppercase font-data">{item.products?.brand || 'No Brand'}</p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="font-bold text-brand-charcoal">x{item.quantity}</p>
                                                                                        <p className="text-[9px] text-slate-400 font-data">UNIT: ₱{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                                                        <p className="text-[10px] text-slate-500 font-data font-black">TOTAL: ₱{Number(item.total_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    <div className="bg-slate-50/50 p-6 rounded-2xl space-y-4">
                                                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Financial Summary</p>
                                                                        <div className="space-y-2">
                                                                            <div className="flex justify-between text-[10px] items-center">
                                                                                <span className="text-slate-500 font-bold uppercase tracking-tight">Payment Mode</span>
                                                                                <span className="bg-brand-red-light text-brand-red px-3 py-1 rounded-full font-black uppercase text-[9px]">{sale.payment_mode}</span>
                                                                            </div>
                                                                            {!(sale.is_os || sale.grand_total < 101) && (
                                                                                <>
                                                                                    <div className="flex justify-between text-xs pt-2">
                                                                                        <span className="text-slate-500 font-medium">VATable Sales (Tax Base)</span>
                                                                                        <span className="font-data font-bold">₱{(sale.total_vat > 0 ? (sale.total_base / 1.12) : 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between text-xs">
                                                                                        <span className="text-slate-500 font-medium">VAT Amount (12%)</span>
                                                                                        <span className="font-data font-bold text-brand-red">₱{sale.total_vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                            <div className="flex justify-between text-xs pt-1">
                                                                                <span className="text-slate-500 font-medium">Initial Sub-Total</span>
                                                                                <span className="font-data font-bold">₱{sale.total_base.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                            {sale.total_discount > 0 && (
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-brand-orange font-medium">Applied Discount</span>
                                                                                    <span className="font-data font-bold text-brand-orange">- ₱{sale.total_discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                                </div>
                                                                            )}
                                                                            {Number(sale.delivery_fee) > 0 && (
                                                                                <div className="flex justify-between text-xs pt-1 border-t border-slate-100/50 mt-1">
                                                                                    <span className="text-slate-500 font-bold uppercase tracking-tighter text-[9px]">Delivery Fee</span>
                                                                                    <span className="font-data font-black text-blue-600">+ ₱{Number(sale.delivery_fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center text-sm font-black text-brand-charcoal">
                                                                                <span className="uppercase tracking-widest text-[10px]">Grand Total</span>
                                                                                <span className="text-2xl font-data">₱{sale.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                                        <tr><td colSpan={5} className="py-20 text-center text-slate-400">No matching orders found for this date.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <SalesModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditData(null); }} onSuccess={handleSuccess} editData={editData || undefined} />
        </div >
    );
}
