import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import type { StocktakeItem } from '../types/product';

interface StocktakeTableProps {
    items: StocktakeItem[];
    countedById: string;
    onUpdateCount: (itemId: string, countedQty: number, countedBy: string) => void;
    isUpdating: boolean;
    showUncountedOnly?: boolean;
}

export default function StocktakeTable({
    items,
    countedById,
    onUpdateCount,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isUpdating: _isUpdating,
    showUncountedOnly = false,
}: StocktakeTableProps) {
    const [localValues, setLocalValues] = useState<Record<string, string>>({});

    const displayed = showUncountedOnly ? items.filter(i => i.counted_qty === null) : items;

    const handleBlur = (item: StocktakeItem, value: string) => {
        const parsed = parseFloat(value);
        if (!isNaN(parsed) && parsed !== item.counted_qty) {
            onUpdateCount(item.id, parsed, countedById);
        }
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-border-default">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="border-b border-border-default bg-bg-surface">
                        <th className="px-3 py-2.5 text-left text-[11px] font-black text-text-muted uppercase tracking-wider w-6">#</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-black text-text-muted uppercase tracking-wider">SKU</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-black text-text-muted uppercase tracking-wider">Name</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-black text-text-muted uppercase tracking-wider w-14">Unit</th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-black text-text-muted uppercase tracking-wider w-24">System Qty</th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-black text-text-muted uppercase tracking-wider w-28">Counted Qty</th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-black text-text-muted uppercase tracking-wider w-20">Variance</th>
                    </tr>
                </thead>
                <tbody>
                    {displayed.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="text-center py-12 text-text-muted text-sm">
                                {showUncountedOnly ? 'All items counted ✓' : 'No items in this session'}
                            </td>
                        </tr>
                    ) : (
                        displayed.map((item, idx) => {
                            const variance = item.variance;
                            const isCounted = item.counted_qty !== null;
                            const localVal = localValues[item.id] ?? (item.counted_qty?.toString() ?? '');

                            return (
                                <tr
                                    key={item.id}
                                    className={`border-b border-border-default/50 transition-colors ${
                                        isCounted ? 'bg-emerald-500/3' : ''
                                    }`}
                                >
                                    <td className="px-3 py-2 text-text-muted text-xs">{idx + 1}</td>
                                    <td className="px-3 py-2 font-mono text-xs text-text-muted">{item.product?.sku}</td>
                                    <td className="px-3 py-2 font-medium text-text-primary max-w-[200px] truncate">{item.product?.name}</td>
                                    <td className="px-3 py-2 text-xs text-text-muted">{item.product?.unit ?? '—'}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-medium text-text-secondary">
                                        {item.system_qty}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <input
                                                type="number"
                                                value={localVal}
                                                step="0.01"
                                                onChange={e =>
                                                    setLocalValues(prev => ({
                                                        ...prev,
                                                        [item.id]: e.target.value,
                                                    }))
                                                }
                                                onBlur={e => handleBlur(item, e.target.value)}
                                                className="w-20 px-2 py-1 text-right tabular-nums bg-bg-subtle border border-border-default rounded-lg text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all"
                                                placeholder="—"
                                            />
                                            {isCounted && (
                                                <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums font-bold">
                                        {variance === null ? (
                                            <span className="text-text-muted">—</span>
                                        ) : variance < 0 ? (
                                            <span className="text-red-500">{variance}</span>
                                        ) : variance > 0 ? (
                                            <span className="text-emerald-500">+{variance}</span>
                                        ) : (
                                            <span className="text-text-muted">0</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
