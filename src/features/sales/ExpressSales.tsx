import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../shared/lib/supabase';
import {
    Save, Plus, Trash2, ArrowLeft, Search, ShoppingCart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAudit } from '../../shared/hooks/useAudit';
import { useBranch } from '../../shared/hooks/useBranch';
import type { Product } from '../inventory/types/product';
import { toast } from 'sonner';
import { isSmartMatch } from '../../shared/lib/searchUtils';

interface ExpressRow {
    id: string;
    invoice_number: string;
    customer_id: string;
    customer_name: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    searchQuery: string;
    isSearchOpen: boolean;
    highlightedIndex: number;
    payment_mode: 'cash' | 'gcash' | 'card' | 'check';
    isOs: boolean;
    invoice_type: 'A' | 'B';
}

export default function ExpressSales() {
    const navigate = useNavigate();
    const { logAction } = useAudit();
    const { activeBranchId } = useBranch();
    const [rows, setRows] = useState<ExpressRow[]>([createEmptyRow()]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const searchInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const qtyInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const invoiceInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const saveButtonRef = useRef<HTMLButtonElement>(null);

    function createEmptyRow(): ExpressRow {
        return {
            id: crypto.randomUUID(),
            invoice_number: '',
            customer_id: '',
            customer_name: 'Walk-in Customer',
            product_id: '',
            product_name: '',
            quantity: 1,
            unit_price: 0,
            total_price: 0,
            searchQuery: '',
            isSearchOpen: false,
            highlightedIndex: 0,
            payment_mode: 'cash',
            isOs: true,
            invoice_type: 'A'
        };
    }

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];
            let prodQuery = supabase.from('products').select('*').order('name');
            let lastSalesQuery = supabase.from('sales').select('invoice_number').eq('is_os', true).gte('date', today).order('date', { ascending: false }).limit(1);

            if (activeBranchId) {
                prodQuery = prodQuery.eq('branch_id', activeBranchId);
                lastSalesQuery = lastSalesQuery.eq('branch_id', activeBranchId);
            }

            const [prodRes, lastSalesRes] = await Promise.all([
                prodQuery,
                lastSalesQuery
            ]);

            if (prodRes.data) setProducts(prodRes.data);

            if (lastSalesRes.data && lastSalesRes.data.length > 0) {
                const lastNum = lastSalesRes.data[0].invoice_number;
                const isOs = lastNum.startsWith('OS-');
                setRows(prev => prev.map((row, i) => i === 0 ? { ...row, invoice_number: incrementInvoice(lastNum), isOs } : row));
            } else {
                setRows(prev => prev.map((row, i) => i === 0 ? { ...row, invoice_number: 'OS-000001', isOs: true } : row));
            }
            setLoading(false);
            // Focus first search input when data is loaded
            setTimeout(() => {
                searchInputRefs.current[0]?.focus();
            }, 100);
        };
        fetchData();
    }, []);

    const incrementInvoice = (current: string) => {
        const num = parseInt(current.replace(/\D/g, '')) || 0;
        const nextNum = (num + 1).toString().padStart(6, '0');
        return current.startsWith('OS-') ? `OS-${nextNum}` : nextNum;
    };

    const handleAddRow = () => {
        const lastRow = rows[rows.length - 1];
        const newRow = createEmptyRow();
        newRow.invoice_number = incrementInvoice(lastRow.invoice_number);
        newRow.isOs = lastRow.isOs;
        newRow.invoice_type = lastRow.invoice_type;
        setRows([...rows, newRow]);
    };

    const handleRemoveRow = (index: number) => {
        if (rows.length === 1) return;
        setRows(rows.filter((_, i) => i !== index));
    };

    const updateRow = (index: number, updates: Partial<ExpressRow>) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], ...updates };

        if ('quantity' in updates || 'unit_price' in updates) {
            newRows[index].total_price = newRows[index].quantity * (newRows[index].unit_price || 0);
        }

        setRows(newRows);
    };

    const selectProduct = (index: number, product: Product) => {
        const currentRow = rows[index];
        const existingIndex = rows.findIndex((r, i) =>
            i !== index &&
            r.invoice_number === currentRow.invoice_number &&
            r.product_id === product.id
        );

        if (existingIndex !== -1) {
            // Merge duplicate
            const newRows = [...rows];
            newRows[existingIndex].quantity += currentRow.quantity;
            newRows[existingIndex].total_price = newRows[existingIndex].quantity * newRows[existingIndex].unit_price;

            // Remove current row if it was just used for selection
            if (rows.length > 1) {
                newRows.splice(index, 1);
            } else {
                newRows[index] = createEmptyRow();
                newRows[index].invoice_number = currentRow.invoice_number;
            }

            setRows(newRows);

            // Focus the existing quantity
            const focusIndex = existingIndex < index ? existingIndex : existingIndex - 1;
            setTimeout(() => {
                qtyInputRefs.current[focusIndex]?.focus();
                qtyInputRefs.current[focusIndex]?.select();
            }, 10);
            return;
        }

        if (product.stock_available <= 0) {
            toast.error(`"${product.name}" is out of stock`, {
                description: "Cannot add items with zero stock.",
                className: "font-black"
            });
            return;
        }

        updateRow(index, {
            product_id: product.id,
            product_name: product.name,
            unit_price: product.selling_price || 0,
            total_price: (product.selling_price || 0) * rows[index].quantity,
            searchQuery: product.name,
            isSearchOpen: false
        });

        setTimeout(() => {
            qtyInputRefs.current[index]?.focus();
        }, 10);
    };

    const handleSaveAll = async () => {
        if (saving) return;
        const validRows = rows.filter(r => r.product_id && r.invoice_number);
        if (validRows.length === 0) return;

        setSaving(true);
        try {
            const packageSales = validRows.map(r => ({
                invoice_number: r.invoice_number,
                customer_name: r.customer_name,
                customer_id: r.customer_id || null,
                product_id: r.product_id,
                quantity: r.quantity,
                unit_price: r.unit_price,
                total_price: r.total_price,
                payment_mode: r.payment_mode,
                is_os: r.isOs,
                fulfillment_status: 'pickup',
                date: new Date().toISOString(),
                or_number: r.invoice_number,
                invoice_type: r.isOs ? null : r.invoice_type,
                net_amount: r.total_price,
                branch_id: activeBranchId
            }));

            const { error } = await supabase.from('sales').insert(packageSales);
            if (error) throw error;

            // Audit Log - Log distinct invoices
            const distinctInvoices = Array.from(new Set(packageSales.map(s => s.invoice_number)));
            for (const inv of distinctInvoices) {
                await logAction({
                    action: 'CREATE_SALE',
                    table_name: 'sales',
                    record_id: inv,
                    new_data: packageSales.filter(s => s.invoice_number === inv)
                });
            }

            toast.success("Transactions saved successfully", {
                description: `${packageSales.length} entries have been recorded.`,
                className: "font-black"
            });

            // Reset Rows instead of navigating
            const firstInvoice = packageSales[0].invoice_number;
            const nextInvoice = incrementInvoice(firstInvoice);
            setRows([{ ...createEmptyRow(), invoice_number: nextInvoice }]);
            
            setTimeout(() => {
                searchInputRefs.current[0]?.focus();
            }, 100);

        } catch (err) {
            console.error('Save failed:', err);
            toast.error('Error saving transactions', {
                description: err instanceof Error ? err.message : 'Unknown error',
                className: "font-black"
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-brand-red transition-all">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-brand-charcoal tracking-tight flex items-center gap-2">
                            <ShoppingCart className="text-brand-red" size={24} /> Express Sales Entry
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">Bulk encode multiple receipts in a single view</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        ref={saveButtonRef}
                        onClick={handleSaveAll}
                        disabled={saving || loading}
                        className="flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-brand-red-dark transition-all shadow-red disabled:opacity-50 ring-offset-2 focus:ring-2 focus:ring-brand-red"
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                searchInputRefs.current[rows.length - 1]?.focus();
                            }
                        }}
                    >
                        {saving ? 'SAVING...' : <><Save size={18} /> SAVE ALL ENTRIES</>}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden min-h-[500px]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-black text-brand-charcoal uppercase tracking-widest w-48 text-center">Invoice #</th>
                            <th className="px-6 py-4 text-[10px] font-black text-brand-charcoal uppercase tracking-widest">Product Search</th>
                            <th className="px-6 py-4 text-[10px] font-black text-brand-charcoal uppercase tracking-widest w-32 text-center">Qty</th>
                            <th className="px-6 py-4 text-[10px] font-black text-brand-charcoal uppercase tracking-widest w-40 text-right">Unit Price</th>
                            <th className="px-6 py-4 text-[10px] font-black text-brand-charcoal uppercase tracking-widest w-44 text-right">Total</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {rows.map((row, index) => (
                            <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-3">
                                    <div className="flex flex-col gap-1.5 items-center">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="text"
                                                className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-data font-bold focus:border-brand-red outline-none text-center"
                                                value={row.invoice_number}
                                                ref={el => { invoiceInputRefs.current[index] = el; }}
                                                onChange={(e) => updateRow(index, { invoice_number: e.target.value })}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newIsOs = !row.isOs;
                                                    const newInv = newIsOs 
                                                        ? (row.invoice_number.startsWith('OS-') ? row.invoice_number : `OS-${row.invoice_number}`)
                                                        : row.invoice_number.replace('OS-', '');
                                                    updateRow(index, { isOs: newIsOs, invoice_number: newInv });
                                                }}
                                                className={`px-1.5 py-0.5 rounded text-[8px] font-black transition-all ${row.isOs ? 'bg-brand-red text-white' : 'bg-slate-100 text-slate-400'}`}
                                            >
                                                OS
                                            </button>
                                        </div>
                                        <div className="flex bg-slate-100 border border-slate-200 rounded-md p-0.5 scale-90">
                                            <button
                                                type="button"
                                                onClick={() => updateRow(index, { invoice_type: 'A' })}
                                                className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${row.invoice_type === 'A' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-slate-400'}`}
                                            >
                                                A
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateRow(index, { invoice_type: 'B' })}
                                                className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${row.invoice_type === 'B' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-slate-400'}`}
                                            >
                                                B
                                            </button>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3 relative">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                        <input
                                            type="text"
                                            placeholder="Type product name..."
                                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:border-brand-red outline-none shadow-inner"
                                            value={row.searchQuery}
                                            ref={el => { searchInputRefs.current[index] = el; }}
                                            onFocus={() => updateRow(index, { isSearchOpen: true })}
                                            onChange={(e) => updateRow(index, { searchQuery: e.target.value, isSearchOpen: true })}
                                            onKeyDown={(e) => {
                                                const query = row.searchQuery.toLowerCase();
                                                const filtered = products
                                                    .filter(p => isSmartMatch(p.name, query))
                                                    .slice(0, 10);

                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    if (row.isSearchOpen) {
                                                        updateRow(index, { highlightedIndex: Math.min(row.highlightedIndex + 1, filtered.length - 1) });
                                                    } else {
                                                        updateRow(index, { isSearchOpen: true });
                                                    }
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    updateRow(index, { highlightedIndex: Math.max(row.highlightedIndex - 1, 0) });
                                                } else if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (row.isSearchOpen && filtered[row.highlightedIndex]) {
                                                        selectProduct(index, filtered[row.highlightedIndex]);
                                                    } else if (!row.searchQuery && rows.some(r => r.product_id)) {
                                                        // Move focus to save button on empty search Enter
                                                        saveButtonRef.current?.focus();
                                                    }
                                                } else if (e.key === 'Escape') {
                                                    if (row.isSearchOpen) {
                                                        updateRow(index, { isSearchOpen: false });
                                                    } else {
                                                        updateRow(index, { searchQuery: '' });
                                                    }
                                                }
                                            }}
                                        />
                                        {row.isSearchOpen && (
                                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                                                {products.filter(p => isSmartMatch(p.name, row.searchQuery)).slice(0, 10).map((p, pIdx) => (
                                                    <div
                                                        key={p.id}
                                                        className={`px-4 py-2 text-[11px] cursor-pointer flex justify-between items-center ${row.highlightedIndex === pIdx ? 'bg-brand-red/5 text-brand-red' : 'hover:bg-slate-50'}`}
                                                        onClick={() => selectProduct(index, p)}
                                                        onMouseEnter={() => updateRow(index, { highlightedIndex: pIdx })}
                                                    >
                                                        <span className="font-bold">{p.name} {p.brand ? `[${p.brand}]` : ''}</span>
                                                        <div className="flex gap-4">
                                                        <span className={`text-slate-400 font-data ${p.stock_available <= 0 ? 'text-brand-red font-bold animate-pulse' : ''}`}>STK: {p.stock_available}</span>
                                                        <span className="font-data font-black">₱{p.selling_price}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-data text-center focus:border-brand-red outline-none"
                                        value={row.quantity}
                                        ref={el => { qtyInputRefs.current[index] = el; }}
                                        onChange={(e) => updateRow(index, { quantity: parseInt(e.target.value) || 0 })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (index === rows.length - 1) {
                                                    handleAddRow();
                                                    setTimeout(() => searchInputRefs.current[index + 1]?.focus(), 50);
                                                } else {
                                                    searchInputRefs.current[index + 1]?.focus();
                                                }
                                            } else if (e.key === 'Escape') {
                                                searchInputRefs.current[index]?.focus();
                                                searchInputRefs.current[index]?.select();
                                            }
                                        }}
                                    />
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <span className="text-xs font-data font-bold text-slate-600">₱{row.unit_price.toLocaleString()}</span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <span className="text-sm font-data font-black text-brand-charcoal">₱{row.total_price.toLocaleString()}</span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <button onClick={() => handleRemoveRow(index)} className="p-2 text-slate-300 hover:text-brand-red transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                    <button onClick={handleAddRow} className="flex items-center gap-2 text-xs font-black text-brand-red hover:text-brand-red-dark uppercase tracking-widest transition-all">
                        <Plus size={16} /> Add Receipt Line
                    </button>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total ({rows.filter(r => r.product_id).length} Entries)</p>
                        <p className="text-3xl font-black text-brand-charcoal font-data tracking-tight">₱{rows.reduce((sum, r) => sum + r.total_price, 0).toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </div >
    );
}
