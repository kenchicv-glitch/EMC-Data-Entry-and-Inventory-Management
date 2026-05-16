import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { useDscInvoices, useBatchUpsertInvoices } from '../../hooks/useDscInvoices';
import { DscAutocomplete } from '../DscAutocomplete';
import { dscSyncService } from '../../services/dscSyncService';

interface Props {
  dayId: string;
  branchId: string | null;
  readOnly?: boolean;
}

type Row = {
  series: 'A';
  header_invoice_no: string;
  line_invoice_no: string;
  qty: number;
  description: string;
  unit_price: number;
  is_cancelled: boolean;
  reference_id: string | null;
};

export function InvoiceSectionA({ dayId, branchId, readOnly = false }: Props) {
  const { data: invoices = [], isLoading } = useDscInvoices(dayId, 'A');
  const batchUpsert = useBatchUpsertInvoices();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (invoices.length > 0) {
      setRows(invoices.map((i) => ({
        series: 'A' as const,
        header_invoice_no: i.header_invoice_no || '',
        line_invoice_no: i.line_invoice_no || '',
        qty: Number(i.qty),
        description: i.description || 'Unknown Item',
        unit_price: Number(i.unit_price),
        is_cancelled: i.is_cancelled,
        reference_id: i.reference_id || null
      })));
      setDirty(false);
    }
  }, [invoices]);

  const toggleInvoice = (no: string) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const groupedRows = useMemo(() => {
    const groups: Record<string, { rows: (Row & { originalIndex: number })[], total: number, isSynced: boolean }> = {};
    rows.forEach((row, index) => {
      // Use composite key to prevent mixing
      const key = `${row.series}-${row.header_invoice_no || 'PENDING'}`;
      if (!groups[key]) groups[key] = { rows: [], total: 0, isSynced: !!row.reference_id };
      groups[key].rows.push({ ...row, originalIndex: index });
      if (!row.is_cancelled) {
        groups[key].total += (row.qty || 0) * (row.unit_price || 0);
      }
    });
    return groups;
  }, [rows]);

  const updateRow = (index: number, field: keyof Row, value: string | number | boolean) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  const addRow = (headerNo?: string) => {
    setRows((prev) => [...prev, { 
      series: 'A', 
      header_invoice_no: headerNo || '', 
      line_invoice_no: '', 
      qty: 0, 
      description: '', 
      unit_price: 0, 
      is_cancelled: false,
      reference_id: null 
    }]);
    if (headerNo) {
      setExpandedInvoices((prev) => new Set(prev).add(headerNo));
    }
    setDirty(true);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const save = () => {
    batchUpsert.mutate({ dayId, series: 'A', items: rows.filter((r) => r.description.trim()) });
    setDirty(false);
  };

  const grandTotal = rows.filter((r) => !r.is_cancelled).reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0);

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  // Grid definition: [Toggle_28px] [Hdr#_95px] [Line#_60px] [Description_1fr] [Qty_60px] [UP_80px] [Amount_110px] [Trash_30px]
  const GRID_CLASS = "grid grid-cols-[28px_95px_60px_1fr_60px_80px_110px_30px] gap-1.5 items-center";

  return (
    <div className="bento-card p-2.5 space-y-2.5 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Invoice A</h3>
        <div className="flex items-center gap-2">
          {!readOnly && <button onClick={() => addRow()} className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-brand-red transition-colors"><Plus size={14} /></button>}
          {!readOnly && dirty && (
            <button onClick={save} disabled={batchUpsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors">
              <Save size={12} /> Save
            </button>
          )}
        </div>
      </div>

      <div className={`${GRID_CLASS} text-[9px] font-black text-text-muted uppercase tracking-widest px-1 border-b border-border-default pb-1 mb-1`}>
        <span /><span className="pl-1">Hdr#</span><span>Line#</span><span>Description</span><span className="text-right">Qty</span><span className="text-right">UP</span><span className="text-right">Amount</span><span />
      </div>

      <div className="space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
        {Object.entries(groupedRows).map(([headerNo, group]) => {
          const isExpanded = expandedInvoices.has(headerNo);
          const isPending = headerNo === 'PENDING';

          return (
            <div key={headerNo} className="space-y-1">
              {/* Summary Row */}
              <div 
                className={`group ${GRID_CLASS} px-1 py-0.5 rounded-xl transition-all cursor-pointer ${isExpanded ? 'bg-bg-subtle/50' : 'hover:bg-bg-subtle/30'}`}
                onClick={() => toggleInvoice(headerNo)}
              >
                <div className="text-text-muted">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
                <div className="font-data font-bold text-[11px] truncate" title={headerNo}>{headerNo}</div>
                <div className="text-[10px] text-text-muted italic">{group.rows.length} items</div>
                <div className="text-[10px] font-bold text-text-muted truncate">{isExpanded ? '' : group.rows[0].description}</div>
                <div className="col-span-3 text-right pr-2">
                  {!isExpanded && (
                    <span className="text-[11px] font-data font-bold text-brand-red">
                      ₱{group.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <div className="flex justify-end">
                  {!readOnly && !group.isSynced && <button onClick={(e) => { e.stopPropagation(); addRow(headerNo); }} className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-brand-red transition-all"><Plus size={12} /></button>}
                </div>
              </div>

              {/* Detail Rows — Product Breakdown */}
              {isExpanded && (
                <div className="ml-5 border-l-2 border-border-default/50 pl-2 py-1 bg-bg-subtle/20 rounded-r-xl">
                  {group.rows.map((row) => {
                    const amt = (Number(row.qty) || 0) * (Number(row.unit_price) || 0);
                    return (
                      <div key={row.originalIndex} className={`flex items-center gap-2 py-0.5 group/row hover:bg-white/40 rounded-lg px-2 ${row.is_cancelled ? 'opacity-40 line-through' : ''}`}>
                        <span className="flex-1 text-[11px] text-text-primary leading-tight min-w-0 break-words" title={row.description}>
                          {row.description || <span className="text-text-muted italic">No description</span>}
                        </span>
                        <span className="text-[10px] font-data text-text-muted whitespace-nowrap shrink-0">
                          {row.qty} × ₱{Number(row.unit_price).toLocaleString('en-PH')}
                        </span>
                        <span className="text-[11px] font-data font-bold text-text-primary whitespace-nowrap shrink-0 w-[90px] text-right">
                          ₱{amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                        {!readOnly && !row.reference_id ? (
                          <button onClick={() => removeRow(row.originalIndex)} className="p-0.5 opacity-0 group-hover/row:opacity-100 text-text-muted hover:text-brand-red transition-all shrink-0"><Trash2 size={12} /></button>
                        ) : null}
                      </div>
                    );
                  })}
                  {/* Subtotal only */}
                  <div className="flex justify-end px-2 pt-1 mt-0.5 border-t border-border-default/30">
                    <span className="text-[11px] font-data font-bold text-brand-red">
                      ₱{group.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs font-black text-text-secondary pt-1.5 border-t border-border-default no-print">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-widest text-[9px] text-text-muted">Cancelled Mode:</span>
          <input type="checkbox" disabled className="w-3 h-3 rounded border-border-default accent-brand-red" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="uppercase tracking-widest text-[9px] text-text-muted">Total A:</span>
          <span className="font-data text-sm text-brand-red">₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}
