import { AlertTriangle } from 'lucide-react';
import type { Product } from '../types/product';

interface LowStockBadgeProps {
    product: Pick<Product, 'stock_available' | 'low_stock_threshold'>;
    showCount?: boolean;
    className?: string;
}

export default function LowStockBadge({ product, showCount = true, className = '' }: LowStockBadgeProps) {
    const threshold = product.low_stock_threshold ?? 0;
    if (threshold <= 0 || product.stock_available > threshold) return null;

    const isOut = product.stock_available <= 0;

    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${
                isOut
                    ? 'bg-red-500/15 text-red-500'
                    : 'bg-amber-500/15 text-amber-500'
            } ${className}`}
        >
            <AlertTriangle size={9} />
            {isOut ? 'Out' : showCount ? `Low (${product.stock_available})` : 'Low'}
        </span>
    );
}
