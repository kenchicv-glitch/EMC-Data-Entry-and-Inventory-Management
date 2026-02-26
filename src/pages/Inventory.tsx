import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ChevronDown, ChevronUp, Plus, Search, Edit, Trash2, Package, Filter, FileUp, PackageSearch } from 'lucide-react';
import ProductModal from '../components/ProductModal';
import { startOfDay } from 'date-fns';
import { parseExcelFile } from '../lib/ExcelImportService';
import type { RawProductData } from '../lib/ExcelImportService';

interface Product {
    id: string;
    name: string;
    stock_available: number;
    stock_reserved: number;
    stock_damaged: number;
    low_stock_threshold?: number;
    selling_price?: number;
    created_at: string;
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

    const handleDrop = async (e: React.DragEvent, targetL1: string, targetSubCat?: string) => {
        e.preventDefault();
        setDragOverL1(null);
        if (!draggedProduct) return;

        const parts = draggedProduct.name.split(' > ');
        const oldL1 = parts[0];
        const oldSubCat = parts.slice(1, -1).join(' > ') || 'GENERAL';
        const itemSpec = parts.slice(-1)[0];

        // Determine destination subcat: if dropping on a subcat-container, use it; 
        // if dropping on L1, retain existing subcat structure or default to GENERAL.
        const destSubCat = targetSubCat || oldSubCat;

        // If nothing changed, exit
        if (oldL1 === targetL1 && oldSubCat === destSubCat) return;

        const newName = `${targetL1} > ${destSubCat} > ${itemSpec}`.toUpperCase();

        setLoading(true);
        try {
            // Check if product with new name already exists
            const { data: existingMatch } = await supabase
                .from('products')
                .select('id, stock_available, stock_reserved, stock_damaged')
                .eq('name', newName)
                .neq('id', draggedProduct.id)
                .single();

            if (existingMatch) {
                // Merge: Add all stock types to existing match and delete current dragged product
                const totalAvail = (existingMatch.stock_available || 0) + (draggedProduct.stock_available || 0);
                const totalResv = (existingMatch.stock_reserved || 0) + (draggedProduct.stock_reserved || 0);
                const totalDmgd = (existingMatch.stock_damaged || 0) + (draggedProduct.stock_damaged || 0);

                const { error: updateError } = await supabase
                    .from('products')
                    .update({
                        stock_available: totalAvail,
                        stock_reserved: totalResv,
                        stock_damaged: totalDmgd
                    })
                    .eq('id', existingMatch.id);
                if (updateError) throw updateError;

                const { error: deleteError } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', draggedProduct.id);
                if (deleteError) throw deleteError;

                console.log(`Merged ${draggedProduct.name} into ${newName}`);
            } else {
                // Simple move
                const { error } = await supabase
                    .from('products')
                    .update({ name: newName })
                    .eq('id', draggedProduct.id);
                if (error) throw error;
            }
            fetchData();
        } catch (err) {
            console.error('Error moving product:', err);
            alert('Failed to move product: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setLoading(false);
            setDraggedProduct(null);
        }
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

            // Fetch current products to check for existing names (case-insensitive normalization)
            const { data: existingProducts, error: fetchError } = await supabase.from('products').select('id, name, stock_available');
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
                    updates.push({
                        id: match.id,
                        ...item,
                        // Consolidate: current stock + upload stock (summing instead of hard reset to 0 if desired, 
                        // but user previously asked for '0' in imports. 
                        // "consolidate all duplicates into one stock, include current stock" -> means sum them up.
                        stock_available: match.stock + item.stock_available
                    });
                } else {
                    inserts.push({
                        ...item,
                        sku: name,
                        stock_available: item.stock_available
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

    const handleDeleteCategory = async (l1: string) => {
        const count = Object.values(groupedProducts[l1] || {}).flat().length;
        if (!window.confirm(`Are you sure you want to delete ALL ${count} products in the "${l1}" category? This action cannot be undone.`)) {
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .or(`name.ilike.${l1},name.ilike.${l1} > %`);

            if (error) throw error;
            alert(`Successfully deleted all products in ${l1}.`);
            fetchData();
        } catch (err) {
            console.error('Error deleting category:', err);
            alert('Failed to delete category: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
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
            const normalizedNewName = newNameInput.trim().toUpperCase();
            if (renamingTarget.type === 'L1') {
                const oldPrefix = `${renamingTarget.currentName} > `;
                const newPrefix = `${normalizedNewName} > `;

                const { data: matchedProducts } = await supabase
                    .from('products')
                    .select('*')
                    .or(`name.ilike.${renamingTarget.currentName},name.ilike.${renamingTarget.currentName} > %`);

                if (matchedProducts && matchedProducts.length > 0) {
                    const oldPrefixUpper = oldPrefix.toUpperCase();
                    const newPrefixUpper = newPrefix.toUpperCase();

                    // Fetch any existing products at destination to detect collisions
                    const { data: targetCollisions } = await supabase
                        .from('products')
                        .select('id, name, stock_available')
                        .or(`name.ilike.${normalizedNewName},name.ilike.${normalizedNewName} > %`);

                    const collisionMap = new Map<string, { id: string; stock_available: number }>();
                    (targetCollisions || []).forEach(p => collisionMap.set(p.name.toUpperCase(), { id: p.id, stock_available: p.stock_available || 0 }));

                    for (const p of matchedProducts) {
                        const upperOldName = p.name.toUpperCase();
                        let upperNewName = upperOldName;
                        if (upperOldName === renamingTarget.currentName.toUpperCase()) {
                            upperNewName = normalizedNewName;
                        } else if (upperOldName.startsWith(oldPrefixUpper)) {
                            upperNewName = upperOldName.replace(oldPrefixUpper, newPrefixUpper);
                        }

                        const collision = collisionMap.get(upperNewName);
                        if (collision && collision.id !== p.id) {
                            // Merge: add stock to existing survivor then delete this one
                            const newStock = collision.stock_available + (p.stock_available || 0);
                            const { error: mergeErr } = await supabase
                                .from('products')
                                .update({ stock_available: newStock })
                                .eq('id', collision.id);
                            if (mergeErr) throw mergeErr;
                            const { error: delErr } = await supabase.from('products').delete().eq('id', p.id);
                            if (delErr) throw delErr;
                        } else {
                            // Simple rename
                            const { error: renErr } = await supabase
                                .from('products')
                                .update({ name: upperNewName })
                                .eq('id', p.id);
                            if (renErr) throw renErr;
                        }
                    }
                }
            } else {
                const oldPrefix = `${renamingTarget.l1} > ${renamingTarget.currentName} > `;
                const newPrefix = `${renamingTarget.l1} > ${normalizedNewName} > `;
                const exactOldName = `${renamingTarget.l1} > ${renamingTarget.currentName}`;
                const exactNewName = `${renamingTarget.l1} > ${normalizedNewName}`;

                const { data: matchedProducts } = await supabase
                    .from('products')
                    .select('*')
                    .or(`name.ilike.${exactOldName},name.ilike.${exactOldName} > %`);

                if (matchedProducts && matchedProducts.length > 0) {
                    const oldPrefixUpper = oldPrefix.toUpperCase();
                    const newPrefixUpper = newPrefix.toUpperCase();
                    const exactOldNameUpper = exactOldName.toUpperCase();

                    const { data: targetCollisions } = await supabase
                        .from('products')
                        .select('id, name, stock_available')
                        .or(`name.ilike.${exactNewName},name.ilike.${exactNewName} > %`);

                    const collisionMap = new Map<string, { id: string; stock_available: number }>();
                    (targetCollisions || []).forEach(p => collisionMap.set(p.name.toUpperCase(), { id: p.id, stock_available: p.stock_available || 0 }));

                    for (const p of matchedProducts) {
                        const upperOldName = p.name.toUpperCase();
                        let upperNewName = upperOldName;
                        if (upperOldName === exactOldNameUpper) {
                            upperNewName = exactNewName.toUpperCase();
                        } else if (upperOldName.startsWith(oldPrefixUpper)) {
                            upperNewName = upperOldName.replace(oldPrefixUpper, newPrefixUpper);
                        }

                        const collision = collisionMap.get(upperNewName);
                        if (collision && collision.id !== p.id) {
                            const newStock = collision.stock_available + (p.stock_available || 0);
                            const { error: mergeErr } = await supabase.from('products').update({ stock_available: newStock }).eq('id', collision.id);
                            if (mergeErr) throw mergeErr;
                            const { error: delErr } = await supabase.from('products').delete().eq('id', p.id);
                            if (delErr) throw delErr;
                        } else {
                            const { error: renErr } = await supabase.from('products').update({ name: upperNewName }).eq('id', p.id);
                            if (renErr) throw renErr;
                        }
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
        const { data: productsData, error: productsError } = await supabase.from('products').select('*').order('name');
        if (productsError) console.error('Error fetching inventory:', productsError);
        else setProducts(productsData || []);

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
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const category = p.name.split(' > ')[0] || 'Uncategorized';
        const matchesCategory = categoryFilter === 'All' || category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const groupedProducts = filtered.reduce((acc: Record<string, Record<string, Product[]>>, p) => {
        const parts = p.name.split(' > ');
        const l1 = parts[0] || 'Uncategorized';
        const subCat = parts.slice(1, -1).join(' > ') || 'GENERAL';
        if (!acc[l1]) acc[l1] = {};
        if (!acc[l1][subCat]) acc[l1][subCat] = [];
        acc[l1][subCat].push(p);
        return acc;
    }, {});

    const sortedL1s = Object.keys(groupedProducts).sort();
    const allCategories = Array.from(new Set(products.map(p => p.name.split(' > ')[0] || 'Uncategorized'))).sort();

    const getStockStatus = (stock: number, threshold: number = 10) => {
        if (stock === 0) return { label: 'Out of Stock', cls: 'badge-out-of-stock' };
        if (stock <= threshold) return { label: 'Low Stock', cls: 'badge-low-stock' };
        return { label: 'In Stock', cls: 'badge-in-stock' };
    };

    const stats = {
        totalSKUs: products.length,
        lowStock: products.filter(p => p.stock_available > 0 && p.stock_available <= (p.low_stock_threshold || 10)).length,
        outOfStock: products.filter(p => p.stock_available === 0).length,
        totalValue: products.reduce((acc, p) => acc + (p.stock_available * (p.selling_price || 0)), 0)
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-none">
            {/* Header Title Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-brand-charcoal tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center shadow-red"><PackageSearch className="text-white" size={24} /></div>
                        Inventory Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Monitor stock levels, manage categories, and track movements</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
                        <FileUp size={18} className="text-blue-500" /> Export
                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
                    </label>
                    {role === 'admin' && (
                        <button onClick={() => { setSelectedProduct(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red active:scale-95">
                            <Plus size={18} /> ADD PRODUCT
                        </button>
                    )}
                </div>
            </div>

            {/* Action Row */}
            <div className="flex flex-col sm:flex-row gap-4 relative">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-red transition-colors" size={18} />
                    <input type="text" placeholder="Search inventory products..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:border-brand-red outline-none transition-all shadow-sm placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Stats Sidebar */}
                <div className="flex-shrink-0">
                    <div className="sticky top-6 space-y-4">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative w-full lg:w-64">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/5 rounded-full -mr-12 -mt-12" />
                            <h3 className="text-[10px] font-black text-brand-charcoal border-b border-slate-100 pb-3 mb-4 uppercase tracking-[0.2em]">Summary Statistics</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total SKUs</p>
                                        <p className="text-lg font-black text-brand-charcoal font-data">{stats.totalSKUs}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Low Stock</p>
                                        <p className="text-lg font-black text-amber-500 font-data">{stats.lowStock}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Out Stock</p>
                                        <p className="text-lg font-black text-brand-red font-data">{stats.outOfStock}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Delta</p>
                                        <p className="text-lg font-black text-blue-500 font-data">{Object.values(movements).reduce((a, m) => a + (m.purchases - m.sales + m.refunds), 0)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Existing Categories Sidebar */}
                        <div className="hidden lg:block bg-white p-4 rounded-3xl border border-slate-100 shadow-sm overflow-y-auto max-h-[calc(100vh-400px)] custom-scrollbar w-64">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-3 px-3 pb-2 border-b border-slate-50">Quick Categories</p>
                            <div className="space-y-1 mt-2">
                                <button onClick={() => setCategoryFilter('All')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${categoryFilter === 'All' ? 'bg-brand-red text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>All Items</button>
                                {allCategories.map(cat => (
                                    <button key={cat} onClick={() => setCategoryFilter(cat)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all truncate ${categoryFilter === cat ? 'bg-brand-red text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{cat}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0 space-y-6">
                    <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <select className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-black text-brand-charcoal appearance-none shadow-sm outline-none focus:ring-2 focus:ring-brand-red/10" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                                <option value="All">All Categories</option>
                                {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-8">
                        {loading ? ([1, 2, 3].map(i => <div key={i} className="bento-card p-8 skeleton h-20" />)) : sortedL1s.length === 0 ? (
                            <div className="bento-card py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center"><Package size={20} className="text-slate-400" /></div>
                                    <p className="text-sm text-slate-500 font-medium">No products found</p>
                                </div>
                            </div>
                        ) : (
                            sortedL1s.map(l1 => {
                                const isL1Expanded = expandedL1s.has(l1) || searchTerm !== '' || categoryFilter !== 'All';
                                return (
                                    <div key={l1} className={`space-y-4 transition-all duration-300 ${dragOverL1 === l1 ? 'bg-brand-red/5 p-4 rounded-2xl ring-2 ring-brand-red ring-dashed' : ''}`} onDragOver={(e) => handleDragOver(e, l1)} onDragLeave={() => setDragOverL1(null)} onDrop={(e) => handleDrop(e, l1, undefined)}>
                                        <div className="flex items-center justify-between border-l-4 border-brand-red pl-4 py-2 bg-slate-50/50 rounded-r-xl">
                                            <div className="flex items-center gap-3 cursor-pointer group flex-1" onClick={() => toggleL1(l1)}>
                                                {renamingTarget?.type === 'L1' && renamingTarget.l1 === l1 ? (
                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <input autoFocus className="bg-white border-2 border-brand-red rounded-lg px-3 py-1 text-sm font-bold outline-none shadow-md" value={newNameInput} onChange={(e) => setNewNameInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(); if (e.key === 'Escape') setRenamingTarget(null); }} />
                                                        <button onClick={handleRenameCategory} className="p-1.5 bg-brand-red text-white rounded-lg"><Plus size={14} className="rotate-45" /></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h2 className="text-lg font-black text-brand-charcoal tracking-tighter uppercase group-hover:text-brand-red transition-colors">{l1}</h2>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                            {role === 'admin' && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); setRenamingTarget({ type: 'L1', l1, currentName: l1 }); setNewNameInput(l1); }} className="p-1 rounded text-slate-300 hover:text-brand-red hover:bg-red-50 transition-all"><Edit size={14} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(l1); }} className="p-1 rounded text-slate-300 hover:text-brand-red hover:bg-red-50 transition-all font-data" title={`Delete all products in ${l1}`}><Trash2 size={14} /></button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-black text-slate-700 uppercase tracking-widest">{Object.values(groupedProducts[l1]).flat().length} items</span>
                                            </div>
                                            {role === 'admin' && (
                                                <button onClick={() => { setInitialModalData({ l1 }); setSelectedProduct(null); setIsModalOpen(true); }} className="flex items-center gap-1.5 text-[10px] font-black bg-brand-charcoal text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all uppercase tracking-widest"><Plus size={12} /> Add in {l1}</button>
                                            )}
                                        </div>
                                        <div className={`grid grid-cols-1 gap-4 transition-all duration-300 ${isL1Expanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                            {Object.keys(groupedProducts[l1]).sort().map(subCat => {
                                                const catProducts = groupedProducts[l1][subCat];
                                                const isExpanded = expandedCategories.has(`${l1} > ${subCat}`) || categoryFilter !== 'All' || searchTerm !== '';
                                                return (
                                                    <div key={subCat} className="bento-card overflow-hidden ml-4 md:ml-8 border-slate-100" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => { e.stopPropagation(); handleDrop(e, l1, subCat); }}>
                                                        <div onClick={() => toggleCategory(`${l1} > ${subCat}`)} className="px-6 py-3 bg-white border-b border-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-1 rounded-md transition-all ${isExpanded ? 'bg-brand-red text-white' : 'bg-slate-100 text-slate-400'}`}>{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</div>
                                                                {renamingTarget?.type === 'subCat' && renamingTarget.l1 === l1 && renamingTarget.subCat === subCat ? (
                                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                        <input autoFocus className="bg-white border-2 border-brand-red rounded-lg px-2 py-0.5 text-[10px] font-black outline-none shadow-sm uppercase" value={newNameInput} onChange={(e) => setNewNameInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(); if (e.key === 'Escape') setRenamingTarget(null); }} />
                                                                        <button onClick={handleRenameCategory} className="p-1 bg-brand-red text-white rounded-md"><Plus size={10} className="rotate-45" /></button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 group/sub">
                                                                        <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{subCat}</h3>
                                                                        {role === 'admin' && (<button onClick={(e) => { e.stopPropagation(); setRenamingTarget({ type: 'subCat', l1, subCat, currentName: subCat }); setNewNameInput(subCat); }} className="opacity-0 group-hover/sub:opacity-100 p-1 rounded text-slate-300 hover:text-brand-red hover:bg-red-50 transition-all font-data"><Edit size={12} /></button>)}
                                                                    </div>
                                                                )}
                                                                <span className="text-[9px] font-bold text-slate-600">{catProducts.length} items</span>
                                                            </div>
                                                            {role === 'admin' && (<button onClick={(e) => { e.stopPropagation(); const parts = subCat.split(' > '); setInitialModalData({ l1, l2: parts[0], l3: parts[1] }); setSelectedProduct(null); setIsModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-red hover:bg-red-50 transition-all" title={`Add product in ${l1} > ${subCat}`}><Plus size={14} /></button>)}
                                                        </div>
                                                        <div className={`overflow-x-auto transition-all duration-300 ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                            <table className="min-w-full">
                                                                <thead>
                                                                    <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                                                        <th className="px-4 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">Item Status</th>
                                                                        <th className="px-4 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Spec / Description</th>
                                                                        <th className="px-4 py-2 text-center text-[9px] font-black uppercase tracking-widest text-slate-400 w-32">Available Stock</th>
                                                                        <th className="px-4 py-2 text-right text-[9px] font-black uppercase tracking-widest text-slate-400 w-20">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                                    {catProducts.map((product) => {
                                                                        const status = getStockStatus(product.stock_available, product.low_stock_threshold);
                                                                        return (
                                                                            <tr key={product.id} className={`hover:bg-blue-50/30 transition-colors group cursor-grab active:cursor-grabbing ${draggedProduct?.id === product.id ? 'opacity-30' : ''}`} draggable onDragStart={() => handleDragStart(product)}>
                                                                                <td className="whitespace-nowrap px-4 py-2 text-[10px] font-bold text-slate-500 font-data tracking-tighter"><span className={`inline-flex px-1 rounded text-[7px] font-black uppercase ${status.cls}`}>{status.label}</span></td>
                                                                                <td className="px-4 py-2 min-w-[200px] text-[11px] font-black text-brand-charcoal tracking-tight leading-tight uppercase">{product.name.split(' > ').slice(-1)[0]}</td>
                                                                                <td className="whitespace-nowrap px-4 py-2">
                                                                                    <div className="flex items-center justify-center gap-1 font-data text-[11px] font-bold">
                                                                                        <div className="flex flex-col items-center bg-green-50 px-4 py-1 rounded-xl border border-green-100 min-w-[64px] transition-all group-hover:bg-green-100 shadow-sm"><span className="text-[8px] text-green-600 uppercase font-black tracking-wider mb-0.5">Quantity</span><span className="text-green-700 text-sm leading-none">{product.stock_available}</span></div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="whitespace-nowrap px-4 py-2 text-right">
                                                                                    <div className="flex justify-end gap-1">
                                                                                        <button onClick={() => { setSelectedProduct(product); setInitialModalData(undefined); setIsModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-charcoal hover:bg-slate-100 transition-all"><Edit size={14} /></button>
                                                                                        {role === 'admin' && (<button onClick={() => handleDelete(product.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-brand-red hover:bg-red-50 transition-all font-data"><Trash2 size={14} /></button>)}
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
                    <ProductModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setInitialModalData(undefined); }} onSuccess={fetchData} product={selectedProduct} role={role} initialData={initialModalData} />
                </div>
            </div>
        </div>
    );
}
