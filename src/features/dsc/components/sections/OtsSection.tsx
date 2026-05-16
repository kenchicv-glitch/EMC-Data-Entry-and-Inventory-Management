import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useDscOtsItems, useBatchUpsertOtsItems } from '../../hooks/useDscOtsItems';
import { DscAutocomplete } from '../DscAutocomplete';
import { dscSyncService } from '../../services/dscSyncService';

interface Props { dayId: string; branchId: string | null; readOnly?: boolean; }
type Row = { qty: number; description: string; unit_price: number; reference_id: string | null; };

export function OtsSection({ dayId, branchId, readOnly = false }: Props) {
  const { data: items = [], isLoading } = useDscOtsItems(dayId);
  const batchUpsert = useBatchUpsertOtsItems();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (items.length > 0) {
      setRows(items.map((o) => ({ 
        qty: Number(o.qty), 
        description: o.description || 'Unknown Item', 
        unit_price: Number(o.unit_price),
        reference_id: o.reference_id || null
      })));
      setDirty(false);
    }
  }, [items]);

  const updateRow = (i: number, f: keyof Row, v: string | number) => { setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r)); setDirty(true); };
  const addRow = () => { setRows((p) => [...p, { qty: 0, description: '', unit_price: 0, reference_id: null }]); setDirty(true); };
  const removeRow = (i: number) => { setRows((p) => p.filter((_, idx) => idx !== i)); setDirty(true); };
  const save = () => { batchUpsert.mutate({ dayId, items: rows.filter((r) => r.description.trim()) }); setDirty(false); };
  const total = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0);

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  const GRID_CLASS = "grid grid-cols-[55px_1fr_75px_110px_30px] gap-1.5 items-center";

  return (
    <div className="bento-card p-2.5 space-y-2.5 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Over-the-Counter Sales</h3>
        <div className="flex items-center gap-2">
          {!readOnly && <button onClick={addRow} className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-brand-red transition-colors"><Plus size={14} /></button>}
          {!readOnly && dirty && <button onClick={save} disabled={batchUpsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors"><Save size={12} /> Save</button>}
        </div>
      </div>
      
      <div className={`${GRID_CLASS} text-[9px] font-black text-text-muted uppercase tracking-widest px-1 border-b border-border-default pb-1 mb-1`}>
        <span className="text-right pr-1">Qty</span><span>Description</span><span className="text-right pr-1">UP</span><span className="text-right pr-2">Amount</span><span />
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
        {rows.map((row, i) => {
          const amt = (Number(row.qty) || 0) * (Number(row.unit_price) || 0);
          return (
            <div key={i} className={`${GRID_CLASS} py-0.5 group hover:bg-bg-subtle/30 rounded-lg px-0.5`}>
              <input type="number" value={row.qty || ''} onChange={(e) => updateRow(i, 'qty', parseFloat(e.target.value) || 0)} disabled={readOnly || !!row.reference_id} step="0.01" className={`modal-input !py-0.5 text-[10px] text-right font-data !px-1 h-6 ${row.reference_id ? 'border-none shadow-none font-bold bg-transparent' : ''}`} />
              <DscAutocomplete
                value={row.description}
                onChange={(val, item) => {
                  updateRow(i, 'description', val);
                  if (item?.selling_price) {
                    updateRow(i, 'unit_price', Number(item.selling_price));
                  }
                }}
                onSearch={(term) => dscSyncService.searchProducts(term, branchId)}
                disabled={readOnly || !!row.reference_id}
                className={`modal-input !py-0.5 !px-1 bg-transparent text-[10px] h-6 flex-1 min-w-0 ${row.reference_id ? 'border-none shadow-none font-bold' : ''}`}
                placeholder="Item..."
              />
              <input type="number" value={row.unit_price || ''} onChange={(e) => updateRow(i, 'unit_price', parseFloat(e.target.value) || 0)} disabled={readOnly || !!row.reference_id} step="0.01" className={`modal-input !py-0.5 text-[10px] text-right font-data !px-1 h-6 ${row.reference_id ? 'border-none shadow-none font-bold bg-transparent' : ''}`} />
              <span className="text-[10px] font-data text-right text-text-secondary pr-3">₱{amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              {!readOnly && !row.reference_id && <button onClick={() => removeRow(i)} className="p-1 opacity-0 group-hover:opacity-100 text-text-muted hover:text-brand-red transition-all"><Trash2 size={12} /></button>}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end text-xs font-black text-text-secondary pt-1.5 border-t border-border-default no-print">
        <div className="flex items-baseline gap-2">
          <span className="uppercase tracking-widest text-[9px] text-text-muted">Total OTS:</span>
          <span className="font-data text-sm text-brand-red">₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}
