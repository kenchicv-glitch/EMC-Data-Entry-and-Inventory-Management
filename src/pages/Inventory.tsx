import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { ChevronDown, ChevronUp, Plus, Search, Edit, Trash2, Package, TrendingUp, TrendingDown, RefreshCw, Filter } from 'lucide-react';
import ProductModal from '../components/ProductModal';
import { startOfDay } from 'date-fns';

interface Product {
    id: string;
    sku: string;
    name: string;
    stock_available: number;
    stock_reserved: number;
    stock_damaged: number;
}

export default function Inventory() {
    const { role } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [initialModalData, setInitialModalData] = useState<{ l1?: string; l2?: string; l3?: string } | undefined>();
    const [movements, setMovements] = useState<Record<string, { sales: number, purchases: number, refunds: number }>>({});
    const [showSummary, setShowSummary] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());
    const [draggedProduct, setDraggedProduct] = useState<Product | null>(null);
    const [dragOverL1, setDragOverL1] = useState<string | null>(null);
    const [renamingTarget, setRenamingTarget] = useState<{ type: 'L1' | 'subCat', l1: string, subCat?: string, currentName: string } | null>(null);
    const [newNameInput, setNewNameInput] = useState('');

    const toggleCategory = (cat: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(cat)) newExpanded.delete(cat);
        else newExpanded.add(cat);
        setExpandedCategories(newExpanded);
    };

    const toggleL1 = (l1: string) => {
        const newExpanded = new Set(expandedL1s);
        if (newExpanded.has(l1)) newExpanded.delete(l1);
        else newExpanded.add(l1);
        setExpandedL1s(newExpanded);
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
            alert('Failed to move product: ' + error.message);
        } else {
            fetchData();
        }
        setDraggedProduct(null);
    };

    const handleRenameCategory = async () => {
        if (!renamingTarget || !newNameInput.trim() || newNameInput === renamingTarget.currentName) {
            setRenamingTarget(null);
            return;
        }

        const confirmMessage = renamingTarget.type === 'L1'
            ? `This will rename the Master Category "${renamingTarget.currentName}" to "${newNameInput}" for ALL associated products. Proceed?`
            : `This will rename the sub-category "${renamingTarget.currentName}" to "${newNameInput}" for ALL associated products in ${renamingTarget.l1}. Proceed?`;

        if (!window.confirm(confirmMessage)) {
            setRenamingTarget(null);
            return;
        }

        setLoading(true);
        try {
            if (renamingTarget.type === 'L1') {
                const oldPrefix = `${renamingTarget.currentName} > `;
                const newPrefix = `${newNameInput.trim()} > `;

                // Fetch all products that start with this L1
                const { data: matchedProducts } = await supabase
                    .from('products')
                    .select('id, name')
                    .ilike('name', `${renamingTarget.currentName} > %`);

                if (matchedProducts) {
                    const updates = matchedProducts.map(p => ({
                        id: p.id,
                        name: p.name.replace(oldPrefix, newPrefix)
                    }));

                    for (const up of updates) {
                        await supabase.from('products').update({ name: up.name }).eq('id', up.id);
                    }
                }
            } else {
                const oldPrefix = `${renamingTarget.l1} > ${renamingTarget.currentName} > `;
                const newPrefix = `${renamingTarget.l1} > ${newNameInput.trim()} > `;

                // Fetch all products that start with this subCat path
                const { data: matchedProducts } = await supabase
                    .from('products')
                    .select('id, name')
                    .ilike('name', `${oldPrefix}%`);

                if (matchedProducts) {
                    const updates = matchedProducts.map(p => ({
                        id: p.id,
                        name: p.name.replace(oldPrefix, newPrefix)
                    }));

                    for (const up of updates) {
                        await supabase.from('products').update({ name: up.name }).eq('id', up.id);
                    }
                }
            }
            fetchData();
        } catch (err) {
            console.error('Error renaming category:', err);
            alert('Failed to rename category. Please check logs.');
        } finally {
            setRenamingTarget(null);
            setLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);

        // Fetch products
        const { data: productsData, error: productsError } = await supabase.from('products').select('*').order('name');
        if (productsError) console.error('Error fetching inventory:', productsError);
        else setProducts(productsData || []);

        // Fetch today's movements for summary
        const todayStart = startOfDay(new Date()).toISOString();

        const [salesRes, purchasesRes, refundsRes] = await Promise.all([
            supabase.from('sales').select('product_id, quantity').gte('date', todayStart),
            supabase.from('purchases').select('product_id, quantity').gte('date', todayStart).eq('status', 'received'),
            supabase.from('customer_refunds').select('product_id, quantity').gte('date', todayStart)
        ]);

        const movMap: Record<string, { sales: number, purchases: number, refunds: number }> = {};

        salesRes.data?.forEach(s => {
            movMap[s.product_id] = { ...movMap[s.product_id] || { sales: 0, purchases: 0, refunds: 0 }, sales: (movMap[s.product_id]?.sales || 0) + s.quantity };
        });
        purchasesRes.data?.forEach(p => {
            movMap[p.product_id] = { ...movMap[p.product_id] || { sales: 0, purchases: 0, refunds: 0 }, purchases: (movMap[p.product_id]?.purchases || 0) + p.quantity };
        });
        refundsRes.data?.forEach(r => {
            movMap[r.product_id] = { ...movMap[r.product_id] || { sales: 0, purchases: 0, refunds: 0 }, refunds: (movMap[r.product_id]?.refunds || 0) + r.quantity };
        });

        setMovements(movMap);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this product?')) return;
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else fetchData();
    };

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchTerm.toLowerCase());

        const category = p.name.includes(' > ') ? p.name.split(' > ').slice(0, 3).join(' > ') : 'Uncategorized';
        const matchesCategory = categoryFilter === 'All' || category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    // Hierarchical Grouping: L1 -> (L2 > L3)
    const groupedProducts = filtered.reduce((acc: Record<string, Record<string, Product[]>>, p) => {
        const parts = p.name.split(' > ');
        const l1 = parts[0] || 'Uncategorized';
        const subCat = parts.slice(1, 3).join(' > ') || 'GENERAL';

        if (!acc[l1]) acc[l1] = {};
        if (!acc[l1][subCat]) acc[l1][subCat] = [];
        acc[l1][subCat].push(p);
        return acc;
    }, {});

    const sortedL1s = Object.keys(groupedProducts).sort();
    const allCategories = Array.from(new Set(products.map(p => p.name.includes(' > ') ? p.name.split(' > ').slice(0, 3).join(' > ') : 'Uncategorized'))).sort();

    const getStockStatus = (stock: number) => {
        if (stock === 0) return { label: 'Out of Stock', cls: 'bg-red-100 text-red-700' };
        if (stock <= 10) return { label: 'Low Stock', cls: 'bg-amber-100 text-amber-700' };
        return { label: 'In Stock', cls: 'bg-green-100 text-green-700' };
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-brand-charcoal tracking-tight font-data">INVENTORY</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{products.length} products</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSummary(!showSummary)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${showSummary ? 'bg-brand-charcoal text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                        <TrendingUp size={16} />
                        {showSummary ? 'Hide Summary' : 'Day Summary'}
                    </button>
                    {role === 'admin' && (
                        <button
                            onClick={() => { setSelectedProduct(null); setIsModalOpen(true); }}
                            className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-red transition-all duration-200 active:scale-95"
                        >
                            <Plus size={16} />
                            Add Item
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Panel */}
            {showSummary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
                    <div className="bento-card p-4 bg-white">
                        <div className="flex items-center gap-2 text-blue-600 mb-2">
                            <TrendingUp size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Today's Purchases</span>
                        </div>
                        <p className="text-2xl font-black text-brand-charcoal font-data">
                            {Object.values(movements).reduce((a, m) => a + m.purchases, 0)}
                            <span className="text-xs font-medium text-slate-400 ml-1.5 uppercase">Units</span>
                        </p>
                    </div>
                    <div className="bento-card p-4 bg-white">
                        <div className="flex items-center gap-2 text-brand-red mb-2">
                            <TrendingDown size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Today's Sales</span>
                        </div>
                        <p className="text-2xl font-black text-brand-charcoal font-data">
                            {Object.values(movements).reduce((a, m) => a + m.sales, 0)}
                            <span className="text-xs font-medium text-slate-400 ml-1.5 uppercase">Units</span>
                        </p>
                    </div>
                    <div className="bento-card p-4 bg-white">
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                            <RefreshCw size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Today's Refunds</span>
                        </div>
                        <p className="text-2xl font-black text-brand-charcoal font-data">
                            {Object.values(movements).reduce((a, m) => a + m.refunds, 0)}
                            <span className="text-xs font-medium text-slate-400 ml-1.5 uppercase">Units</span>
                        </p>
                    </div>
                    <div className="bento-card p-4 bg-brand-charcoal text-white">
                        <div className="flex items-center gap-2 text-brand-red mb-2">
                            <Package size={14} />
                            <span className="text-[10px] font-bold font-semibold uppercase tracking-widest">Net Change</span>
                        </div>
                        <p className="text-2xl font-black font-data">
                            {Object.values(movements).reduce((a, m) => a + (m.purchases - m.sales + m.refunds), 0)}
                            <span className="text-xs font-medium text-slate-400 ml-1.5 uppercase">Units</span>
                        </p>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-bento focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20 transition-all">
                    <Search size={16} className="text-slate-400 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="Search by name or SKU..."
                        className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 text-slate-700 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-600 appearance-none shadow-bento outline-none focus:ring-2 focus:ring-brand-red/20"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="All">All Categories</option>
                        {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-8">
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="bento-card p-8 skeleton h-20" />)
                ) : sortedL1s.length === 0 ? (
                    <div className="bento-card py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                                <Package size={20} className="text-slate-400" />
                            </div>
                            <p className="text-sm text-slate-500 font-medium">No products found</p>
                        </div>
                    </div>
                ) : (
                    sortedL1s.map(l1 => {
                        const isL1Expanded = expandedL1s.has(l1) || searchTerm !== '' || categoryFilter !== 'All';
                        return (
                            <div
                                key={l1}
                                className={`space-y-4 transition-all duration-300 ${dragOverL1 === l1 ? 'bg-brand-red/5 p-4 rounded-2xl ring-2 ring-brand-red ring-dashed' : ''}`}
                                onDragOver={(e) => handleDragOver(e, l1)}
                                onDragLeave={() => setDragOverL1(null)}
                                onDrop={(e) => handleDrop(e, l1)}
                            >
                                {/* Master Category Header */}
                                <div className="flex items-center justify-between border-l-4 border-brand-red pl-4 py-2 bg-slate-50/50 rounded-r-xl">
                                    <div
                                        className="flex items-center gap-3 cursor-pointer group flex-1"
                                        onClick={() => toggleL1(l1)}
                                    >
                                        {renamingTarget?.type === 'L1' && renamingTarget.l1 === l1 ? (
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    autoFocus
                                                    className="bg-white border-2 border-brand-red rounded-lg px-3 py-1 text-sm font-bold outline-none shadow-md"
                                                    value={newNameInput}
                                                    onChange={(e) => setNewNameInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameCategory();
                                                        if (e.key === 'Escape') setRenamingTarget(null);
                                                    }}
                                                />
                                                <button onClick={handleRenameCategory} className="p-1.5 bg-brand-red text-white rounded-lg"><Plus size={14} className="rotate-45" /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <h2 className="text-lg font-black text-brand-charcoal tracking-tighter uppercase group-hover:text-brand-red transition-colors">{l1}</h2>
                                                {role === 'admin' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setRenamingTarget({ type: 'L1', l1, currentName: l1 });
                                                            setNewNameInput(l1);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-brand-red hover:bg-red-50 transition-all"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            {Object.values(groupedProducts[l1]).flat().length} items
                                        </span>
                                    </div>
                                    {role === 'admin' && (
                                        <button
                                            onClick={() => {
                                                setInitialModalData({ l1 });
                                                setSelectedProduct(null);
                                                setIsModalOpen(true);
                                            }}
                                            className="flex items-center gap-1.5 text-[10px] font-black bg-brand-charcoal text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all uppercase tracking-widest"
                                        >
                                            <Plus size={12} /> Add in {l1}
                                        </button>
                                    )}
                                </div>

                                <div className={`grid grid-cols-1 gap-4 transition-all duration-300 ${isL1Expanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                    {Object.keys(groupedProducts[l1]).sort().map(subCat => {
                                        const catProducts = groupedProducts[l1][subCat];
                                        const isExpanded = expandedCategories.has(`${l1} > ${subCat}`) || categoryFilter !== 'All' || searchTerm !== '';

                                        return (
                                            <div key={subCat} className="bento-card overflow-hidden ml-4 md:ml-8 border-slate-100">
                                                <div
                                                    onClick={() => toggleCategory(`${l1} > ${subCat}`)}
                                                    className="px-6 py-3 bg-white border-b border-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-1 rounded-md transition-all ${isExpanded ? 'bg-brand-red text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                        </div>
                                                        {renamingTarget?.type === 'subCat' && renamingTarget.l1 === l1 && renamingTarget.subCat === subCat ? (
                                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    autoFocus
                                                                    className="bg-white border-2 border-brand-red rounded-lg px-2 py-0.5 text-[10px] font-black outline-none shadow-sm uppercase"
                                                                    value={newNameInput}
                                                                    onChange={(e) => setNewNameInput(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleRenameCategory();
                                                                        if (e.key === 'Escape') setRenamingTarget(null);
                                                                    }}
                                                                />
                                                                <button onClick={handleRenameCategory} className="p-1 bg-brand-red text-white rounded-md"><Plus size={10} className="rotate-45" /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 group/sub">
                                                                <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{subCat}</h3>
                                                                {role === 'admin' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setRenamingTarget({ type: 'subCat', l1, subCat, currentName: subCat });
                                                                            setNewNameInput(subCat);
                                                                        }}
                                                                        className="opacity-0 group-hover/sub:opacity-100 p-1 rounded text-slate-300 hover:text-brand-red hover:bg-red-50 transition-all font-data"
                                                                    >
                                                                        <Edit size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        <span className="text-[9px] font-bold text-slate-400">{catProducts.length} items</span>
                                                    </div>
                                                    {role === 'admin' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const parts = subCat.split(' > ');
                                                                setInitialModalData({ l1, l2: parts[0], l3: parts[1] });
                                                                setSelectedProduct(null);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-red hover:bg-red-50 transition-all"
                                                            title={`Add product in ${l1} > ${subCat}`}
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className={`overflow-x-auto transition-all duration-300 ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                    <table className="min-w-full">
                                                        <thead>
                                                            <tr className="bg-white border-b border-slate-50">
                                                                <th className="px-5 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">SKU</th>
                                                                <th className="px-5 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Details</th>
                                                                <th className="px-5 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                                                <th className="px-5 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 font-data text-right">Stock</th>
                                                                <th className="px-5 py-3 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {catProducts.map((product) => {
                                                                const status = getStockStatus(product.stock_available);
                                                                return (
                                                                    <tr
                                                                        key={product.id}
                                                                        className={`hover:bg-slate-50/30 transition-colors group cursor-grab active:cursor-grabbing ${draggedProduct?.id === product.id ? 'opacity-30' : ''}`}
                                                                        draggable
                                                                        onDragStart={() => handleDragStart(product)}
                                                                    >
                                                                        <td className="whitespace-nowrap px-5 py-2.5 text-[10px] font-bold text-slate-400 font-data tracking-tighter">{product.sku}</td>
                                                                        <td className="whitespace-nowrap px-5 py-2.5 text-xs font-black text-brand-charcoal">
                                                                            {product.name.split(' > ').slice(3).join(' > ') || product.name.split(' > ').pop()}
                                                                        </td>
                                                                        <td className="whitespace-nowrap px-5 py-2.5">
                                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${status.cls}`}>
                                                                                {status.label}
                                                                            </span>
                                                                        </td>
                                                                        <td className="whitespace-nowrap px-5 py-2.5 text-xs font-black text-brand-red font-data text-right">{product.stock_available}</td>
                                                                        <td className="whitespace-nowrap px-5 py-2.5 text-right">
                                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button
                                                                                    onClick={() => { setSelectedProduct(product); setInitialModalData(undefined); setIsModalOpen(true); }}
                                                                                    className="p-1 rounded text-slate-300 hover:text-brand-charcoal hover:bg-slate-100 transition-all font-data"
                                                                                >
                                                                                    <Edit size={12} />
                                                                                </button>
                                                                                {role === 'admin' && (
                                                                                    <button
                                                                                        onClick={() => handleDelete(product.id)}
                                                                                        className="p-1 rounded text-slate-300 hover:text-brand-red hover:bg-red-50 transition-all"
                                                                                    >
                                                                                        <Trash2 size={12} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setInitialModalData(undefined); }}
                onSuccess={fetchData}
                product={selectedProduct}
                role={role}
                initialData={initialModalData}
            />
        </div>
    );
}
