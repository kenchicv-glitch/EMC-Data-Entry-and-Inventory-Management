export interface Product {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    brand: string | null;
    stock_available: number;
    stock_reserved: number;
    stock_damaged: number;
    selling_price: number | null;
    buying_price: number | null;
    supplier_selling_price: number | null;
    low_stock_threshold: number | null;
    supplier_id: string | null;
    created_at: string;
}

export interface StockMovement {
    id: string;
    product_id: string;
    type: 'sale' | 'purchase' | 'adjustment' | 'refund' | 'return';
    quantity: number;
    reason: string | null;
    date: string;
    user_id: string | null;
}
