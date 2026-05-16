import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useDscCashDenom, useBatchUpsertCashDenom } from '../../hooks/useDscCashDenom';
import { getDefaultDenominations } from '../../services/dscCashDenomService';

interface Props { dayId: string; readOnly?: boolean; }

export function CashDenomSection({ dayId, readOnly = false }: Props) {
  const { data: denoms = [], isLoading } = useDscCashDenom(dayId);
  const batchUpsert = useBatchUpsertCashDenom();
  const [rows, setRows] = useState<Array<{ denomination: number; count: number }>>(getDefaultDenominations());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (denoms.length > 0) {
      const defaults = getDefaultDenominations();
      setRows(defaults.map((d) => {
        const match = denoms.find((db) => Number(db.denomination) === d.denomination);
        return { denomination: d.denomination, count: match ? match.count : 0 };
      }));
      setDirty(false);
    }
  }, [denoms]);

  const updateCount = (denomination: number, count: number) => {
    setRows((prev) => prev.map((r) => r.denomination === denomination ? { ...r, count } : r));
    setDirty(true);
  };

  const save = () => {
    batchUpsert.mutate({ dayId, items: rows });
    setDirty(false);
  };

  const total = rows.reduce((s, r) => s + r.denomination * r.count, 0);

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  return (
    <div className="bento-card p-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Cash Denominations</h3>
        {!readOnly && dirty && <button onClick={save} disabled={batchUpsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors"><Save size={12} /> Save</button>}
      </div>
      <div className="grid grid-cols-1 gap-y-1">
        {rows.map((row) => (
          <div key={row.denomination} className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-text-secondary w-12 text-right font-data">
              ₱{row.denomination >= 1 ? row.denomination.toLocaleString() : row.denomination}
            </span>
            <span className="text-text-muted text-[10px]">×</span>
            <input type="number" value={row.count || ''} onChange={(e) => updateCount(row.denomination, parseInt(e.target.value) || 0)} disabled={readOnly} min={0} className="modal-input !py-1 text-[10px] text-right font-data w-24" />
            <span className="text-[9px] font-data text-text-secondary w-16 text-right">
              = ₱{(row.denomination * row.count).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-end text-xs font-bold text-text-secondary pt-1.5 border-t border-border-default">
        Total Cash on Hand: <span className="font-data ml-1 text-brand-red">₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}
