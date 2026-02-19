import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    RefreshCw,
    History, Search
} from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import Calendar from '../components/Calendar';

interface InventorySnap {
    id: string;
    sku: string;
    name: string;
    opening: number;
    inwards: number;
    outwards: number;
    returns: number;
    ending: number;
}

export default function DailyInventorySummary() {
    const [summary, setSummary] = useState<InventorySnap[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Get ALL products (current state)
            const { data: products } = await supabase
                .from('products')
                .select('id, sku, name, stock_available');

            if (!products) return;

            const targetDate = startOfDay(selectedDate);

            // 2. Fetch ALL movements after the target date
            // Movements include: Sales (-), Purchases (+), Returns (-), Refunds (+)
            const { data: sales } = await supabase.from('sales').select('product_id, quantity, date').gt('date', selectedDate.toISOString());
            const { data: purchases } = await supabase.from('purchases').select('product_id, quantity, date').eq('status', 'received').gt('date', selectedDate.toISOString());
            const { data: returns } = await supabase.from('supplier_returns').select('product_id, quantity, date').gt('date', selectedDate.toISOString());
            const { data: refunds } = await supabase.from('customer_refunds').select('product_id, quantity, date').gt('date', selectedDate.toISOString());

            // 3. Fetch movements FOR THE TARGET DATE (to show inwards/outwards)
            const isoTargetStart = targetDate.toISOString();
            const isoTargetEnd = new Date(targetDate.getTime() + 86400000).toISOString();

            const { data: dSales } = await supabase.from('sales').select('product_id, quantity').gte('date', isoTargetStart).lt('date', isoTargetEnd);
            const { data: dPurchases } = await supabase.from('purchases').select('product_id, quantity').eq('status', 'received').gte('date', isoTargetStart).lt('date', isoTargetEnd);
            const { data: dReturns } = await supabase.from('supplier_returns').select('product_id, quantity').gte('date', isoTargetStart).lt('date', isoTargetEnd);
            const { data: dRefunds } = await supabase.from('customer_refunds').select('product_id, quantity').gte('date', isoTargetStart).lt('date', isoTargetEnd);

            const snaps: InventorySnap[] = products.map(p => {
                // Determine real-time stock
                let current = p.stock_available;

                // Adjust for movements AFTER the target date to get "Ending Balance" of target date
                // To get PAST balance: Past = Current - (Purchases - Sales - Returns + Refunds) ?? No.
                // Logic: 
                // Stock(Today) = Stock(Target) + In(AfterTarget) - Out(AfterTarget)
                // Stock(Target) = Stock(Today) - In(AfterTarget) + Out(AfterTarget)

                const salesAfter = sales?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const purchasesAfter = purchases?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const returnsAfter = returns?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const refundsAfter = refunds?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;

                // Move from TODAY back to END OF TARGET DATE
                const endingBalance = current + salesAfter - purchasesAfter + returnsAfter - refundsAfter;

                // Movements ON Target Date
                const inwards = dPurchases?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;
                const outwards = (dSales?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0) +
                    (dReturns?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0);
                const refundsTotal = dRefunds?.filter(s => s.product_id === p.id).reduce((a, s) => a + s.quantity, 0) || 0;

                // Opening = Ending - In + Out - Refunds
                const opening = endingBalance - inwards + outwards - refundsTotal;

                return {
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    opening,
                    inwards,
                    outwards,
                    returns: refundsTotal,
                    ending: endingBalance
                };
            });

            setSummary(snaps);
        } catch (err) {
            console.error('Error calculating history:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const filtered = summary.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-brand-charcoal tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-900 rounded-2xl flex items-center justify-center shadow-lg"><History className="text-white" size={24} /></div>
                        Daily Inventory Summary
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">Reconstruct historical stock balances</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-shrink-0">
                    <div className="sticky top-6">
                        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} activeDates={[format(new Date(), 'yyyy-MM-dd')]} />
                        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                            <p className="text-[10px] font-black text-amber-600 uppercase mb-2 flex items-center gap-1"><RefreshCw size={10} /> Reverse Playback</p>
                            <p className="text-[11px] text-amber-700 leading-relaxed font-medium">This report calculates balances by mathematically reversing all transactions from today's real-time stock levels.</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-4">
                    <div className="relative group flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                        <input type="text" placeholder="Search product or SKU..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product / SKU</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Opening</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center bg-emerald-50/20">In (+)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-brand-red uppercase tracking-widest text-center bg-red-50/20">Out (-)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-blue-600 uppercase tracking-widest text-center bg-blue-50/20">Refund (+)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-brand-charcoal uppercase tracking-widest text-center border-l">Ending</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    [1, 2, 3, 4, 5].map(i => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-6 py-5"><div className="h-4 bg-slate-50 rounded italic">Calculating...</div></td></tr>)
                                ) : filtered.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-all font-data">
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-black text-brand-charcoal">{item.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{item.sku}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-500">{item.opening}</td>
                                        <td className="px-6 py-4 text-center font-black text-emerald-600 bg-emerald-50/10">+{item.inwards}</td>
                                        <td className="px-6 py-4 text-center font-black text-brand-red bg-red-50/10">-{item.outwards}</td>
                                        <td className="px-6 py-4 text-center font-black text-blue-600 bg-blue-50/10">+{item.returns}</td>
                                        <td className="px-6 py-4 text-center font-black text-brand-charcoal border-l bg-slate-50/30">{item.ending}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
