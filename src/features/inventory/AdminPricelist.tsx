import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { useAuth } from '../../shared/hooks/useAuth';
import {
    ChevronDown, ChevronUp, Plus, Search, Edit, Tag,
    Eye, EyeOff, Save, CheckCircle, AlertCircle, Filter, Package
} from 'lucide-react';
import ProductModal from './components/ProductModal';
import { encodePrice, isEncoded, decodePrice } from '../../shared/lib/priceCodes';
import { useBranch } from '../../shared/lib/BranchContext';

interface Product {
    id: string;
    name: string;
    stock_available: number;
    selling_price: number | null;
    buying_price: number | null;
    low_stock_threshold: number | null;
    brand?: string | null;
    description?: string | null;
}

export default function AdminPricelist() {
    const { role } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [showWsp, setShowWsp] = useState(false);
    const [editingId, setEditingId] = useState<{ id: string, field: 'srp' | 'wsp' | 'trigger' } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());
    const [expandedSubCats, setExpandedSubCats] = useState<Set<string>>(new Set());

    const { activeBranchId } = useBranch();

    const fetchData = async () => {
        setLoading(true);
        let query = supabase
            .from('products')
            .select('*')
            .order('name');
            
        if (activeBranchId) {
            query = query.eq('branch_id', activeBranchId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching products:', error);
            setMessage({ type: 'error', text: `Failed to load products: ${error.message}` });
        } else {
            setProducts(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [activeBranchId]);

    const handleSavePrice = async (id: string, field: 'srp' | 'wsp' | 'trigger') => {
        if (role !== 'owner') {
            setMessage({ type: 'error', text: 'You do not have permission to modify prices.' });
            return;
        }

        let value: number;
        const displayField = field.toUpperCase();

        if (field === 'wsp') {
            // Check if it's an encoded string or a number
            if (isNaN(Number(editValue))) {
                if (isEncoded(editValue.toUpperCase())) {
                    const decoded = decodePrice(editValue.toUpperCase());
                    proceedSave(decoded);
                } else {
                    setMessage({ type: 'error', text: 'Invalid price or code' });
                }
                return;
            } else {
                value = parseFloat(editValue);
                proceedSave(value);
            }
        } else {
            value = parseFloat(editValue);
            if (isNaN(value) || value < 0) {
                setMessage({ type: 'error', text: 'Invalid value' });
                return;
            }
            proceedSave(value);
        }

        async function proceedSave(val: number) {
            const dbField = field === 'srp' ? 'selling_price' : field === 'wsp' ? 'buying_price' : 'low_stock_threshold';
            const { error } = await supabase
                .from('products')
                .update({ [dbField]: val })
                .eq('id', id);

            if (error) {
                setMessage({ type: 'error', text: `Failed to update ${displayField}` });
            } else {
                setProducts(products.map(p => p.id === id ? { ...p, [dbField]: val } : p));
                setEditingId(null);
                setMessage({ type: 'success', text: `${displayField} updated successfully` });
                setTimeout(() => setMessage(null), 3000);
            }
        }
    };

    const toggleL1 = (l1: string) => {
        const next = new Set(expandedL1s);
        if (next.has(l1)) next.delete(l1);
        else next.add(l1);
        setExpandedL1s(next);
    };

    const toggleSubCat = (sc: string) => {
        const next = new Set(expandedSubCats);
        if (next.has(sc)) next.delete(sc);
        else next.add(sc);
        setExpandedSubCats(next);
    };

    const filtered = products.filter(p => {
        const searchMatched = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
        const l1 = p.name.split(' > ')[0] || 'Uncategorized';
        const categoryMatched = categoryFilter === 'All' || l1 === categoryFilter;
        return searchMatched && categoryMatched;
    });

    const grouped = filtered.reduce((acc: Record<string, Record<string, Product[]>>, p) => {
        const parts = p.name.split(' > ');
        const l1 = parts[0] || 'Uncategorized';
        const subCat = parts.slice(1, -1).join(' > ') || 'GENERAL';
        if (!acc[l1]) acc[l1] = {};
        if (!acc[l1][subCat]) acc[l1][subCat] = [];
        acc[l1][subCat].push(p);
        return acc;
    }, {});

    const sortedL1s = Object.keys(grouped).sort();
    const allCategories = Array.from(new Set(products.map(p => p.name.split(' > ')[0] || 'Uncategorized'))).sort();

    const stats = {
        totalSrpValue: products.reduce((acc, p) => acc + ((p.stock_available || 0) * (p.selling_price || 0)), 0),
        totalCostValue: products.reduce((acc, p) => acc + ((p.stock_available || 0) * (p.buying_price || 0)), 0),
        totalStock: products.reduce((acc, p) => acc + (p.stock_available || 0), 0)
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-none pb-10 font-sans">
            {/* Header matches Inventory.tsx style */}
            <div className="flex items-center justify-between bg-bg-surface p-4 rounded-2xl border border-border-muted shadow-sm sticky top-0 z-40 backdrop-blur-md bg-bg-surface/90">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center shadow-red">
                        <Tag className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-text-primary tracking-tight font-data">ADMIN PRICELIST</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex flex-col">
                                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none mb-1">Total SRP Value</p>
                                <p className="text-sm font-black text-text-primary font-data leading-none">₱{stats.totalSrpValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="w-px h-6 bg-border-muted" />
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none">Total Cost Value</p>
                                    <button
                                        onClick={() => setShowWsp(!showWsp)}
                                        className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter transition-all px-1.5 py-0.5 rounded ${showWsp ? 'text-brand-red bg-brand-red/10' : 'text-text-muted hover:text-brand-red border border-border-muted'}`}
                                    >
                                        {showWsp ? <EyeOff size={8} /> : <Eye size={8} />}
                                    </button>
                                </div>
                                <p className="text-sm font-black text-brand-red font-data leading-none">
                                    {showWsp ? `₱${stats.totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : encodePrice(stats.totalCostValue)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-bg-base border border-border-muted rounded-xl px-3 py-1.5 focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/10 transition-all w-80">
                        <Search size={14} className="text-text-muted flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search items or brands..."
                            className="bg-transparent border-none outline-none text-xs w-full placeholder:text-text-muted/50 text-text-primary font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {role === 'owner' && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-red transition-all active:scale-95 flex-shrink-0"
                        >
                            <Plus size={14} /> Add Product
                        </button>
                    )}
                </div>
            </div>

            {message && (
                <div className={`mx-auto max-w-2xl p-3 rounded-xl border flex items-center justify-center gap-3 animate-slide-up shadow-sm ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    <span className="text-[11px] font-black uppercase tracking-wider">{message.text}</span>
                </div>
            )}

            <div className="flex gap-6 items-start">
                {/* Sidebar Categories Navigator */}
                <div className="hidden xl:block w-56 sticky top-24 space-y-1 bg-bg-surface p-3 rounded-2xl border border-border-muted shadow-sm overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest px-2 mb-3">Master Groups</p>
                    <button
                        onClick={() => setCategoryFilter('All')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${categoryFilter === 'All' ? 'bg-brand-red text-white shadow-sm' : 'text-text-muted hover:bg-bg-subtle'}`}
                    >
                        All Categories
                    </button>
                    {allCategories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all truncate ${categoryFilter === cat ? 'bg-brand-red text-white shadow-sm' : 'text-text-muted hover:bg-bg-subtle'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex-1 space-y-8 pb-10">
                    <div className="xl:hidden flex items-center gap-3">
                        <div className="relative flex-1">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                            <select
                                className="w-full bg-bg-surface border border-border-muted rounded-xl pl-9 pr-4 py-2 text-xs font-black text-text-primary appearance-none shadow-sm outline-none focus:ring-2 focus:ring-brand-red/10"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="All">All Categories</option>
                                {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
                        </div>
                    ) : sortedL1s.length > 0 ? (
                        sortedL1s.map(l1 => {
                            const isL1Expanded = expandedL1s.has(l1) || searchTerm !== '' || categoryFilter !== 'All';
                            return (
                                <div key={l1} className="space-y-3">
                                    <div
                                        onClick={() => toggleL1(l1)}
                                        className="flex items-center justify-between border-l-4 border-text-primary pl-4 py-2 bg-bg-subtle/30 rounded-r-xl cursor-pointer group hover:bg-bg-subtle/50 transition-all font-data"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1 rounded-md transition-all ${isL1Expanded ? 'bg-text-primary text-text-inverse' : 'bg-bg-surface text-text-muted border border-border-muted'}`}>
                                                {isL1Expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </div>
                                            <h2 className="text-lg font-black text-text-primary tracking-tighter uppercase">{l1} PRICELIST</h2>
                                        </div>
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest pr-4">
                                            {Object.values(grouped[l1]).flat().length} Items
                                        </span>
                                    </div>

                                    <div className={`grid grid-cols-1 gap-6 transition-all duration-300 ${isL1Expanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                        {Object.keys(grouped[l1]).sort().map(subCat => {
                                            const subCatKey = `${l1} > ${subCat}`;
                                            const isExpanded = expandedSubCats.has(subCatKey) || searchTerm !== '' || categoryFilter !== 'All';
                                            return (
                                                <div key={subCat} className="bg-bg-surface overflow-hidden ml-4 md:ml-8 border border-border-muted rounded-2xl shadow-sm relative">
                                                    <div
                                                        onClick={() => toggleSubCat(subCatKey)}
                                                        className="px-6 py-2.5 bg-bg-subtle/30 border-b border-border-muted flex items-center justify-between cursor-pointer hover:bg-bg-subtle/50 transition-colors"
                                                    >
                                                        <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                                            <div className={`p-0.5 rounded transition-all ${isExpanded ? 'bg-text-primary text-text-inverse' : 'bg-bg-subtle text-text-muted'}`}>
                                                                {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                                            </div>
                                                            {subCat}
                                                        </h3>
                                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">{grouped[l1][subCat].length} items</span>
                                                    </div>

                                                    <div className={`overflow-x-auto transition-all duration-300 ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                        <table className="min-w-full">
                                                            <thead>
                                                                <tr className="bg-bg-surface border-b border-border-muted">
                                                                    <th className="px-6 py-2 text-left text-[9px] font-black uppercase tracking-widest text-text-muted">Spec / Description</th>
                                                                    <th className="px-6 py-2 text-center text-[9px] font-black uppercase tracking-widest text-text-muted w-24">Brand</th>
                                                                    <th className="px-6 py-2 text-right text-[9px] font-black uppercase tracking-widest text-text-secondary bg-bg-subtle/20 w-32">SRP (₱) Selling</th>
                                                                    <th className="px-6 py-2 text-right text-[9px] font-black uppercase tracking-widest text-brand-red bg-brand-red/5 w-44">WSP (Cost)</th>
                                                                    <th className="px-6 py-2 text-center text-[9px] font-black uppercase tracking-widest text-orange-500 w-28">Low Stock Trigger</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border-muted/30 bg-bg-surface">
                                                                {grouped[l1][subCat].map((p) => (
                                                                    <tr key={p.id} className="hover:bg-bg-subtle/30 transition-colors group">
                                                                        <td className="px-6 py-3">
                                                                            <p className="text-[11px] font-black text-text-primary tracking-tight leading-tight uppercase">
                                                                                {p.name.split(' > ').slice(-1)[0]}
                                                                            </p>
                                                                        </td>
                                                                        <td className="px-6 py-3 text-center">
                                                                            {p.brand && (
                                                                                <span className="inline-flex px-1.5 py-0.5 rounded bg-bg-subtle text-[8px] font-black text-text-muted uppercase tracking-widest border border-border-muted/50">
                                                                                    {p.brand}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-3 text-right bg-bg-subtle/10">
                                                                            {editingId?.id === p.id && editingId?.field === 'srp' ? (
                                                                                <div className="flex items-center justify-end gap-1">
                                                                                    <input
                                                                                        autoFocus
                                                                                        className="w-24 bg-bg-surface border-2 border-text-primary rounded-lg px-2 py-1 text-xs font-black text-right outline-none font-data text-text-primary"
                                                                                        value={editValue}
                                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSavePrice(p.id, 'srp');
                                                                                            if (e.key === 'Escape') setEditingId(null);
                                                                                        }}
                                                                                    />
                                                                                    <button onClick={() => handleSavePrice(p.id, 'srp')} className="p-1 bg-text-primary text-text-inverse rounded"><Save size={12} /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    onClick={() => { setEditingId({ id: p.id, field: 'srp' }); setEditValue((p.selling_price ?? 0).toString()); }}
                                                                                    className="group/price flex items-center justify-end gap-2 cursor-pointer hover:text-text-primary transition-colors"
                                                                                >
                                                                                    <span className="text-[11px] font-black text-text-secondary font-data tracking-tight">
                                                                                        ₱{(p.selling_price ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                                                    </span>
                                                                                    <Edit size={10} className="text-text-muted opacity-0 group-hover/price:opacity-100" />
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-3 text-right bg-brand-red/5">
                                                                            {editingId?.id === p.id && editingId?.field === 'wsp' ? (
                                                                                <div className="flex items-center justify-end gap-1">
                                                                                    <input
                                                                                        autoFocus
                                                                                        className="w-24 bg-bg-surface border-2 border-brand-red rounded-lg px-2 py-1 text-xs font-black text-right outline-none font-data text-text-primary"
                                                                                        placeholder="Price or Code"
                                                                                        value={editValue}
                                                                                        onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSavePrice(p.id, 'wsp');
                                                                                            if (e.key === 'Escape') setEditingId(null);
                                                                                        }}
                                                                                    />
                                                                                    <button onClick={() => handleSavePrice(p.id, 'wsp')} className="p-1 bg-brand-red text-white rounded"><Save size={12} /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    onClick={() => { setEditingId({ id: p.id, field: 'wsp' }); setEditValue(p.buying_price?.toString() || '0'); }}
                                                                                    className="group/wsp flex items-center justify-end gap-3 cursor-pointer"
                                                                                >
                                                                                    <div className="text-right">
                                                                                        <span className="text-[12px] font-black text-brand-red font-data tracking-tight block leading-none">
                                                                                            {showWsp
                                                                                                ? `₱${(p.buying_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                                                                                : encodePrice(p.buying_price)}
                                                                                        </span>
                                                                                        {!showWsp && <span className="text-[7px] font-black text-red-300 uppercase tracking-tighter block mt-0.5">COST CODE</span>}
                                                                                    </div>
                                                                                    <Edit size={10} className="text-red-200 opacity-0 group-hover/wsp:opacity-100" />
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-3 text-center">
                                                                            {editingId?.id === p.id && editingId?.field === 'trigger' ? (
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <input
                                                                                        autoFocus
                                                                                        type="number"
                                                                                        className="w-16 bg-bg-surface border-2 border-orange-500 rounded-lg px-2 py-1 text-xs font-black text-center outline-none font-data text-text-primary"
                                                                                        value={editValue}
                                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSavePrice(p.id, 'trigger');
                                                                                            if (e.key === 'Escape') setEditingId(null);
                                                                                        }}
                                                                                    />
                                                                                    <button onClick={() => handleSavePrice(p.id, 'trigger')} className="p-1 bg-orange-500 text-white rounded"><Save size={12} /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    onClick={() => { setEditingId({ id: p.id, field: 'trigger' }); setEditValue(p.low_stock_threshold?.toString() || '10'); }}
                                                                                    className="group/trigger flex items-center justify-center gap-2 cursor-pointer hover:bg-orange-500/10 rounded-lg py-1 transition-colors"
                                                                                >
                                                                                    <span className="text-[11px] font-black text-orange-500 font-data">
                                                                                        {p.low_stock_threshold || 10}
                                                                                    </span>
                                                                                    <Edit size={10} className="text-orange-500/40 opacity-0 group-hover/trigger:opacity-100" />
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
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
                    ) : (
                        <div className="bg-bg-surface py-20 text-center rounded-3xl border border-border-muted shadow-sm">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-bg-subtle rounded-full flex items-center justify-center">
                                    <Package size={20} className="text-text-muted" />
                                </div>
                                <p className="text-[11px] text-text-muted font-black uppercase tracking-widest">No items found</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchData}
                role="owner"
            />
        </div>
    );
}
