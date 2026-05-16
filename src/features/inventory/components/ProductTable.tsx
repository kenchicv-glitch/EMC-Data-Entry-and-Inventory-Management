import { useMemo, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '../types/product';
import LowStockBadge from './LowStockBadge';
import { isSmartMatch } from '../../../shared/lib/searchUtils';
import { buildSkuPrefix, extractSize } from '../../../shared/lib/skuGenerator';

// ── Helper: resolve category hierarchy from product ─────────────
function resolveHierarchy(product: Product): { master: string; subcat: string } {
    const cat = product.category;
    if (cat) {
        if (cat.depth === 2 && cat.parent?.parent) {
            return { master: cat.parent.parent.name || '', subcat: cat.name || '' };
        } else if (cat.depth === 1 && cat.parent) {
            return { master: cat.parent.name || '', subcat: cat.name || '' };
        } else {
            return { master: cat.name || '', subcat: '' };
        }
    }
    // Legacy: extract from breadcrumb name
    const parts = product.name.split(' > ');
    return { master: parts[0] || 'MISC', subcat: parts.length > 2 ? parts[2] : '' };
}

// ── Helper: compute display SKU on-the-fly ──────────────────────
function computeDisplaySku(product: Product): string | null {
    // If already has a clean (non-breadcrumb) SKU, use it directly
    if (product.sku && !product.sku.includes(' > ')) return product.sku;

    // Otherwise, compute a preview from the product's category/brand/name
    const { master, subcat } = resolveHierarchy(product);
    if (!master || master === 'UNCATEGORIZED') return null;

    const prefix = buildSkuPrefix(master, subcat || undefined, product.brand || undefined, product.name);
    return prefix; // Show prefix without sequence (sequence requires DB lookup)
}

interface ProductTableProps {
    products: Product[];
    isLoading: boolean;
    onRowClick?: (product: Product) => void;
    globalFilter?: string;
}

export default function ProductTable({
    products,
    isLoading,
    onRowClick,
    globalFilter = '',
}: ProductTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);

    // Pre-compute display SKUs with sequence numbers per prefix group
    const skuMap = useMemo(() => {
        const map = new Map<string, string>();
        const prefixCounters = new Map<string, number>();

        for (const p of products) {
            const displaySku = computeDisplaySku(p);
            if (!displaySku) {
                map.set(p.id || '', '');
                continue;
            }

            // If it's already a clean SKU from the DB, use as-is
            if (p.sku && !p.sku.includes(' > ')) {
                map.set(p.id || '', p.sku || '');
                continue;
            }

            // Assign sequence number based on prefix grouping
            const count = (prefixCounters.get(displaySku) || 0) + 1;
            prefixCounters.set(displaySku, count);
            map.set(p.id || '', `${displaySku}-${String(count).padStart(3, '0')}`);
        }
        return map;
    }, [products]);

    const columns = useMemo<ColumnDef<Product>[]>(() => [
        {
            id: 'sku',
            header: 'SKU',
            size: 180,
            accessorFn: row => skuMap.get(row.id || '') || '',
            cell: info => {
                const sku = info.getValue() as string;
                if (!sku) {
                    return <span className="text-[10px] text-text-muted italic">—</span>;
                }
                return (
                    <span className="font-mono text-[10px] font-bold text-brand-red/80 tracking-wider whitespace-nowrap">{sku}</span>
                );
            },
        },
        {
            id: 'name',
            accessorKey: 'name',
            header: 'Name',
            cell: info => {
                const product = info.row.original;
                return (
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary truncate max-w-[220px]">
                            {info.getValue() as string}
                        </span>
                        <LowStockBadge product={product} showCount={false} />
                    </div>
                );
            },
        },
        {
            id: 'category',
            header: 'Category',
            accessorFn: row => row.category?.name ?? '—',
            cell: info => {
                const cat = info.row.original.category;
                if (!cat) return <span className="text-text-muted text-xs">—</span>;
                return (
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{
                            backgroundColor: cat.color ? `${cat.color}22` : undefined,
                            color: cat.color ?? undefined,
                        }}
                    >
                        {cat.color ? '' : ''}
                        {cat.name}
                    </span>
                );
            },
        },
        {
            id: 'location',
            header: 'Location',
            accessorFn: row => row.location?.code ?? '—',
            cell: info => {
                const loc = info.row.original.location;
                if (!loc) return <span className="text-text-muted text-xs">—</span>;
                return (
                    <span className="font-mono text-xs bg-bg-subtle border border-border-default px-1.5 py-0.5 rounded">
                        {loc.code}
                    </span>
                );
            },
        },
        {
            id: 'brand',
            accessorKey: 'brand',
            header: 'Brand',
            cell: info => (
                <span className="text-xs text-text-secondary">{(info.getValue() as string) ?? '—'}</span>
            ),
        },
        {
            id: 'stock_available',
            accessorKey: 'stock_available',
            header: 'Stock',
            size: 80,
            cell: info => {
                const product = info.row.original;
                const threshold = product.low_stock_threshold ?? 0;
                const stock = info.getValue() as number;
                const isLow = threshold > 0 && stock <= threshold;
                return (
                    <span className={`font-bold tabular-nums ${isLow ? 'text-amber-500' : 'text-text-primary'}`}>
                        {stock}
                    </span>
                );
            },
        },
        {
            id: 'selling_price',
            accessorKey: 'selling_price',
            header: '₱ Price',
            size: 90,
            cell: info => (
                <span className="font-medium tabular-nums text-text-primary">
                    {Number(info.getValue()).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}
                </span>
            ),
        },
        {
            id: 'unit',
            accessorKey: 'unit',
            header: 'Unit',
            size: 60,
            cell: info => (
                <span className="text-xs text-text-muted">{(info.getValue() as string) ?? '—'}</span>
            ),
        },
    ], [skuMap]);

    const table = useReactTable({
        data: products,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 50 } },
        globalFilterFn: (row, _columnId, filterValue) => {
            const p = row.original;
            
            // Build a searchable string (index) similar to Sales UI
            const cat = p.category;
            let path = '';
            if (cat) {
                const names = [cat.name];
                let curr = cat;
                while (curr.parent) {
                    names.unshift(curr.parent.name);
                    curr = curr.parent;
                }
                path = names.join(' > ');
            }
            
            const searchIndex = `${p.name} ${p.sku || ''} ${p.brand || ''} ${p.variant_type || ''} ${p.size || ''} ${path}`.toLowerCase();
            return isSmartMatch(searchIndex, filterValue);
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-brand-red/20 border-t-brand-red rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-border-default">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        {table.getHeaderGroups().map(hg => (
                            <tr key={hg.id} className="border-b border-border-default bg-bg-surface">
                                {hg.headers.map(header => (
                                    <th
                                        key={header.id}
                                        onClick={header.column.getToggleSortingHandler()}
                                        className={`px-3 py-2.5 text-left text-[11px] font-black text-text-muted uppercase tracking-wider whitespace-nowrap select-none
                                            ${header.column.getCanSort() ? 'cursor-pointer hover:text-text-primary transition-colors' : ''}`}
                                        style={{ width: header.getSize() }}
                                    >
                                        <span className="flex items-center gap-1">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {header.column.getIsSorted() === 'asc' && <ChevronUp size={11} />}
                                            {header.column.getIsSorted() === 'desc' && <ChevronDown size={11} />}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="text-center py-16 text-text-muted text-sm">
                                    No products found
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map(row => (
                                <tr
                                    key={row.id}
                                    onClick={() => onRowClick?.(row.original)}
                                    className={`border-b border-border-default/50 transition-colors
                                        ${onRowClick ? 'cursor-pointer hover:bg-bg-subtle' : ''}
                                        ${(row.original.low_stock_threshold ?? 0) > 0 && row.original.stock_available <= (row.original.low_stock_threshold ?? 0)
                                            ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                            : ''
                                        }`}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-3 py-2">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-1">
                <span className="text-xs text-text-muted">
                    {table.getFilteredRowModel().rows.length} products
                    {globalFilter ? ` matching "${globalFilter}"` : ''}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-bg-subtle transition-colors"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-text-muted px-1">
                        Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                    </span>
                    <button
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-bg-subtle transition-colors"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
