import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useDscSiSummary, useBatchUpsertSiSummary } from '../../hooks/useDscSiSummary';

interface Props { dayId: string; readOnly?: boolean; }
type Row = { book_label: string; si_range_start: string; si_range_end: string; total: number; };

export function SiSummarySection({ dayId, readOnly = false }: Props) {
  const { data: summaries = [], isLoading } = useDscSiSummary(dayId);
  const batchUpsert = useBatchUpsertSiSummary();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (summaries.length > 0) {
      setRows(summaries.map((s) => ({ book_label: s.book_label, si_range_start: s.si_range_start || '', si_range_end: s.si_range_end || '', total: Number(s.total) })));
      setDirty(false);
    }
  }, [summaries]);

  const updateRow = (i: number, f: keyof Row, v: string | number) => { setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r)); setDirty(true); };
  const addRow = () => { setRows((p) => [...p, { book_label: '', si_range_start: '', si_range_end: '', total: 0 }]); setDirty(true); };
  const removeRow = (i: number) => { setRows((p) => p.filter((_, idx) => idx !== i)); setDirty(true); };
  const save = () => { batchUpsert.mutate({ dayId, items: rows.filter((r) => r.book_label.trim()) }); setDirty(false); };
  const total = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  return (
    <div className="bento-card p-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">SI Receipt Summary</h3>
        <div className="flex items-center gap-2">
          {!readOnly && <button onClick={addRow} className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-brand-red transition-colors"><Plus size={14} /></button>}
          {!readOnly && dirty && <button onClick={save} disabled={batchUpsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors"><Save size={12} /> Save</button>}
        </div>
      </div>
      <div className="text-[10px] font-black text-text-muted uppercase tracking-widest grid grid-cols-[100px_80px_80px_90px_30px] gap-1">
        <span>Book</span><span>SI From</span><span>SI To</span><span>Total</span><span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[100px_80px_80px_90px_30px] gap-1 items-center">
          <input type="text" value={row.book_label} onChange={(e) => updateRow(i, 'book_label', e.target.value)} disabled={readOnly} className="modal-input !py-1 text-[10px]" placeholder="A#..." />
          <input type="text" value={row.si_range_start} onChange={(e) => updateRow(i, 'si_range_start', e.target.value)} disabled={readOnly} className="modal-input !py-1 text-[10px]" />
          <input type="text" value={row.si_range_end} onChange={(e) => updateRow(i, 'si_range_end', e.target.value)} disabled={readOnly} className="modal-input !py-1 text-[10px]" />
          <input type="number" value={row.total || ''} onChange={(e) => updateRow(i, 'total', parseFloat(e.target.value) || 0)} disabled={readOnly} step="0.01" className="modal-input !py-1 text-[10px] text-right font-data" />
          {!readOnly && <button onClick={() => removeRow(i)} className="p-0.5 text-text-muted hover:text-brand-red transition-colors"><Trash2 size={12} /></button>}
        </div>
      ))}
      <div className="flex justify-end text-xs font-bold text-text-secondary pt-1.5 border-t border-border-default">
        Total: <span className="font-data ml-1 text-brand-red">₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}
