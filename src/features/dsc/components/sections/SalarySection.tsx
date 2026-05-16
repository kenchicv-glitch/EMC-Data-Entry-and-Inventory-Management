import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useDscSalary, useBatchUpsertSalary } from '../../hooks/useDscSalary';

interface Props { dayId: string; readOnly?: boolean; }
type Row = { employee_name: string; rate: number; days_worked: number; amount: number; note: string; };

export function SalarySection({ dayId, readOnly = false }: Props) {
  const { data: entries = [], isLoading } = useDscSalary(dayId);
  const batchUpsert = useBatchUpsertSalary();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (entries.length > 0) {
      setRows(entries.map((e) => ({ employee_name: e.employee_name, rate: Number(e.rate) || 0, days_worked: Number(e.days_worked) || 0, amount: Number(e.amount), note: e.note || '' })));
      setDirty(false);
    }
  }, [entries]);

  const updateRow = (i: number, f: keyof Row, v: string | number) => { setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r)); setDirty(true); };
  const addRow = () => { setRows((p) => [...p, { employee_name: '', rate: 0, days_worked: 0, amount: 0, note: '' }]); setDirty(true); };
  const removeRow = (i: number) => { setRows((p) => p.filter((_, idx) => idx !== i)); setDirty(true); };
  const save = () => { batchUpsert.mutate({ dayId, items: rows.filter((r) => r.employee_name.trim()) }); setDirty(false); };
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  return (
    <div className="bento-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Salary</h3>
        <div className="flex items-center gap-2">
          {!readOnly && <button onClick={addRow} className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-brand-red transition-colors"><Plus size={14} /></button>}
          {!readOnly && dirty && <button onClick={save} disabled={batchUpsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors"><Save size={12} /> Save</button>}
        </div>
      </div>
      <div className="text-[10px] font-black text-text-muted uppercase tracking-widest grid grid-cols-[1fr_70px_60px_80px_1fr_30px] gap-1">
        <span>Employee</span><span>Rate</span><span>Days</span><span>Amount</span><span>Note</span><span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_70px_60px_80px_1fr_30px] gap-1 items-center">
          <input type="text" value={row.employee_name} onChange={(e) => updateRow(i, 'employee_name', e.target.value)} disabled={readOnly} className="modal-input !py-1 text-[11px]" />
          <input type="number" value={row.rate || ''} onChange={(e) => updateRow(i, 'rate', parseFloat(e.target.value) || 0)} disabled={readOnly} step="0.01" className="modal-input !py-1 text-[11px] text-right font-data" />
          <input type="number" value={row.days_worked || ''} onChange={(e) => updateRow(i, 'days_worked', parseFloat(e.target.value) || 0)} disabled={readOnly} step="0.5" className="modal-input !py-1 text-[11px] text-right font-data" />
          <input type="number" value={row.amount || ''} onChange={(e) => updateRow(i, 'amount', parseFloat(e.target.value) || 0)} disabled={readOnly} step="0.01" className="modal-input !py-1 text-[11px] text-right font-data" />
          <input type="text" value={row.note} onChange={(e) => updateRow(i, 'note', e.target.value)} disabled={readOnly} className="modal-input !py-1 text-[11px]" placeholder="Note" />
          {!readOnly && <button onClick={() => removeRow(i)} className="p-0.5 text-text-muted hover:text-brand-red transition-colors"><Trash2 size={12} /></button>}
        </div>
      ))}
      <div className="flex justify-end text-xs font-bold text-text-secondary pt-2 border-t border-border-default">
        Total: <span className="font-data ml-1">₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}
