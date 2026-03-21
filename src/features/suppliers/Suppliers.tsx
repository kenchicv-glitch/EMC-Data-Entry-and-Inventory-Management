import { useState, useCallback, Fragment } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { useSuppliers } from './hooks/useSuppliers';
import { useAuth } from '../../shared/hooks/useAuth';
import {
    Truck, Plus, Search, Edit, Trash2, Mail, Phone, MapPin,
    CreditCard, Loader2, PackageSearch,
    AlertCircle, CheckCircle2, Receipt, ChevronDown, ShoppingBag,
    Clock, Calendar, TrendingUp,
    ArrowRight, User
} from 'lucide-react';
import { useBranch } from '../../shared/hooks/useBranch';
import SupplierModal from './components/SupplierModal';
import type { Supplier, SupplierInsert } from '../../shared/types';
import { format } from 'date-fns';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
interface PurchaseRecord {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    date: string;
    invoice_number: string;
    status: 'pending' | 'received' | 'cancelled';
    payment_status: 'paid' | 'unpaid' | 'partial';
    products: { name: string; brand?: string };
}

interface GroupedPurchase {
    invoice_number: string;
    date: string;
    status: 'pending' | 'received' | 'cancelled';
    payment_status: 'paid' | 'unpaid' | 'partial';
    items: PurchaseRecord[];
    total: number;
}

type Tab = 'overview' | 'history' | 'ledger';

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────
export default function Suppliers() {
    const { role } = useAuth();
    const { activeBranchId } = useBranch();
    const { suppliers, isLoading, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    // Purchase history state
    const [supplierPurchases, setSupplierPurchases] = useState<GroupedPurchase[]>([]);
    const [purchasesLoading, setPurchasesLoading] = useState(false);
    const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

    // ── Filtering ──
    const filteredSuppliers = suppliers.filter(s => {
        const search = searchTerm.toLowerCase();
        return s.name.toLowerCase().includes(search) || s.contact_person?.toLowerCase().includes(search) || s.email?.toLowerCase().includes(search);
    });

    // ── Fetch supplier purchase history ──
    const fetchSupplierPurchases = useCallback(async (supplier: Supplier) => {
        setPurchasesLoading(true);
        setSupplierPurchases([]);
        try {
            let query = supabase
                .from('purchases')
                .select('*, products(name, brand)')
                .eq('supplier_id', supplier.id)
                .order('date', { ascending: false });

            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Group by invoice
            const groups: Record<string, GroupedPurchase> = {};
            (data || []).forEach((purchase: PurchaseRecord) => {
                const key = purchase.invoice_number || `REF-${purchase.id.slice(0, 8)}`;
                if (!groups[key]) {
                    groups[key] = {
                        invoice_number: key,
                        date: purchase.date,
                        status: purchase.status,
                        payment_status: purchase.payment_status,
                        items: [],
                        total: 0
                    };
                }
                groups[key].items.push(purchase);
                groups[key].total += Number(purchase.total_price);
            });

            setSupplierPurchases(Object.values(groups).sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            ));
        } catch (err) {
            console.error('Error fetching supplier purchases:', err);
        } finally {
            setPurchasesLoading(false);
        }
    }, [activeBranchId]);

    // ── Select supplier ──
    const handleSelectSupplier = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setActiveTab('overview');
        setExpandedInvoices(new Set());
        fetchSupplierPurchases(supplier);
    };

    // ── CRUD ──
    const handleAdd = () => { setEditingSupplier(null); setIsModalOpen(true); };
    const handleEdit = (supplier: Supplier) => { setEditingSupplier(supplier); setIsModalOpen(true); };
    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this supplier?')) {
            await deleteSupplier(id);
            if (selectedSupplier?.id === id) setSelectedSupplier(null);
        }
    };
    const handleSubmit = async (data: SupplierInsert) => {
        if (editingSupplier) {
            await updateSupplier({ id: editingSupplier.id, updates: data });
        } else {
            await createSupplier(data);
        }
        setIsModalOpen(false);
    };

    // ── Toggle invoice expand ──
    const toggleExpand = (inv: string) => {
        setExpandedInvoices(prev => {
            const next = new Set(prev);
            if (next.has(inv)) next.delete(inv); else next.add(inv);
            return next;
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'received': return <CheckCircle2 className="text-emerald-500" size={12} />;
            case 'pending': return <Clock className="text-amber-500" size={12} />;
            case 'cancelled': return <AlertCircle className="text-red-500" size={12} />;
            default: return <Clock className="text-slate-400" size={12} />;
        }
    };

    // ── Stats ──
    const totalOrders = supplierPurchases.length;
    const totalSpent = supplierPurchases.reduce((s, i) => s + i.total, 0);
    const avgOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const lastPurchase = supplierPurchases.length > 0 ? supplierPurchases[0].date : null;

    // ── Loading screen ──
    if (isLoading && suppliers.length === 0) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={40} className="text-brand-red animate-spin" />
                    <p className="text-sm text-text-muted font-black uppercase tracking-widest">Loading Supplier Database...</p>
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
                        <Truck className="text-brand-red group-hover:rotate-12 transition-transform" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tight uppercase">Suppliers</h1>
                        <p className="text-sm text-text-secondary mt-1 font-medium">Vendor relations, procurement & ledger</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search suppliers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-bg-surface border border-border-default rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-text-primary focus:ring-4 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-all w-full md:w-72 shadow-sm placeholder:text-text-muted"
                        />
                    </div>
                    {role === 'owner' && (
                        <button onClick={handleAdd} className="flex items-center gap-2 bg-text-primary text-bg-base px-6 py-3.5 rounded-2xl font-black text-xs hover:opacity-90 transition-all shadow-lg active:scale-95 flex-shrink-0">
                            <Plus size={18} /> ADD SUPPLIER
                        </button>
                    )}
                </div>
            </div>

            {/* ── Master-Detail Layout ── */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* ── Left Panel: Supplier List ── */}
                <div className={`${selectedSupplier ? 'lg:w-[420px]' : 'w-full'} flex-shrink-0 transition-all`}>
                    <div className="bg-bg-surface rounded-[32px] border border-border-muted shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-bg-subtle/50 border-b border-border-muted flex items-center justify-between">
                            <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">{filteredSuppliers.length} Suppliers</span>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Active Partnerships</span>
                        </div>
                        <div className="divide-y divide-border-muted max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                            {filteredSuppliers.length === 0 ? (
                                <div className="p-12 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-bg-base rounded-[20px] flex items-center justify-center mb-4">
                                        <PackageSearch className="text-text-muted opacity-50" size={32} />
                                    </div>
                                    <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">No Suppliers Found</h3>
                                    <p className="text-text-muted max-w-xs mt-1 text-xs font-medium">Adjust your search or add a new vendor.</p>
                                </div>
                            ) : (
                                filteredSuppliers.map(supplier => (
                                    <button
                                        key={supplier.id}
                                        onClick={() => handleSelectSupplier(supplier)}
                                        className={`w-full text-left px-6 py-4 hover:bg-bg-subtle transition-all flex items-center gap-4 group ${selectedSupplier?.id === supplier.id ? 'bg-brand-red/10 border-l-4 border-brand-red' : 'border-l-4 border-transparent'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm transition-all ${selectedSupplier?.id === supplier.id ? 'bg-brand-red text-white' : 'bg-brand-red/10 text-brand-red'}`}>
                                            {supplier.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-text-primary uppercase tracking-tight truncate">{supplier.name}</p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] font-bold text-text-muted font-data">{supplier.phone || 'No phone'}</span>
                                                {supplier.supplier_tin && (
                                                    <span className="text-[8px] font-bold text-text-muted/50 font-data">TIN: {supplier.supplier_tin}</span>
                                                )}
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${supplier.supplier_vat_registered ? 'bg-emerald-500/10 text-emerald-500' : 'bg-bg-base text-text-muted opacity-50'}`}>
                                                    {supplier.supplier_vat_registered ? 'VAT' : 'NON-VAT'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-text-muted opacity-50 font-data">Since {format(new Date(supplier.created_at), 'yyyy')}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Right Panel: Detail ── */}
                {selectedSupplier ? (
                    <div className="flex-1 min-w-0 space-y-6">
                        {/* Supplier Header Card */}
                        <div className="bg-bg-surface rounded-[32px] border border-border-muted shadow-sm p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-brand-red/5 rounded-full -mr-20 -mt-20" />
                            <div className="flex items-start justify-between relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl bg-brand-red flex items-center justify-center text-white text-2xl font-black shadow-lg">
                                        {selectedSupplier.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight">{selectedSupplier.name}</h2>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${selectedSupplier.supplier_vat_registered ? 'bg-emerald-500/10 text-emerald-500' : 'bg-bg-base text-text-muted opacity-50'}`}>
                                                {selectedSupplier.supplier_vat_registered ? 'VAT Registered' : 'Non-VAT Vendor'}
                                            </span>
                                            {selectedSupplier.supplier_tin && (
                                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-brand-red font-data">TIN: {selectedSupplier.supplier_tin}</span>
                                            )}
                                            <span className="text-[10px] font-bold text-text-muted opacity-50 font-data">Onboarded {format(new Date(selectedSupplier.created_at), 'MMM d, yyyy')}</span>
                                        </div>
                                    </div>
                                </div>
                                {role === 'owner' && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleEdit(selectedSupplier)} className="p-3 rounded-2xl hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-all">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(selectedSupplier.id)} className="p-3 rounded-2xl hover:bg-brand-red/10 text-text-muted hover:text-brand-red transition-all">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2">
                            {([
                                { id: 'overview', label: 'Overview', icon: User },
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
                                    <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] border-b border-border-muted pb-3">Contact Information</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-bg-base/50 flex items-center justify-center"><User size={14} className="text-text-muted" /></div>
                                            <div>
                                                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Main Point of Contact</p>
                                                <p className="text-sm font-black text-text-primary uppercase">{selectedSupplier.contact_person || 'Not Assigned'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-bg-base/50 flex items-center justify-center"><Phone size={14} className="text-text-muted" /></div>
                                            <span className="text-sm font-bold text-text-primary font-data">{selectedSupplier.phone || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-bg-base/50 flex items-center justify-center"><Mail size={14} className="text-text-muted" /></div>
                                            <span className="text-sm font-bold text-text-primary truncate">{selectedSupplier.email || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-bg-base/50 flex items-center justify-center flex-shrink-0"><MapPin size={14} className="text-text-muted" /></div>
                                            <span className="text-sm font-medium text-text-secondary leading-relaxed">{selectedSupplier.address || 'No address registered'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Procurement Summary Card */}
                                <div className="bg-bg-surface rounded-[28px] border border-border-muted shadow-sm p-6 space-y-5">
                                    <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] border-b border-border-muted pb-3 flex items-center gap-2"><Truck size={12} /> Procurement Summary</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-bg-base/50 rounded-2xl border border-border-muted">
                                            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Total Procurement</p>
                                            <p className="text-lg font-black text-text-primary font-data">₱{totalSpent.toLocaleString()}</p>
                                        </div>
                                        <div className="p-4 bg-bg-base/50 rounded-2xl border border-border-muted">
                                            <p className="text-[8px] font-black text-brand-orange uppercase tracking-widest mb-1">Active Orders</p>
                                            <p className="text-lg font-black text-brand-orange font-data">{supplierPurchases.filter(p => p.status === 'pending').length}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-brand-red/5 rounded-2xl border border-brand-red/10">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-[8px] font-black text-brand-red uppercase tracking-widest mb-1">Average P.O. Value</p>
                                                <p className="text-lg font-black text-text-primary font-data">₱{avgOrder.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                            </div>
                                            <TrendingUp size={24} className="text-brand-red/20" />
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Bar */}
                                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Total Invoices', value: totalOrders.toString(), icon: Receipt, color: 'text-brand-red' },
                                        { label: 'Success Rate', value: '100%', icon: CheckCircle2, color: 'text-emerald-500' },
                                        { label: 'Primary Brand', value: selectedSupplier.contact_person?.split(' ')[0] || 'Generic', icon: ShoppingBag, color: 'text-brand-orange' },
                                        { label: 'Last Restock', value: lastPurchase ? format(new Date(lastPurchase), 'MMM d, yyyy') : 'Never', icon: Calendar, color: 'text-blue-500' }
                                    ].map((stat, idx) => (
                                        <div key={idx} className="bg-bg-surface rounded-[24px] border border-border-muted shadow-sm p-5 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-bg-base rounded-full -mr-8 -mt-8 opacity-50" />
                                            <stat.icon size={16} className={`${stat.color} mb-3`} />
                                            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">{stat.label}</p>
                                            <p className={`text-sm font-black ${stat.color} font-data`}>{purchasesLoading ? '...' : stat.value}</p>
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
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest">P.O. Number</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest">Date</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest">Payment</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest text-right">Amount</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-text-primary uppercase tracking-widest w-20 text-center">Detail</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-muted">
                                            {purchasesLoading ? (
                                                [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded w-full" /></td></tr>)
                                            ) : supplierPurchases.length > 0 ? (
                                                supplierPurchases.map(invoice => (
                                                    <Fragment key={invoice.invoice_number}>
                                                        <tr onClick={() => toggleExpand(invoice.invoice_number)} className="group hover:bg-bg-subtle transition-all cursor-pointer">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-9 h-9 bg-bg-base/50 rounded-lg flex items-center justify-center text-text-muted group-hover:bg-brand-red group-hover:text-white transition-all"><Receipt size={16} /></div>
                                                                    <p className="text-xs font-black text-text-primary uppercase font-data">{invoice.invoice_number}</p>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-[11px] font-bold text-text-primary">{format(new Date(invoice.date), 'MMM d, yyyy')}</p>
                                                                <p className="text-[9px] font-bold text-text-muted font-data">{format(new Date(invoice.date), 'p')}</p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full w-fit ${invoice.status === 'received' ? 'bg-emerald-500/10 text-emerald-500' :
                                                                    invoice.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                                                                    }`}>
                                                                    {getStatusIcon(invoice.status)}
                                                                    <span className="text-[8px] font-black uppercase tracking-tight">{invoice.status}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full w-fit border ${invoice.payment_status === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${invoice.payment_status === 'paid' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                                    <span className="text-[9px] font-black uppercase tracking-wider">{invoice.payment_status}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-data font-black text-text-primary text-sm">₱{invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center justify-center">
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
                                                                            <h4 className="text-[10px] font-black uppercase text-text-primary tracking-widest flex items-center gap-2"><PackageSearch size={14} /> Received Items</h4>
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
                                                                                        <p className="text-[9px] text-text-muted font-data">COST: ₱{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                                                        <p className="text-[10px] text-text-secondary font-data font-black">TOTAL: ₱{Number(item.total_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <div className="pt-3 border-t border-border-muted flex justify-between items-center text-sm font-black text-text-primary">
                                                                            <span className="uppercase tracking-widest text-[10px]">Invoice Total</span>
                                                                            <span className="text-xl font-data">₱{invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                                                        <p className="text-sm font-black uppercase tracking-tight">No purchase orders</p>
                                                        <p className="text-xs font-medium text-text-muted">No procurement records found for this vendor.</p>
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
                                <div className="bg-bg-surface rounded-[28px] border border-border-muted shadow-sm p-6 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] mb-1">Accounts Payable</h3>
                                        <p className="text-2xl font-black text-text-primary font-data">Reference Ledger</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Vendor Lifetime Value</p>
                                        <p className="text-2xl font-black text-emerald-500 font-data">₱{totalSpent.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="bg-bg-surface rounded-[28px] border border-border-muted shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 bg-bg-subtle/50 border-b border-border-muted">
                                        <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Financial History</span>
                                    </div>
                                    <div className="divide-y divide-border-muted max-h-[500px] overflow-y-auto custom-scrollbar">
                                        {purchasesLoading ? (
                                            <div className="p-8 text-center"><Loader2 className="animate-spin text-brand-red mx-auto" size={24} /></div>
                                        ) : supplierPurchases.length > 0 ? (
                                            supplierPurchases.map(invoice => (
                                                <div key={invoice.invoice_number} className="px-6 py-4 flex items-center gap-4 hover:bg-bg-subtle transition-all">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${invoice.status === 'received' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-bg-base text-text-muted opacity-50'}`}>
                                                        <Receipt size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-black text-text-primary uppercase font-data">{invoice.invoice_number}</p>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${invoice.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{invoice.payment_status}</span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-text-muted mt-0.5">{format(new Date(invoice.date), 'MMM d, yyyy')} · {invoice.items.length} Product{invoice.items.length > 1 ? 's' : ''}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-text-primary font-data">₱{invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                        <p className="text-[9px] font-black text-text-muted opacity-50 uppercase">Procured</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-12 text-center">
                                                <CreditCard size={32} className="text-text-muted opacity-20 mx-auto mb-3" />
                                                <p className="text-sm font-black text-text-primary uppercase tracking-tight">No transactions</p>
                                                <p className="text-xs font-medium text-text-muted mt-1">No invoices found for this supplier.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* No supplier selected - prompt */
                    !selectedSupplier && filteredSuppliers.length > 0 && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center p-12">
                                <div className="w-24 h-24 bg-bg-surface rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl border border-border-muted">
                                    <ArrowRight className="text-text-muted opacity-20 animate-pulse" size={40} />
                                </div>
                                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Select a Supplier</h3>
                                <p className="text-text-muted max-w-xs mt-2 text-sm font-medium mx-auto">Click a vendor from the list to view their profile, procurement history, and ledger accounts.</p>
                            </div>
                        </div>
                    )
                )}
            </div>

            {/* ── Modals ── */}
            <SupplierModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                supplier={editingSupplier}
            />
        </div>
    );
}
