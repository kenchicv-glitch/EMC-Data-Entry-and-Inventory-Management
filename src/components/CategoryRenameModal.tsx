import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, Save, AlertTriangle, Loader2 } from 'lucide-react';

interface CategoryRenameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentName: string;
    level: 1 | 2 | 3;
}

export default function CategoryRenameModal({ isOpen, onClose, onSuccess, currentName, level }: CategoryRenameModalProps) {
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
            const { data: products, error: fetchError } = await supabase.from('products').select('id, name');
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
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center"><AlertTriangle size={18} /></div>
                        <h2 className="text-base font-bold">Global Rename</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
                <form onSubmit={handleRename} className="p-6 space-y-4">
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 leading-relaxed font-medium">
                        <p>Renaming <span className="font-black">"{currentName}"</span> globally.</p>
                        <p className="mt-1 opacity-80">Updates all products using this category.</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">New Name</label>
                        <input type="text" autoFocus className="modal-input uppercase font-bold" value={newName} onChange={e => setNewName(e.target.value.toUpperCase())} required />
                    </div>
                    {error && <div className="text-xs text-red-600 font-bold bg-red-50 p-3 rounded-lg border">Error: {error}</div>}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
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
