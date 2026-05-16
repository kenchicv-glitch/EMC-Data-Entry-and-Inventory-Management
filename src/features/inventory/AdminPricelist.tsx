import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { useAuth } from '../../shared/hooks/useAuth';
import {
    ChevronDown, ChevronUp, Plus, Search, Edit, Tag,
    Eye, EyeOff, Save, CheckCircle, AlertCircle, Filter, Package, X, RefreshCw, Database
} from 'lucide-react';
import ProductModal from './components/ProductModal';
import { encodePrice, isEncoded, decodePrice } from '../../shared/lib/priceCodes';
import { useBranch } from '../../shared/hooks/useBranch';
import { productService } from './services/productService';
import { runProductMigration } from './services/categoryService';
import { buildSkuPrefix } from '../../shared/lib/skuGenerator';

interface CategoryNode {
    id: string;
    name: string;
    depth: number;
    parent_id?: string | null;
    parent?: CategoryNode | null;
}

interface Product {
    id: string;
    name: string;
    sku?: string | null;
    stock_available: number;
    selling_price: number | null;
    buying_price: number | null;
    low_stock_threshold: number | null;
    brand?: string | null;
    description?: string | null;
    category?: CategoryNode | null;
}

export default function AdminPricelist() {
    const { role } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [showWsp, setShowWsp] = useState(false);
    const [editingId, setEditingId] = useState<{ id: string, field: 'srp' | 'wsp' | 'trigger' | 'stock' } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());
    const [expandedSubCats, setExpandedSubCats] = useState<Set<string>>(new Set());

    const { activeBranchId } = useBranch();

    const fetchData = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('products')
            .select(`
                *,
                category:inv_categories!category_id(
                    id, name, depth, parent_id,
                    parent:inv_categories!parent_id(
                        id, name, depth, parent_id,
                        parent:inv_categories!parent_id(id, name, depth)
                    )
                )
            `)
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
    }, [activeBranchId]);

    useEffect(() => {
        const load = async () => {
            await fetchData();
        };
        load();
    }, [fetchData]);

    const handleSavePrice = async (id: string, field: 'srp' | 'wsp' | 'trigger' | 'stock') => {
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
            const dbField = field === 'srp' ? 'selling_price' : field === 'wsp' ? 'buying_price' : field === 'stock' ? 'stock_available' : 'low_stock_threshold';
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

    const handleStandardizeUnits = async () => {
        if (role !== 'owner') return;
        setLoading(true);
        try {
            const count = await productService.standardizeUnits();
            await fetchData();
            setMessage({ type: 'success', text: `Successfully standardized units for ${count} items.` });
            setTimeout(() => setMessage(null), 5000);
        } catch (err: any) {
            setMessage({ type: 'error', text: `Standardization failed: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleMigrateCategories = async () => {
        if (role !== 'owner') return;
        if (!window.confirm(
            'This will auto-assign categories to ALL products using their breadcrumb names.\n\n' +
            '• Products with names like "STEEL > MATTING > ..." will be assigned to the correct category\n' +
            '• Missing categories will be created automatically\n' +
            '• Product names will be cleaned (only the last segment kept)\n\n' +
            'This operation is safe and can be run multiple times. Proceed?'
        )) return;

        setLoading(true);
        setMessage({ type: 'success', text: 'Initializing migration...' });
        
        try {
            const result = await runProductMigration(activeBranchId, (current, total) => {
                setMessage({ type: 'success', text: `Migrating products: ${current} / ${total} processed...` });
            });
            
            await fetchData();
            const msg = `Migration complete: ${result.migrated} migrated, ${result.skipped} skipped` +
                (result.errors.length > 0 ? `, ${result.errors.length} errors` : '');
            
            setMessage({ type: result.errors.length > 0 ? 'error' : 'success', text: msg });
            
            if (result.errors.length > 0) {
                console.warn('Migration errors:', result.errors);
            }
            setTimeout(() => setMessage(null), 8000);
        } catch (err: any) {
            setMessage({ type: 'error', text: `Migration failed: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    const toggleL1 = (l1: string) => {
        const next = new Set(expandedL1s);
        const nextSubs = new Set(expandedSubCats);
        if (next.has(l1)) {
            next.delete(l1);
            // Also collapse all subcategories within this L1
            for (const key of nextSubs) {
                if (key.startsWith(l1 + ' > ')) nextSubs.delete(key);
            }
        } else {
            next.add(l1);
            // Also expand all subcategories within this L1
            const itemsInL1 = grouped[l1] || {};
            for (const subCat of Object.keys(itemsInL1)) {
                nextSubs.add(`${l1} > ${subCat}`);
            }
        }
        setExpandedL1s(next);
        setExpandedSubCats(nextSubs);
    };

    const toggleSubCat = (sc: string) => {
        const next = new Set(expandedSubCats);
        if (next.has(sc)) next.delete(sc);
        else next.add(sc);
        setExpandedSubCats(next);
    };

    // ── Hierarchy resolution helpers (matches Inventory.tsx, defensive) ──
    // Supabase self-referential joins can return arrays; normalize to single object
    const normCat = (raw: any): CategoryNode | null => {
        if (!raw) return null;
        if (Array.isArray(raw)) return raw[0] ?? null;
        return raw;
    };

    const resolveHierarchy = (p: Product): { master: string; subCat: string; catNames: string } => {
        const rawCat = normCat(p.category);
        if (!rawCat) {
            // Legacy fallback: breadcrumb name
            const parts = p.name.split(' > ');
            const master = parts[0]?.toUpperCase() || 'UNCATEGORIZED';
            const subCat = parts.slice(1, -1).join(' > ') || 'GENERAL';
            return { master, subCat, catNames: parts.join(' ').toLowerCase() };
        }

        const depth = rawCat.depth ?? 0;
        const parent = normCat(rawCat.parent);
        const grandparent = parent ? normCat(parent.parent) : null;

        let master = 'UNCATEGORIZED';
        let subCat = 'GENERAL';
        const namesParts: string[] = [rawCat.name || ''];

        if (depth === 2 && parent) {
            if (grandparent) {
                master = (grandparent.name || 'UNCATEGORIZED').toUpperCase();
            } else if (parent) {
                master = (parent.name || 'UNCATEGORIZED').toUpperCase();
            }
            subCat = `${parent.name || 'GENERAL'} - ${rawCat.name || ''}`;
            namesParts.push(parent.name || '', grandparent?.name || '');
        } else if (depth === 1 && parent) {
            master = (parent.name || 'UNCATEGORIZED').toUpperCase();
            subCat = rawCat.name || 'GENERAL';
            namesParts.push(parent.name || '');
        } else {
            master = (rawCat.name || 'UNCATEGORIZED').toUpperCase();
        }

        return { master, subCat, catNames: namesParts.join(' ').toLowerCase() };
    };

    const filtered = products.filter(p => {
        const searchTerms = searchTerm.toLowerCase().split(' ').filter(Boolean);
        const { master, catNames } = resolveHierarchy(p);
        const searchMatched = searchTerms.every(term =>
            p.name.toLowerCase().includes(term) ||
            (p.brand?.toLowerCase().includes(term) ?? false) ||
            catNames.includes(term)
        );
        const categoryMatched = categoryFilter === 'All' || master === categoryFilter;
        return searchMatched && categoryMatched;
    });

    const grouped = filtered.reduce((acc: Record<string, Record<string, Product[]>>, p) => {
        const { master, subCat } = resolveHierarchy(p);
        if (!acc[master]) acc[master] = {};
        if (!acc[master][subCat]) acc[master][subCat] = [];
        acc[master][subCat].push(p);
        return acc;
    }, {});

    const getMasterColor = (master: string) => {
        const m = master.toUpperCase();
        if (m.includes('STEEL')) return '#1E8449';
        if (m.includes('PLYWOOD')) return '#0369A1';
        if (m.includes('ELECTRICALS')) return '#7C3AED';
        if (m.includes('ROOFING')) return '#B45309';
        if (m.includes('LUMBER')) return '#8B4513';
        if (m.includes('PIPES AND FITTINGS')) return '#2563EB';
        if (m.includes('HARDWARE AND FASTENERS')) return '#4B5563';
        if (m.includes('CEMENT AND AGGREGATES')) return '#52525B';
        if (m.includes('DOORS AND FIXTURES')) return '#92400E';
        if (m.includes('PAINTS AND FINISHES')) return '#DB2777';
        if (m.includes('BOYSEN')) return '#F59E0B';
        return '#EF4444'; // Brand Red default
    };

    const CANONICAL_CATEGORIES = [
        'STEEL', 'PLYWOOD', 'ELECTRICALS', 'ROOFING', 'LUMBER',
        'PIPES AND FITTINGS', 'HARDWARE AND FASTENERS',
        'CEMENT AND AGGREGATES', 'DOORS AND FIXTURES', 'PAINTS AND FINISHES',
        'BOYSEN'
    ];

    const sortedL1s = Object.keys(grouped).sort();
    // Merge canonical categories with actual data groups so NO products are hidden
    const allCategoriesMerged = Array.from(new Set([...CANONICAL_CATEGORIES, ...sortedL1s])).sort();


    const stats = {
        totalSrpValue: products.reduce((acc, p) => acc + ((p.stock_available || 0) * (p.selling_price || 0)), 0),
        totalCostValue: products.reduce((acc, p) => acc + ((p.stock_available || 0) * (p.buying_price || 0)), 0),
        totalStock: products.reduce((acc, p) => acc + (p.stock_available || 0), 0)
    };

    // Compute SKU on-the-fly from category hierarchy
    const computeSku = (p: Product): string | null => {
        // If product already has a clean (non-breadcrumb) SKU, use it
        if (p.sku && !p.sku.includes(' > ') && p.sku !== p.name) return p.sku;
        const cat = normCat(p.category);
        let master = '', subcat = '';
        if (cat) {
            const parent = normCat(cat.parent);
            const grandparent = parent ? normCat(parent.parent) : null;
            if (cat.depth === 2 && grandparent) {
                master = grandparent.name || '';
                subcat = cat.name || '';
            } else if (cat.depth === 1 && parent) {
                master = parent.name || '';
                subcat = cat.name || '';
            } else {
                master = cat.name || '';
            }
        }
        if (!master) return null;
        return buildSkuPrefix(master, subcat || undefined, p.brand || undefined, p.name);
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
                        {searchTerm && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    if (categoryFilter === 'All') {
                                        setExpandedL1s(new Set());
                                        setExpandedSubCats(new Set());
                                    }
                                }}
                                className="text-text-muted hover:text-brand-red transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {role === 'owner' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleStandardizeUnits}
                                disabled={loading}
                                title="Standardize units based on item names (e.g. - 1 ELF -> ELF)"
                                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                Standardize Units
                            </button>
                            <button
                                onClick={handleMigrateCategories}
                                disabled={loading}
                                title="Auto-assign category hierarchy from breadcrumb product names"
                                className="flex items-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Database size={14} className={loading ? 'animate-spin' : ''} />
                                Migrate Categories
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-red transition-all active:scale-95 flex-shrink-0"
                            >
                                <Plus size={14} /> Add Product
                            </button>
                        </div>
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
                        onClick={() => { setCategoryFilter('All'); setExpandedL1s(new Set()); setExpandedSubCats(new Set()); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${categoryFilter === 'All' ? 'bg-brand-red text-white shadow-sm' : 'text-text-muted hover:bg-bg-subtle'}`}
                    >
                        All Categories
                    </button>
                    {allCategoriesMerged.map(cat => {
                        const mColor = getMasterColor(cat);
                        const isActive = categoryFilter === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all truncate border-l-2 ${
                                    isActive 
                                    ? 'text-white shadow-sm' 
                                    : 'text-text-muted hover:bg-bg-subtle border-transparent'
                                }`}
                                style={{ 
                                    backgroundColor: isActive ? mColor : undefined,
                                    borderLeftColor: isActive ? 'white' : mColor
                                }}
                            >
                                {cat}
                            </button>
                        );
                    })}

                </div>

                <div className="flex-1 space-y-8 pb-10">
                    <div className="xl:hidden flex items-center gap-3">
                        <div className="relative flex-1">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                            <select
                                className="w-full bg-bg-surface border border-border-muted rounded-xl pl-9 pr-4 py-2 text-xs font-black text-text-primary appearance-none shadow-sm outline-none focus:ring-2 focus:ring-brand-red/10"
                                value={categoryFilter}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCategoryFilter(val);
                                    if (val === 'All') {
                                        setExpandedL1s(new Set());
                                        setExpandedSubCats(new Set());
                                    }
                                }}
                            >
                                <option value="All">All Categories</option>
                                {allCategoriesMerged.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
                        </div>
                    ) : (categoryFilter !== 'All' ? sortedL1s : allCategoriesMerged).length > 0 ? (
                        (categoryFilter !== 'All' ? sortedL1s : allCategoriesMerged).map(l1 => {
                            const isL1Expanded = expandedL1s.has(l1) || searchTerm !== '' || categoryFilter !== 'All';
                            const mColor = getMasterColor(l1);
                            const itemsInL1 = grouped[l1] || {};
                            
                            return (
                                <div key={l1} className="space-y-3">
                                    <div
                                        onClick={() => toggleL1(l1)}
                                        className="flex items-center justify-between border-l-4 pl-4 py-2 bg-bg-subtle/30 rounded-r-xl cursor-pointer group hover:bg-bg-subtle/50 transition-all font-data"
                                        style={{ borderLeftColor: mColor }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className={`p-1 rounded-md transition-all ${isL1Expanded ? 'text-text-inverse shadow-sm' : 'bg-bg-surface text-text-muted border border-border-muted'}`}
                                                style={{ backgroundColor: isL1Expanded ? mColor : undefined }}
                                            >
                                                {isL1Expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </div>
                                            <h2 className="text-lg font-black tracking-tighter uppercase" style={{ color: mColor }}>{l1} PRICELIST</h2>
                                        </div>
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest pr-4">
                                            {Object.values(itemsInL1).flat().length} Items
                                        </span>
                                    </div>


                                    <div className={`grid grid-cols-1 gap-6 transition-all duration-300 ${isL1Expanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                        {Object.keys(itemsInL1).sort().map(subCat => {
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
                                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">{itemsInL1[subCat].length} items</span>
                                                    </div>

                                                    <div className={`overflow-x-auto transition-all duration-300 ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                        <table className="min-w-full">
                                                            <thead>
                                                                <tr className="bg-bg-surface border-b border-border-muted">
                                                                    <th className="px-3 py-2 text-left text-[8px] font-black uppercase tracking-widest text-brand-red/70 w-36">SKU</th>
                                                                    <th className="px-3 py-2 text-left text-[8px] font-black uppercase tracking-widest text-text-muted">Spec / Description</th>
                                                                    <th className="px-3 py-2 text-center text-[8px] font-black uppercase tracking-widest text-text-muted w-20">Brand</th>
                                                                    <th className="px-3 py-2 text-center text-[8px] font-black uppercase tracking-widest text-cyan-500 w-16">Stock</th>
                                                                    <th className="px-3 py-2 text-right text-[8px] font-black uppercase tracking-widest text-text-secondary bg-bg-subtle/20 w-24">SRP (₱)</th>
                                                                    <th className="px-3 py-2 text-right text-[8px] font-black uppercase tracking-widest text-brand-red bg-brand-red/5 w-28">WSP (Cost)</th>
                                                                    <th className="px-3 py-2 text-right text-[8px] font-black uppercase tracking-widest text-emerald-500 w-28">Total SRP</th>
                                                                    <th className="px-3 py-2 text-right text-[8px] font-black uppercase tracking-widest text-amber-500 w-28">Total Cost</th>
                                                                    <th className="px-3 py-2 text-center text-[8px] font-black uppercase tracking-widest text-orange-500 w-20">Low Stk</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border-muted/30 bg-bg-surface">
                                                                {grouped[l1][subCat].map((p) => {
                                                                    const sku = computeSku(p);
                                                                    const totalSrp = (p.stock_available || 0) * (p.selling_price || 0);
                                                                    const totalCost = (p.stock_available || 0) * (p.buying_price || 0);
                                                                    return (
                                                                    <tr key={p.id} className="hover:bg-bg-subtle/30 transition-colors group">
                                                                        {/* SKU */}
                                                                        <td className="px-3 py-2.5">
                                                                            {sku ? (
                                                                                <span className="text-[9px] font-mono font-bold text-brand-red/70 uppercase tracking-wider">{sku}</span>
                                                                            ) : (
                                                                                <span className="text-[9px] text-text-muted">—</span>
                                                                            )}
                                                                        </td>
                                                                        {/* Spec / Description */}
                                                                        <td className="px-3 py-2.5">
                                                                            <p className="text-[11px] font-black text-text-primary tracking-tight leading-tight uppercase">
                                                                                {p.name.split(' > ').slice(-1)[0]}
                                                                            </p>
                                                                        </td>
                                                                        {/* Brand */}
                                                                        <td className="px-3 py-2.5 text-center">
                                                                            {p.brand && (
                                                                                <span className="inline-flex px-1.5 py-0.5 rounded bg-bg-subtle text-[7px] font-black text-text-muted uppercase tracking-widest border border-border-muted/50">
                                                                                    {p.brand}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        {/* Stock (editable) */}
                                                                        <td className="px-3 py-2.5 text-center">
                                                                            {editingId?.id === p.id && editingId?.field === 'stock' ? (
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <input
                                                                                        autoFocus
                                                                                        type="number"
                                                                                        className="w-16 bg-bg-surface border-2 border-cyan-500 rounded-lg px-2 py-1 text-xs font-black text-center outline-none font-data text-text-primary"
                                                                                        value={editValue}
                                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSavePrice(p.id, 'stock');
                                                                                            if (e.key === 'Escape') setEditingId(null);
                                                                                        }}
                                                                                    />
                                                                                    <button onClick={() => handleSavePrice(p.id, 'stock')} className="p-1 bg-cyan-500 text-white rounded"><Save size={10} /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    onClick={() => { setEditingId({ id: p.id, field: 'stock' }); setEditValue((p.stock_available || 0).toString()); }}
                                                                                    className="group/stock flex items-center justify-center gap-1 cursor-pointer hover:bg-cyan-500/10 rounded-lg py-1 transition-colors"
                                                                                >
                                                                                    <span className="text-[11px] font-black text-cyan-500 font-data">{p.stock_available || 0}</span>
                                                                                    <Edit size={8} className="text-cyan-500/30 opacity-0 group-hover/stock:opacity-100" />
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        {/* SRP (editable) */}
                                                                        <td className="px-3 py-2.5 text-right bg-bg-subtle/10">
                                                                            {editingId?.id === p.id && editingId?.field === 'srp' ? (
                                                                                <div className="flex items-center justify-end gap-1">
                                                                                    <input
                                                                                        autoFocus
                                                                                        className="w-20 bg-bg-surface border-2 border-text-primary rounded-lg px-2 py-1 text-[10px] font-black text-right outline-none font-data text-text-primary"
                                                                                        value={editValue}
                                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSavePrice(p.id, 'srp');
                                                                                            if (e.key === 'Escape') setEditingId(null);
                                                                                        }}
                                                                                    />
                                                                                    <button onClick={() => handleSavePrice(p.id, 'srp')} className="p-1 bg-text-primary text-text-inverse rounded"><Save size={10} /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    onClick={() => { setEditingId({ id: p.id, field: 'srp' }); setEditValue((p.selling_price ?? 0).toString()); }}
                                                                                    className="group/price flex items-center justify-end gap-1 cursor-pointer hover:text-text-primary transition-colors"
                                                                                >
                                                                                    <span className="text-[10px] font-black text-text-secondary font-data tracking-tight">
                                                                                        ₱{(p.selling_price ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                                                    </span>
                                                                                    <Edit size={8} className="text-text-muted opacity-0 group-hover/price:opacity-100" />
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        {/* WSP / Cost Code (editable) */}
                                                                        <td className="px-3 py-2.5 text-right bg-brand-red/5">
                                                                            {editingId?.id === p.id && editingId?.field === 'wsp' ? (
                                                                                <div className="flex items-center justify-end gap-1">
                                                                                    <input
                                                                                        autoFocus
                                                                                        className="w-20 bg-bg-surface border-2 border-brand-red rounded-lg px-2 py-1 text-[10px] font-black text-right outline-none font-data text-text-primary"
                                                                                        placeholder="Price or Code"
                                                                                        value={editValue}
                                                                                        onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSavePrice(p.id, 'wsp');
                                                                                            if (e.key === 'Escape') setEditingId(null);
                                                                                        }}
                                                                                    />
                                                                                    <button onClick={() => handleSavePrice(p.id, 'wsp')} className="p-1 bg-brand-red text-white rounded"><Save size={10} /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    onClick={() => { setEditingId({ id: p.id, field: 'wsp' }); setEditValue(p.buying_price?.toString() || '0'); }}
                                                                                    className="group/wsp flex items-center justify-end gap-2 cursor-pointer"
                                                                                >
                                                                                    <div className="text-right">
                                                                                        <span className="text-[11px] font-black text-brand-red font-data tracking-tight block leading-none">
                                                                                            {showWsp
                                                                                                ? `₱${(p.buying_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                                                                                : encodePrice(p.buying_price)}
                                                                                        </span>
                                                                                        {!showWsp && <span className="text-[6px] font-black text-red-300 uppercase tracking-tighter block mt-0.5">CODE</span>}
                                                                                    </div>
                                                                                    <Edit size={8} className="text-red-200 opacity-0 group-hover/wsp:opacity-100" />
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        {/* Total SRP Value */}
                                                                        <td className="px-3 py-2.5 text-right">
                                                                            <span className="text-[10px] font-black text-emerald-500 font-data tracking-tight">
                                                                                ₱{totalSrp.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                                            </span>
                                                                        </td>
                                                                        {/* Total Cost Value */}
                                                                        <td className="px-3 py-2.5 text-right">
                                                                            <span className="text-[10px] font-black text-amber-500 font-data tracking-tight">
                                                                                {showWsp
                                                                                    ? `₱${totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                                                                    : encodePrice(totalCost)}
                                                                            </span>
                                                                        </td>
                                                                        {/* Low Stock Trigger (editable) */}
                                                                        <td className="px-3 py-2.5 text-center">
                                                                            {editingId?.id === p.id && editingId?.field === 'trigger' ? (
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <input
                                                                                        autoFocus
                                                                                        type="number"
                                                                                        className="w-14 bg-bg-surface border-2 border-orange-500 rounded-lg px-1 py-1 text-[10px] font-black text-center outline-none font-data text-text-primary"
                                                                                        value={editValue}
                                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSavePrice(p.id, 'trigger');
                                                                                            if (e.key === 'Escape') setEditingId(null);
                                                                                        }}
                                                                                    />
                                                                                    <button onClick={() => handleSavePrice(p.id, 'trigger')} className="p-1 bg-orange-500 text-white rounded"><Save size={10} /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    onClick={() => { setEditingId({ id: p.id, field: 'trigger' }); setEditValue(p.low_stock_threshold?.toString() || '10'); }}
                                                                                    className="group/trigger flex items-center justify-center gap-1 cursor-pointer hover:bg-orange-500/10 rounded-lg py-1 transition-colors"
                                                                                >
                                                                                    <span className="text-[10px] font-black text-orange-500 font-data">{p.low_stock_threshold || 10}</span>
                                                                                    <Edit size={8} className="text-orange-500/30 opacity-0 group-hover/trigger:opacity-100" />
                                                                                </div>
                                                                            )}
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
