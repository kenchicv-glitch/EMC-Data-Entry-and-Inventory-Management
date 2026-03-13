import { useState, useCallback, Fragment } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { useCustomers } from './hooks/useCustomers';
import { useAuth } from '../../shared/hooks/useAuth';
import {
    Users, Plus, Search, Edit, Trash2, Mail, Phone, MapPin,
    CreditCard, Loader2, PackageSearch,
    AlertCircle, CheckCircle2, Receipt, ChevronDown, ShoppingBag,
    RotateCcw, Clock, Truck, Calendar, TrendingUp, Filter,
    ArrowRight
} from 'lucide-react';
import { useBranch } from '../../shared/lib/BranchContext';
import CustomerModal from './components/CustomerModal';
import SalesModal from '../sales/components/SalesModal';
import type { Customer, CustomerInsert } from '../../shared/types';
import { format } from 'date-fns';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
interface SaleRecord {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    date: string;
    invoice_number: string;
    customer_name: string;
    customer_id: string | null;
    fulfillment_status: 'pickup' | 'delivered' | 'out';
    payment_mode: string;
    is_os: boolean;
    vat_amount: number;
    discount_amount: number;
    is_discounted: boolean;
    delivery_fee: number;
    edited_at: string | null;
    products: { name: string; brand?: string };
}

interface GroupedInvoice {
    invoice_number: string;
    date: string;
    customer_name: string;
    fulfillment_status: 'pickup' | 'delivered' | 'out';
    payment_mode: string;
    is_os: boolean;
    items: SaleRecord[];
    total: number;
    delivery_fee: number;
    discount: number;
    grand_total: number;
}

type Tab = 'overview' | 'history' | 'ledger';

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────
export default function Customers() {
    const { role } = useAuth();
    const { activeBranchId } = useBranch();
    const { customers, isLoading, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hold'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    // Purchase history state
    const [customerSales, setCustomerSales] = useState<GroupedInvoice[]>([]);
    const [salesLoading, setSalesLoading] = useState(false);
    const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

    // Sales Modal state (for repeat orders)
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [repeatOrderData, setRepeatOrderData] = useState<{
        invoiceNumber: string;
        customerName?: string;
        customer_id?: string | null;
        fulfillmentStatus?: string;
        paymentMode?: string;
        items: { product_id: string; quantity: number; unit_price: number; total_price: number; name?: string; brand?: string }[];
        isVatEnabled: boolean;
        isDiscountEnabled: boolean;
        is_os?: boolean;
        delivery_fee?: number;
    } | null>(null);

    // ── Helpers ──
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'delivered': return <CheckCircle2 className="text-emerald-500" size={12} />;
            case 'out': return <Truck className="text-amber-500" size={12} />;
            default: return <Clock className="text-slate-400" size={12} />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'delivered': return 'Delivered';
            case 'out': return 'In Transit';
            default: return 'Store Pickup';
        }
    };

    // ── Filtering ──
    const filteredCustomers = customers.filter(c => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = c.name.toLowerCase().includes(search) || c.email?.toLowerCase().includes(search) || c.phone?.toLowerCase().includes(search);
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? c.is_active : !c.is_active);
        return matchesSearch && matchesStatus;
    });

    // ── Fetch customer purchase history ──
    const fetchCustomerSales = useCallback(async (customer: Customer) => {
        setSalesLoading(true);
        setCustomerSales([]);
        try {
            let query = supabase
                .from('sales')
                .select('*, products(name, brand)')
                .or(`customer_name.eq.${customer.name},customer_id.eq.${customer.id}`)
                .order('date', { ascending: false });

            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Group by invoice
            const groups: Record<string, GroupedInvoice> = {};
            (data || []).forEach((sale: SaleRecord) => {
                const key = sale.invoice_number;
                if (!key) return;
                if (!groups[key]) {
                    groups[key] = {
                        invoice_number: key,
                        date: sale.date,
                        customer_name: sale.customer_name || customer.name,
                        fulfillment_status: sale.fulfillment_status || 'pickup',
                        payment_mode: sale.payment_mode || 'cash',
                        is_os: sale.is_os || false,
                        items: [],
                        total: 0,
                        delivery_fee: Number(sale.delivery_fee) || 0,
                        discount: 0,
                        grand_total: 0
                    };
                }
                groups[key].items.push(sale);
                groups[key].total += Number(sale.total_price);
                groups[key].discount += Number(sale.discount_amount || 0);
            });
            Object.values(groups).forEach(g => {
                g.grand_total = g.total - g.discount + g.delivery_fee;
            });

            setCustomerSales(Object.values(groups).sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            ));
        } catch (err) {
            console.error('Error fetching customer sales:', err);
        } finally {
            setSalesLoading(false);
        }
    }, []);

    // ── Select customer ──
    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setActiveTab('overview');
        setExpandedInvoices(new Set());
        fetchCustomerSales(customer);
    };

    // ── CRUD ──
    const handleAdd = () => { setEditingCustomer(null); setIsModalOpen(true); };
    const handleEdit = (customer: Customer) => { setEditingCustomer(customer); setIsModalOpen(true); };
    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this customer?')) {
            await deleteCustomer(id);
            if (selectedCustomer?.id === id) setSelectedCustomer(null);
        }
    };
    const handleSubmit = async (data: CustomerInsert) => {
        if (editingCustomer) {
            await updateCustomer({ id: editingCustomer.id, updates: data });
        } else {
            await createCustomer({ ...data, branch_id: activeBranchId });
        }
        setIsModalOpen(false);
    };

    // ── Repeat order ──
    const handleRepeatOrder = (invoice: GroupedInvoice) => {
        setRepeatOrderData({
            invoiceNumber: '', // blank = new sale, auto-assign
            customerName: selectedCustomer?.name,
            customer_id: selectedCustomer?.id,
            fulfillmentStatus: invoice.fulfillment_status,
            paymentMode: invoice.payment_mode,
            items: invoice.items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                name: item.products?.name,
                brand: item.products?.brand
            })),
            isVatEnabled: !invoice.is_os,
            isDiscountEnabled: invoice.discount > 0,
            is_os: invoice.is_os,
            delivery_fee: invoice.delivery_fee
        });
        setIsSalesModalOpen(true);
    };

    // ── Toggle invoice expand ──
    const toggleExpand = (inv: string) => {
        setExpandedInvoices(prev => {
            const next = new Set(prev);
            if (next.has(inv)) next.delete(inv); else next.add(inv);
            return next;
        });
    };

    // ── Stats ──
    const totalOrders = customerSales.length;
    const totalSpent = customerSales.reduce((s, i) => s + i.grand_total, 0);
    const avgOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const lastPurchase = customerSales.length > 0 ? customerSales[0].date : null;

    // ── Loading screen ──
    if (isLoading && customers.length === 0) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={40} className="text-brand-red animate-spin" />
                    <p className="text-sm text-text-muted font-black uppercase tracking-widest">Loading Customer Database...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-bg-surface rounded-[24px] flex items-center justify-center shadow-xl border border-border-muted group transition-all hover:scale-105">
                        <Users className="text-brand-red group-hover:rotate-12 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tight">Customers</h1>
                        <p className="text-sm text-text-secondary mt-1 font-medium">Accounts, purchase history & relationships</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-bg-surface border border-border-default rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-text-primary placeholder:text-text-muted focus:ring-4 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-all w-full md:w-72 shadow-sm"
                        />
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'all' ? 'active' : statusFilter === 'active' ? 'hold' : 'all')}
                            className={`px-4 py-3.5 border rounded-2xl transition-all shadow-sm flex items-center gap-2 font-bold text-xs ${statusFilter !== 'all' ? 'bg-brand-red text-white border-brand-red' : 'bg-bg-surface border-border-default text-text-secondary hover:bg-bg-subtle'}`}
                        >
                            <Filter size={16} /> {statusFilter === 'all' ? 'All' : statusFilter === 'active' ? 'Active' : 'On Hold'}
                        </button>
                    </div>
                    {role === 'owner' && (
                        <button onClick={handleAdd} className="flex items-center gap-2 bg-text-primary text-bg-base px-6 py-3.5 rounded-2xl font-black text-xs hover:opacity-90 transition-all shadow-lg active:scale-95 flex-shrink-0">
                            <Plus size={18} /> ADD CUSTOMER
                        </button>
                    )}
                </div>
            </div>

            {/* ── Master-Detail Layout ── */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* ── Left Panel: Customer List ── */}
                <div className={`${selectedCustomer ? 'lg:w-[420px]' : 'w-full'} flex-shrink-0 transition-all`}>
                    <div className="bg-bg-surface rounded-[32px] border border-border-muted shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-bg-subtle/50 border-b border-border-muted flex items-center justify-between">
                            <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">{filteredCustomers.length} Customers</span>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">₱{customers.reduce((s, c) => s + c.current_balance, 0).toLocaleString()} Total Exposure</span>
                        </div>
                        <div className="divide-y divide-border-muted max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                            {filteredCustomers.length === 0 ? (
                                <div className="p-12 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-bg-base rounded-[20px] flex items-center justify-center mb-4 border border-border-muted">
                                        <PackageSearch className="text-text-muted opacity-20" size={32} />
                                    </div>
                                    <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">No Customers Found</h3>
                                    <p className="text-text-muted max-w-xs mt-1 text-xs font-medium">Adjust your search or add a new customer.</p>
                                </div>
                            ) : (
                                filteredCustomers.map(customer => (
                                    <button
                                        key={customer.id}
                                        onClick={() => handleSelectCustomer(customer)}
                                        className={`w-full text-left px-6 py-4 hover:bg-bg-subtle transition-all flex items-center gap-4 group ${selectedCustomer?.id === customer.id ? 'bg-brand-red/5 border-l-4 border-brand-red' : 'border-l-4 border-transparent'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm transition-all ${selectedCustomer?.id === customer.id ? 'bg-brand-red text-white' : customer.is_active ? 'bg-brand-red/10 text-brand-red' : 'bg-bg-base text-text-muted opacity-50'}`}>
                                            {customer.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-text-primary uppercase tracking-tight truncate">{customer.name}</p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] font-bold text-text-muted opacity-50 font-data">{customer.phone || 'No phone'}</span>
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${customer.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-bg-base text-text-muted opacity-50'}`}>
                                                    {customer.is_active ? 'Active' : 'Hold'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xs font-black font-data ${customer.current_balance > 0 ? 'text-brand-red' : 'text-text-muted opacity-50'}`}>
                                                ₱{customer.current_balance.toLocaleString()}
                                            </p>
                                            <p className="text-[9px] font-bold text-text-muted opacity-40 font-data">/ ₱{(customer.credit_limit || 0).toLocaleString()}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Right Panel: Detail ── */}
                {selectedCustomer ? (
                    <div className="flex-1 min-w-0 space-y-6">
                        {/* Customer Header Card */}
                        <div className="bg-bg-surface rounded-[32px] border border-border-muted shadow-sm p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-brand-red/5 rounded-full -mr-20 -mt-20" />
                            <div className="flex items-start justify-between relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl bg-brand-red flex items-center justify-center text-white text-2xl font-black shadow-lg">
                                        {selectedCustomer.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight">{selectedCustomer.name}</h2>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${selectedCustomer.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-bg-base text-text-muted opacity-50'}`}>
                                                {selectedCustomer.is_active ? 'Account Eligible' : 'Account On Hold'}
                                            </span>
                                            <span className="text-[10px] font-bold text-text-muted opacity-50 font-data">Since {format(new Date(selectedCustomer.created_at), 'MMM yyyy')}</span>
                                        </div>
                                    </div>
                                </div>
                                {role === 'owner' && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleEdit(selectedCustomer)} className="p-3 rounded-2xl hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-all">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(selectedCustomer.id)} className="p-3 rounded-2xl hover:bg-brand-red/10 text-text-muted hover:text-brand-red transition-all">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2">
                            {([
                                { id: 'overview', label: 'Overview', icon: Users },
                                { id: 'history', label: 'Purchase History', icon: Receipt },
                                { id: 'ledger', label: 'Ledger', icon: CreditCard }
                            ] as const).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-text-primary text-bg-base shadow-lg' : 'bg-bg-surface text-text-muted border border-border-muted hover:bg-bg-subtle'}`}
                                >
                                    <tab.icon size={14} /> {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* ── TAB: Overview ── */}
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Contact Card */}
                                <div className="bg-bg-surface rounded-[28px] border border-border-muted shadow-sm p-6 space-y-5">
                                    <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] border-b border-border-muted pb-3">Contact Details</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-bg-base/50 flex items-center justify-center"><Phone size={14} className="text-text-muted" /></div>
                                            <span className="text-sm font-bold text-text-primary font-data">{selectedCustomer.phone || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-bg-base/50 flex items-center justify-center"><Mail size={14} className="text-text-muted" /></div>
                                            <span className="text-sm font-bold text-text-primary truncate">{selectedCustomer.email || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-bg-base/50 flex items-center justify-center flex-shrink-0"><MapPin size={14} className="text-text-muted" /></div>
                                            <span className="text-sm font-medium text-text-secondary leading-relaxed">{selectedCustomer.address || 'No address registered'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Credit Exposure Card */}
                                <div className="bg-bg-surface rounded-[28px] border border-border-muted shadow-sm p-6 space-y-5">
                                    <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] border-b border-border-muted pb-3 flex items-center gap-2"><CreditCard size={12} /> Credit Exposure</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Outstanding Balance</span>
                                                <span className={`text-xl font-black font-data ${selectedCustomer.current_balance > 0 ? 'text-brand-red' : 'text-text-primary'}`}>₱{selectedCustomer.current_balance.toLocaleString()}</span>
                                            </div>
                                            <div className="w-full h-3 bg-bg-base rounded-full overflow-hidden border border-border-muted">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${selectedCustomer.current_balance > selectedCustomer.credit_limit ? 'bg-brand-red animate-pulse' : 'bg-brand-orange'}`}
                                                    style={{ width: `${Math.min((selectedCustomer.current_balance / (selectedCustomer.credit_limit || 1)) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-black text-text-muted uppercase tracking-widest">
                                            <span>Limit: ₱{(selectedCustomer.credit_limit || 0).toLocaleString()}</span>
                                            {selectedCustomer.current_balance > selectedCustomer.credit_limit && (
                                                <div className="flex items-center gap-1 text-brand-red"><AlertCircle size={14} className="animate-bounce" /> Over Limit</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Cards */}
                                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Total Orders', value: totalOrders.toString(), icon: ShoppingBag, color: 'text-brand-red' },
                                        { label: 'Total Spent', value: `₱${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-emerald-500' },
                                        { label: 'Avg Order', value: `₱${avgOrder.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Receipt, color: 'text-brand-orange' },
                                        { label: 'Last Purchase', value: lastPurchase ? format(new Date(lastPurchase), 'MMM d, yyyy') : 'Never', icon: Calendar, color: 'text-blue-500' }
                                    ].map((stat, idx) => (
                                        <div key={idx} className="bg-bg-surface rounded-[24px] border border-border-muted shadow-sm p-5 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-bg-base rounded-full -mr-8 -mt-8 opacity-50" />
                                            <stat.icon size={16} className={`${stat.color} mb-3`} />
                                            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">{stat.label}</p>
                                            <p className={`text-sm font-black ${stat.color} font-data`}>{salesLoading ? '...' : stat.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── TAB: Purchase History ── */}
                        {activeTab === 'history' && (
                            <div className="bg-bg-surface rounded-[32px] border border-border-muted shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-bg-subtle/50 border-b border-border-muted">
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest">Invoice</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest">Date</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest">Items</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest">Payment</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest text-right">Total</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest w-28 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-muted">
                                            {salesLoading ? (
                                                [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded w-full" /></td></tr>)
                                            ) : customerSales.length > 0 ? (
                                                customerSales.map(invoice => (
                                                    <Fragment key={invoice.invoice_number}>
                                                        <tr onClick={() => toggleExpand(invoice.invoice_number)} className="group hover:bg-bg-subtle transition-all cursor-pointer">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-9 h-9 bg-bg-base/50 rounded-lg flex items-center justify-center text-text-muted group-hover:bg-brand-red group-hover:text-white transition-all"><Receipt size={16} /></div>
                                                                    <div>
                                                                        <p className="text-xs font-black text-text-primary uppercase font-data">{invoice.invoice_number}</p>
                                                                        <div className="flex gap-1 mt-0.5">
                                                                            {invoice.is_os && <span className="px-1.5 py-0.5 bg-brand-red text-white text-[7px] font-black rounded uppercase">OS</span>}
                                                                            {invoice.discount > 0 && <span className="px-1.5 py-0.5 bg-brand-orange text-white text-[7px] font-black rounded uppercase">DISC</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-[11px] font-bold text-text-primary">{format(new Date(invoice.date), 'MMM d, yyyy')}</p>
                                                                <p className="text-[9px] font-bold text-text-muted">{format(new Date(invoice.date), 'p')}</p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full w-fit ${invoice.fulfillment_status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                                                                    invoice.fulfillment_status === 'out' ? 'bg-amber-500/10 text-amber-500' : 'bg-bg-base text-text-muted opacity-50'
                                                                    }`}>
                                                                    {getStatusIcon(invoice.fulfillment_status)}
                                                                    <span className="text-[8px] font-black uppercase tracking-tight">{getStatusText(invoice.fulfillment_status)}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2 px-2.5 py-1 bg-bg-base/50 rounded-full w-fit border border-border-muted">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-red" />
                                                                    <span className="text-[9px] font-black text-text-primary uppercase tracking-wider">{invoice.payment_mode}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-data font-black text-text-primary text-sm">₱{invoice.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleRepeatOrder(invoice); }}
                                                                        className="p-2 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 hover:text-brand-red hover:bg-brand-red/10 transition-all"
                                                                        title="Repeat Order"
                                                                    >
                                                                        <RotateCcw size={14} />
                                                                    </button>
                                                                    <div className={`p-2 rounded-lg transition-all ${expandedInvoices.has(invoice.invoice_number) ? 'bg-brand-red text-white rotate-180' : 'bg-bg-base/50 text-text-muted opacity-50'}`}>
                                                                        <ChevronDown size={14} />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {expandedInvoices.has(invoice.invoice_number) && (
                                                            <tr>
                                                                <td colSpan={6} className="px-6 py-4 bg-bg-base/50">
                                                                    <div className="p-5 border-l-4 border-brand-red bg-bg-surface shadow-sm rounded-2xl space-y-4">
                                                                        <div className="flex items-center justify-between border-b border-border-muted pb-3">
                                                                            <h4 className="text-[10px] font-black uppercase text-text-primary tracking-widest flex items-center gap-2"><PackageSearch size={14} /> Invoice Items</h4>
                                                                            <button
                                                                                onClick={() => handleRepeatOrder(invoice)}
                                                                                className="text-[10px] font-black bg-text-primary text-bg-base hover:opacity-90 px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                                                                            >
                                                                                <RotateCcw size={12} /> REPEAT ORDER
                                                                            </button>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {invoice.items.map(item => (
                                                                                <div key={item.id} className="flex justify-between items-start gap-4 text-xs p-2 rounded-lg hover:bg-bg-subtle">
                                                                                    <div className="flex-1">
                                                                                        <p className="font-bold text-text-primary">{item.products?.name}</p>
                                                                                        <p className="text-[9px] text-text-muted uppercase font-data">{item.products?.brand || 'No Brand'}</p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="font-bold text-text-primary">x{item.quantity}</p>
                                                                                        <p className="text-[9px] text-text-muted font-data">UNIT: ₱{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                                                        <p className="text-[10px] text-text-secondary font-data font-black">TOTAL: ₱{Number(item.total_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <div className="pt-3 border-t border-border-muted flex justify-between items-center text-sm font-black text-text-primary">
                                                                            <span className="uppercase tracking-widest text-[10px]">Grand Total</span>
                                                                            <span className="text-xl font-data">₱{invoice.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                ))
                                            ) : (
                                                <tr><td colSpan={6} className="py-16 text-center text-text-muted opacity-50">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <PackageSearch size={32} className="text-text-muted opacity-20" />
                                                        <p className="text-sm font-black uppercase tracking-tight">No purchase history</p>
                                                        <p className="text-xs font-medium text-text-muted">This customer hasn't made any purchases yet.</p>
                                                    </div>
                                                </td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── TAB: Ledger ── */}
                        {activeTab === 'ledger' && (
                            <div className="space-y-6">
                                {/* Balance Summary */}
                                <div className="bg-bg-surface rounded-[28px] border border-border-muted shadow-sm p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em]">Account Ledger</h3>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Outstanding</p>
                                                <p className={`text-xl font-black font-data ${selectedCustomer.current_balance > 0 ? 'text-brand-red' : 'text-emerald-500'}`}>
                                                    ₱{selectedCustomer.current_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Transaction List = Sales as charges */}
                                <div className="bg-bg-surface rounded-[28px] border border-border-muted shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 bg-bg-subtle/50 border-b border-border-muted">
                                        <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Transaction History (Invoices)</span>
                                    </div>
                                    <div className="divide-y divide-border-muted max-h-[500px] overflow-y-auto custom-scrollbar">
                                        {salesLoading ? (
                                            <div className="p-8 text-center"><Loader2 className="animate-spin text-brand-red mx-auto" size={24} /></div>
                                        ) : customerSales.length > 0 ? (
                                            customerSales.map(invoice => (
                                                <div key={invoice.invoice_number} className="px-6 py-4 flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${invoice.is_os ? 'bg-brand-red/10 text-brand-red' : 'bg-slate-100 text-slate-400'}`}>
                                                        <Receipt size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-black text-brand-charcoal uppercase font-data">{invoice.invoice_number}</p>
                                                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">{invoice.payment_mode}</span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{format(new Date(invoice.date), 'MMM d, yyyy · p')} · {invoice.items.length} item{invoice.items.length > 1 ? 's' : ''}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-brand-charcoal font-data">₱{invoice.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                        <p className="text-[9px] font-black text-slate-300 uppercase">Charge</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-12 text-center">
                                                <CreditCard size={32} className="text-slate-200 mx-auto mb-3" />
                                                <p className="text-sm font-black text-brand-charcoal uppercase tracking-tight">No transactions</p>
                                                <p className="text-xs font-medium text-slate-400 mt-1">No invoices found for this customer.</p>
                                            </div>
                                        )}
                                    </div>
                                    {customerSales.length > 0 && (
                                        <div className="px-6 py-4 bg-bg-subtle border-t border-border-muted flex justify-between items-center">
                                            <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Total Lifetime Value</span>
                                            <span className="text-lg font-black text-text-primary font-data">₱{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* No customer selected - prompt */
                    !selectedCustomer && filteredCustomers.length > 0 && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center p-12">
                                <div className="w-24 h-24 bg-bg-surface rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl border border-border-muted">
                                    <ArrowRight className="text-text-muted opacity-20 animate-pulse" size={40} />
                                </div>
                                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Select a Customer</h3>
                                <p className="text-text-muted max-w-xs mt-2 text-sm font-medium mx-auto">Click a customer from the list to view their profile, purchase history, and account ledger.</p>
                            </div>
                        </div>
                    )
                )}
            </div>

            {/* ── Modals ── */}
            <CustomerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                customer={editingCustomer}
            />
            <SalesModal
                isOpen={isSalesModalOpen}
                onClose={() => { setIsSalesModalOpen(false); setRepeatOrderData(null); }}
                onSuccess={() => {
                    setIsSalesModalOpen(false);
                    setRepeatOrderData(null);
                    if (selectedCustomer) fetchCustomerSales(selectedCustomer);
                }}
                editData={repeatOrderData || undefined}
            />
        </div>
    );
}
