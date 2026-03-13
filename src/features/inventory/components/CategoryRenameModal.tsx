import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../shared/lib/supabase';
import { X, Save, AlertTriangle, Loader2 } from 'lucide-react';
import { useBranch } from '../../../shared/lib/BranchContext';

interface CategoryRenameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentName: string;
    level: 1 | 2 | 3;
}

export default function CategoryRenameModal({ isOpen, onClose, onSuccess, currentName, level }: CategoryRenameModalProps) {
    const { activeBranchId } = useBranch();
    const [newName, setNewName] = useState(currentName);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleRename = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedNewName = newName.trim().toUpperCase();
        if (!trimmedNewName || trimmedNewName === currentName) {
            onClose();
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let query = supabase.from('products').select('id, name');
            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }
            const { data: products, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            const updates = products?.filter(p => {
                const parts = p.name.split(' > ');
                return parts[level - 1] === currentName;
            }).map(p => {
                const parts = p.name.split(' > ');
                parts[level - 1] = trimmedNewName;
                return { id: p.id, name: parts.join(' > ') };
            }) || [];

            if (updates.length > 0) {
                const { error: updateError } = await supabase.from('products').upsert(updates);
                if (updateError) throw updateError;
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
            <div className="w-full max-w-md rounded-2xl bg-surface shadow-2xl border border-border-default overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between px-6 py-4 bg-text-primary">
                    <div className="flex items-center gap-3 text-text-inverse">
                        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white"><AlertTriangle size={18} /></div>
                        <h2 className="text-base font-bold">Global Rename</h2>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-text-inverse"><X size={18} /></button>
                </div>
                <form onSubmit={handleRename} className="p-6 space-y-4">
                    <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-600 leading-relaxed font-medium">
                        <p>Renaming <span className="font-black">"{currentName}"</span> globally.</p>
                        <p className="mt-1 opacity-80">Updates all products using this category.</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-text-muted mb-1.5">New Name</label>
                        <input type="text" autoFocus className="modal-input text-sm bg-surface border border-border-default text-text-primary rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-brand-red/20 uppercase font-bold" value={newName} onChange={e => setNewName(e.target.value.toUpperCase())} required />
                    </div>
                    {error && <div className="text-xs text-red-600 font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">Error: {error}</div>}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-text-secondary hover:bg-subtle rounded-xl">Cancel</button>
                        <button type="submit" disabled={loading || !newName.trim() || newName.trim() === currentName} className="flex items-center gap-2 bg-brand-red text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-red disabled:opacity-50">
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            {loading ? 'Renaming...' : 'Rename Globally'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
