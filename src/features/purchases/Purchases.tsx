import { useEffect, useState, useCallback, Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase';
import {
    Search, ChevronDown, ShoppingBag, Package, Download, Filter, CheckCircle2, Clock, Trash2, RotateCcw, Tag
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import PurchaseModal from './components/PurchaseModal';
import Calendar from '../../features/reports/components/Calendar';
import { useAuth } from '../../shared/hooks/useAuth';
import { useBranch } from '../../shared/lib/BranchContext';

interface Purchase {
    id: string;
    transaction_label?: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    date: string;
    invoice_number: string;
    supplier: string;
    status: 'pending' | 'received';
    received_date: string | null;
    vat_amount: number;
    discount_amount: number;
    payment_status: 'unpaid' | 'partial' | 'paid';
    payment_date: string | null;
    purchase_type: 'supplier' | 'transfer';
    products: {
        name: string;
    };
}

interface SupabasePurchase {
    id: string;
    transaction_label?: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    date: string;
    invoice_number: string;
    supplier: string;
    status: 'pending' | 'received';
    received_date: string | null;
    vat_amount: number;
    discount_amount: number;
    payment_status: 'unpaid' | 'partial' | 'paid';
    payment_date: string | null;
    purchase_type: 'supplier' | 'transfer';
    products: {
        name: string;
    };
}

interface GroupedPurchase {
    invoice_number: string;
    date: string;
    supplier: string;
    status: 'pending' | 'received';
    payment_status: 'unpaid' | 'partial' | 'paid';
    purchase_type: 'supplier' | 'transfer';
    items: Purchase[];
    total_base: number;
    total_vat: number;
    total_discount: number;
    grand_total: number;
    transaction_label: string | null;
}

export default function Purchases() {
    const { role } = useAuth();
    const { activeBranchId } = useBranch();
    const navigate = useNavigate();
    const location = useLocation();
    const [groupedPurchases, setGroupedPurchases] = useState<GroupedPurchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
        start: new Date(),
        end: new Date()
    });
    const [isDateRangeActive, setIsDateRangeActive] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editData, setEditData] = useState<unknown>(null);
    const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [statusFilters, setStatusFilters] = useState<string[]>([]);
    const [paymentFilters, setPaymentFilters] = useState<string[]>([]);
    const [typeFilters, setTypeFilters] = useState<string[]>([]);
    const [returnedInvoices, setReturnedInvoices] = useState<Set<string>>(new Set());

    const fetchPurchases = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        let purchasesQuery = supabase.from('purchases').select(`*, products(name)`).order('date', { ascending: false });
        let returnsQuery = supabase.from('supplier_returns').select('invoice_number');

        if (activeBranchId) {
            purchasesQuery = purchasesQuery.eq('branch_id', activeBranchId);
            returnsQuery = returnsQuery.eq('branch_id', activeBranchId);
        }

        const [purchasesRes, returnsRes] = await Promise.all([
            purchasesQuery,
            returnsQuery
        ]);

        if (returnsRes.data) {
            setReturnedInvoices(new Set(returnsRes.data.map(r => r.invoice_number).filter(Boolean)));
        }

        const { data, error } = purchasesRes;

        if (error) {
            console.error('Error fetching purchases:', error);
        } else {
            const groups: { [key: string]: GroupedPurchase } = {};
            (data as unknown as SupabasePurchase[]).forEach(purchase => {
                const key = purchase.invoice_number || `UNTRACKED-${purchase.id}`;
                if (!groups[key]) {
                    groups[key] = {
                        invoice_number: purchase.invoice_number,
                        date: purchase.date,
                        supplier: purchase.supplier || 'Unknown Supplier',
                        status: 'received',
                        payment_status: 'paid', // Default to paid, will be demoted
                        purchase_type: purchase.purchase_type || 'supplier',
                        items: [],
                        total_base: 0,
                        total_vat: 0,
                        total_discount: 0,
                        grand_total: 0,
                        transaction_label: purchase.transaction_label || null
                    };
                }
                const group = groups[key];
                group.items.push(purchase);
                group.total_base += purchase.total_price;
                group.total_vat += purchase.vat_amount || 0;
                group.total_discount += purchase.discount_amount || 0;
                if (purchase.status === 'pending') group.status = 'pending';

                // Track most restrictive payment status in group
                const pStatus = purchase.payment_status || 'unpaid';
                if (pStatus === 'unpaid') {
                    group.payment_status = 'unpaid';
                } else if (pStatus === 'partial' && group.payment_status === 'paid') {
                    group.payment_status = 'partial';
                }
            });

            Object.values(groups).forEach(group => {
                group.grand_total = group.total_base - group.total_discount;
            });

            setGroupedPurchases(Object.values(groups).sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            ));
        }
        setLoading(false);
    }, [activeBranchId]);

    useEffect(() => {
        let mounted = true;
        const load = async () => { if (mounted) await fetchPurchases(); };
        load();
        const channel = supabase.channel('purchases_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => { if (mounted) fetchPurchases(true); }).subscribe();
        return () => { mounted = false; supabase.removeChannel(channel); };
    }, [fetchPurchases]);

    // Listen for global "P" shortcut to open purchase modal
    // Global Shortcuts & Navigation Redirection
    useEffect(() => {
        const handleOpenModal = () => { setEditData(null); setIsModalOpen(true); };
        window.addEventListener('open-purchase-modal', handleOpenModal);

        if ((location.state as any)?.openModal) {
            handleOpenModal();
            navigate(location.pathname, { replace: true, state: {} });
        }

        return () => window.removeEventListener('open-purchase-modal', handleOpenModal);
    }, [location.state, navigate, location.pathname]);

    const toggleExpand = (invoiceNumber: string) => {
        setExpandedInvoices(prev => {
            const next = new Set(prev);
            if (next.has(invoiceNumber)) next.delete(invoiceNumber);
            else next.add(invoiceNumber);
            return next;
        });
    };

    const handleMarkAsReceived = async (group: GroupedPurchase) => {
        try {
            const { error: updateError } = await supabase
                .from('purchases')
                .update({
                    status: 'received',
                    received_date: new Date().toISOString()
                })
                .eq('invoice_number', group.invoice_number);

            if (updateError) throw updateError;
            fetchPurchases(true);
        } catch (err) {
            console.error('Error marking as received:', err);
        }
    };

    const handleMarkAsPaid = async (group: GroupedPurchase) => {
        if (group.payment_status === 'paid') return;
        if (!confirm(`Mark invoice ${group.invoice_number} as FULLY PAID?`)) return;

        try {
            const { error } = await supabase
                .from('purchases')
                .update({
                    payment_status: 'paid',
                    payment_date: new Date().toISOString()
                })
                .eq('invoice_number', group.invoice_number);

            if (error) throw error;
            fetchPurchases(true);
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Error updating payment status:', err);
            alert('Failed to update payment status: ' + err.message);
        }
    };

    const filteredPurchases = groupedPurchases.filter(group => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (group.invoice_number?.toLowerCase().includes(search) ?? false) ||
            (group.supplier?.toLowerCase().includes(search) ?? false) ||
            group.items.some(item =>
                (item.products?.name?.toLowerCase().includes(search) ?? false)
            )
        );

        const purchaseDate = new Date(group.date);
        purchaseDate.setHours(0, 0, 0, 0); // Normalize to start of day

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        start.setHours(0, 0, 0, 0); // Normalize to start of day
        end.setHours(23, 59, 59, 999); // Normalize to end of day

        const matchesDate = purchaseDate >= start && purchaseDate <= end;

        const isReturned = returnedInvoices.has(group.invoice_number);

        const matchesStatus = statusFilters.length === 0 ||
            (statusFilters.includes(group.status) && !statusFilters.includes('returned')) ||
            (statusFilters.includes('returned') && isReturned);

        const matchesPayment = paymentFilters.length === 0 || paymentFilters.includes(group.payment_status || 'unpaid');
        const matchesType = typeFilters.length === 0 || typeFilters.includes(group.purchase_type || 'supplier');

        return matchesSearch && matchesDate && matchesStatus && matchesPayment && matchesType;
    });

    const activeDates = Array.from(new Set(groupedPurchases.map(s => format(new Date(s.date), 'yyyy-MM-dd'))));

    const handleDateSelect = (date: Date) => {
        if (!isDateRangeActive) {
            setDateRange({ start: date, end: date });
            return;
        }

        if (!dateRange.start || (dateRange.start && dateRange.end && !isSameDay(dateRange.start, dateRange.end))) {
            // Start a new range
            setDateRange({ start: date, end: date });
        } else {
            // Complete the range
            if (date < dateRange.start) {
                setDateRange({ start: date, end: dateRange.start });
            } else {
                setDateRange({ ...dateRange, end: date });
            }
        }
    };

    const handleEditPurchase = (group: GroupedPurchase) => {
        setEditData({
            invoiceNumber: group.invoice_number,
            supplier: group.supplier,
            status: group.status,
            payment_status: group.payment_status,
            payment_date: group.items[0].payment_date,
            purchase_type: group.purchase_type,
            date: group.date,
            isVatEnabled: group.total_vat > 0,
            isDiscountEnabled: group.total_discount > 0,
            items: group.items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                name: item.products?.name
            }))
        });
        setIsModalOpen(true);
    };

    const handleDeleteInvoice = async (invoiceNumber: string) => {
        if (!window.confirm(`Are you sure you want to delete purchase ${invoiceNumber}? This will reverse inventory changes.`)) return;

        setLoading(true);
        try {
            // 1. Delete purchase records
            const { error: deleteError } = await supabase
                .from('purchases')
                .delete()
                .eq('invoice_number', invoiceNumber);

            if (deleteError) throw deleteError;
            fetchPurchases();
        } catch (err) {
            console.error('Error deleting purchase:', err);
            alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-text-primary tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center shadow-brand-red/20 shadow-lg"><ShoppingBag className="text-white" size={24} /></div>
                        Purchase Dashboard
                    </h1>
                    <p className="text-text-secondary mt-1 font-medium">Manage stock inwards and supplier invoices</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 bg-bg-surface border border-border-default text-text-secondary px-5 py-3 rounded-2xl font-bold text-sm hover:bg-bg-subtle transition-all shadow-sm"><Download size={18} /> Export</button>
                    <button onClick={() => { setEditData(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red active:scale-95"><ShoppingBag size={18} /> CREATE PURCHASE</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 relative">
                <div className="relative group flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={18} /><input type="text" placeholder="Search invoices or suppliers..." className="w-full pl-12 pr-4 py-3 bg-bg-surface border border-border-default rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none transition-all shadow-sm placeholder:text-text-muted text-text-primary" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>

                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`px-5 py-3 bg-bg-surface border border-border-default rounded-2xl text-text-primary hover:bg-bg-subtle transition-all shadow-sm flex items-center gap-2 font-bold text-sm ${isFilterOpen ? 'border-brand-red text-brand-red' : ''}`}
                    >
                        <Filter size={18} /> Filters {(statusFilters.length + paymentFilters.length + typeFilters.length) > 0 && <span className="w-5 h-5 bg-brand-red text-white rounded-full flex items-center justify-center text-[10px]">{statusFilters.length + paymentFilters.length + typeFilters.length}</span>}
                    </button>

                    {isFilterOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-bg-surface rounded-2xl shadow-xl border border-border-muted p-4 z-[100] animate-slide-up">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Order Status</h4>
                                    <div className="space-y-2">
                                        {['pending', 'received', 'returned'].map(s => (
                                            <label key={s} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={statusFilters.includes(s)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setStatusFilters([...statusFilters, s]);
                                                        else setStatusFilters(statusFilters.filter(f => f !== s));
                                                    }}
                                                    className="w-4 h-4 rounded border-border-default text-brand-red focus:ring-brand-red cursor-pointer bg-bg-base"
                                                />
                                                <span className="text-xs font-bold text-text-secondary capitalize group-hover:text-brand-red transition-colors">{s}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-border-muted">
                                    <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Payment Status</h4>
                                    <div className="space-y-2">
                                        {['unpaid', 'partial', 'paid'].map(s => (
                                            <label key={s} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={paymentFilters.includes(s)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setPaymentFilters([...paymentFilters, s]);
                                                        else setPaymentFilters(paymentFilters.filter(f => f !== s));
                                                    }}
                                                    className="w-4 h-4 rounded border-border-default text-brand-red focus:ring-brand-red cursor-pointer bg-bg-base"
                                                />
                                                <span className="text-xs font-bold text-text-secondary capitalize group-hover:text-brand-red transition-colors">{s === 'paid' ? 'Full' : s}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-border-muted">
                                    <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Purchase Type</h4>
                                    <div className="space-y-2">
                                        {[
                                            { id: 'supplier', label: 'Supplier' },
                                            { id: 'transfer', label: 'Transfer' }
                                        ].map(t => (
                                            <label key={t.id} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={typeFilters.includes(t.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setTypeFilters([...typeFilters, t.id]);
                                                        else setTypeFilters(typeFilters.filter(f => f !== t.id));
                                                    }}
                                                    className="w-4 h-4 rounded border-border-default text-brand-red focus:ring-brand-red cursor-pointer bg-bg-base"
                                                />
                                                <span className="text-xs font-bold text-text-secondary capitalize group-hover:text-brand-red transition-colors">{t.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setStatusFilters([]); setPaymentFilters([]); setTypeFilters([]); }}
                                    className="w-full py-2 text-[10px] font-black text-text-muted hover:text-brand-red uppercase tracking-widest text-center transition-colors"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-shrink-0">
                    <div className="sticky top-6 space-y-4">
                        <div className="bg-bg-surface p-6 rounded-3xl border border-border-muted shadow-sm space-y-4 w-full lg:w-72">
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

                        <div className="bg-bg-surface p-6 rounded-3xl border border-border-muted shadow-sm">
                            <h3 className="text-[10px] font-black text-text-secondary border-b border-border-muted pb-3 mb-4 uppercase tracking-[0.2em]">Summary</h3>
                            <div className="space-y-4">
                                <div><p className="text-[9px] font-black text-text-secondary uppercase tracking-widest mb-1">Total Cost</p><p className="text-xl font-black text-text-primary font-data">₱{filteredPurchases.reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                                <div><p className="text-[9px] font-black text-brand-red uppercase tracking-widest mb-1">Unpaid Amount</p><p className="text-xl font-black text-brand-red font-data">₱{filteredPurchases.filter(g => g.payment_status !== 'paid').reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                                <div><p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">Pending Orders</p><p className="text-xl font-black text-orange-500 font-data">{filteredPurchases.filter(g => g.status === 'pending').length}</p></div>
                                <div><p className="text-[9px] font-black text-text-secondary uppercase tracking-widest mb-1">Complete Orders</p><p className="text-xl font-black text-text-primary font-data">{filteredPurchases.length}</p></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="bg-bg-surface rounded-[32px] border border-border-muted shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-bg-subtle/50 border-b border-border-muted">
                                        <th className="px-8 py-5 text-[11px] font-black text-text-secondary uppercase tracking-widest pl-16">Created</th>
                                        <th className="px-8 py-5 text-[11px] font-black text-text-secondary uppercase tracking-widest">Invoice / Supplier</th>
                                        <th className="px-8 py-5 text-[11px] font-black text-text-secondary uppercase tracking-widest">Status / Payment</th>
                                        <th className="px-8 py-5 text-[11px] font-black text-text-secondary uppercase tracking-widest">Received Date</th>
                                        <th className="px-8 py-5 text-[11px] font-black text-text-primary uppercase tracking-widest text-right">Total Amount</th>
                                        <th className="px-8 py-5 text-[11px] font-black text-text-secondary uppercase tracking-widest w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-muted">
                                    {loading ? (
                                        [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-6 py-8"><div className="h-4 bg-bg-subtle rounded w-full"></div></td></tr>)
                                    ) : filteredPurchases.length > 0 ? (
                                        filteredPurchases.map((group) => {
                                            const creationDate = new Date(group.date);
                                            const itemsWithReceivedDate = group.items.filter(i => i.received_date);
                                            const receiptDate = itemsWithReceivedDate.length > 0 ? new Date(itemsWithReceivedDate[0].received_date!) : null;

                                            return (
                                                <Fragment key={group.invoice_number || group.date}>
                                                    <tr
                                                        onClick={() => toggleExpand(group.invoice_number)}
                                                        className={`hover:bg-bg-subtle/80 transition-all cursor-pointer group ${expandedInvoices.has(group.invoice_number) ? 'bg-bg-subtle/50' : ''}`}
                                                    >
                                                        <td className="px-8 py-7">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-bg-base flex items-center justify-center text-text-muted group-hover:bg-brand-red/10 group-hover:text-brand-red transition-colors">
                                                                    <Clock size={16} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-text-primary uppercase tracking-wider">{format(creationDate, 'MMM d, yyyy')}</p>
                                                                    <p className="text-[9px] font-bold text-text-muted uppercase">{format(creationDate, 'p')}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-7">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${group.status === 'received' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                                                    {group.status === 'received' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-black text-text-primary uppercase font-data">{group.invoice_number || 'N/A'}</p>{group.transaction_label && (<span className="px-1.5 py-0.5 bg-brand-charcoal text-white text-[8px] font-black rounded uppercase tracking-tighter shadow-sm flex items-center gap-0.5 shrink-0"><Tag size={8} /> {group.transaction_label}</span>)}
                                                                        {returnedInvoices.has(group.invoice_number) && (
                                                                            <span className="px-1.5 py-0.5 bg-brand-red/10 text-brand-red text-[8px] font-black rounded uppercase tracking-tighter border border-brand-red/20 shadow-sm flex items-center gap-0.5 shrink-0">
                                                                                <RotateCcw size={8} /> RETURNED
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] font-bold text-text-muted uppercase">{group.supplier}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-7">
                                                            <div className="flex flex-col gap-1">
                                                                {group.status === 'pending' ? (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleMarkAsReceived(group); }}
                                                                        className="w-fit group/btn flex items-center gap-1.5 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-emerald-600 hover:text-white hover:border-emerald-700 transition-all shadow-sm"
                                                                    >
                                                                        <div className="w-1 h-1 rounded-full bg-orange-400 group-hover/btn:bg-white animate-pulse" />
                                                                        <span>{group.status}</span>
                                                                        <CheckCircle2 size={8} className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                                                    </button>
                                                                ) : (
                                                                    <span className="w-fit flex items-center gap-1.5 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                                                        <CheckCircle2 size={8} />
                                                                        <span>{group.status}</span>
                                                                    </span>
                                                                )}
                                                                {group.payment_status === 'paid' ? (
                                                                    <span className="w-fit text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex items-center gap-1">
                                                                        <CheckCircle2 size={8} />
                                                                        PAID
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(group); }}
                                                                        className={`w-fit text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border transition-all hover:scale-105 active:scale-95 ${group.payment_status === 'partial' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20' : 'bg-brand-red/10 text-brand-red border-brand-red/20 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20'}`}
                                                                        title="Click to toggle to FULLY PAID"
                                                                    >
                                                                        {group.payment_status || 'unpaid'}
                                                                    </button>
                                                                )}
                                                                {group.purchase_type === 'transfer' && (
                                                                    <span className="w-fit text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border bg-blue-500/10 text-blue-500 border-blue-500/20">TRANSFER</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-7">
                                                            {receiptDate ? (
                                                                <div className="flex flex-col">
                                                                    <p className="text-[10px] font-black text-text-primary uppercase tracking-wider">{format(receiptDate, 'MMM d, yyyy')}</p>
                                                                    <p className="text-[9px] font-bold text-text-muted uppercase">{format(receiptDate, 'p')}</p>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-text-muted opacity-50 uppercase">Pending</span>
                                                            )}
                                                        </td>
                                                        <td className="px-8 py-7 text-right font-data font-black text-text-primary">₱{group.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-8 py-7 text-right flex items-center justify-end gap-2">
                                                            {role === 'owner' && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); if (confirm('Are you sure you want to delete this purchase?')) handleDeleteInvoice(group.invoice_number); }}
                                                                    className="p-2 text-text-muted hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                            <div className={`p-2 rounded-lg transition-all ${expandedInvoices.has(group.invoice_number) ? 'bg-brand-red text-white rotate-180' : 'bg-bg-base text-text-muted'}`}><ChevronDown size={16} /></div>
                                                        </td>
                                                    </tr>
                                                    {expandedInvoices.has(group.invoice_number) && (
                                                        <tr>
                                                            <td colSpan={6} className="px-8 py-6 bg-bg-base/50">
                                                                <div className="p-9 border-l-4 border-brand-red bg-bg-surface shadow-inner rounded-3xl space-y-6">
                                                                    <div className="flex items-center justify-between border-b border-border-muted pb-2">
                                                                        <h4 className="text-[10px] font-black uppercase text-text-primary tracking-widest flex items-center gap-2"><Package size={14} /> Items</h4>
                                                                        <div className="flex gap-2">
                                                                            {group.status === 'pending' && <button onClick={(e) => { e.stopPropagation(); if (confirm('Mark this order as Received? This will update live inventory levels.')) handleMarkAsReceived(group); }} className="text-[9px] font-black bg-emerald-500 text-white px-3 py-1 rounded uppercase tracking-tighter hover:bg-emerald-600 transition-colors">MARK AS RECEIVED</button>}
                                                                            <button onClick={(e) => { e.stopPropagation(); handleEditPurchase(group); }} className="text-[9px] font-black bg-text-primary text-bg-base px-3 py-1 rounded uppercase tracking-tighter hover:opacity-90 transition-opacity">EDIT</button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        {group.items.map((item, idx) => (
                                                                            <div key={idx} className="flex justify-between items-start text-xs border-b border-border-muted pb-2 last:border-0">
                                                                                <div>
                                                                                    <p className="font-bold text-text-primary">{item.products?.name}</p>
                                                                                    <p className="text-[9px] text-text-muted font-data">UNIT PRICE: ₱{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <p className="font-bold text-text-primary">x{item.quantity}</p>
                                                                                    <p className="text-[10px] text-text-secondary font-data font-black">₱{item.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <div className="pt-2 border-t border-border-muted flex flex-col items-end gap-1">{group.total_discount > 0 && <span className="text-[10px] text-brand-orange">Discount: -₱{group.total_discount.toLocaleString()}</span>}<span className="text-sm font-black text-brand-red font-data">Total: ₱{group.grand_total.toLocaleString()}</span></div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })
                                    ) : (
                                        <tr><td colSpan={6} className="py-20 text-center text-text-muted">No purchases found for this filters.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div >

            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <PurchaseModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditData(null); }} onSuccess={() => { fetchPurchases(); setEditData(null); }} editData={editData as any} />
        </div >
    );
}
