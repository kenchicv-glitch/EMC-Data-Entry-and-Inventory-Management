import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Wallet, Users } from 'lucide-react';
import { useDscExpenses, useBatchUpsertExpenses } from '../../hooks/useDscExpenses';
import type { DscExpenseEntry } from '../../types';

interface Props { 
  dayId: string; 
  readOnly?: boolean; 
}

type ExpenseRow = Omit<DscExpenseEntry, 'id' | 'day_id' | 'created_at'> & { id?: string };

export function ExpensesSection({ dayId, readOnly = false }: Props) {
  const { data: entries = [], isLoading } = useDscExpenses(dayId);
  const batchUpsert = useBatchUpsertExpenses();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (entries.length > 0) {
      setRows(entries.map((e) => ({ 
        id: e.id,
        description: e.description, 
        amount: Number(e.amount), 
        category: e.category,
        reference_id: e.reference_id,
        sort_order: e.sort_order 
      })));
      setDirty(false);
    } else {
      setRows([]);
    }
  }, [entries]);

  const updateRow = (i: number, f: keyof ExpenseRow, v: any) => { 
    setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r)); 
    setDirty(true); 
  };

  const addRow = (category: 'general' | 'salary') => { 
    setRows((p) => [...p, { 
      description: '', 
      amount: 0, 
      category, 
      sort_order: p.length 
    }]); 
    setDirty(true); 
  };

  const removeRow = (i: number) => { 
    setRows((p) => p.filter((_, idx) => idx !== i)); 
    setDirty(true); 
  };

  const save = () => { 
    batchUpsert.mutate({ dayId, items: rows.filter((r) => r.description.trim()) }); 
    setDirty(false); 
  };

  const salaries = rows.filter(r => r.category === 'salary');
  const generalExpenses = rows.filter(r => r.category === 'general');
  
  const totalSalaries = salaries.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalGeneral = generalExpenses.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const total = totalSalaries + totalGeneral;

  if (isLoading) return <div className="skeleton h-48 rounded-xl" />;

  const renderRows = (items: ExpenseRow[], category: 'general' | 'salary') => {
    return items.map((row, i) => {
      // Find original index in 'rows' state
      const originalIndex = rows.findIndex(r => r === row);
      return (
        <div key={`${category}-${i}`} className="grid grid-cols-[1fr_100px_30px] gap-1 items-center animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="relative group">
            <input 
              type="text" 
              value={row.description} 
              onChange={(e) => updateRow(originalIndex, 'description', e.target.value)} 
              disabled={readOnly || !!row.reference_id} 
              className={`modal-input !py-0.5 text-[10px] h-7 ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} 
              placeholder={category === 'salary' ? "Employee..." : "Expense..."}
            />
            {row.reference_id && (
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] font-black text-brand-red uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">SYNC</span>
            )}
          </div>
          <input 
            type="number" 
            value={row.amount || ''} 
            onChange={(e) => updateRow(originalIndex, 'amount', parseFloat(e.target.value) || 0)} 
            disabled={readOnly || !!row.reference_id} 
            step="0.01" 
            className={`modal-input !py-0.5 text-[10px] text-right font-data h-7 ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} 
          />
          {!readOnly && !row.reference_id && (
            <button onClick={() => removeRow(originalIndex)} className="p-1 text-text-muted hover:text-brand-red transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      );
    });
  };

  return (
    <div className="bento-card p-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Wallet size={16} className="text-brand-red" /> 
            Expenses & Salaries
          </h3>
          <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-0">Operating Outflow</p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && dirty && (
            <button 
              onClick={save} 
              disabled={batchUpsert.isPending} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-all shadow-red"
            >
              <Save size={14} /> Save Changes
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {/* General Expenses Sub-section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-border-default pb-1">
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
              General Expenses
            </h4>
            {!readOnly && (
              <button onClick={() => addRow('general')} className="p-1 rounded-lg hover:bg-bg-subtle text-brand-red transition-colors">
                <Plus size={16} />
              </button>
            )}
          </div>
          <div className="space-y-2">
            {generalExpenses.length > 0 ? (
              <>
                <div className="text-[9px] font-black text-text-muted/50 uppercase tracking-widest grid grid-cols-[1fr_100px_30px] gap-1 px-1">
                  <span>Description</span><span className="text-right">Amount</span><span />
                </div>
                {renderRows(generalExpenses, 'general')}
                <div className="flex justify-end text-[10px] font-black text-text-secondary pt-1.5 border-t border-border-default/50 border-dashed">
                  Total Gen: <span className="font-data ml-2 text-brand-red">₱{totalGeneral.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-text-muted/40 italic text-center py-4">No general expenses recorded.</p>
            )}
          </div>
        </div>

        {/* Salaries Sub-section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-border-default pb-1">
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Users size={12} /> Salaries
            </h4>
            {!readOnly && (
              <button onClick={() => addRow('salary')} className="p-1 rounded-lg hover:bg-bg-subtle text-brand-red transition-colors">
                <Plus size={16} />
              </button>
            )}
          </div>
          <div className="space-y-2">
            {salaries.length > 0 ? (
              <>
                <div className="text-[9px] font-black text-text-muted/50 uppercase tracking-widest grid grid-cols-[1fr_100px_30px] gap-1 px-1">
                  <span>Employee / Type</span><span className="text-right">Amount</span><span />
                </div>
                {renderRows(salaries, 'salary')}
                <div className="flex justify-end text-[10px] font-black text-text-secondary pt-1.5 border-t border-border-default/50 border-dashed">
                  Total Salary: <span className="font-data ml-2 text-brand-red">₱{totalSalaries.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-text-muted/40 italic text-center py-4">No salary entries recorded.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center gap-2 pt-1.5 border-t border-border-default">
          <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Total Expenses:</span>
          <span className="text-sm font-black text-text-primary font-data text-brand-red">
            ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
      </div>
    </div>
  );
}
