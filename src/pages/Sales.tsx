import { useEffect, useState, useCallback, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import {
    Search, ChevronDown, Receipt, Package, ShoppingBag, Download, Filter, Trash2
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import SalesModal from '../components/SalesModal';
import Calendar from '../components/Calendar';
import { useAuth } from '../lib/AuthContext';

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
    full_name: string;
    products: {
        sku: string;
        name: string;
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
    products: {
        sku: string;
        name: string;
    };
}

interface GroupedSale {
    invoice_number: string;
    date: string;
    full_name: string;
    items: Sale[];
    total_base: number;
    total_vat: number;
    total_discount: number;
    grand_total: number;
}

export default function Sales() {
    const { role } = useAuth();
    const [groupedSales, setGroupedSales] = useState<GroupedSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editData, setEditData] = useState<unknown>(null);
    const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const fetchSales = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        const { data, error } = await supabase
            .from('sales')
            .select(`*, products(sku, name)`)
            .order('date', { ascending: false });

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
                        items: [],
                        total_base: 0,
                        total_vat: 0,
                        total_discount: 0,
                        grand_total: 0
                    };
                }
                const group = groups[key];
                const s = { ...sale, full_name: 'Staff' } as Sale;
                group.items.push(s);
                group.total_base += s.total_price;
                group.total_vat += s.vat_amount || 0;
                group.total_discount += s.discount_amount || 0;
            });

            Object.values(groups).forEach(group => {
                group.grand_total = group.total_base - group.total_discount;
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
            group.items.some(item =>
                (item.products?.name?.toLowerCase().includes(search) ?? false) ||
                (item.products?.sku?.toLowerCase().includes(search) ?? false)
            )
        );
        return matchesSearch && isSameDay(new Date(group.date), selectedDate);
    });

    const activeDates = Array.from(new Set(groupedSales.map(s => format(new Date(s.date), 'yyyy-MM-dd'))));

    const handleSuccess = () => { setEditData(null); fetchSales(); };

    const handleEditInvoice = (group: GroupedSale) => {
        setEditData({
            invoiceNumber: group.invoice_number,
            items: group.items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                sku: item.products.sku,
                name: item.products.name
            })),
            isVatEnabled: group.total_vat > 0,
            isDiscountEnabled: group.total_discount > 0
        });
        setIsModalOpen(true);
    };

    const handleDeleteInvoice = async (invoiceNumber: string, items: Sale[]) => {
        if (!window.confirm(`Are you sure you want to delete invoice ${invoiceNumber}? This will restore stock to inventory.`)) return;

        setLoading(true);
        try {
            // 1. Delete sales records
            const { error: deleteError } = await supabase
                .from('sales')
                .delete()
                .eq('invoice_number', invoiceNumber);

            if (deleteError) throw deleteError;

            // 2. Restore stock for each item
            for (const item of items) {
                const { data: p } = await supabase
                    .from('products')
                    .select('stock_available')
                    .eq('id', item.product_id)
                    .single();

                if (p) {
                    await supabase
                        .from('products')
                        .update({ stock_available: (p.stock_available || 0) + item.quantity })
                        .eq('id', item.product_id);
                }
            }

            fetchSales();
        } catch (err) {
            console.error('Error deleting sale:', err);
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
                        <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center shadow-red"><Receipt className="text-white" size={24} /></div>
                        Sales History
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage and track your customer invoices</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"><Download size={18} /> Export</button>
                    <button onClick={() => { setEditData(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red active:scale-95"><ShoppingBag size={18} /> NEW ORDER</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative group flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} /><input type="text" placeholder="Search..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                <button className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"><Filter size={18} /> Filters</button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-shrink-0">
                    <div className="sticky top-6 space-y-4">
                        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} activeDates={activeDates} />
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 border-b border-slate-50 pb-3 mb-4 uppercase tracking-[0.2em]">Daily Stats</h3>
                            <div className="space-y-4">
                                <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales</p><p className="text-xl font-black text-brand-charcoal font-data">₱{filteredSales.reduce((sum, g) => sum + g.grand_total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                                <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoices</p><p className="text-xl font-black text-brand-charcoal font-data">{filteredSales.length}</p></div>
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
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Invoice</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Operator</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Total Amount</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={4} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded w-full"></div></td></tr>)
                                    ) : filteredSales.length > 0 ? (
                                        filteredSales.map((sale) => (
                                            <Fragment key={sale.invoice_number}>
                                                <tr onClick={() => toggleExpand(sale.invoice_number)} className="group hover:bg-slate-50 transition-all cursor-pointer">
                                                    <td className="px-6 py-5"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-red group-hover:text-white transition-all"><Receipt size={18} /></div><div><p className="text-sm font-black text-brand-charcoal uppercase font-data">{sale.invoice_number}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{format(new Date(sale.date), 'MMMM d, yyyy')}</p></div></div></td>
                                                    <td className="px-6 py-5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{sale.full_name}</span></td>
                                                    <td className="px-6 py-5 text-right font-data font-black text-brand-charcoal">₱{sale.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                                                        {role === 'admin' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(sale.invoice_number, sale.items); }}
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
                                                        <td colSpan={4} className="px-6 py-4 bg-slate-50/50">
                                                            <div className="p-6 border-l-4 border-brand-red bg-white shadow-inner rounded-2xl space-y-4">
                                                                <div className="flex items-center justify-between border-b pb-2"><h4 className="text-[10px] font-black uppercase text-brand-charcoal tracking-widest flex items-center gap-2"><Package size={14} /> Breakdown</h4><button onClick={() => handleEditInvoice(sale)} className="text-[10px] font-black bg-brand-charcoal text-white px-2 py-1 rounded">EDIT</button></div>
                                                                <div className="space-y-2">{sale.items.map(item => (<div key={item.id} className="flex justify-between text-xs"><span>{item.products?.name} (x{item.quantity})</span><span className="font-data">₱{item.total_price.toLocaleString()}</span></div>))}</div>
                                                                <div className="pt-2 border-t flex flex-col items-end gap-1">{sale.total_discount > 0 && <span className="text-[10px] text-brand-orange">Discount: -₱{sale.total_discount.toLocaleString()}</span>}<span className="text-sm font-black text-brand-red font-data">Total: ₱{sale.grand_total.toLocaleString()}</span></div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        ))
                                    ) : (
                                        <tr><td colSpan={4} className="py-20 text-center text-slate-400">No sales found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <SalesModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditData(null); }} onSuccess={handleSuccess} editData={editData as unknown as any} />
        </div>
    );
}
