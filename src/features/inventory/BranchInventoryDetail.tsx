import { useEffect, useState, useCallback } from 'react';
import type { Product } from './types/product';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase';
import { useAuth } from '../../shared/hooks/useAuth';
import { 
    ArrowLeft, Package, Search, 
    Filter, Plus, Edit, Trash2,
    ChevronDown
} from 'lucide-react';
import ProductModal from './components/ProductModal';


export default function BranchInventoryDetail() {
    const { branchId } = useParams();
    const navigate = useNavigate();
    const { role } = useAuth();
    const [branchName, setBranchName] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [initialModalData, setInitialModalData] = useState<{ l1?: string; l2?: string; l3?: string; branch_id?: string } | undefined>();

    const fetchData = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            // Fetch Branch Name
            const { data: branch } = await supabase.from('branches').select('name').eq('id', branchId).single();
            if (branch) setBranchName(branch.name);

            // Fetch Branch Products
            const { data: productsData } = await supabase
                .from('products')
                .select('*')
                .eq('branch_id', branchId)
                .order('name');
            
            setProducts(productsData || []);
        } catch (err) {
            console.error('Error fetching branch details:', err);
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { 
        fetchData(); 
    }, [fetchData]);

    const naturalSort = (a: string, b: string) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this product from this branch?')) return;
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else fetchData();
    };

    const getMasterColor = (master: string) => {
        const m = master.toUpperCase();
        if (m.includes('PLYWOOD')) return '#0369A1';
        if (m.includes('STEEL')) return '#1E8449';
        if (m.includes('ELECTRICAL')) return '#7C3AED';
        if (m.includes('ROOFING')) return '#B45309';
        if (m.includes('BOYSEN')) return '#F59E0B';
        return '#EF4444'; // Brand Red default
    };

    const handleBulkDelete = async (filter: { master?: string, category?: string, subCat?: string }) => {
        let label = '';
        if (filter.subCat) label = `Sub-category: ${filter.subCat}`;
        else if (filter.category) label = `Category: ${filter.category}`;
        else if (filter.master) label = `Master Category: ${filter.master}`;

        if (!window.confirm(`STRICT WARNING: This will permanently delete ALL products in "${label}" for this branch. Proceed?`)) return;

        setLoading(true);
        try {
            const query = supabase.from('products').delete().eq('branch_id', branchId);
            
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
        const searchTerms = searchTerm.toLowerCase().split(' ').filter(Boolean);
        const matchesSearch = searchTerms.every(term => 
            p.name.toLowerCase().includes(term) || 
            (p.brand?.toLowerCase().includes(term) ?? false)
        );
        const category = p.name.split(' > ')[0] || 'Uncategorized';
        const matchesCategory = categoryFilter === 'All' || category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

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

    const toggleCategory = (cat: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(cat)) newExpanded.delete(cat);
        else newExpanded.add(cat);
        setExpandedCategories(newExpanded);
    };

    if (loading && branchName === '') {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Breadcrumbs & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/branch-inventory')}
                        className="p-3 bg-surface border border-border-default rounded-2xl text-text-secondary hover:text-brand-red hover:border-brand-red/30 transition-all shadow-sm"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-brand-red bg-brand-red/10 px-2 py-0.5 rounded-full uppercase tracking-widest">Branch Access</span>
                            <span className="text-[10px] font-black text-text-muted bg-muted px-2 py-0.5 rounded-full uppercase tracking-widest leading-none">ID: {branchId?.slice(0, 8)}...</span>
                        </div>
                        <h1 className="text-3xl font-black text-text-primary tracking-tighter uppercase">{branchName} Inventory</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-surface border border-border-default rounded-2xl px-5 py-3 flex flex-col items-center shadow-sm">
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Total SKUs</span>
                        <span className="text-lg font-black text-text-primary font-data leading-none mt-1">{products.length}</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-surface border border-border-default p-6 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="SEARCH PRODUCTS IN THIS BRANCH..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-subtle/30 border-2 border-border-default focus:border-brand-red rounded-2xl pl-12 pr-6 py-3 text-xs font-black tracking-widest outline-none transition-all shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-subtle/30 px-4 py-3 rounded-2xl border border-border-default shadow-sm min-w-[200px]">
                        <Filter size={16} className="text-text-muted" />
                        <select 
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-transparent text-xs font-black tracking-widest outline-none uppercase text-text-primary w-full"
                        >
                            <option value="All">ALL CATEGORIES</option>
                            {Array.from(new Set(products.map(p => p.name.split(' > ')[0]))).filter(Boolean).sort(naturalSort).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Inventory Table */}
            <div className="space-y-6 pb-20">
                {Object.keys(groupedProducts).length === 0 ? (
                    <div className="bg-surface border border-border-default rounded-[2.5rem] py-20 text-center animate-fade-in shadow-sm">
                        <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
                            <div className="p-6 bg-brand-red/10 rounded-full text-brand-red animate-pulse">
                                <Package size={48} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-text-primary uppercase">No Products Found</h3>
                                <p className="text-sm text-text-secondary font-medium mt-2 uppercase tracking-widest">This branch has no inventory records matching your filters</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    Object.keys(groupedProducts).sort(naturalSort).map(master => {
                        const categories = groupedProducts[master];
                        const isMasterExpanded = expandedCategories.has(master) || searchTerm !== '';
                        const mColor = getMasterColor(master);
                        return (
                            <div key={master} className="space-y-4">
                                <div 
                                    className="flex items-center justify-between bg-brand-red/5 px-4 py-2 rounded-2xl border-l-4 cursor-pointer" 
                                    style={{ borderLeftColor: mColor }}
                                    onClick={() => toggleCategory(master)}
                                >
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl font-black text-text-primary tracking-tighter uppercase" style={{ color: mColor }}>{master}</h2>
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
                                    </div>
                                    <ChevronDown size={20} className={`text-text-muted transition-transform ${isMasterExpanded ? 'rotate-180' : ''}`} />
                                </div>
                                
                                {isMasterExpanded && (
                                    <div className="space-y-6 ml-4 border-l-2 border-border-default/50 pl-6">
                                        {Object.keys(categories).sort(naturalSort).map(catName => {
                                            const subCats = categories[catName];
                                            const isCatExpanded = expandedCategories.has(`${master} > ${catName}`) || searchTerm !== '';
                                            return (
                                                <div key={catName} className="space-y-3">
                                                    <div className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleCategory(`${master} > ${catName}`)}>
                                                            <div className={`p-1 rounded transition-colors ${isCatExpanded ? 'bg-brand-red text-white' : 'bg-subtle text-text-muted'}`}>
                                                                <ChevronDown size={12} className={`transition-transform ${isCatExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                            </div>
                                                            <h3 className="text-sm font-black text-text-primary uppercase tracking-tight group-hover:text-brand-red transition-colors">{catName}</h3>
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
                                                                const isSubExpanded = expandedCategories.has(`${master} > ${catName} > ${subName}`) || searchTerm !== '';
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
                                                                                            <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-text-muted">Item Description</th>
                                                                                            <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-text-muted w-20">Unit</th>
                                                                                            <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-widest text-text-muted w-24">WSP (₱)</th>
                                                                                            <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-widest text-text-muted w-24">SRP (₱)</th>
                                                                                            <th className="px-6 py-3 text-center text-[9px] font-black uppercase tracking-widest text-text-muted w-24">Stock</th>
                                                                                            <th className="px-6 py-3 text-right text-[9px] font-black uppercase tracking-widest text-text-muted w-20">Actions</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-border-default">
                                                                                        {items.map((p: Product) => (
                                                                                            <tr key={p.id} className="hover:bg-subtle/30 transition-colors group">
                                                                                                <td className="px-6 py-4">
                                                                                                    <span className="text-xs font-black text-text-primary uppercase tracking-tight">{p.name.split(' > ').slice(-1)[0]}</span>
                                                                                                </td>
                                                                                                <td className="px-4 py-4 text-center">
                                                                                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{p.unit || 'pc'}</span>
                                                                                                </td>
                                                                                                <td className="px-4 py-4 text-right">
                                                                                                    <span className="text-[11px] font-bold font-data text-text-secondary">
                                                                                                        {p.buying_price ? `₱${p.buying_price.toLocaleString()}` : '-'}
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td className="px-4 py-4 text-right">
                                                                                                    <span className="text-[11px] font-black font-data text-brand-red">
                                                                                                        ₱{(p.selling_price || 0).toLocaleString()}
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td className="px-6 py-4 text-center">
                                                                                                    <div className="inline-flex flex-col items-center bg-emerald-500/5 px-4 py-1.5 rounded-2xl border border-emerald-500/10 min-w-[70px]">
                                                                                                        <span className="text-sm font-black text-emerald-600 font-data">{p.stock_available}</span>
                                                                                                        <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Qty</span>
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td className="px-6 py-4 text-right">
                                                                                                    <div className="flex justify-end gap-1">
                                                                                                        <button 
                                                                                                            onClick={() => { setSelectedProduct(p); setInitialModalData(undefined); setIsModalOpen(true); }}
                                                                                                            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-muted transition-all"
                                                                                                        >
                                                                                                            <Edit size={14} />
                                                                                                        </button>
                                                                                                        {role === 'owner' && (
                                                                                                            <button 
                                                                                                                onClick={() => handleDelete(p.id || '')}
                                                                                                                className="p-2 rounded-xl text-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-all"
                                                                                                            >
                                                                                                                <Trash2 size={14} />
                                                                                                            </button>
                                                                                                        )}
                                                                                                    </div>
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

            <ProductModal 
                isOpen={isModalOpen} 
                onClose={() => { setIsModalOpen(false); setInitialModalData(undefined); }} 
                onSuccess={fetchData} 
                product={selectedProduct as any} 
                role={role} 
                initialData={{ ...initialModalData, branch_id: branchId }} 
            />
        </div>
    );
}
