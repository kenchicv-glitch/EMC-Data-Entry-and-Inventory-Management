import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useDscCollections, useBatchUpsertCollections } from '../../hooks/useDscCollections';
import type { CollectionType } from '../../types';

interface Props { dayId: string; readOnly?: boolean; }

const COLLECTION_TYPES: { key: CollectionType; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'gcash', label: 'GCash' },
  { key: 'bank_psb', label: 'Bank - PSB' },
  { key: 'bank_mbtc', label: 'Bank - MBTC' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'zaldy', label: 'Zaldy' },
  { key: 'cashplus', label: 'Cash+' },
  { key: 'milcorp', label: 'Milcorp' },
];

export function CollectionSection({ dayId, readOnly = false }: Props) {
  const { data: collections = [], isLoading } = useDscCollections(dayId);
  const batchUpsert = useBatchUpsertCollections();
  const [rows, setRows] = useState<Record<CollectionType, { amount: number; reference: string; reference_id: string | null }>>(() => {
    const init: Record<string, { amount: number; reference: string; reference_id: string | null }> = {};
    COLLECTION_TYPES.forEach((t) => { init[t.key] = { amount: 0, reference: '', reference_id: null }; });
    return init as Record<CollectionType, { amount: number; reference: string; reference_id: string | null }>;
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (collections.length > 0) {
      const newRows: Record<string, { amount: number; reference: string; reference_id: string | null }> = {};
      COLLECTION_TYPES.forEach((t) => {
        const match = collections.find((c) => c.collection_type === t.key);
        newRows[t.key] = { 
          amount: match ? Number(match.amount) : 0, 
          reference: match?.reference || '',
          reference_id: match?.reference_id || null
        };
      });
      setRows(newRows as Record<CollectionType, { amount: number; reference: string; reference_id: string | null }>);
      setDirty(false);
    }
  }, [collections]);

  const updateAmount = (key: CollectionType, value: number) => {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], amount: value } }));
    setDirty(true);
  };

  const updateRef = (key: CollectionType, value: string) => {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], reference: value } }));
    setDirty(true);
  };

  const save = () => {
    const items = COLLECTION_TYPES
      .filter((t) => rows[t.key].amount > 0 || rows[t.key].reference.trim())
      .map((t) => ({ 
        collection_type: t.key as CollectionType, 
        amount: rows[t.key].amount, 
        reference: rows[t.key].reference || null,
        reference_id: rows[t.key].reference_id
      }));
    batchUpsert.mutate({ dayId, items });
    setDirty(false);
  };

  const total = COLLECTION_TYPES.reduce((s, t) => s + (Number(rows[t.key].amount) || 0), 0);

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  return (
    <div className="bento-card p-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Collections</h3>
        {!readOnly && dirty && <button onClick={save} disabled={batchUpsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors"><Save size={12} /> Save</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
        {COLLECTION_TYPES.map((t) => (
          <div key={t.key} className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-text-secondary w-24 shrink-0">{t.label}</span>
            <input type="number" value={rows[t.key].amount || ''} onChange={(e) => updateAmount(t.key, parseFloat(e.target.value) || 0)} disabled={readOnly || !!rows[t.key].reference_id} step="0.01" className={`modal-input !py-1 text-[10px] text-right font-data flex-1 ${rows[t.key].reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} />
            {(t.key === 'cheque' || t.key === 'bank_psb' || t.key === 'bank_mbtc') && (
              <input type="text" value={rows[t.key].reference} onChange={(e) => updateRef(t.key, e.target.value)} disabled={readOnly || !!rows[t.key].reference_id} placeholder="Ref#" className={`modal-input !py-1 text-[10px] w-24 ${rows[t.key].reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end text-xs font-bold text-text-secondary pt-1.5 border-t border-border-default">
        Total: <span className="font-data ml-1 text-brand-red">₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}
