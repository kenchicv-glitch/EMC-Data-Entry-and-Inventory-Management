import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { useBranch } from '../../shared/hooks/useBranch';
import { 
    Building2, Search, Trash2, 
    ArrowRight, PackageSearch,
    AlertCircle, ChevronDown, Filter, X
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface BranchStats {
    id: string;
    name: string;
    skuCount: number;
    totalStock: number;
    value: number;
}

interface ConsolidatedProduct {
    name: string;
    totalStock: number;
    branchStocks: Record<string, number>; // branchId -> stock
    category: string;
    productIds: string[];
}

export default function BranchInventory() {
    const { branches } = useBranch();
    const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
    const [products, setProducts] = useState<ConsolidatedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [masterFilter, setMasterFilter] = useState('All');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const CANONICAL_CATEGORIES = [
        'STEEL', 'PLYWOOD', 'ELECTRICALS', 'ROOFING', 'LUMBER',
        'PIPES AND FITTINGS', 'HARDWARE AND FASTENERS',
        'CEMENT AND AGGREGATES', 'DOORS AND FIXTURES', 'PAINTS AND FINISHES',
        'BOYSEN'
    ];

    const naturalSort = (a: string, b: string) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

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

    const toggleCategory = (cat: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(cat)) {
            newExpanded.delete(cat);
        } else {
            newExpanded.add(cat);
            // AUTO-EXPAND recursively for all children (Categories and Sub-categories)
            const parts = cat.split(' > ');
            if (parts.length === 1) { // Master level
                const categories = groupedProducts[cat] || {};
                Object.keys(categories).forEach(c => {
                    const catPath = `${cat} > ${c}`;
                    newExpanded.add(catPath);
                    const subCats = categories[c] || {};
                    Object.keys(subCats).forEach(s => {
                        if (s !== 'GENERAL') newExpanded.add(`${catPath} > ${s}`);
                    });
                });
            } else if (parts.length === 2) { // Category level
                const master = parts[0];
                const category = parts[1];
                const subCats = groupedProducts[master]?.[category] || {};
                Object.keys(subCats).forEach(s => {
                    if (s !== 'GENERAL') newExpanded.add(`${master} > ${category} > ${s}`);
                });
            }
        }
        setExpandedCategories(newExpanded);
    };

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const { data: allProducts, error } = await supabase
                    .from('products')
                    .select('id, name, stock_available, branch_id, selling_price');
                
                if (error) throw error;

                const consolidatedMap: Record<string, ConsolidatedProduct> = {};
                const statsMap: Record<string, { skus: number, stock: number, value: number }> = {};
                
                branches.forEach(b => {
                    statsMap[b.id] = { skus: 0, stock: 0, value: 0 };
                });

                const activeBranchIds = new Set(branches.map(b => b.id));
                const orphanedIds: string[] = [];

                allProducts?.forEach(p => {
                    if (!activeBranchIds.has(p.branch_id)) {
                        orphanedIds.push(p.id);
                        return;
                    }

                    const normalizedName = p.name.toUpperCase();
                    const stock = p.stock_available || 0;
                    const price = p.selling_price || 0;

                    if (!consolidatedMap[normalizedName]) {
                        consolidatedMap[normalizedName] = {
                            name: normalizedName,
                            totalStock: 0,
                            branchStocks: {},
                            category: normalizedName.split(' > ')[0] || 'UNCATEGORIZED',
                            productIds: []
                        };
                    }
                    consolidatedMap[normalizedName].totalStock += stock;
                    consolidatedMap[normalizedName].branchStocks[p.branch_id] = (consolidatedMap[normalizedName].branchStocks[p.branch_id] || 0) + stock;
                    consolidatedMap[normalizedName].productIds.push(p.id);

                    if (statsMap[p.branch_id]) {
                        statsMap[p.branch_id].skus += 1;
                        statsMap[p.branch_id].stock += stock;
                        statsMap[p.branch_id].value += (stock * price);
                    }
                });

                // Prepare for cleanup
                const productsToDelete: string[] = [...orphanedIds];
                Object.values(consolidatedMap).forEach(p => {
                    if (p.totalStock === 0) {
                        productsToDelete.push(...p.productIds);
                    }
                });

                // Remove zero-stock or orphaned items from the database permanently
                if (productsToDelete.length > 0) {
                    console.log(`Cleanup: Deleting ${productsToDelete.length} stale/zero-stock products`);
                    supabase.from('products').delete().in('id', productsToDelete).then(({ error: delError }) => {
                        if (delError) console.error('Cleanup error:', delError);
                        else console.log('Cleanup successful');
                    });
                }

                // Filter out products that have no stock across all active branches for current view
                const finalProducts = Object.values(consolidatedMap)
                    .filter(p => p.totalStock > 0)
                    .sort((a, b) => a.name.localeCompare(b.name));

                setProducts(finalProducts);
                setBranchStats(branches.map(b => ({
                    id: b.id,
                    name: b.name,
                    skuCount: statsMap[b.id]?.skus || 0,
                    totalStock: statsMap[b.id]?.stock || 0,
                    value: statsMap[b.id]?.value || 0
                })));

            } catch (err) {
                console.error('Error fetching branch inventory:', err);
            } finally {
                setLoading(false);
            }
        };

        if (branches.length > 0) fetchAllData();
    }, [branches]);

    const handleDeleteProductGlobal = async (productName: string) => {
        if (!window.confirm(`Are you sure you want to delete "${productName}" and all its stock records across ALL branches? This cannot be undone.`)) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('name', productName);

            if (error) throw error;
            setProducts(prev => prev.filter(p => p.name !== productName));
        } catch (err) {
            alert('Error deleting product globally: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const filtered = products.filter(p => {
        const searchTerms = searchTerm.toLowerCase().split(' ').filter(Boolean);
        const fullName = `${p.category} ${p.name}`.toLowerCase();
        const matchesSearch = searchTerms.every(term => fullName.includes(term));
        
        const master = p.name.split(' > ')[0] || 'UNCATEGORIZED';
        const matchesMaster = masterFilter === 'All' || master === masterFilter;
        
        return matchesSearch && matchesMaster;
    });

    useEffect(() => {
        if (searchTerm !== '' || masterFilter !== 'All') {
            const newExpanded = new Set<string>(expandedCategories);
            filtered.forEach(p => {
                const parts = p.name.split(' > ');
                if (parts[0]) {
                    newExpanded.add(parts[0]);
                    if (parts[1]) {
                        newExpanded.add(`${parts[0]} > ${parts[1]}`);
                        if (parts[2]) {
                            newExpanded.add(`${parts[0]} > ${parts[1]} > ${parts[2]}`);
                        }
                    }
                }
            });
            setExpandedCategories(newExpanded);
        }
    }, [searchTerm, masterFilter, products.length > 0]); // Trigger when search, filter or products change

    // Grouping logic
    const groupedProducts = filtered.reduce((acc: Record<string, Record<string, Record<string, ConsolidatedProduct[]>>>, p) => {
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

    if (loading && branchStats.length === 0) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in p-2 md:p-0">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-red/10 p-2 rounded-2xl text-brand-red shadow-sm border border-brand-red/10">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-text-primary tracking-tight uppercase">Branch Inventory</h1>
                        <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">Global Stock Monitoring</p>
                    </div>
                </div>
            </div>

            {/* Branch Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branchStats.map(branch => (
                    <Link 
                        key={branch.id}
                        to={`/branch-inventory/${branch.id}`}
                        className="group relative bg-surface border border-border-default rounded-[2rem] p-5 hover:border-brand-red/30 transition-all hover:shadow-xl overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <Building2 size={80} />
                        </div>
 
                        <div className="relative flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-black text-text-primary tracking-tighter uppercase mb-0.5 group-hover:text-brand-red transition-colors">{branch.name}</h3>
                                <span className="text-[8px] font-black uppercase tracking-widest text-text-muted bg-muted px-2 py-0.5 rounded-full">Active Branch</span>
                            </div>
                            <div className="bg-brand-red/10 p-1.5 rounded-xl text-brand-red group-hover:translate-x-1 transition-transform">
                                <ArrowRight size={16} />
                            </div>
                        </div>
 
                        <div className="grid grid-cols-3 gap-2 border-t border-border-default pt-4">
                            <div>
                                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">SKUs</p>
                                <p className="text-base font-black text-text-primary font-data">{branch.skuCount}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">Stock</p>
                                <p className="text-base font-black text-text-primary font-data">{branch.totalStock}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5">Value</p>
                                <p className="text-base font-black text-text-primary font-data">₱{branch.value.toLocaleString()}</p>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Consolidated Stock Table */}
            <div className="bg-surface border border-border-default rounded-[2rem] shadow-sm overflow-hidden min-h-[500px]">
                <div className="px-6 py-4 border-b border-border-default flex flex-col md:flex-row md:items-center justify-between gap-3 bg-subtle/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-text-primary text-text-inverse rounded-xl">
                            <PackageSearch size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-text-primary tracking-tighter uppercase leading-none">Consolidated Stock</h2>
                            <p className="text-[9px] font-bold text-text-secondary mt-1 uppercase tracking-widest">Global Item Filter</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-xl border-2 border-border-default shadow-sm min-w-[200px] hover:border-brand-red/30 focus-within:border-brand-red transition-all">
                            <Filter size={14} className="text-text-muted" />
                            <select 
                                value={masterFilter}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setMasterFilter(val);
                                    if (val === 'All') {
                                        setExpandedCategories(new Set());
                                    }
                                }}
                                className="bg-transparent text-[11px] font-black tracking-widest outline-none border-none ring-0 focus:ring-0 uppercase text-text-primary w-full cursor-pointer appearance-none"
                            >
                                <option value="All">ALL MASTER CATEGORIES</option>
                                {CANONICAL_CATEGORIES.sort(naturalSort).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="text-text-muted transition-transform ml-auto" />
                        </div>

                        <div className="relative group min-w-[250px] flex-1 sm:flex-initial">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={16} />
                            <input 
                                type="text" 
                                placeholder="SEARCH GLOBAL STOCK..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-surface border-2 border-border-default hover:border-brand-red/30 focus:border-brand-red rounded-xl pl-10 pr-10 py-2 text-[10px] font-black tracking-widest outline-none transition-all shadow-sm focus:ring-0"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        if (masterFilter === 'All') {
                                            setExpandedCategories(new Set());
                                        }
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-brand-red transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 space-y-4 pb-24">
                    {Object.keys(groupedProducts).length === 0 && masterFilter === 'All' ? (
                        <div className="bg-subtle/20 py-20 rounded-[2rem] text-center border-2 border-dashed border-border-default">
                            <div className="flex flex-col items-center gap-4">
                                <AlertCircle size={48} className="text-text-muted/30" />
                                <p className="text-xl font-black text-text-muted uppercase tracking-widest">No Products Found</p>
                            </div>
                        </div>
                    ) : (
                        (masterFilter === 'All' ? CANONICAL_CATEGORIES.sort(naturalSort) : [masterFilter]).map(master => {
                            const categories = groupedProducts[master] || {};
                            const isMasterExpanded = expandedCategories.has(master);
                            const mColor = getMasterColor(master);
                            
                            return (
                                <div key={master} className="space-y-3 animate-slide-up">
                                    <div 
                                        className="flex items-center justify-between bg-brand-red/5 px-5 py-3 rounded-2xl border-l-4 cursor-pointer group/master transition-all hover:bg-brand-red/[0.08]" 
                                        style={{ borderLeftColor: mColor }}
                                        onClick={() => toggleCategory(master)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-xl font-black text-text-primary tracking-tighter uppercase" style={{ color: mColor }}>{master}</h2>
                                            <span className="text-[9px] font-black bg-white/50 px-2 py-0.5 rounded-full text-text-muted border border-border-default uppercase tracking-widest">
                                                {Object.values(categories).reduce((acc, cat) => acc + Object.values(cat).reduce((acc2, items) => acc2 + items.length, 0), 0)} SKUs
                                            </span>
                                        </div>
                                        <ChevronDown size={20} className={`text-text-muted transition-transform duration-300 ${isMasterExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                    
                                    {isMasterExpanded && (
                                        <div className="space-y-4 ml-4 border-l-2 border-border-default/50 pl-4 pb-2">
                                            {Object.keys(categories).sort(naturalSort).map(catName => {
                                                const subCats = categories[catName];
                                                const isCatExpanded = expandedCategories.has(`${master} > ${catName}`);
                                                
                                                return (
                                                    <div key={catName} className="space-y-4">
                                                        <div 
                                                            className="flex items-center gap-3 cursor-pointer group/cat w-fit" 
                                                            onClick={() => toggleCategory(`${master} > ${catName}`)}
                                                        >
                                                            <div className={`p-1.5 rounded-lg transition-all ${isCatExpanded ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'bg-subtle text-text-muted'}`}>
                                                                <ChevronDown size={14} className={`transition-transform duration-300 ${isCatExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                            </div>
                                                            <h3 className={`text-lg font-black uppercase tracking-tight transition-colors ${isCatExpanded ? 'text-text-primary' : 'text-text-secondary group-hover:text-brand-red'}`}>{catName}</h3>
                                                        </div>

                                                        {isCatExpanded && (
                                                            <div className="grid grid-cols-1 gap-4">
                                                                {Object.keys(subCats).sort(naturalSort).map(subName => {
                                                                    const items = subCats[subName];
                                                                    const isSubExpanded = expandedCategories.has(`${master} > ${catName} > ${subName}`);
                                                                    
                                                                    return (
                                                                        <div key={subName} className="bg-surface rounded-2xl border border-border-default overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                                            <div 
                                                                                onClick={() => toggleCategory(`${master} > ${catName} > ${subName}`)} 
                                                                                className="px-5 py-2.5 bg-subtle/30 flex items-center justify-between cursor-pointer hover:bg-subtle/50 transition-colors group/sub"
                                                                            >
                                                                                <div className="flex items-center gap-3">
                                                                                    <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{subName}</h4>
                                                                                    <span className="text-[9px] font-bold text-text-muted bg-white/50 px-2 py-0.5 rounded-full border border-border-default">{items.length} units</span>
                                                                                </div>
                                                                                <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isSubExpanded ? 'rotate-180' : ''}`} />
                                                                            </div>
                                                                            
                                                                            {isSubExpanded && (
                                                                                <div className="overflow-x-auto">
                                                                                    <table className="min-w-full">
                                                                                        <thead>
                                                                                            <tr className="bg-subtle/10 border-b border-border-default">
                                                                                                <th className="px-6 py-2 text-left text-[8px] font-black uppercase tracking-widest text-text-muted">Item Description</th>
                                                                                                <th className="px-6 py-2 text-center text-[8px] font-black uppercase tracking-widest text-text-muted border-l border-border-default bg-emerald-500/5">Total Σ</th>
                                                                                                {branches.map(b => (
                                                                                                    <th key={b.id} className="px-4 py-2 text-center text-[8px] font-black uppercase tracking-widest text-text-muted border-l border-border-default">{b.name}</th>
                                                                                                ))}
                                                                                                <th className="px-4 py-2 text-right text-[8px] font-black uppercase tracking-widest text-text-muted border-l border-border-default">Actions</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-border-default">
                                                                                            {items.map((p, pIdx) => (
                                                                                                <tr key={p.name} className={`hover:bg-subtle/30 transition-colors group ${pIdx % 2 === 0 ? 'bg-surface' : 'bg-subtle/5'}`}>
                                                                                                    <td className="px-6 py-3">
                                                                                                        <span className="text-[11px] font-black text-text-primary tracking-tight group-hover:text-brand-red transition-colors uppercase">{p.name.split(' > ').slice(-1)[0]}</span>
                                                                                                    </td>
                                                                                                    <td className="px-6 py-3 border-l border-border-default bg-emerald-500/[0.02]">
                                                                                                        <div className="flex flex-col items-center">
                                                                                                            <span className="text-xs font-black text-emerald-600 font-data underline decoration-emerald-500/30 underline-offset-4">{p.totalStock}</span>
                                                                                                            <span className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter">UNITS Σ</span>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    {branches.map(b => {
                                                                                                        const stock = p.branchStocks[b.id] || 0;
                                                                                                        return (
                                                                                                            <td key={b.id} className="px-4 py-3 border-l border-border-default text-center">
                                                                                                                <span className={`text-[12px] font-bold font-data ${stock > 0 ? 'text-text-primary text-xs font-black' : 'text-text-muted/20'}`}>
                                                                                                                    {stock > 0 ? stock : '-'}
                                                                                                                </span>
                                                                                                            </td>
                                                                                                        );
                                                                                                    })}
                                                                                                    <td className="px-4 py-3 border-l border-border-default text-right">
                                                                                                        <button 
                                                                                                            onClick={() => handleDeleteProductGlobal(p.name)}
                                                                                                            className="p-1.5 rounded-lg text-text-muted/20 hover:text-brand-red hover:bg-brand-red/10 transition-all"
                                                                                                        >
                                                                                                            <Trash2 size={12} />
                                                                                                        </button>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))}
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
            </div>
        </div>
    );
}
