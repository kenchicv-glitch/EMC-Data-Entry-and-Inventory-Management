import { Search, X, AlertTriangle } from 'lucide-react';
import type { InventoryLocation } from '../types/product';

interface ProductFiltersProps {
    search: string;
    onSearchChange: (v: string) => void;
    brandFilter: string;
    onBrandChange: (v: string) => void;
    locationFilter: string;
    onLocationChange: (v: string) => void;
    lowStockOnly: boolean;
    onLowStockToggle: () => void;
    brands: string[];
    locations: InventoryLocation[];
    onClearAll: () => void;
}

export default function ProductFilters({
    search,
    onSearchChange,
    brandFilter,
    onBrandChange,
    locationFilter,
    onLocationChange,
    lowStockOnly,
    onLowStockToggle,
    brands,
    locations,
    onClearAll,
}: ProductFiltersProps) {
    const hasFilters = search || brandFilter || locationFilter || lowStockOnly;

    return (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-bg-surface border border-border-default rounded-xl">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                    id="inventory-product-search"
                    type="text"
                    placeholder="Search SKU or name…"
                    value={search}
                    onChange={e => onSearchChange(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-bg-subtle border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all"
                />
                {search && (
                    <button
                        onClick={() => onSearchChange('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* Brand */}
            <select
                value={brandFilter}
                onChange={e => onBrandChange(e.target.value)}
                className="px-3 py-1.5 bg-bg-subtle border border-border-default rounded-lg text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all cursor-pointer"
            >
                <option value="">All brands</option>
                {brands.map(b => (
                    <option key={b} value={b}>{b}</option>
                ))}
            </select>

            {/* Location */}
            <select
                value={locationFilter}
                onChange={e => onLocationChange(e.target.value)}
                className="px-3 py-1.5 bg-bg-subtle border border-border-default rounded-lg text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/40 transition-all cursor-pointer"
            >
                <option value="">All locations</option>
                {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                ))}
            </select>

            {/* Low stock toggle */}
            <button
                onClick={onLowStockToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    lowStockOnly
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                        : 'bg-bg-subtle border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-muted'
                }`}
            >
                <AlertTriangle size={13} />
                Low stock
            </button>

            {/* Clear */}
            {hasFilters && (
                <button
                    onClick={onClearAll}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-brand-red transition-colors"
                >
                    <X size={12} />
                    Clear
                </button>
            )}
        </div>
    );
}
