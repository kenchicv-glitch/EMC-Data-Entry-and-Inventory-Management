import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { InventoryLocation } from '../types/product';

interface LocationFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<InventoryLocation, 'id' | 'created_at' | 'children'>) => void;
    isPending: boolean;
    editLocation?: InventoryLocation | null;
    branchId: string | null;
    existingLocations: InventoryLocation[];
}

export default function LocationFormModal({
    isOpen,
    onClose,
    onSubmit,
    isPending,
    editLocation,
    branchId,
    existingLocations,
}: LocationFormModalProps) {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [parentId, setParentId] = useState<string | null>(null);
    const [displayOrder, setDisplayOrder] = useState(0);

    const isEdit = Boolean(editLocation);

    useEffect(() => {
        if (editLocation) {
            setName(editLocation.name);
            setCode(editLocation.code);
            setDescription(editLocation.description ?? '');
            setParentId(editLocation.parent_id);
            setDisplayOrder(editLocation.display_order);
        } else {
            setName('');
            setCode('');
            setDescription('');
            setParentId(null);
            setDisplayOrder(0);
        }
    }, [editLocation, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !code.trim()) return;
        onSubmit({
            name: name.trim(),
            code: code.trim().toUpperCase(),
            description: description.trim() || null,
            parent_id: parentId || null,
            branch_id: branchId,
            display_order: displayOrder,
        });
    };

    const parentOptions = existingLocations.filter(l => l.id !== editLocation?.id);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-bg-surface border border-border-default rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
                    <h2 className="text-base font-bold text-text-primary">
                        {isEdit ? 'Edit Location' : 'New Location'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-black text-text-muted uppercase tracking-wider mb-1.5">
                                Code *
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="e.g. SH-A"
                                className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm font-mono text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-text-muted uppercase tracking-wider mb-1.5">
                                Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Shelf A"
                                className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all"
                                required
                            />
                        </div>
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
                            Parent Location (optional)
                        </label>
                        <select
                            value={parentId ?? ''}
                            onChange={e => setParentId(e.target.value || null)}
                            className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all cursor-pointer"
                        >
                            <option value="">None (top-level)</option>
                            {parentOptions.map(l => (
                                <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                            ))}
                        </select>
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
                            disabled={isPending || !name.trim() || !code.trim()}
                            className="flex-1 px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-bold hover:bg-brand-red/90 disabled:opacity-50 transition-all"
                        >
                            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
