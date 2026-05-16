import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
    Folder, Plus, Pencil, Trash2, ChevronRight, Tag, ArrowLeft, 
    Zap, CheckCircle, AlertTriangle, Loader2, LayoutGrid, ListTree,
    Search
} from 'lucide-react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useCategoryTree, useCategoryProductCounts } from '../hooks/useCategories';
import CategoryFormModal from '../components/CategoryFormModal';
import CategoryTreeComponent from '../components/CategoryTree';
import type { Category } from '../types/product';
import { type MigrationResult } from '../services/categoryService';
import { useBranch } from '../../../shared/hooks/useBranch';
import { clsx } from 'clsx';

export default function InventoryCategoriesPage() {
    const { data: categories = [], isLoading } = useCategories();
    const createMutation = useCreateCategory();
    const updateMutation = useUpdateCategory();
    const deleteMutation = useDeleteCategory();
    const { activeBranchId } = useBranch();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const { data: categoryTree = [] } = useCategoryTree();
    const { data: productCounts = {} } = useCategoryProductCounts(activeBranchId);

    const [modalOpen, setModalOpen] = useState(false);
    const [editCategory, setEditCategory] = useState<Category | null>(null);
    const [parentCategory, setParentCategory] = useState<Category | null>(null);
    
    // selectedMasterId now tracks state locally for the "drill down" view
    // but we still want to match it with the sidebar
    const [selectedMasterId, setSelectedMasterId] = useState<string | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const handleSelectFromTree = (id: string | null) => {
        if (!id) {
            navigate('/inventory');
            return;
        }
        // If it's a master category, stay in overview but filter
        const cat = categories.find(c => c.id === id);
        if (cat && cat.depth === 0) {
            setSelectedMasterId(id);
        } else {
            // If it's a sub-category, go to products
            navigate(`/inventory?category=${id}`);
        }
    };

    const handleCardClick = (id: string) => {
        // High level intent: "show every item under them"
        navigate(`/inventory?category=${id}`);
    };

    const openCreate = (parent?: Category) => {
        setEditCategory(null);
        setParentCategory(parent ?? null);
        setModalOpen(true);
    };
    const openEdit = (cat: Category) => {
        setEditCategory(cat);
        setParentCategory(null);
        setModalOpen(true);
    };
    const handleClose = () => { setModalOpen(false); setEditCategory(null); setParentCategory(null); };

    const handleSubmit = (data: Parameters<typeof createMutation.mutate>[0]) => {
        if (editCategory) {
            updateMutation.mutate({ id: editCategory.id, input: data }, { onSuccess: handleClose });
        } else {
            createMutation.mutate(data, { onSuccess: handleClose });
        }
    };

    const handleDelete = (cat: Category) => {
        if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
        deleteMutation.mutate(cat.id);
    };


    const masters = useMemo(() => categories.filter(c => c.depth === 0), [categories]);
    const selectedMaster = useMemo(() => masters.find(m => m.id === selectedMasterId), [masters, selectedMasterId]);
    
    // Filtered categories logic
    const displayCategories = useMemo(() => {
        let list = categories;
        if (selectedMasterId !== 'all') {
            // Find all descendants of selected master
            const getDescendants = (parentId: string): string[] => {
                const children = categories.filter(c => c.parent_id === parentId);
                return [parentId, ...children.flatMap(c => getDescendants(c.id))];
            };
            const allowedIds = getDescendants(selectedMasterId as string);
            list = categories.filter(c => allowedIds.includes(c.id));
        }
        
        if (searchQuery) {
            list = list.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        
        return list;
    }, [categories, selectedMasterId, searchQuery]);

    const byParent = (parentId: string) => displayCategories.filter(c => c.parent_id === parentId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-brand-red/20 border-t-brand-red rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] min-h-[600px] animate-fade-in">
            {/* ── LEFT SIDEBAR (Category Tree) ── */}
            <aside className="w-full lg:w-64 flex flex-col gap-4 border-r border-border-default pr-6 overflow-y-auto">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Explorer</h3>
                    <button 
                        onClick={() => openCreate()} 
                        className="p-1.5 rounded-lg bg-brand-red/10 text-brand-red hover:bg-brand-red hover:text-white transition-all"
                        title="New Master Category"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                <div className="relative group px-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-red transition-colors" size={14} />
                    <input 
                        type="text" 
                        placeholder="Filter..." 
                        className="w-full pl-9 pr-3 py-2 bg-bg-subtle border border-border-default rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-1 pr-1">
                    <button
                        onClick={() => setSelectedMasterId('all')}
                        className={clsx(
                            "flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left mb-2",
                            selectedMasterId === 'all' ? "bg-brand-red text-white shadow-red-lg" : "text-text-secondary hover:bg-bg-subtle"
                        )}
                    >
                        <LayoutGrid size={16} />
                        <span className="text-sm font-bold flex-1">Overview</span>
                    </button>

                    <CategoryTreeComponent
                        tree={categoryTree}
                        selectedId={selectedMasterId === 'all' ? null : selectedMasterId}
                        onSelect={handleSelectFromTree}
                        productCounts={productCounts}
                    />
                </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                {/* Header Card */}
                <div className="bg-bg-surface border border-border-default rounded-3xl p-5 shadow-sm flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <Link to="/inventory" className="p-2 rounded-xl text-text-muted hover:bg-bg-subtle transition-all">
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <h2 className="text-lg font-black text-text-primary tracking-tight">
                                {selectedMasterId === 'all' ? 'Category Overview' : 
                                 selectedMaster?.name}
                            </h2>
                            <p className="text-xs text-text-muted font-medium">
                                {selectedMasterId === 'all' ? `${masters.length} master groups` : 
                                 selectedMaster?.description || 'Manage product classification'}
                            </p>
                        </div>
                    </div>
                    
                    {selectedMaster && (
                       <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(selectedMaster)} className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-all">
                                <Pencil size={16} />
                            </button>
                            <button onClick={() => handleDelete(selectedMaster)} className="p-2 rounded-xl text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all">
                                <Trash2 size={16} />
                            </button>
                            <button 
                                onClick={() => openCreate(selectedMaster)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-red text-white text-xs font-black shadow-red active:scale-95 transition-all"
                            >
                                <Plus size={14} /> ADD CATEGORY
                            </button>
                       </div>
                    )}
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 pb-10">
                    
                    {/* ──── MIGRATION VIEW ──── */}
                    {selectedMasterId === 'migration' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                             <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-8 text-center max-w-2xl mx-auto space-y-6">
                                <div className="w-16 h-16 bg-amber-500 rounded-3xl flex items-center justify-center mx-auto shadow-amber">
                                    <Zap size={32} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-text-primary">Inventory Structure Migration</h3>
                                    <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                                        This process scans all products for legacy "string-path" names (e.g., <span className="font-mono text-brand-red bg-red-500/5 px-1 rounded">STEEL &gt; BARS &gt; 10mm</span>) 
                                        and automatically converts them into clean names with direct relational category links.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                    <div className="bg-bg-surface/50 border border-border-default rounded-2xl p-4">
                                        <p className="text-[10px] font-black uppercase text-amber-600 mb-1">Impact</p>
                                        <p className="text-xs text-text-secondary">Normalizes hierarchy for 3-level depth reporting and high-speed filtering.</p>
                                    </div>
                                    <div className="bg-bg-surface/50 border border-border-default rounded-2xl p-4">
                                        <p className="text-[10px] font-black uppercase text-text-muted mb-1">Safety</p>
                                        <p className="text-xs text-text-secondary">Original full paths are preserved in the SKU field as historical references.</p>
                                    </div>
                                </div>

                                {migrationResult && (
                                    <div className={clsx(
                                        "rounded-2xl p-4 text-left border animate-in fade-in duration-500",
                                        migrationResult.errors.length === 0 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700' : 'bg-red-500/5 border-red-500/20 text-red-700'
                                    )}>
                                        <div className="flex items-center gap-3 font-black">
                                            {migrationResult.errors.length === 0 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                            <span className="text-sm uppercase tracking-wide">Migration Complete</span>
                                        </div>
                                        <div className="mt-3 flex gap-6 text-xs font-bold opacity-80">
                                            <span>MIGRATED: {migrationResult.migrated}</span>
                                            <span>SKIPPED: {migrationResult.skipped}</span>
                                            <span>ERRORS: {migrationResult.errors.length}</span>
                                        </div>
                                        {migrationResult.errors.length > 0 && (
                                            <div className="mt-3 p-3 bg-red-500/10 rounded-xl max-h-32 overflow-y-auto">
                                                {migrationResult.errors.map((e, i) => <p key={i} className="text-[10px] font-mono text-red-600 mb-1 leading-normal">• {e}</p>)}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleRunMigration}
                                    disabled={isMigrating}
                                    className="w-full py-4 rounded-2xl bg-amber-500 text-white font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-amber-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isMigrating ? <><Loader2 className="animate-spin" /> MIGRATING DATA...</> : <><Zap size={18} /> RUN GLOBAL MIGRATION</>}
                                </button>
                             </div>
                        </div>
                    )}

                    {/* ──── OVERVIEW / GRID VIEW ──── */}
                    {(selectedMasterId === 'all' || !selectedMaster) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in duration-500">
                            {masters.map(master => (
                                <div key={master.id} className="bg-bg-surface border border-border-default rounded-3xl p-5 hover:border-brand-red/40 transition-all flex flex-col gap-4 group cursor-pointer shadow-sm active:scale-[0.98]" onClick={() => handleCardClick(master.id)}>
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: master.color || '#64748b' }}>
                                            <Folder size={20} />
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Master</span>
                                            <span className="text-sm font-black text-text-primary uppercase">{master.name}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary">
                                            <span>Categories</span>
                                            <span>{categories.filter(c => c.parent_id === master.id).length}</span>
                                        </div>
                                        <div className="h-1 bg-bg-subtle rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-red transition-all duration-1000" style={{ width: `${Math.min(100, (categories.filter(c => c.parent_id === master.id).length / 20) * 100)}%` }} />
                                        </div>
                                    </div>
                                    <div className="pt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[10px] font-black text-brand-red uppercase tracking-widest flex items-center gap-1">Explorer <ChevronRight size={10} /></span>
                                        <div className="flex gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); openEdit(master); }} className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted transition-colors"><Pencil size={12} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(master); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors"><Trash2 size={12} /></button> 
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button 
                                onClick={() => openCreate()}
                                className="border-2 border-dashed border-border-default rounded-3xl p-5 hover:border-brand-red transition-all flex flex-col items-center justify-center gap-3 text-text-muted hover:text-brand-red min-h-[160px]"
                            >
                                <div className="w-10 h-10 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                                    <Plus size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">New Master Group</span>
                            </button>
                        </div>
                    )}

                    {/* ──── DETAIL LIST VIEW (Categories & Sub-categories) ──── */}
                    {selectedMaster && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            {byParent(selectedMaster.id).length === 0 ? (
                                <div className="bg-bg-surface border border-border-default rounded-3xl p-20 text-center flex flex-col items-center gap-4">
                                    <ListTree size={40} className="text-text-muted opacity-20" />
                                    <div>
                                        <p className="text-sm font-black text-text-secondary uppercase">No Categories in {selectedMaster.name}</p>
                                        <p className="text-xs text-text-muted mt-1 font-medium">Add a category to begin organizing products.</p>
                                    </div>
                                    <button 
                                        onClick={() => openCreate(selectedMaster)}
                                        className="mt-4 px-6 py-2.5 rounded-2xl bg-brand-red text-white text-xs font-black shadow-red uppercase tracking-widest"
                                    >
                                        Create First Category
                                    </button>
                                </div>
                            ) : (
                                byParent(selectedMaster.id).map(cat => (
                                    <div key={cat.id} className="bg-bg-surface border border-border-default rounded-3xl overflow-hidden shadow-sm shadow-black/5 hover:border-brand-red/20 transition-all">
                                        <div className="px-5 py-4 flex items-center justify-between border-b border-border-default bg-bg-surface/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-bg-subtle flex items-center justify-center text-text-muted group">
                                                    <Tag size={14} className="group-hover:text-brand-red transition-colors" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-text-primary uppercase tracking-tight">{cat.name}</h4>
                                                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{byParent(cat.id).length} sub-categories</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openCreate(cat)} className="p-2 rounded-xl bg-brand-red text-white hover:bg-brand-red-dark transition-all" title="New sub-category">
                                                    <Plus size={14} />
                                                </button>
                                                <button onClick={() => openEdit(cat)} className="p-2 rounded-xl text-text-muted hover:bg-bg-subtle transition-all"><Pencil size={14} /></button>
                                                <button onClick={() => handleDelete(cat)} className="p-2 rounded-xl text-text-muted hover:bg-red-500/10 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        
                                        <div className="p-2 bg-bg-subtle/20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {byParent(cat.id).map(sub => (
                                                <div key={sub.id} className="bg-bg-surface border border-border-default/50 rounded-2xl p-3 flex items-center justify-between group hover:shadow-md transition-all">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronRight size={10} className="text-brand-red" />
                                                        <span className="text-xs font-bold text-text-secondary truncate max-w-[140px]">{sub.name}</span>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openEdit(sub)} className="p-1 px-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-subtle"><Pencil size={11} /></button>
                                                        <button onClick={() => handleDelete(sub)} className="p-1 px-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10"><Trash2 size={11} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                            {byParent(cat.id).length === 0 && (
                                                <div className="col-span-full py-6 text-center text-text-muted italic text-[10px] font-medium uppercase tracking-widest opacity-40">No Sub-categories</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            <CategoryFormModal
                isOpen={modalOpen}
                onClose={handleClose}
                onSubmit={handleSubmit}
                isPending={createMutation.isPending || updateMutation.isPending}
                editCategory={editCategory}
                parentCategory={parentCategory}
            />
        </div>
    );
}
