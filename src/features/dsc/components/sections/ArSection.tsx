import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useDscAr, useBatchUpsertAr } from '../../hooks/useDscAr';
import type { ArType } from '../../types';

interface Props { dayId: string; readOnly?: boolean; }
type Row = { ar_type: ArType; account_name: string; dr_number: string; amount: number; reference_id: string | null; };

const AR_LABELS: Record<ArType, string> = { cash: 'AR Cash', gcash: 'AR GCash', dr: 'AR / DR', ar2: 'AR2' };

export function ArSection({ dayId, readOnly = false }: Props) {
  const { data: entries = [], isLoading } = useDscAr(dayId);
  const batchUpsert = useBatchUpsertAr();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (entries.length > 0) {
      setRows(entries.map((e) => ({ 
        ar_type: e.ar_type, 
        account_name: e.account_name, 
        dr_number: e.dr_number || '', 
        amount: Number(e.amount),
        reference_id: e.reference_id || null
      })));
      setDirty(false);
    }
  }, [entries]);

  const updateRow = (i: number, f: keyof Row, v: string | number) => { setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r)); setDirty(true); };
  const addRow = (arType: ArType) => { setRows((p) => [...p, { ar_type: arType, account_name: '', dr_number: '', amount: 0, reference_id: null }]); setDirty(true); };
  const removeRow = (i: number) => { setRows((p) => p.filter((_, idx) => idx !== i)); setDirty(true); };
  const save = () => { batchUpsert.mutate({ dayId, items: rows.filter((r) => r.account_name.trim()) }); setDirty(false); };

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  const renderGroup = (arType: ArType) => {
    const groupRows = rows.map((r, i) => ({ ...r, idx: i })).filter((r) => r.ar_type === arType);
    const groupTotal = groupRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest">{AR_LABELS[arType]}</h4>
          {!readOnly && <button onClick={() => addRow(arType)} className="p-1 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-brand-red transition-colors"><Plus size={14} /></button>}
        </div>
        {groupRows.map((row) => (
          <div key={row.idx} className="grid grid-cols-[1fr_80px_80px_30px] gap-1 items-center">
            <input type="text" value={row.account_name} onChange={(e) => updateRow(row.idx, 'account_name', e.target.value)} disabled={readOnly || !!row.reference_id} className={`modal-input !py-1 text-[10px] ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} placeholder="Account" />
            {arType === 'dr' && <input type="text" value={row.dr_number} onChange={(e) => updateRow(row.idx, 'dr_number', e.target.value)} disabled={readOnly || !!row.reference_id} className={`modal-input !py-1 text-[10px] ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} placeholder="DR#" />}
            {arType !== 'dr' && <span />}
            <input type="number" value={row.amount || ''} onChange={(e) => updateRow(row.idx, 'amount', parseFloat(e.target.value) || 0)} disabled={readOnly || !!row.reference_id} step="0.01" className={`modal-input !py-1 text-[10px] text-right font-data ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} />
            {!readOnly && !row.reference_id && <button onClick={() => removeRow(row.idx)} className="p-0.5 text-text-muted hover:text-brand-red transition-colors"><Trash2 size={12} /></button>}
          </div>
        ))}
        <div className="text-right text-[10px] font-bold text-text-secondary">₱{groupTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
      </div>
    );
  };

  return (
    <div className="bento-card p-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Accounts Receivable</h3>
        {!readOnly && dirty && <button onClick={save} disabled={batchUpsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors"><Save size={12} /> Save</button>}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {renderGroup('cash')}
        {renderGroup('gcash')}
        {renderGroup('dr')}
        {renderGroup('ar2')}
      </div>
    </div>
  );
}
