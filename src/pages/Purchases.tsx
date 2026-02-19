import { useEffect, useState, useCallback, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import {
    Search, ChevronDown, ShoppingBag, Package, Download, Filter, CheckCircle2, Clock, Trash2
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import PurchaseModal from '../components/PurchaseModal';
import Calendar from '../components/Calendar';
import { useAuth } from '../lib/AuthContext';

interface Purchase {
    id: string;
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
    products: {
        sku: string;
        name: string;
    };
}

interface SupabasePurchase {
    id: string;
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
    products: {
        sku: string;
        name: string;
    };
}

interface GroupedPurchase {
    invoice_number: string;
    date: string;
    supplier: string;
    status: 'pending' | 'received';
    items: Purchase[];
    total_base: number;
    total_vat: number;
    total_discount: number;
    grand_total: number;
}

export default function Purchases() {
    const { role } = useAuth();
    const [groupedPurchases, setGroupedPurchases] = useState<GroupedPurchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editData, setEditData] = useState<unknown>(null);
    const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const fetchPurchases = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        const { data, error } = await supabase
            .from('purchases')
            .select(`*, products(sku, name)`)
            .order('date', { ascending: false });

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
                        status: 'received', // Will be demoted to pending if any item is pending
                        items: [],
                        total_base: 0,
                        total_vat: 0,
                        total_discount: 0,
                        grand_total: 0
                    };
                }
                const group = groups[key];
                group.items.push(purchase);
                group.total_base += purchase.total_price;
                group.total_vat += purchase.vat_amount || 0;
                group.total_discount += purchase.discount_amount || 0;
                if (purchase.status === 'pending') group.status = 'pending';
            });

            Object.values(groups).forEach(group => {
                group.grand_total = group.total_base - group.total_discount;
            });

            setGroupedPurchases(Object.values(groups).sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            ));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        let mounted = true;
        const load = async () => { if (mounted) await fetchPurchases(); };
        load();
        const channel = supabase.channel('purchases_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => { if (mounted) fetchPurchases(true); }).subscribe();
        return () => { mounted = false; supabase.removeChannel(channel); };
    }, [fetchPurchases]);

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
                .update({ status: 'received', received_date: new Date().toISOString() })
                .eq('invoice_number', group.invoice_number);

            if (updateError) throw updateError;

            // Trigger stock update for each item
            for (const item of group.items) {
                if (item.status === 'pending') {
                    const { data: p } = await supabase.from('products').select('stock_available').eq('id', item.product_id).single();
                    if (p) {
                        await supabase.from('products').update({ stock_available: p.stock_available + item.quantity }).eq('id', item.product_id);
                    }
                }
            }
            fetchPurchases(true);
        } catch (err) {
            console.error('Error marking as received:', err);
        }
    };

    const filteredPurchases = groupedPurchases.filter(group => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (group.invoice_number?.toLowerCase().includes(search) ?? false) ||
            (group.supplier?.toLowerCase().includes(search) ?? false) ||
            group.items.some(item =>
                (item.products?.name?.toLowerCase().includes(search) ?? false) ||
                (item.products?.sku?.toLowerCase().includes(search) ?? false)
            )
        );
        return matchesSearch && isSameDay(new Date(group.date), selectedDate);
    });

    const activeDates = Array.from(new Set(groupedPurchases.map(s => format(new Date(s.date), 'yyyy-MM-dd'))));

    const handleEditPurchase = (group: GroupedPurchase) => {
        setEditData({
            invoiceNumber: group.invoice_number,
            supplier: group.supplier,
            items: group.items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                sku: item.products.sku,
                name: item.products.name
            })),
            isVatEnabled: group.total_vat > 0,
            isDiscountEnabled: group.total_discount > 0,
            status: group.status
        });
        setIsModalOpen(true);
    };

    const handleDeleteInvoice = async (invoiceNumber: string, items: Purchase[], status: string) => {
        if (!window.confirm(`Are you sure you want to delete purchase ${invoiceNumber}? This will reverse inventory changes.`)) return;

        setLoading(true);
        try {
            // 1. Delete purchase records
            const { error: deleteError } = await supabase
                .from('purchases')
                .delete()
                .eq('invoice_number', invoiceNumber);

            if (deleteError) throw deleteError;

            // 2. Adjust stock if it was already received
            if (status === 'received') {
                for (const item of items) {
                    const { data: p } = await supabase
                        .from('products')
                        .select('stock_available')
                        .eq('id', item.product_id)
                        .single();

                    if (p) {
                        await supabase
                            .from('products')
                            .update({ stock_available: (p.stock_available || 0) - item.quantity })
                            .eq('id', item.product_id);
                    }
                }
            }

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
                    <h1 className="text-3xl font-black text-brand-charcoal tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-indigo-200 shadow-lg"><ShoppingBag className="text-white" size={24} /></div>
                        Purchase Orders
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage stock inwards and supplier invoices</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"><Download size={18} /> Export</button>
                    <button onClick={() => { setEditData(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-indigo active:scale-95"><ShoppingBag size={18} /> NEW PURCHASE</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative group flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} /><input type="text" placeholder="Search invoices or suppliers..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:border-indigo-500 outline-none transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                <button className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"><Filter size={18} /> Filters</button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-shrink-0">
                    <div className="sticky top-6 space-y-4">
                        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} activeDates={activeDates} />
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 border-b border-slate-50 pb-3 mb-4 uppercase tracking-[0.2em]">Summary</h3>
                            <div className="space-y-4">
                                <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Cost</p><p className="text-xl font-black text-brand-charcoal font-data">₱{filteredPurchases.reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                                <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Orders</p><p className="text-xl font-black text-brand-charcoal font-data">{filteredPurchases.length}</p></div>
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
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Invoice / Supplier</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Total Amount</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={4} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded w-full"></div></td></tr>)
                                    ) : filteredPurchases.length > 0 ? (
                                        filteredPurchases.map((group) => (
                                            <Fragment key={group.invoice_number || group.date}>
                                                <tr onClick={() => toggleExpand(group.invoice_number)} className="group hover:bg-slate-50 transition-all cursor-pointer">
                                                    <td className="px-6 py-5"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${group.status === 'received' ? 'bg-emerald-50 text-emerald-500' : 'bg-orange-50 text-orange-500'}`}>{group.status === 'received' ? <CheckCircle2 size={18} /> : <Clock size={18} />}</div><div><p className="text-sm font-black text-brand-charcoal uppercase font-data">{group.invoice_number || 'N/A'}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{group.supplier}</p></div></div></td>
                                                    <td className="px-6 py-5"><span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest border ${group.status === 'received' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{group.status}</span></td>
                                                    <td className="px-6 py-5 text-right font-data font-black text-brand-charcoal">₱{group.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                                                        {role === 'admin' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(group.invoice_number, group.items, group.status); }}
                                                                className="p-2 text-slate-200 hover:text-brand-red hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                        <div className={`p-2 rounded-lg transition-all ${expandedInvoices.has(group.invoice_number) ? 'bg-indigo-500 text-white rotate-180' : 'bg-slate-50 text-slate-300'}`}><ChevronDown size={16} /></div>
                                                    </td>
                                                </tr>
                                                {expandedInvoices.has(group.invoice_number) && (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-4 bg-slate-50/50">
                                                            <div className="p-6 border-l-4 border-indigo-500 bg-white shadow-inner rounded-2xl space-y-4">
                                                                <div className="flex items-center justify-between border-b pb-2">
                                                                    <h4 className="text-[10px] font-black uppercase text-brand-charcoal tracking-widest flex items-center gap-2"><Package size={14} /> Items</h4>
                                                                    <div className="flex gap-2">
                                                                        {group.status === 'pending' && <button onClick={(e) => { e.stopPropagation(); handleMarkAsReceived(group); }} className="text-[9px] font-black bg-emerald-500 text-white px-3 py-1 rounded uppercase tracking-tighter">MARK AS RECEIVED</button>}
                                                                        <button onClick={(e) => { e.stopPropagation(); handleEditPurchase(group); }} className="text-[9px] font-black bg-brand-charcoal text-white px-3 py-1 rounded uppercase tracking-tighter">EDIT</button>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">{group.items.map((item, idx) => (<div key={idx} className="flex justify-between text-xs"><span>{item.products?.name} (x{item.quantity})</span><span className="font-data">₱{item.total_price.toLocaleString()}</span></div>))}</div>
                                                                <div className="pt-2 border-t flex flex-col items-end gap-1">{group.total_discount > 0 && <span className="text-[10px] text-brand-orange">Discount: -₱{group.total_discount.toLocaleString()}</span>}<span className="text-sm font-black text-indigo-600 font-data">Total: ₱{group.grand_total.toLocaleString()}</span></div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        ))
                                    ) : (
                                        <tr><td colSpan={4} className="py-20 text-center text-slate-400">No purchases found for this date.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <PurchaseModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditData(null); }} onSuccess={() => { fetchPurchases(); setEditData(null); }} editData={editData as any} />
        </div>
    );
}
