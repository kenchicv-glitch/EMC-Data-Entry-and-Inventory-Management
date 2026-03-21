import { useEffect, useState, useMemo, useDeferredValue } from 'react';
import { normalizeUnit } from '../../shared/lib/unitUtils';
import type { Product } from './types/product';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';
import { useBranch } from '../../shared/hooks/useBranch';
import { useProducts } from './hooks/useProducts';
import { 
    ChevronDown, Plus, Search, Edit, Trash2, Package, Filter, SlidersHorizontal,
    FileUp, PackageSearch, X, RefreshCw
} from 'lucide-react';
import ProductModal from './components/ProductModal';
import TransferRequestModal from './components/TransferRequestModal';
import { parseExcelFile } from '../../shared/lib/ExcelImportService';
import { exportInventoryToExcel } from '../../shared/lib/exportUtils';
import { supabase } from '../../shared/lib/supabase';
import { formatCurrency, formatNumber } from '../../shared/lib/formatUtils';
import { ReportService } from '../reports/services/reportService';


export default function Inventory() {
    const { role } = useAuth();
    const { activeBranchId } = useBranch();
    const navigate = useNavigate();
    const location = useLocation();
    
    const { 
        products, 
        movements, 
        isLoading: loading, 
        deleteProduct, 
        bulkDelete, 
        importProducts, 
        refresh,
        isImporting,
        isBulkDeleting 
    } = useProducts();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [transferProduct, setTransferProduct] = useState<Product | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [initialModalData, setInitialModalData] = useState<{ l1?: string; l2?: string; l3?: string } | undefined>();
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());

    const toggleCategory = (cat: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(cat)) {
            newExpanded.delete(cat);
        } else {
            newExpanded.add(cat);
            // AUTO-EXPAND Level 3 Sub-categories if expanding a Level 2 Category
            const parts = cat.split(' > ');
            if (parts.length === 2) {
                const master = parts[0];
                const category = parts[1];
                const subCats = groupedProducts[master]?.[category] || {};
                Object.keys(subCats).forEach(sub => {
                    if (sub !== 'GENERAL') {
                        newExpanded.add(`${master} > ${category} > ${sub}`);
                    }
                });
            }
        }
        setExpandedCategories(newExpanded);
    };

    const toggleL1 = (l1: string) => {
        const newExpandedL1s = new Set(expandedL1s);
        const newExpandedCats = new Set(expandedCategories);
        
        if (newExpandedL1s.has(l1)) {
            newExpandedL1s.delete(l1);
        } else {
            newExpandedL1s.add(l1);
            // AUTO-EXPAND recursively for all children of this Master category
            const categories = groupedProducts[l1] || {};
            Object.keys(categories).forEach(cat => {
                const catPath = `${l1} > ${cat}`;
                newExpandedCats.add(catPath);
                
                // Deep expand Level 3 (Sub-categories)
                const subCats = categories[cat] || {};
                Object.keys(subCats).forEach(sub => {
                    if (sub !== 'GENERAL') {
                        newExpandedCats.add(`${catPath} > ${sub}`);
                    }
                });
            });
        }
        setExpandedL1s(newExpandedL1s);
        setExpandedCategories(newExpandedCats);
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm(`Import products from "${file.name}"? This will add or update items. Existing items will have their stock reset to 100 if below 100.`)) {
            e.target.value = '';
            return;
        }

        try {
            const productsToUpsert = await parseExcelFile(file);
            if (productsToUpsert.length === 0) {
                alert('No valid product data found.');
                return;
            }

            const result = await importProducts(productsToUpsert);
            alert(`Successfully imported/updated ${productsToUpsert.length} products (${result.updates} updated, ${result.inserts} new).`);
        } catch (err: any) {
            alert('Failed to import: ' + err.message);
        } finally {
            e.target.value = '';
        }
    };
    
    const handleExportExcel = async () => {
        try {
            const { data: branchData } = await supabase.from('branches').select('name').eq('id', activeBranchId).single();
            const branchName = branchData?.name || 'Current Branch';
            await exportInventoryToExcel(products as any, branchName);
        } catch (err) {
            console.error('Export error:', err);
            alert('Failed to export inventory.');
        }
    };

    // Handle global search focus from redirection
    useEffect(() => {
        const state = location.state as { focusSearch?: boolean } | null;
        if (state?.focusSearch) {
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
        try {
            await deleteProduct(id);
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const handleBulkDelete = async (filter: { master?: string, category?: string, subCat?: string }) => {
        let label = '';
        if (filter.subCat) label = `Sub-category: ${filter.subCat}`;
        else if (filter.category) label = `Category: ${filter.category}`;
        else if (filter.master) label = `Master Category: ${filter.master}`;

        if (!window.confirm(`STRICT WARNING: This will permanently delete ALL products in "${label}" for this branch. Proceed?`)) return;

        try {
            let pattern = '';
            if (filter.subCat) pattern = `${filter.master} > ${filter.category} > ${filter.subCat} > %`;
            else if (filter.category) pattern = `${filter.master} > ${filter.category} > %`;
            else if (filter.master) pattern = `${filter.master} > %`;

            await bulkDelete(pattern);
        } catch (err) {
            console.error('Bulk delete error:', err);
            alert('Bulk delete failed.');
        }
    };


    const [filterOptions, setFilterOptions] = useState({
        noWsp: false,
        noSrp: false,
        units: [] as string[],
        stockStatus: 'all' as 'all' | 'out' | 'low'
    });
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const toggleUnit = (unit: string) => {
        setFilterOptions(prev => ({
            ...prev,
            units: prev.units.includes(unit) 
                ? prev.units.filter(u => u !== unit) 
                : [...prev.units, unit]
        }));
    };

    const activeFilterCount = (filterOptions.noWsp ? 1 : 0) + 
                             (filterOptions.noSrp ? 1 : 0) + 
                             (filterOptions.units.length) + 
                             (filterOptions.stockStatus !== 'all' ? 1 : 0);

    const resetFilters = () => {
        setSearchTerm('');
        setCategoryFilter('All');
        setFilterOptions({
            noWsp: false,
            noSrp: false,
            units: [],
            stockStatus: 'all'
        });
        setExpandedL1s(new Set());
        setExpandedCategories(new Set());
    };


    const deferredSearchTerm = useDeferredValue(searchTerm);

    const filtered = useMemo(() => products.filter(p => {
        const searchTerms = deferredSearchTerm.toLowerCase().split(' ').filter(Boolean);
        const matchesSearch = searchTerms.every(term => 
            p.name.toLowerCase().includes(term) || 
            (p.brand?.toLowerCase().includes(term) ?? false)
        );
        const category = p.name.split(' > ')[0] || 'Uncategorized';
        const matchesCategory = categoryFilter === 'All' || category === categoryFilter;

        // NEW FILTERS
        const matchesNoWsp = !filterOptions.noWsp || !p.buying_price || p.buying_price === 0;
        const matchesNoSrp = !filterOptions.noSrp || !p.selling_price || p.selling_price === 0;
        const matchesUnit = filterOptions.units.length === 0 || filterOptions.units.includes(normalizeUnit(p.unit));
        const matchesStock = filterOptions.stockStatus === 'all' || 
                           (filterOptions.stockStatus === 'out' && (p.stock_available || 0) === 0) ||
                           (filterOptions.stockStatus === 'low' && (p.stock_available || 0) > 0 && (p.stock_available || 0) <= 10);

        return matchesSearch && matchesCategory && matchesNoWsp && matchesNoSrp && matchesUnit && matchesStock;
    }), [products, deferredSearchTerm, categoryFilter, filterOptions]);

    const hasProducts = products.length > 0;
    const shouldExpandOnSearch = searchTerm !== '' || categoryFilter !== 'All';

    useEffect(() => {
        let isActive = true;
        if (shouldExpandOnSearch && hasProducts) {
            const newL1s = new Set(expandedL1s);
            const newCats = new Set(expandedCategories);
            const expandLimit = 50;
            const itemsToProcess = filtered.length > expandLimit ? filtered.slice(0, expandLimit) : filtered;
            
            itemsToProcess.forEach(p => {
                const parts = p.name.split(' > ');
                if (parts[0]) {
                    newL1s.add(parts[0]);
                    if (filtered.length <= expandLimit) {
                        if (parts[1]) {
                            newCats.add(`${parts[0]} > ${parts[1]}`);
                            if (parts[2]) {
                                newCats.add(`${parts[0]} > ${parts[1]} > ${parts[2]}`);
                            }
                        }
                    }
                }
            });
            
            if (isActive) {
                setExpandedL1s(newL1s);
                if (filtered.length <= expandLimit) {
                    setExpandedCategories(newCats);
                }
            }
        }
        return () => { isActive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldExpandOnSearch, hasProducts, filtered]);


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


    const groupedProducts = useMemo(() => filtered.reduce((acc: Record<string, Record<string, Record<string, Product[]>>>, p) => {
        const parts = p.name.split(' > ');
        const master = parts[0] || 'UNCATEGORIZED';
        const category = parts[1] || 'GENERAL';
        // If 4 parts: [Master, Cat, SubCat, Product]
        // If 3 parts: [Master, Cat, Product] -> SubCat should be GENERAL
        const subCat = parts.length > 3 ? parts[2] : 'GENERAL';
        
        if (!acc[master]) acc[master] = {};
        if (!acc[master][category]) acc[master][category] = {};
        if (!acc[master][category][subCat]) acc[master][category][subCat] = [];
        
        acc[master][category][subCat].push(p);
        return acc;
    }, {}), [filtered]);

    const displayL1s = useMemo(() => Object.keys(groupedProducts).sort(naturalSort), [groupedProducts]);

    const allCategories = useMemo(() => {
        const masters = new Set<string>();
        // Get ALL masters from ALL products, not filtered ones
        products.forEach(p => {
            const m = p.name.split(' > ')[0]?.toUpperCase();
            if (m) masters.add(m);
        });
        return Array.from(masters).sort(naturalSort);
    }, [products]);

    const getStockStatus = (stock: number, threshold: number = 10) => {
        if (stock === 0) return { label: 'Out of Stock', cls: 'badge-out-of-stock' };
        if (stock <= threshold) return { label: 'Low Stock', cls: 'badge-low-stock' };
        return { label: 'In Stock', cls: 'badge-in-stock' };
    };

    const stats = useMemo(() => ReportService.calculateInventoryStats(products, Object.values(movements), role || 'guest'), [products, movements, role]);

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
                    <label className={`flex items-center gap-2 bg-surface border border-border-default text-text-secondary px-5 py-3 rounded-2xl font-bold text-sm hover:bg-subtle transition-all shadow-sm cursor-pointer ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                        <FileUp size={18} className="text-blue-500" /> {isImporting ? 'IMPORTING...' : 'IMPORT'}
                        <input type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} disabled={isImporting} />
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
                    {searchTerm && (
                        <button 
                            onClick={() => {
                                setSearchTerm('');
                                    setExpandedL1s(new Set());
                                    setExpandedCategories(new Set());
                            }}
                            className="absolute right-12 top-1/2 -translate-y-1/2 text-text-muted hover:text-brand-red transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                    
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`p-2 rounded-xl transition-all flex items-center gap-2 ${activeFilterCount > 0 ? 'bg-brand-red text-white shadow-red' : 'bg-subtle text-text-muted hover:text-brand-red'}`}
                            title="Advanced Filters"
                        >
                            <SlidersHorizontal size={16} />
                            {activeFilterCount > 0 && <span className="text-[10px] font-black">{activeFilterCount}</span>}
                        </button>
                    </div>

                    {isFilterOpen && (
                        <div className="absolute right-0 top-full mt-3 w-72 bg-surface border border-border-default rounded-3xl shadow-xl z-50 p-5 animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center justify-between mb-4 border-b border-border-default pb-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-text-primary">Advanced Filters</h4>
                                <button onClick={resetFilters} className="text-[9px] font-black uppercase text-brand-red hover:underline decoration-2 underline-offset-4">CLEAR ALL</button>

                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Pricing Gaps</p>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" className="hidden" checked={filterOptions.noWsp} onChange={e => setFilterOptions(prev => ({ ...prev, noWsp: e.target.checked }))} />
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${filterOptions.noWsp ? 'bg-brand-red border-brand-red' : 'bg-white border-border-default'}`}>
                                                {filterOptions.noWsp && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                            <span className="text-xs font-bold text-text-secondary group-hover:text-text-primary">No Buying Price (Cost)</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" className="hidden" checked={filterOptions.noSrp} onChange={e => setFilterOptions(prev => ({ ...prev, noSrp: e.target.checked }))} />
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${filterOptions.noSrp ? 'bg-brand-red border-brand-red' : 'bg-white border-border-default'}`}>
                                                {filterOptions.noSrp && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                            <span className="text-xs font-bold text-text-secondary group-hover:text-text-primary">No Selling Price (SRP)</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Stock Health</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setFilterOptions(prev => ({ ...prev, stockStatus: prev.stockStatus === 'out' ? 'all' : 'out' }))} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${filterOptions.stockStatus === 'out' ? 'bg-brand-red border-brand-red text-white' : 'bg-white border-border-default text-text-muted'}`}>Out Stock</button>
                                        <button onClick={() => setFilterOptions(prev => ({ ...prev, stockStatus: prev.stockStatus === 'low' ? 'all' : 'low' }))} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${filterOptions.stockStatus === 'low' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-border-default text-text-muted'}`}>Low Stock</button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Units (pc, box, elf)</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {['pc', 'length', 'sheet', 'box', 'roll', 'elf', 'meter', 'ft', 'set', 'bag', 'kg'].map(u => (
                                            <button 
                                                key={u}
                                                onClick={() => toggleUnit(u)}
                                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${filterOptions.units.includes(u) ? 'bg-text-primary border-text-primary text-white' : 'bg-white border-border-default text-text-muted'}`}
                                            >
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setIsFilterOpen(false)} className="w-full mt-6 bg-brand-red text-white py-3 rounded-2xl font-black text-[10px] uppercase shadow-red active:scale-95 transition-all">Apply Filters</button>
                        </div>
                    )}
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
                                        <p className="text-lg font-black text-text-primary font-data">{formatNumber(stats.totalSKUs)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Low Stock</p>
                                        <p className="text-lg font-black text-amber-500 font-data">{formatNumber(stats.lowStock)}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Out Stock</p>
                                        <p className="text-lg font-black text-brand-red font-data">{stats.outOfStock}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Daily Delta</p>
                                        <p className="text-lg font-black text-blue-500 font-data">{stats.dailyDelta}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Categories Sidebar */}
                        <div className="hidden lg:block bg-surface p-4 rounded-3xl border border-border-default shadow-sm overflow-y-auto max-h-[calc(100vh-400px)] custom-scrollbar w-64 animate-in slide-in-from-left duration-300">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest px-2 mb-3 px-3 pb-2 border-b border-border-default">Quick Categories</p>
                                <div className="space-y-1 mt-2">
                                    <button 
                                        onClick={() => { 
                                            setCategoryFilter('All'); 
                                            setExpandedL1s(new Set()); 
                                            setExpandedCategories(new Set()); 
                                        }} 
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${categoryFilter === 'All' ? 'bg-brand-red text-white shadow-sm' : 'text-text-secondary hover:bg-subtle'}`}
                                    >
                                        All Items
                                    </button>
                                    {allCategories.map(cat => (
                                        <button 
                                            key={cat} 
                                            onClick={() => {
                                                setCategoryFilter(cat);
                                                // AUTO-EXPAND Master and all its children when clicked from sidebar
                                                const newL1s = new Set([cat]);
                                                const newCats = new Set<string>();
                                                
                                                // We need to look into the full grouped products here
                                                const categoriesForMaster = groupedProducts[cat] || {};
                                                Object.keys(categoriesForMaster).forEach(c => {
                                                    const catPath = `${cat} > ${c}`;
                                                    newCats.add(catPath);
                                                    Object.keys(categoriesForMaster[c] || {}).forEach(s => {
                                                        if (s !== 'GENERAL') newCats.add(`${catPath} > ${s}`);
                                                    });
                                                });
                                                
                                                setExpandedL1s(newL1s);
                                                setExpandedCategories(newCats);
                                            }} 
                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all truncate ${categoryFilter === cat ? 'bg-brand-red text-white shadow-sm' : 'text-text-secondary hover:bg-subtle'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                    </div>
                </div>

                <div className="flex-1 min-w-0 space-y-6">
                    <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                            <select className="w-full bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2 text-xs font-black text-text-primary appearance-none shadow-sm outline-none focus:ring-2 focus:ring-brand-red/10" value={categoryFilter} onChange={(e) => {
                                const val = e.target.value;
                                setCategoryFilter(val);
                                if (val === 'All') {
                                    setExpandedL1s(new Set());
                                    setExpandedCategories(new Set());
                                }
                            }}>
                                <option value="All">All Categories</option>
                                {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-8">
                        {loading ? ([1, 2, 3].map(i => <div key={i} className="bento-card p-8 skeleton h-20" />)) : displayL1s.length === 0 ? (
                            <div className="bg-surface rounded-3xl border border-border-default py-20 text-center shadow-sm">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center"><Package size={20} className="text-text-muted" /></div>
                                    <p className="text-sm text-text-secondary font-medium">No products found</p>
                                </div>
                            </div>
                        ) : (
                            displayL1s.map(master => {
                                const isMasterExpanded = expandedL1s.has(master);
                                const categories = groupedProducts[master] || {};
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
                                                                        disabled={isBulkDeleting}
                                                                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted/50 hover:text-brand-red transition-all disabled:opacity-30"
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
                                                                            <div key={subName} className={`bg-surface rounded-3xl overflow-hidden shadow-sm ${subName === 'GENERAL' ? 'border-none shadow-none bg-transparent' : 'border border-border-default'}`}>
                                                                                {subName !== 'GENERAL' && (
                                                                                    <div onClick={() => toggleCategory(`${master} > ${catName} > ${subName}`)} className="px-5 py-2.5 bg-subtle/30 flex items-center justify-between cursor-pointer hover:bg-subtle transition-colors group/sub">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <h4 className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{subName}</h4>
                                                                                                <span className="text-[9px] font-bold text-text-muted">{items.length} units</span>
                                                                                            </div>
                                                                                            {role === 'owner' && (
                                                                                                <button 
                                                                                                    onClick={(e) => { e.stopPropagation(); handleBulkDelete({ master, category: catName, subCat: subName }); }}
                                                                                                    disabled={isBulkDeleting}
                                                                                                    className="opacity-0 group-hover/sub:opacity-100 p-1 text-text-muted/50 hover:text-brand-red transition-all disabled:opacity-30"
                                                                                                    title="Delete Sub-category"
                                                                                                >
                                                                                                    <Trash2 size={12} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                        <ChevronDown size={14} className={`text-text-muted transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                                                                                    </div>
                                                                                )}
                                                                                
                                                                                {(isSubExpanded || subName === 'GENERAL') && (
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
                                                                                                    const status = getStockStatus(product.stock_available, product.low_stock_threshold ?? undefined);
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
                                                                                                                    {product.buying_price ? formatCurrency(product.buying_price) : '-'}
                                                                                                                </span>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-right">
                                                                                                                <span className="text-[11px] font-black font-data text-brand-red">
                                                                                                                    {formatCurrency(product.selling_price || 0)}
                                                                                                                </span>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-center">
                                                                                                                <span className="text-[11px] font-bold font-data text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">{formatNumber(product.stock_available)}</span>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-right">
                                                                                                                <div className="flex justify-end gap-1">
                                                                                                                    <button 
                                                                                                                        onClick={() => { setTransferProduct(product as any); setIsTransferModalOpen(true); }}
                                                                                                                        className="p-1 text-text-muted/50 hover:text-brand-orange transition-all"
                                                                                                                        title="Request Stock Transfer"
                                                                                                                    >
                                                                                                                        <RefreshCw size={14} />
                                                                                                                    </button>
                                                                                                                    <button onClick={() => { setSelectedProduct(product); setIsModalOpen(true); }} className="p-1 text-text-muted/50 hover:text-text-primary transition-all"><Edit size={14} /></button>
                                                                                                                    {role === 'owner' && <button onClick={() => handleDelete(product.id || '')} className="p-1 text-text-muted/50 hover:text-brand-red transition-all"><Trash2 size={14} /></button>}
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
                    <ProductModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setInitialModalData(undefined); }} onSuccess={refresh} product={selectedProduct as any} role={role} initialData={initialModalData} />
                    {transferProduct && (
                        <TransferRequestModal 
                            isOpen={isTransferModalOpen}
                            onClose={() => { setIsTransferModalOpen(false); setTransferProduct(null); }}
                            onSuccess={refresh}
                            product={transferProduct as any}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
