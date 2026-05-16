import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { useDscDrItems, useBatchUpsertDrItems } from '../../hooks/useDscDrItems';
import { DscAutocomplete } from '../DscAutocomplete';
import { dscSyncService } from '../../services/dscSyncService';

interface Props { dayId: string; branchId: string | null; readOnly?: boolean; }
type Row = { account_name: string; dr_number: string; qty: number; description: string; unit_price: number; reference_id: string | null; };

export function DrSection({ dayId, branchId, readOnly = false }: Props) {
  const { data: items = [], isLoading } = useDscDrItems(dayId);
  const batchUpsert = useBatchUpsertDrItems();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (items.length > 0) {
      setRows(items.map((d) => ({ 
        account_name: d.account_name, 
        dr_number: d.dr_number || '', 
        qty: Number(d.qty), 
        description: d.description || 'Unknown Item', 
        unit_price: Number(d.unit_price),
        reference_id: d.reference_id || null
      })));
      setDirty(false);
    }
  }, [items]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupedRows = useMemo(() => {
    const groups: Record<string, { rows: (Row & { originalIndex: number })[], total: number, account: string, drNo: string }> = {};
    rows.forEach((row, index) => {
      const key = `${row.account_name}-${row.dr_number}-${!!row.reference_id}` || 'MANUAL';
      if (!groups[key]) groups[key] = { rows: [], total: 0, account: row.account_name, drNo: row.dr_number };
      groups[key].rows.push({ ...row, originalIndex: index });
      groups[key].total += (row.qty || 0) * (row.unit_price || 0);
    });
    return groups;
  }, [rows]);

  const updateRow = (i: number, f: keyof Row, v: string | number) => { setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r)); setDirty(true); };
  const addRow = (account = '', drNo = '') => { setRows((p) => [...p, { account_name: account, dr_number: drNo, qty: 0, description: '', unit_price: 0, reference_id: null }]); setDirty(true); };
  const removeRow = (i: number) => { setRows((p) => p.filter((_, idx) => idx !== i)); setDirty(true); };
  const save = () => { batchUpsert.mutate({ dayId, items: rows.filter((r) => r.description.trim()) }); setDirty(false); };

  const grandTotal = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0);

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  // Grid definition: [Toggle_28px] [Account_110px] [DR#_90px] [QtyCount_50px] [Description_1fr] [UP_75px] [Amount_110px] [Trash_30px]
  const GRID_CLASS = "grid grid-cols-[28px_110px_90px_50px_1fr_75px_110px_30px] gap-1.5 items-center";

  return (
    <div className="bento-card p-2.5 space-y-2.5 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Delivery Receipts</h3>
        <div className="flex items-center gap-2">
          {!readOnly && <button onClick={() => addRow()} className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-brand-red transition-colors"><Plus size={14} /></button>}
          {!readOnly && dirty && <button onClick={save} disabled={batchUpsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors"><Save size={12} /> Save</button>}
        </div>
      </div>

      <div className={`${GRID_CLASS} text-[9px] font-black text-text-muted uppercase tracking-widest px-1 border-b border-border-default pb-1 mb-1`}>
        <span /><span>Account</span><span>DR#</span><span className="text-right">Qty</span><span>Description</span><span className="text-right">UP</span><span className="text-right">Amount</span><span />
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
        {Object.entries(groupedRows).map(([key, group]) => {
          const isExpanded = expandedGroups.has(key);
          return (
            <div key={key} className="space-y-1">
              <div 
                className={`group ${GRID_CLASS} px-1 py-1 rounded-xl transition-all cursor-pointer ${isExpanded ? 'bg-bg-subtle/50' : 'hover:bg-bg-subtle/30'}`}
                onClick={() => toggleGroup(key)}
              >
                <div className="text-text-muted">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
                <div className="text-[10px] font-bold text-text-primary truncate" title={group.account}>{group.account || 'New Account'}</div>
                <div className="font-data text-[10px] text-text-muted">{group.drNo}</div>
                <div className="text-[10px] text-text-muted text-right italic">{group.rows.length} items</div>
                <div className="text-[10px] font-bold text-text-muted truncate">{isExpanded ? '' : group.rows[0].description}</div>
                <div className="col-span-2 text-right pr-2">
                  {!isExpanded && (
                    <span className="text-[11px] font-data font-bold text-brand-red">
                      ₱{group.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <div className="flex justify-end">
                  {!readOnly && <button onClick={(e) => { e.stopPropagation(); addRow(group.account, group.drNo); }} className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-brand-red transition-all"><Plus size={12} /></button>}
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-0.5 ml-1 border-l-2 border-border-default/50 pl-1 py-1 bg-bg-subtle/20 rounded-r-xl">
                  {group.rows.map((row) => {
                    const amt = (Number(row.qty) || 0) * (Number(row.unit_price) || 0);
                    return (
                      <div key={row.originalIndex} className={`${GRID_CLASS} py-0.5 group/row hover:bg-white/50 rounded-lg pr-1`}>
                        <span />
                        <input type="text" value={row.account_name} onChange={(e) => updateRow(row.originalIndex, 'account_name', e.target.value)} disabled={readOnly || !!row.reference_id} className={`modal-input !py-0.5 text-[10px] !px-1 h-6 ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} />
                        <input type="text" value={row.dr_number} onChange={(e) => updateRow(row.originalIndex, 'dr_number', e.target.value)} disabled={readOnly || !!row.reference_id} className={`modal-input !py-0.5 text-[10px] font-data !px-1 h-6 ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} />
                        <input type="number" value={row.qty || ''} onChange={(e) => updateRow(row.originalIndex, 'qty', parseFloat(e.target.value) || 0)} disabled={readOnly || !!row.reference_id} step="0.01" className={`modal-input !py-0.5 text-[10px] text-right font-data !px-1 h-6 ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} />
                        <DscAutocomplete
                          value={row.description}
                          onChange={(val, item) => {
                            updateRow(row.originalIndex, 'description', val);
                            if (item?.selling_price) {
                              updateRow(row.originalIndex, 'unit_price', Number(item.selling_price));
                            }
                          }}
                          onSearch={(term) => dscSyncService.searchProducts(term, branchId)}
                          disabled={readOnly || !!row.reference_id}
                          className={`modal-input !py-0.5 !px-1 bg-transparent text-[10px] h-6 ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`}
                          placeholder="Item..."
                        />
                        <input type="number" value={row.unit_price || ''} onChange={(e) => updateRow(row.originalIndex, 'unit_price', parseFloat(e.target.value) || 0)} disabled={readOnly || !!row.reference_id} step="0.01" className={`modal-input !py-0.5 text-[10px] text-right font-data !px-1 h-6 ${row.reference_id ? 'border-none shadow-none font-bold !bg-transparent' : ''}`} />
                        <span className="text-[10px] font-data text-right text-text-secondary pr-2">₱{amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        {!readOnly && !row.reference_id && <button onClick={() => removeRow(row.originalIndex)} className="p-1 opacity-0 group-hover/row:opacity-100 text-text-muted hover:text-brand-red transition-all"><Trash2 size={12} /></button>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end text-xs font-black text-text-secondary pt-1.5 border-t border-border-default no-print">
        <div className="flex items-baseline gap-2">
          <span className="uppercase tracking-widest text-[9px] text-text-muted">Total DR:</span>
          <span className="font-data text-sm text-brand-red">₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}
