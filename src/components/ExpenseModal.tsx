import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Wallet, Receipt, AlertTriangle } from 'lucide-react';

interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newExpense?: unknown) => void;
}

const CATEGORIES = ['Salary', 'Donation', 'Others'] as const;

export default function ExpenseModal({ isOpen, onClose, onSuccess }: ExpenseModalProps) {
    const [category, setCategory] = useState<typeof CATEGORIES[number]>('Salary');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setCategory('Salary');
            setDescription('');
            setAmount(0);
            setInvoiceNumber('');
            setError(null);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error: insertError } = await supabase
                .from('expenses')
                .insert([{
                    category,
                    description,
                    amount,
                    invoice_number: invoiceNumber,
                    user_id: user?.id
                }])
                .select();

            if (insertError) throw insertError;

            setTimeout(() => {
                onSuccess(data?.[0]);
                onClose();
            }, 500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border flex flex-col animate-slide-up">
                <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center"><Wallet size={16} /></div>
                        <h2 className="text-base font-bold">Log Expense</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>

                <div className="p-8">
                    {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
                    <form id="expense-form" onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Category</label>
                            <div className="grid grid-cols-3 gap-3">
                                {CATEGORIES.map(cat => (
                                    <button key={cat} type="button" onClick={() => setCategory(cat)} className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${category === cat ? 'bg-brand-red text-white border-brand-red shadow-lg' : 'bg-white text-slate-400 border-slate-200'}`}>{cat}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Voucher #</label>
                            <div className="relative"><Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="modal-input pl-12 font-data" placeholder="EX-001" required /></div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Description</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} className="modal-input min-h-[100px] py-3" placeholder="Details..." required />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Total Amount</label>
                            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span><input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className="modal-input pl-8 font-data text-xl text-brand-red font-black" required /></div>
                        </div>
                    </form>
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t flex items-center justify-between">
                    <button type="button" onClick={onClose} className="text-sm font-bold text-slate-400">Cancel</button>
                    <button type="submit" form="expense-form" disabled={loading} className="px-8 py-3 bg-brand-charcoal text-white rounded-xl font-black text-sm shadow-xl disabled:opacity-50">{loading ? 'Processing...' : 'Record Expense'}</button>
                </div>
            </div>
        </div>
    );
}
