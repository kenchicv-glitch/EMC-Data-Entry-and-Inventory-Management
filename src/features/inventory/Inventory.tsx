import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase';
import { useAuth } from '../../shared/hooks/useAuth';
import { useBranch } from '../../shared/lib/BranchContext';
import { ChevronDown, Plus, Search, Edit, Trash2, Package, Filter, FileUp, PackageSearch } from 'lucide-react';
import ProductModal from './components/ProductModal';
import { startOfDay } from 'date-fns';
import { parseExcelFile } from '../../shared/lib/ExcelImportService';
import type { RawProductData } from '../../shared/lib/ExcelImportService';
import { exportInventoryToExcel } from '../../shared/lib/exportUtils';

interface Product {
    id: string;
    name: string;
    stock_available: number;
    stock_reserved: number;
    stock_damaged: number;
    low_stock_threshold?: number;
    selling_price?: number;
    buying_price?: number;
    unit?: string;
    created_at: string;
}

export default function Inventory() {
    const { role } = useAuth();
    const { activeBranchId } = useBranch();
    const navigate = useNavigate();
    const location = useLocation();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [initialModalData, setInitialModalData] = useState<{ l1?: string; l2?: string; l3?: string } | undefined>();
    const [movements, setMovements] = useState<Record<string, { sales: number, purchases: number, refunds: number }>>({});
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());

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

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm(`Import products from "${file.name}"? This will add or update items. Existing items will have their stock reset to 0 as requested.`)) {
            e.target.value = '';
            return;
        }

        setLoading(true);
        try {
            console.log('Using Import Logic Version: 1.2 (Explicit PK Conflict)');
            const productsToUpsert = await parseExcelFile(file);

            if (productsToUpsert.length === 0) {
                alert('No valid product data found. Please ensure it follows the Price List format.');
                return;
            }

            // Fetch current products for this branch to check for existing names (case-insensitive normalization)
            let existingQuery = supabase.from('products').select('id, name, stock_available');
            if (activeBranchId) {
                existingQuery = existingQuery.eq('branch_id', activeBranchId);
            }
            const { data: existingProducts, error: fetchError } = await existingQuery;
            if (fetchError) throw fetchError;

            // Normalize existing products into a map: NAME -> { id, stock }
            const existingMap = new Map();
            (existingProducts || []).forEach(p => {
                const upperName = p.name.toUpperCase();
                if (existingMap.has(upperName)) {
                    // This case handles existing duplicates in the DB if any
                    existingMap.get(upperName).stock += (p.stock_available || 0);
                    // Keep the first ID as primary
                } else {
                    existingMap.set(upperName, { id: p.id, stock: p.stock_available || 0 });
                }
            });

            // Normalize and group products from Excel (sums up duplicate names in the upload itself)
            const consolidateUpload = new Map<string, RawProductData>();
            productsToUpsert.forEach(item => {
                const name = item.name.toUpperCase();
                if (consolidateUpload.has(name)) {
                    const existing = consolidateUpload.get(name)!;
                    existing.stock_available += (item.stock_available || 0);
                } else {
                    consolidateUpload.set(name, { ...item, name });
                }
            });

            const updates = [];
            const inserts = [];

            for (const [name, item] of consolidateUpload) {
                if (existingMap.has(name)) {
                    const match = existingMap.get(name);
                    // 100-unit standard: if current < 100, set to 100. else keep current.
                    const currentStock = match.stock || 0;
                    const finalStock = currentStock < 100 ? 100 : currentStock;
                    
                    updates.push({
                        id: match.id,
                        ...item,
                        stock_available: finalStock
                    });
                } else {
                    inserts.push({
                        ...item,
                        sku: name,
                        stock_available: 100, // New items always 100
                        branch_id: activeBranchId
                    });
                }
            }

            // Perform batch operations with explicit onConflict for updates
            if (updates.length > 0) {
                const { error: updateError } = await supabase.from('products').upsert(updates, { onConflict: 'id' });
                if (updateError) throw updateError;
            }

            if (inserts.length > 0) {
                const { error: insertError } = await supabase.from('products').insert(inserts);
                if (insertError) throw insertError;
            }

            alert(`Successfully imported/updated ${productsToUpsert.length} products (${updates.length} updated, ${inserts.length} new).`);
            fetchData();
        } catch (err: unknown) {
            console.error('Import error:', err);
            const msg = err instanceof Error ? err.message : JSON.stringify(err);
            alert('Failed to import: ' + msg);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };
    
    const handleExportExcel = async () => {
        setLoading(true);
        try {
            // Find current branch name
            const { data: branchData } = await supabase.from('branches').select('name').eq('id', activeBranchId).single();
            const branchName = branchData?.name || 'Current Branch';
            await exportInventoryToExcel(products, branchName);
        } catch (err) {
            console.error('Export error:', err);
            alert('Failed to export inventory.');
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        let productsQuery = supabase.from('products').select('*').order('name');
        if (activeBranchId) {
            productsQuery = productsQuery.eq('branch_id', activeBranchId);
        }
        const { data: productsData, error: productsError } = await productsQuery;
        
        if (productsError) console.error('Error fetching inventory:', productsError);
        else setProducts(productsData || []);

        const todayStart = startOfDay(new Date()).toISOString();
        
        let salesQuery = supabase.from('sales').select('product_id, quantity').gte('date', todayStart);
        let purchasesQuery = supabase.from('purchases').select('product_id, quantity').gte('date', todayStart).eq('status', 'received');
        let refundsQuery = supabase.from('customer_refunds').select('product_id, quantity').gte('date', todayStart);

        if (activeBranchId) {
            salesQuery = salesQuery.eq('branch_id', activeBranchId);
            purchasesQuery = purchasesQuery.eq('branch_id', activeBranchId);
            refundsQuery = refundsQuery.eq('branch_id', activeBranchId);
        }

        const [salesRes, purchasesRes, refundsRes] = await Promise.all([
            salesQuery,
            purchasesQuery,
            refundsQuery
        ]);

        const movMap: Record<string, { sales: number, purchases: number, refunds: number }> = {};

        salesRes.data?.forEach(s => {
            const key = s.product_id;
            movMap[key] = { ...movMap[key] || { sales: 0, purchases: 0, refunds: 0 }, sales: (movMap[key]?.sales || 0) + s.quantity };
        });
        purchasesRes.data?.forEach(p => {
            const key = p.product_id;
            movMap[key] = { ...movMap[key] || { sales: 0, purchases: 0, refunds: 0 }, purchases: (movMap[key]?.purchases || 0) + p.quantity };
        });
        refundsRes.data?.forEach(r => {
            const key = r.product_id;
            movMap[key] = { ...movMap[key] || { sales: 0, purchases: 0, refunds: 0 }, refunds: (movMap[key]?.refunds || 0) + r.quantity };
        });

        setMovements(movMap);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [activeBranchId]);

    // Handle global search focus from redirection
    useEffect(() => {
        if ((location.state as any)?.focusSearch) {
            const searchEl = document.getElementById('inventory-global-search') as HTMLInputElement | null;
            if (searchEl) {
                searchEl.focus();
                // Clear state
                navigate(location.pathname, { replace: true, state: {} });
            }
        }
    }, [location.state, navigate, location.pathname]);

    const naturalSort = (a: string, b: string) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this product?')) return;
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else fetchData();
    };

    const handleBulkDelete = async (filter: { master?: string, category?: string, subCat?: string }) => {
        let label = '';
        if (filter.subCat) label = `Sub-category: ${filter.subCat}`;
        else if (filter.category) label = `Category: ${filter.category}`;
        else if (filter.master) label = `Master Category: ${filter.master}`;

        if (!window.confirm(`STRICT WARNING: This will permanently delete ALL products in "${label}" for this branch. Proceed?`)) return;

        setLoading(true);
        try {
            let query = supabase.from('products').delete();
            if (activeBranchId) query = query.eq('branch_id', activeBranchId);
            
            // Construct name pattern for deletion
            let pattern = '';
            if (filter.subCat) pattern = `${filter.master} > ${filter.category} > ${filter.subCat} > %`;
            else if (filter.category) pattern = `${filter.master} > ${filter.category} > %`;
            else if (filter.master) pattern = `${filter.master} > %`;

            const { error } = await query.ilike('name', pattern);
            if (error) throw error;
            
            fetchData();
        } catch (err) {
            console.error('Bulk delete error:', err);
            alert('Bulk delete failed.');
        } finally {
            setLoading(false);
        }
    };

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const category = p.name.split(' > ')[0] || 'Uncategorized';
        const matchesCategory = categoryFilter === 'All' || category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    useEffect(() => {
        if (searchTerm !== '' || categoryFilter !== 'All') {
            const newL1s = new Set(expandedL1s);
            const newCats = new Set(expandedCategories);
            
            filtered.forEach(p => {
                const parts = p.name.split(' > ');
                if (parts[0]) {
                    newL1s.add(parts[0]);
                    if (parts[1]) {
                        newCats.add(`${parts[0]} > ${parts[1]}`);
                        if (parts[2]) {
                            newCats.add(`${parts[0]} > ${parts[1]} > ${parts[2]}`);
                        }
                    }
                }
            });
            
            setExpandedL1s(newL1s);
            setExpandedCategories(newCats);
        }
    }, [searchTerm, categoryFilter, products.length > 0]);

    const getMasterColor = (master: string) => {
        const m = master.toUpperCase();
        if (m.includes('PLYWOOD')) return '#0369A1';
        if (m.includes('STEEL')) return '#1E8449';
        if (m.includes('ELECTRICAL')) return '#7C3AED';
        if (m.includes('ROOFING')) return '#B45309';
        return '#EF4444'; // Brand Red default
    };

    const groupedProducts = filtered.reduce((acc: Record<string, Record<string, Record<string, Product[]>>>, p) => {
        const parts = p.name.split(' > ');
        const master = parts[0] || 'UNCATEGORIZED';
        const category = parts[1] || 'GENERAL';
        const subCat = parts[2] || 'GENERAL';
        
        if (!acc[master]) acc[master] = {};
        if (!acc[master][category]) acc[master][category] = {};
        if (!acc[master][category][subCat]) acc[master][category][subCat] = [];
        
        acc[master][category][subCat].push(p);
        return acc;
    }, {});

    const sortedL1s = Object.keys(groupedProducts).sort(naturalSort);
    const allCategories = Array.from(new Set(products.map(p => p.name.split(' > ')[0] || 'Uncategorized'))).sort(naturalSort);

    const getStockStatus = (stock: number, threshold: number = 10) => {
        if (stock === 0) return { label: 'Out of Stock', cls: 'badge-out-of-stock' };
        if (stock <= threshold) return { label: 'Low Stock', cls: 'badge-low-stock' };
        return { label: 'In Stock', cls: 'badge-in-stock' };
    };

    const stats = {
        totalSKUs: products.length,
        lowStock: products.filter(p => p.stock_available > 0 && p.stock_available <= (p.low_stock_threshold || 10)).length,
        outOfStock: products.filter(p => p.stock_available === 0).length,
        totalValue: role === 'owner' ? products.reduce((acc, p) => acc + (p.stock_available * (p.selling_price || 0)), 0) : null
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-none">
            {/* Header Title Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-text-primary tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center shadow-red"><PackageSearch className="text-white" size={24} /></div>
                        Inventory Dashboard
                    </h1>
                    <p className="text-sm text-text-secondary mt-1 font-medium">Monitor stock levels, manage categories, and track movements</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-surface border border-border-default text-text-secondary px-5 py-3 rounded-2xl font-bold text-sm hover:bg-subtle transition-all shadow-sm"
                    >
                        <FileUp size={18} className="text-emerald-500" /> EXPORT
                    </button>
                    <label className="flex items-center gap-2 bg-surface border border-border-default text-text-secondary px-5 py-3 rounded-2xl font-bold text-sm hover:bg-subtle transition-all shadow-sm cursor-pointer">
                        <FileUp size={18} className="text-blue-500" /> IMPORT
                        <input type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} />
                    </label>
                    {role === 'owner' && (
                        <button onClick={() => { setSelectedProduct(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red active:scale-95">
                            <Plus size={18} /> ADD PRODUCT
                        </button>
                    )}
                </div>
            </div>

            {/* Action Row */}
            <div className="flex flex-col sm:flex-row gap-4 relative">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={18} />
                    <input 
                        id="inventory-global-search"
                        type="text" 
                        placeholder="Search inventory products..." 
                        className="w-full pl-12 pr-4 py-3 bg-surface border border-border-default rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none transition-all shadow-sm placeholder:text-text-muted text-text-primary" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Stats Sidebar */}
                <div className="flex-shrink-0">
                    <div className="sticky top-6 space-y-4">
                        <div className="bg-surface p-6 rounded-3xl border border-border-default shadow-sm overflow-hidden relative w-full lg:w-64">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/5 rounded-full -mr-12 -mt-12" />
                            <h3 className="text-[10px] font-black text-text-primary border-b border-border-default pb-3 mb-4 uppercase tracking-[0.2em]">Summary Statistics</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Total SKUs</p>
                                        <p className="text-lg font-black text-text-primary font-data">{stats.totalSKUs}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Low Stock</p>
                                        <p className="text-lg font-black text-amber-500 font-data">{stats.lowStock}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Out Stock</p>
                                        <p className="text-lg font-black text-brand-red font-data">{stats.outOfStock}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Daily Delta</p>
                                        <p className="text-lg font-black text-blue-500 font-data">{Object.values(movements).reduce((a, m) => a + (m.purchases - m.sales + m.refunds), 0)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Existing Categories Sidebar */}
                        <div className="hidden lg:block bg-surface p-4 rounded-3xl border border-border-default shadow-sm overflow-y-auto max-h-[calc(100vh-400px)] custom-scrollbar w-64">
                            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest px-2 mb-3 px-3 pb-2 border-b border-border-default">Quick Categories</p>
                            <div className="space-y-1 mt-2">
                                <button onClick={() => setCategoryFilter('All')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${categoryFilter === 'All' ? 'bg-brand-red text-white shadow-sm' : 'text-text-secondary hover:bg-subtle'}`}>All Items</button>
                                {allCategories.map(cat => (
                                    <button key={cat} onClick={() => setCategoryFilter(cat)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all truncate ${categoryFilter === cat ? 'bg-brand-red text-white shadow-sm' : 'text-text-secondary hover:bg-subtle'}`}>{cat}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0 space-y-6">
                    <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                            <select className="w-full bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2 text-xs font-black text-text-primary appearance-none shadow-sm outline-none focus:ring-2 focus:ring-brand-red/10" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                                <option value="All">All Categories</option>
                                {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-8">
                        {loading ? ([1, 2, 3].map(i => <div key={i} className="bento-card p-8 skeleton h-20" />)) : sortedL1s.length === 0 ? (
                            <div className="bg-surface rounded-3xl border border-border-default py-20 text-center shadow-sm">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center"><Package size={20} className="text-text-muted" /></div>
                                    <p className="text-sm text-text-secondary font-medium">No products found</p>
                                </div>
                            </div>
                        ) : (
                            sortedL1s.map(master => {
                                const isMasterExpanded = expandedL1s.has(master);
                                const categories = groupedProducts[master];
                                const mColor = getMasterColor(master);
                                return (
                                    <div key={master} className="space-y-4">
                                        <div 
                                            className="flex items-center justify-between border-l-4 pl-4 py-2 bg-brand-red/5 rounded-r-xl cursor-pointer" 
                                            style={{ borderLeftColor: mColor }}
                                            onClick={() => toggleL1(master)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-xl font-black text-text-primary tracking-tighter uppercase" style={{ color: mColor }}>{master}</h2>
                                                <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-black text-text-primary uppercase tracking-widest">
                                                    {Object.values(categories).reduce((acc, cat) => acc + Object.values(cat).flat().length, 0)} items
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {role === 'owner' && (
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleBulkDelete({ master }); }}
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted/50 hover:text-brand-red hover:bg-brand-red/10 transition-all"
                                                            title="Delete Master Category"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); setInitialModalData({ l1: master }); setSelectedProduct(null); setIsModalOpen(true); }} className="flex items-center gap-1.5 text-[10px] font-black bg-text-primary text-text-inverse px-3 py-1.5 rounded-lg hover:bg-brand-red transition-all uppercase tracking-widest"><Plus size={12} /> ADD UNIT</button>
                                                    </div>
                                                )}
                                                <div className={`transition-transform duration-300 ${isMasterExpanded ? 'rotate-180' : ''}`}><ChevronDown size={20} className="text-text-muted" /></div>
                                            </div>
                                        </div>

                                        {isMasterExpanded && (
                                            <div className="space-y-6 ml-4 border-l-2 border-border-default/50 pl-6">
                                                {Object.keys(categories).sort(naturalSort).map(catName => {
                                                    const subCats = categories[catName];
                                                    const isCatExpanded = expandedCategories.has(`${master} > ${catName}`);
                                                    return (
                                                        <div key={catName} className="space-y-3">
                                                            <div className="flex items-center justify-between group">
                                                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleCategory(`${master} > ${catName}`)}>
                                                                    <div className={`p-1 rounded transition-colors ${isCatExpanded ? 'bg-brand-red text-white' : 'bg-subtle text-text-muted'}`}>
                                                                        <ChevronDown size={12} className={`transition-transform ${isCatExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                                    </div>
                                                                    <h3 className="text-sm font-black text-text-primary uppercase tracking-tight group-hover:text-brand-red transition-colors">{catName}</h3>
                                                                    <span className="text-[10px] font-bold text-text-secondary">({Object.values(subCats).flat().length})</span>
                                                                </div>
                                                                {role === 'owner' && (
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleBulkDelete({ master, category: catName }); }}
                                                                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted/50 hover:text-brand-red transition-all"
                                                                        title="Delete Category"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {isCatExpanded && (
                                                                <div className="grid grid-cols-1 gap-4 ml-2">
                                                                    {Object.keys(subCats).sort(naturalSort).map((subName: string) => {
                                                                        const items: Product[] = subCats[subName];
                                                                        const isSubExpanded = expandedCategories.has(`${master} > ${catName} > ${subName}`);
                                                                        return (
                                                                            <div key={subName} className="bg-surface rounded-3xl border border-border-default overflow-hidden shadow-sm">
                                                                                <div onClick={() => toggleCategory(`${master} > ${catName} > ${subName}`)} className="px-5 py-2.5 bg-subtle/30 flex items-center justify-between cursor-pointer hover:bg-subtle transition-colors group/sub">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <h4 className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{subName}</h4>
                                                                                            <span className="text-[9px] font-bold text-text-muted">{items.length} units</span>
                                                                                        </div>
                                                                                        {role === 'owner' && (
                                                                                            <button 
                                                                                                onClick={(e) => { e.stopPropagation(); handleBulkDelete({ master, category: catName, subCat: subName }); }}
                                                                                                className="opacity-0 group-hover/sub:opacity-100 p-1 text-text-muted/50 hover:text-brand-red transition-all"
                                                                                                title="Delete Sub-category"
                                                                                            >
                                                                                                <Trash2 size={12} />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                    <ChevronDown size={14} className={`text-text-muted transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                                                                                </div>
                                                                                
                                                                                {isSubExpanded && (
                                                                                    <div className="overflow-x-auto">
                                                                                        <table className="min-w-full">
                                                                                            <thead>
                                                                                                <tr className="bg-subtle/20 border-b border-border-default">
                                                                                                    <th className="px-4 py-2 text-left text-[9px] font-black uppercase tracking-widest text-text-muted w-24">Status</th>
                                                                                                    <th className="px-4 py-2 text-left text-[9px] font-black uppercase tracking-widest text-text-muted">Item Description</th>
                                                                                                    <th className="px-4 py-2 text-center text-[9px] font-black uppercase tracking-widest text-text-muted w-20">Unit</th>
                                                                                                    <th className="px-4 py-2 text-right text-[9px] font-black uppercase tracking-widest text-text-muted w-24">WSP (₱)</th>
                                                                                                    <th className="px-4 py-2 text-right text-[9px] font-black uppercase tracking-widest text-text-muted w-24">SRP (₱)</th>
                                                                                                    <th className="px-4 py-2 text-center text-[9px] font-black uppercase tracking-widest text-text-muted w-24">Stock</th>
                                                                                                    <th className="px-4 py-2 text-right text-[9px] font-black uppercase tracking-widest text-text-muted w-20">Actions</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody className="divide-y divide-subtle">
                                                                                                {items.map(product => {
                                                                                                    const status = getStockStatus(product.stock_available, product.low_stock_threshold);
                                                                                                    return (
                                                                                                        <tr key={product.id} className="hover:bg-subtle/50 transition-colors group">
                                                                                                            <td className="px-4 py-2">
                                                                                                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase ${status.cls}`}>{status.label}</span>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2">
                                                                                                                <p className="text-[11px] font-black text-text-primary uppercase">{product.name.split(' > ').slice(-1)[0]}</p>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-center">
                                                                                                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{product.unit || 'pc'}</span>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-right">
                                                                                                                <span className="text-[11px] font-bold font-data text-text-secondary">
                                                                                                                    {product.buying_price ? `₱${product.buying_price.toLocaleString()}` : '-'}
                                                                                                                </span>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-right">
                                                                                                                <span className="text-[11px] font-black font-data text-brand-red">
                                                                                                                    ₱{(product.selling_price || 0).toLocaleString()}
                                                                                                                </span>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-center">
                                                                                                                <span className="text-[11px] font-bold font-data text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">{product.stock_available}</span>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-right">
                                                                                                                <div className="flex justify-end gap-1">
                                                                                                                    <button onClick={() => { setSelectedProduct(product); setIsModalOpen(true); }} className="p-1 text-text-muted/50 hover:text-text-primary transition-all"><Edit size={14} /></button>
                                                                                                                    {role === 'owner' && <button onClick={() => handleDelete(product.id)} className="p-1 text-text-muted/50 hover:text-brand-red transition-all"><Trash2 size={14} /></button>}
                                                                                                                </div>
                                                                                                            </td>
                                                                                                        </tr>
                                                                                                    );
                                                                                                })}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <ProductModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setInitialModalData(undefined); }} onSuccess={fetchData} product={selectedProduct} role={role} initialData={initialModalData} />
                </div>
            </div>
        </div>
    );
}


