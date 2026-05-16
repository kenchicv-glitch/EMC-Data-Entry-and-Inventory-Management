import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Category } from '../types/product';

interface CategoryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        name: string;
        description: string | null;
        color: string | null;
        display_order: number;
        parent_id?: string | null;
    }) => void;
    isPending: boolean;
    /** If provided, modal is in edit mode */
    editCategory?: Category | null;
    /** If provided, new category is created as a child of this parent */
    parentCategory?: Category | null;
    maxDepth?: number;
}

const PRESET_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
    '#6366F1', '#84CC16',
];

export default function CategoryFormModal({
    isOpen,
    onClose,
    onSubmit,
    isPending,
    editCategory,
    parentCategory,
}: CategoryFormModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState<string | null>(null);
    const [displayOrder, setDisplayOrder] = useState(0);

    const isEdit = Boolean(editCategory);
    const parentDepth = parentCategory?.depth ?? -1;
    const wouldBeDepth = parentCategory ? parentDepth + 1 : 0;

    useEffect(() => {
        if (editCategory) {
            setName(editCategory.name);
            setDescription(editCategory.description ?? '');
            setColor(editCategory.color ?? null);
            setDisplayOrder(editCategory.display_order);
        } else {
            setName('');
            setDescription('');
            setColor(null);
            setDisplayOrder(0);
        }
    }, [editCategory, isOpen]);

    // Handle body scroll locking
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
            name: name.trim(),
            description: description.trim() || null,
            color,
            display_order: displayOrder,
            parent_id: isEdit ? editCategory!.parent_id : (parentCategory?.id ?? null),
        });
    };

    const depthLabel = ['Master category', 'Category', 'Subcategory'][wouldBeDepth] ?? 'Category';

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
            {/* Backdrop with Blur and Darken */}
            <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
                onClick={onClose} 
            />
            
            {/* Centering container */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-md bg-bg-surface border border-border-default rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
                        <div>
                            <h2 className="text-base font-bold text-text-primary">
                                {isEdit ? 'Edit Category' : `New ${depthLabel}`}
                            </h2>
                            {parentCategory && !isEdit && (
                                <p className="text-xs text-text-muted mt-0.5">
                                    Under: <span className="font-semibold text-text-secondary">{parentCategory.name}</span>
                                </p>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
                        <div>
                            <label className="block text-xs font-black text-text-muted uppercase tracking-wider mb-1.5">
                                Name *
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Plumbing"
                                className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-text-muted uppercase tracking-wider mb-1.5">
                                Description
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Optional description"
                                className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-text-muted uppercase tracking-wider mb-1.5">
                                Color
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setColor(null)}
                                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                                        !color ? 'border-brand-red scale-110' : 'border-border-default'
                                    } bg-bg-subtle`}
                                >
                                    <X size={10} className="text-text-muted" />
                                </button>
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                                            color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                                        }`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-text-muted uppercase tracking-wider mb-1.5">
                                Display Order
                            </label>
                            <input
                                type="number"
                                value={displayOrder}
                                onChange={e => setDisplayOrder(Number(e.target.value))}
                                min={0}
                                className="w-24 px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2 rounded-xl border border-border-default text-sm font-semibold text-text-secondary hover:bg-bg-subtle transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isPending || !name.trim()}
                                className="flex-1 px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-bold hover:bg-brand-red/90 disabled:opacity-50 transition-all"
                            >
                                {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
