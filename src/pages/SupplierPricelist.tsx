import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Edit3, Truck, Save, CheckCircle, AlertCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import ProductModal from '../components/ProductModal';

interface Product {
    id: string;
    sku: string;
    name: string;
    stock_available: number;
    selling_price: number;
    buying_price: number;
}

export default function SupplierPricelist() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newPrice, setNewPrice] = useState<string>('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [initialModalData, setInitialModalData] = useState<{ l1?: string, l2?: string, l3?: string } | undefined>();
    const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());

    useEffect(() => {
        let mounted = true;
        const fetch = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name, stock_available, selling_price, buying_price')
                .order('name');

            if (mounted) {
                if (error) {
                    console.error('Error fetching products:', error);
                } else {
                    setProducts(data || []);
                }
                setLoading(false);
            }
        };
        fetch();
        return () => { mounted = false; };
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('id, sku, name, stock_available, selling_price, buying_price')
            .order('name');

        if (error) {
            console.error('Error fetching products:', error);
        } else {
            setProducts(data || []);
        }
        setLoading(false);
    };

    const toggleL1 = (l1: string) => {
        setExpandedL1s(prev => {
            const next = new Set(prev);
            if (next.has(l1)) next.delete(l1);
            else next.add(l1);
            return next;
        });
    };

    const startEditing = (product: Product) => {
        setEditingId(product.id);
        setNewPrice(product.buying_price?.toString() || '0');
    };

    const savePrice = async (id: string) => {
        const priceValue = parseFloat(newPrice);
        if (isNaN(priceValue) || priceValue < 0) {
            setMessage({ type: 'error', text: 'Invalid price value' });
            return;
        }

        const { error } = await supabase
            .from('products')
            .update({ buying_price: priceValue })
            .eq('id', id);

        if (error) {
            setMessage({ type: 'error', text: 'Failed to update buying price' });
        } else {
            setProducts(products.map(p => p.id === id ? { ...p, buying_price: priceValue } : p));
            setEditingId(null);
            setMessage({ type: 'success', text: 'Buying price updated successfully' });
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const groupedProducts = filteredProducts.reduce((acc: Record<string, Record<string, Product[]>>, p) => {
        const parts = p.name.split(' > ');
        const l1 = parts[0] || 'Uncategorized';
        const subCat = parts.slice(1, 3).join(' > ') || 'GENERAL';

        if (!acc[l1]) acc[l1] = {};
        if (!acc[l1][subCat]) acc[l1][subCat] = [];
        acc[l1][subCat].push(p);
        return acc;
    }, {});

    const sortedL1s = Object.keys(groupedProducts).sort();

    return (
        <div className="space-y-8 animate-fade-in relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-charcoal tracking-tight flex items-center gap-3 font-data uppercase">
                        <div className="w-10 h-10 bg-brand-charcoal rounded-xl flex items-center justify-center shadow-lg">
                            <Truck className="text-white" size={20} />
                        </div>
                        Supplier Pricelist
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium italic">Manage buying prices and costs from suppliers</p>
                </div>

                {/* Search */}
                <div className="flex flex-col sm:flex-row gap-3 min-w-[300px] md:min-w-[500px]">
                    <div className="relative group flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-red transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search by SKU or name..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-slide-up ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span className="text-sm font-bold">{message.text}</span>
                </div>
            )}

            <div className="space-y-12">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-pulse h-40" />
                        ))}
                    </div>
                ) : sortedL1s.length > 0 ? (
                    sortedL1s.map(l1 => {
                        const isL1Expanded = expandedL1s.has(l1) || searchTerm !== '';
                        return (
                            <div key={l1} className="space-y-6">
                                <div className="flex items-center justify-between bg-brand-charcoal text-white px-6 py-3 rounded-2xl shadow-lg border-b-4 border-slate-400">
                                    <div
                                        className="flex items-center gap-4 cursor-pointer group flex-1"
                                        onClick={() => toggleL1(l1)}
                                    >
                                        <div className={`p-1.5 rounded-xl transition-all ${isL1Expanded ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'}`}>
                                            {isL1Expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                        <h2 className="text-xl font-black uppercase tracking-widest group-hover:text-brand-red transition-colors">{l1} SUPPLIER LIST</h2>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setInitialModalData({ l1 });
                                            setIsAddModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border border-white/5"
                                    >
                                        <Plus size={14} /> Add Product in {l1}
                                    </button>
                                </div>

                                <div className={`grid grid-cols-1 gap-8 transition-all duration-300 ${isL1Expanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                    {Object.keys(groupedProducts[l1]).sort().map(subCat => (
                                        <div key={subCat} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="bg-slate-100/50 px-5 py-3 border-b border-slate-200">
                                                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">{subCat}</h3>
                                            </div>

                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                        <th className="px-5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Details</th>
                                                        <th className="px-5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Selling Price (₱)</th>
                                                        <th className="px-5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Buying Price (₱)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {groupedProducts[l1][subCat].map((product) => (
                                                        <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                                                            <td className="px-5 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-bold text-slate-400 font-data mb-0.5">{product.sku}</span>
                                                                    <span className="text-sm font-black text-brand-charcoal">
                                                                        {product.name.split(' > ').slice(3).join(' > ') || product.name.split(' > ').pop()}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 text-right">
                                                                <span className="text-sm font-bold text-slate-400 font-data">
                                                                    ₱{product.selling_price?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4 text-right">
                                                                {editingId === product.id ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <input
                                                                            autoFocus
                                                                            type="number"
                                                                            className="w-24 bg-slate-50 border border-brand-red rounded-lg px-2 py-1 text-sm font-black text-right outline-none font-data"
                                                                            value={newPrice}
                                                                            onChange={(e) => setNewPrice(e.target.value)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && savePrice(product.id)}
                                                                        />
                                                                        <button onClick={() => savePrice(product.id)} className="p-1.5 bg-brand-red text-white rounded-lg"><Save size={14} /></button>
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        onClick={() => startEditing(product)}
                                                                        className="inline-flex items-center gap-3 cursor-pointer hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-all font-data"
                                                                    >
                                                                        <span className="text-sm font-black text-brand-red">
                                                                            ₱{product.buying_price?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}
                                                                        </span>
                                                                        <Edit3 size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
                        <Truck className="mx-auto text-slate-200 mb-4" size={48} />
                        <p className="text-slate-400 font-medium italic">No products found matching your search.</p>
                    </div>
                )}
            </div>

            <ProductModal
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setInitialModalData(undefined); }}
                onSuccess={fetchProducts}
                role="admin"
                initialData={initialModalData}
            />
        </div>
    );
}
