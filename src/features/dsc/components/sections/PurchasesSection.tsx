import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useDscPurchases } from '../../hooks/useDscPurchases';

interface Props {
  dayId: string;
}

type Row = {
  batch: 1 | 2 | 3;
  description: string;
  amount: number;
  // Ephemeral fields derived from description for UI
  supplier_name: string;
  invoice_no: string;
  item_desc: string;
  qty: number;
  unit_price: number;
  isSynced: boolean;
  reference_id?: string;
};

export function PurchasesSection({ dayId }: Props) {
  const { data: purchases = [], isLoading } = useDscPurchases(dayId);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  const rows = useMemo<Row[]>(() => {
    return purchases.map((p) => {
      // Parse the description: "Supplier | Invoice | Product | Qty x Price"
      const parts = (p.description || '').split(' | ').map(s => s.trim());
      const supplier = parts[0] || '';
      const invoice = parts[1] || '';
      const item = parts[2] || parts[0] || 'Unknown Item';
      const breakdownStr = parts[3] || '';
      
      let qty = 1;
      let price = p.amount;
      if (breakdownStr.includes('x')) {
        const [q, pr] = breakdownStr.split('x').map(s => parseFloat(s.replace(/[^0-9.]/g, '')) || 0);
        qty = q || 1;
        price = pr || p.amount;
      }

      return { 
        batch: p.batch as 1 | 2 | 3, 
        description: p.description,
        amount: Number(p.amount),
        supplier_name: supplier,
        invoice_no: invoice,
        item_desc: item,
        qty,
        unit_price: price,
        isSynced: true
      };
    });
  }, [purchases]);

  const toggleInvoice = (key: string) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupedRows = useMemo(() => {
    const groups: Record<string, { rows: (Row & { originalIndex: number })[], total: number, supplier: string, invoice: string, batch: 1|2|3, isSynced: boolean }> = {};
    rows.forEach((row, index) => {
      const key = `${row.batch}-${row.supplier_name}-${row.invoice_no}`;
      if (!groups[key]) {
        groups[key] = { 
          rows: [], 
          total: 0, 
          supplier: row.supplier_name, 
          invoice: row.invoice_no, 
          batch: row.batch,
          isSynced: !!row.reference_id
        };
      }
      groups[key].rows.push({ ...row, originalIndex: index });
      groups[key].total += row.amount || 0;
    });
    return groups;
  }, [rows]);

  // Removed editing functions (updateRow, addRow, removeRow, save)

  const renderBatch = (batchNum: 1 | 2 | 3, label: string) => {
    const batchGroups = Object.entries(groupedRows).filter(([_, g]) => g.batch === batchNum);
    const batchTotal = batchGroups.reduce((sum, [_, g]) => sum + g.total, 0);

    return (
      <div className="space-y-2 group/batch">
        <div className="flex items-center justify-between border-b-2 border-border-default/50 pb-0.5 mb-1">
          <h4 className="text-[10px] font-black text-brand-red uppercase tracking-widest">{label}</h4>
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] text-text-muted uppercase font-bold">Subtotal:</span>
            <span className="font-data text-[11px] font-bold text-text-primary">₱{batchTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Column Headers for Batch (Only if rows exist) */}
        {batchGroups.length > 0 && (
          <div className="grid grid-cols-[1fr_90px_30px] gap-2 px-1 text-[8px] font-black text-text-muted uppercase tracking-tighter border-b border-border-default pb-0.5">
            <span>Supplier / Invoice</span>
            <span className="text-right">Total</span>
            <span />
          </div>
        )}

        <div className="space-y-0.5 pt-0.5">
          {batchGroups.map(([key, group]) => {
            const isExpanded = expandedInvoices.has(key);
            const firstRow = group.rows[0];

            return (
              <div key={key} className="space-y-1">
                {/* Summary Header Row */}
                <div 
                  className={`grid grid-cols-[1fr_90px_30px] items-center gap-2 group/row p-0.5 px-1 rounded-lg transition-all cursor-pointer ${isExpanded ? 'bg-bg-subtle/50' : 'hover:bg-bg-subtle/20'}`}
                  onClick={() => toggleInvoice(key)}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="text-text-muted shrink-0">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-black text-text-primary uppercase truncate">
                        {group.supplier}
                      </span>
                      <div className="w-20 text-[10px] text-text-muted font-bold truncate italic shrink-0" title={group.invoice}>
                        {group.invoice === 'NO-INV' ? '' : group.invoice}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {!isExpanded && (
                      <span className="text-[11px] font-data font-bold text-brand-red">
                        ₱{group.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  <div />
                </div>

                {/* Breakdown Rows */}
                {isExpanded && (
                  <div className="ml-5 border-l-2 border-border-default/50 pl-2 py-1 space-y-1 bg-bg-subtle/20 rounded-r-xl">
                    {group.rows.map((row) => (
                      <div key={row.originalIndex} className="flex items-center gap-2 py-1 group/line hover:bg-white/40 rounded-lg px-2">
                        {/* Description */}
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-text-primary block truncate" title={row.description}>
                            {row.item_desc || 'Synced Item'}
                          </span>
                        </div>

                        {/* Qty x Price Summary */}
                        <div className="shrink-0 flex items-center justify-end">
                          <span className="text-[10px] font-data text-text-muted whitespace-nowrap">
                            {row.qty} × ₱{row.unit_price.toLocaleString('en-PH')}
                          </span>
                        </div>

                        {/* Total Amount */}
                        <span className="text-[11px] font-data font-bold text-brand-red whitespace-nowrap shrink-0 w-[90px] text-right">
                          ₱{row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-end px-2 pt-1 border-t border-border-default/30">
                      <span className="text-[11px] font-data font-bold text-brand-red">
                        ₱{group.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {batchGroups.length === 0 && (
            <div className="text-[10px] text-text-muted italic px-2 py-2 bg-bg-subtle/10 rounded-lg border border-dashed border-border-default/50">No purchases found</div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;

  const grandTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div className="bento-card p-2.5 space-y-2.5 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Purchases</h3>
      </div>
      <div className="space-y-3">
        {renderBatch(1, 'Purchase 1')}
        {renderBatch(2, 'Purchase 2')}
        {renderBatch(3, 'Purchase 3')}
      </div>
      <div className="flex justify-end text-xs font-black text-text-secondary pt-1.5 border-t border-border-default no-print pr-2">
        <div className="flex items-baseline gap-2">
          <span className="uppercase tracking-widest text-[9px] text-text-muted">Grand Total:</span>
          <span className="font-data text-sm text-brand-red">₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}
