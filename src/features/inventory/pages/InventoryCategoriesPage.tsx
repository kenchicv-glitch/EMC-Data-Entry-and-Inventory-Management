import { useState } from 'react';
import { Folder, Plus, Pencil, Trash2, ChevronRight, Tag } from 'lucide-react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks/useCategories';
import CategoryFormModal from '../components/CategoryFormModal';
import type { Category } from '../types/product';

export default function InventoryCategoriesPage() {
    const { data: categories = [], isLoading } = useCategories();
    const createMutation = useCreateCategory();
    const updateMutation = useUpdateCategory();
    const deleteMutation = useDeleteCategory();

    const [modalOpen, setModalOpen] = useState(false);
    const [editCategory, setEditCategory] = useState<Category | null>(null);
    const [parentCategory, setParentCategory] = useState<Category | null>(null);

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

    const masters = categories.filter(c => c.depth === 0);
    const byParent = (parentId: string) => categories.filter(c => c.parent_id === parentId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-brand-red/20 border-t-brand-red rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-black text-text-primary">Categories</h2>
                    <p className="text-xs text-text-muted">{categories.length} categories (max 3 levels)</p>
                </div>
                <button
                    onClick={() => openCreate()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-bold hover:bg-brand-red/90 transition-all"
                >
                    <Plus size={14} /> New Master Category
                </button>
            </div>

            {/* Category tree table */}
            {categories.length === 0 ? (
                <div className="border border-border-default rounded-xl p-12 text-center">
                    <Tag size={32} className="mx-auto mb-3 text-text-muted" />
                    <p className="text-sm font-semibold text-text-secondary">No categories yet</p>
                    <p className="text-xs text-text-muted mt-1">Create master categories to organize your products</p>
                </div>
            ) : (
                <div className="border border-border-default rounded-xl overflow-hidden">
                    {masters.map(master => (
                        <div key={master.id}>
                            {/* Master row */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default bg-bg-surface">
                                <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: master.color ?? '#64748b' }}
                                />
                                <Folder size={15} className="text-amber-400 shrink-0" />
                                <span className="font-bold text-text-primary flex-1">{master.name}</span>
                                {master.description && (
                                    <span className="text-xs text-text-muted hidden md:block">{master.description}</span>
                                )}
                                <div className="flex items-center gap-1 ml-auto">
                                    <button
                                        onClick={() => openCreate(master)}
                                        className="p-1.5 rounded-lg text-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-all"
                                        title="Add subcategory"
                                    >
                                        <Plus size={13} />
                                    </button>
                                    <button
                                        onClick={() => openEdit(master)}
                                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-all"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(master)}
                                        className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Children */}
                            {byParent(master.id).map(cat => (
                                <div key={cat.id}>
                                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-default/60 bg-bg-subtle/40">
                                        <ChevronRight size={12} className="text-text-muted ml-4 shrink-0" />
                                        <span className="font-semibold text-text-secondary flex-1 text-sm">{cat.name}</span>
                                        <div className="flex items-center gap-1 ml-auto">
                                            <button
                                                onClick={() => openCreate(cat)}
                                                className="p-1.5 rounded-lg text-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-all"
                                                title="Add sub-subcategory"
                                            >
                                                <Plus size={12} />
                                            </button>
                                            <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-all">
                                                <Pencil size={12} />
                                            </button>
                                            <button onClick={() => handleDelete(cat)} className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sub-children */}
                                    {byParent(cat.id).map(sub => (
                                        <div key={sub.id} className="flex items-center gap-3 px-4 py-2 border-b border-border-default/40 bg-bg-subtle/20">
                                            <ChevronRight size={11} className="text-text-muted ml-8 shrink-0" />
                                            <span className="text-text-secondary flex-1 text-xs">{sub.name}</span>
                                            <div className="flex items-center gap-1 ml-auto">
                                                <button onClick={() => openEdit(sub)} className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-all">
                                                    <Pencil size={11} />
                                                </button>
                                                <button onClick={() => handleDelete(sub)} className="p-1 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all">
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

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
