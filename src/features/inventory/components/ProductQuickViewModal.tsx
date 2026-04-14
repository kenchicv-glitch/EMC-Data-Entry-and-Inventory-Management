import { X, Package, AlertTriangle } from 'lucide-react';
import type { Product } from '../types/product';

interface ProductQuickViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onEdit?: (product: Product) => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-medium text-text-primary">{value ?? '—'}</p>
        </div>
    );
}

export default function ProductQuickViewModal({
    isOpen,
    onClose,
    product,
    onEdit,
}: ProductQuickViewModalProps) {
    if (!isOpen || !product) return null;

    const threshold = product.low_stock_threshold ?? 0;
    const isLow = threshold > 0 && product.stock_available <= threshold;
    const isOut = product.stock_available <= 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-bg-surface border border-border-default rounded-2xl shadow-2xl animate-scale-in">
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-4 border-b border-border-default">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-bg-subtle border border-border-default flex items-center justify-center">
                            <Package size={18} className="text-text-muted" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-text-primary leading-tight">{product.name}</h2>
                            <p className="text-xs font-mono text-text-muted">{product.sku}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors mt-0.5">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Alert */}
                    {isLow && (
                        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${
                            isOut ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                            <AlertTriangle size={14} />
                            {isOut ? 'Out of stock' : `Low stock — only ${product.stock_available} left (threshold: ${threshold})`}
                        </div>
                    )}

                    {/* Stock grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-bg-subtle rounded-xl p-3 text-center">
                            <p className={`text-2xl font-black tabular-nums ${isLow ? 'text-amber-500' : 'text-text-primary'}`}>
                                {product.stock_available}
                            </p>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider mt-0.5">Available</p>
                        </div>
                        <div className="bg-bg-subtle rounded-xl p-3 text-center">
                            <p className="text-2xl font-black text-text-secondary tabular-nums">{product.stock_reserved}</p>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider mt-0.5">Reserved</p>
                        </div>
                        <div className="bg-bg-subtle rounded-xl p-3 text-center">
                            <p className="text-2xl font-black text-red-400 tabular-nums">{product.stock_damaged}</p>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider mt-0.5">Damaged</p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Brand" value={product.brand} />
                        <Field label="Unit" value={product.unit} />
                        <Field label="Selling Price" value={
                            product.selling_price != null
                                ? `₱${Number(product.selling_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                : null
                        } />
                        <Field label="Buying Price" value={
                            product.buying_price != null
                                ? `₱${Number(product.buying_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                : null
                        } />
                        <Field label="Category" value={
                            product.category ? (
                                <span className="inline-flex items-center gap-1">
                                    {product.category.color && (
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: product.category.color }} />
                                    )}
                                    {product.category.name}
                                </span>
                            ) : null
                        } />
                        <Field label="Location" value={
                            product.location ? (
                                <span className="font-mono text-xs bg-bg-subtle border border-border-default px-1.5 py-0.5 rounded">
                                    {product.location.code}
                                </span>
                            ) : null
                        } />
                    </div>

                    {product.description && (
                        <Field label="Description" value={<span className="text-text-secondary">{product.description}</span>} />
                    )}
                </div>

                {/* Footer */}
                {onEdit && (
                    <div className="px-6 pb-6">
                        <button
                            onClick={() => { onEdit(product); onClose(); }}
                            className="w-full px-4 py-2.5 rounded-xl bg-brand-red text-white text-sm font-bold hover:bg-brand-red/90 transition-all"
                        >
                            Edit Product
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
