import { useState, useEffect } from 'react';
import { MinusCircle, Trash2, Save, Receipt, Info } from 'lucide-react';
import { useDscReturns, useBatchUpsertReturns } from '../../hooks/useDscReturns';
import type { DscReturnEntry } from '../../types';

interface Props { 
  dayId: string; 
  readOnly?: boolean; 
}

type ReturnRow = Omit<DscReturnEntry, 'id' | 'day_id' | 'created_at'> & { id?: string };

export function ReturnsSection({ dayId, readOnly = false }: Props) {
  const { data: entries = [], isLoading } = useDscReturns(dayId);
  const batchUpsert = useBatchUpsertReturns();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (entries.length > 0) {
      setRows(entries.map((e) => ({ 
        id: e.id,
        original_invoice_no: e.original_invoice_no,
        description: e.description, 
        qty: e.qty,
        unit_price: e.unit_price,
        amount: Number(e.amount), 
        reason: e.reason,
        reference_id: e.reference_id,
        sort_order: e.sort_order 
      })));
      setDirty(false);
    } else {
      setRows([]);
    }
  }, [entries]);

  const updateRow = (i: number, f: keyof ReturnRow, v: any) => { 
    setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r)); 
    setDirty(true); 
  };

  const addRow = () => { 
    setRows((p) => [...p, { 
      original_invoice_no: '',
      description: '', 
      qty: 1,
      unit_price: 0,
      amount: 0, 
      reason: '',
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

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  return (
    <div className="bento-card p-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500">
            <MinusCircle size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Returns</h3>
            <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-0 text-amber-600/70">Sales Deductions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
             <button 
              onClick={addRow} 
              className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-amber-600 transition-colors"
              title="Add manual refund"
            >
              <Receipt size={16} />
            </button>
          )}
          {!readOnly && dirty && (
            <button 
              onClick={save} 
              disabled={batchUpsert.isPending} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-900/20"
            >
              <Save size={12} /> Save
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-0.5">
          <thead>
            <tr className="text-[9px] font-black text-text-muted uppercase tracking-[0.15em]">
              <th className="px-2 py-1">Inv #</th>
              <th className="px-2 py-1">Items Refunded / Description</th>
              <th className="px-2 py-1 text-right">Qty</th>
              <th className="px-2 py-1 text-right">Unit</th>
              <th className="px-2 py-1 text-right">Amount</th>
              <th className="px-2 py-1">Reason</th>
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, i) => (
                <tr key={i} className="group animate-in fade-in slide-in-from-top-1 duration-200">
                  <td className="w-16">
                    <input 
                      type="text" 
                      value={row.original_invoice_no || ''} 
                      onChange={(e) => updateRow(i, 'original_invoice_no', e.target.value)} 
                      disabled={readOnly || !!row.reference_id} 
                      className={`modal-input !py-1 text-[10px] font-data text-amber-700 ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`}
                      placeholder="Inv..."
                    />
                  </td>
                  <td>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={row.description} 
                        onChange={(e) => updateRow(i, 'description', e.target.value)} 
                        disabled={readOnly || !!row.reference_id} 
                        className={`modal-input !py-1 text-[10px] ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`}
                        placeholder="Item..."
                      />
                      {row.reference_id && (
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] font-black text-amber-600/60 uppercase tracking-widest pointer-events-none">SYNC</span>
                      )}
                    </div>
                  </td>
                  <td className="w-16">
                    <input 
                      type="number" 
                      value={row.qty || ''} 
                      onChange={(e) => {
                        const q = parseFloat(e.target.value) || 0;
                        updateRow(i, 'qty', q);
                        updateRow(i, 'amount', q * (row.unit_price || 0));
                      }} 
                      disabled={readOnly || !!row.reference_id} 
                      className={`modal-input !py-1 text-[10px] text-right font-data ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`}
                    />
                  </td>
                  <td className="w-24">
                    <input 
                      type="number" 
                      value={row.unit_price || ''} 
                      onChange={(e) => {
                        const u = parseFloat(e.target.value) || 0;
                        updateRow(i, 'unit_price', u);
                        updateRow(i, 'amount', u * (row.qty || 0));
                      }} 
                      disabled={readOnly || !!row.reference_id} 
                      className={`modal-input !py-1 text-[10px] text-right font-data ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`}
                    />
                  </td>
                  <td className="w-16">
                    <input 
                      type="number" 
                      value={row.amount || ''} 
                      onChange={(e) => updateRow(i, 'amount', parseFloat(e.target.value) || 0)} 
                      disabled={readOnly || !!row.reference_id} 
                      className={`modal-input !py-1 text-[10px] text-right font-black text-amber-700 font-data ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`}
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      value={row.reason || ''} 
                      onChange={(e) => updateRow(i, 'reason', e.target.value)} 
                      disabled={readOnly || !!row.reference_id} 
                      className={`modal-input !py-1 text-[10px] ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`}
                      placeholder="Reason..."
                    />
                  </td>
                  {!readOnly && !row.reference_id && (
                    <td className="text-center">
                      <button onClick={() => removeRow(i)} className="p-1 text-text-muted hover:text-brand-red transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center">
                   <div className="flex flex-col items-center gap-2 text-text-muted/30">
                     <Info size={24} />
                     <p className="text-[10px] font-black uppercase tracking-widest italic">No returns or refunds recorded for this day.</p>
                   </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="flex justify-end pt-2 border-t border-border-default/50">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Total Deductions:</span>
            <span className="text-sm font-black text-amber-600 font-data">
              - ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
