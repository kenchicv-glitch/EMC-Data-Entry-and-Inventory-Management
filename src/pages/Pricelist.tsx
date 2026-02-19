import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Edit3, Tag, Save, CheckCircle, AlertCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import ProductModal from '../components/ProductModal';

interface Product {
    id: string;
    sku: string;
    name: string;
    stock_available: number;
    selling_price: number;
}

export default function Pricelist() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newPrice, setNewPrice] = useState<string>('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [initialModalData, setInitialModalData] = useState<{ l1?: string, l2?: string, l3?: string } | undefined>();
    const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());
    const [draggedProduct, setDraggedProduct] = useState<Product | null>(null);
    const [dragOverL1, setDragOverL1] = useState<string | null>(null);

    const fetchProducts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('id, sku, name, stock_available, selling_price')
            .order('name');

        if (error) {
            console.error('Error fetching products:', error);
        } else {
            setProducts(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (mounted) await fetchProducts();
        };
        load();
        return () => { mounted = false; };
    }, []);

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
        setNewPrice(product.selling_price.toString());
    };

    const savePrice = async (id: string) => {
        const priceValue = parseFloat(newPrice);
        if (isNaN(priceValue) || priceValue < 0) {
            setMessage({ type: 'error', text: 'Invalid price value' });
            return;
        }

        const { error } = await supabase
            .from('products')
            .update({ selling_price: priceValue })
            .eq('id', id);

        if (error) {
            setMessage({ type: 'error', text: 'Failed to update price' });
        } else {
            setProducts(products.map(p => p.id === id ? { ...p, selling_price: priceValue } : p));
            setEditingId(null);
            setMessage({ type: 'success', text: 'Price updated successfully' });
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDragStart = (product: Product) => {
        setDraggedProduct(product);
    };

    const handleDragOver = (e: React.DragEvent, l1: string) => {
        e.preventDefault();
        setDragOverL1(l1);
    };

    const handleDrop = async (e: React.DragEvent, targetL1: string) => {
        e.preventDefault();
        setDragOverL1(null);
        if (!draggedProduct) return;

        const parts = draggedProduct.name.split(' > ');
        const oldL1 = parts[0];
        if (oldL1 === targetL1) return;

        const remaining = parts.slice(1).join(' > ') || 'GENERAL';
        const newName = `${targetL1} > ${remaining}`;

        const { error } = await supabase
            .from('products')
            .update({ name: newName })
            .eq('id', draggedProduct.id);

        if (error) {
            setMessage({ type: 'error', text: 'Failed to move product' });
        } else {
            fetchProducts();
            setMessage({ type: 'success', text: `Moved product to ${targetL1}` });
            setTimeout(() => setMessage(null), 3000);
        }
        setDraggedProduct(null);
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    // Hierarchical Grouping: L1 -> (L2 > L3)
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

    // Excel-like Sectioned View
    return (
        <div className="space-y-8 animate-fade-in relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-charcoal tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center shadow-red">
                            <Tag className="text-white" size={20} />
                        </div>
                        Pricelist Management
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium italic">Grouped & organized like your Excel price list</p>
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
                            <div
                                key={l1}
                                className={`space-y-6 transition-all duration-300 ${dragOverL1 === l1 ? 'bg-brand-red/5 p-4 rounded-3xl ring-2 ring-brand-red ring-dashed' : ''}`}
                                onDragOver={(e) => handleDragOver(e, l1)}
                                onDragLeave={() => setDragOverL1(null)}
                                onDrop={(e) => handleDrop(e, l1)}
                            >
                                {/* Master Header */}
                                <div className="flex items-center justify-between bg-brand-charcoal text-white px-6 py-3 rounded-2xl shadow-lg border-b-4 border-brand-red">
                                    <div
                                        className="flex items-center gap-4 cursor-pointer group flex-1"
                                        onClick={() => toggleL1(l1)}
                                    >
                                        <div className={`p-1.5 rounded-xl transition-all ${isL1Expanded ? 'bg-brand-red text-white' : 'bg-white/10 text-white/50'}`}>
                                            {isL1Expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                        <h2 className="text-xl font-black uppercase tracking-widest group-hover:text-brand-red transition-colors">{l1} PRICE LIST</h2>
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

                                {/* Sub-categories in Excel Grid Layout */}
                                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 transition-all duration-300 ${isL1Expanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                    {Object.keys(groupedProducts[l1]).sort().map(subCat => (
                                        <div key={subCat} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                            <div className="bg-slate-100/50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                                                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">{subCat}</h3>
                                                <button
                                                    onClick={() => {
                                                        const parts = subCat.split(' > ');
                                                        setInitialModalData({ l1, l2: parts[0], l3: parts[1] });
                                                        setIsAddModalOpen(true);
                                                    }}
                                                    className="p-1 px-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-brand-red hover:border-brand-red/30 transition-all flex items-center gap-1.5"
                                                    title={`Add in ${l1} > ${subCat}`}
                                                >
                                                    <Plus size={12} /> <span className="text-[9px] font-black uppercase">Add Item</span>
                                                </button>
                                            </div>

                                            <div className="flex-1">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200">
                                                            <th className="px-5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Details</th>
                                                            <th className="px-5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Price (₱)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {groupedProducts[l1][subCat].map((product) => (
                                                            <tr
                                                                key={product.id}
                                                                className={`hover:bg-slate-50/50 transition-colors group cursor-grab active:cursor-grabbing ${draggedProduct?.id === product.id ? 'opacity-30' : ''}`}
                                                                draggable
                                                                onDragStart={() => handleDragStart(product)}
                                                            >
                                                                <td className="px-5 py-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-bold text-slate-400 font-data mb-0.5">{product.sku}</span>
                                                                        <span className="text-sm font-black text-brand-charcoal group-hover:text-brand-red transition-colors">
                                                                            {product.name.split(' > ').slice(3).join(' > ') || product.name.split(' > ').pop()}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3 text-right">
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
                                                                            <span className="text-sm font-black text-brand-charcoal">
                                                                                {product.selling_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
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
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
                        <Tag className="mx-auto text-slate-200 mb-4" size={48} />
                        <p className="text-slate-400 font-medium italic">No products found matching your search.</p>
                    </div>
                )}
            </div>

            <ProductModal
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setInitialModalData(undefined); }}
                onSuccess={fetchProducts}
                role="admin" // Defaulted for this page
                initialData={initialModalData}
            />
        </div>
    );
}
