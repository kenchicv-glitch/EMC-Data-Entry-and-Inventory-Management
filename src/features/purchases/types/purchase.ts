import type { Product } from '../../inventory/types/product';

export type PurchaseStatus = 'pending' | 'received';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type PurchaseType = 'supplier' | 'transfer';

export interface Purchase {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number | null;
    total_price: number | null;
    vat_amount: number | null;
    discount_amount: number | null;
    is_discounted: boolean | null;
    supplier: string | null;
    status: PurchaseStatus | null;
    payment_status: PaymentStatus | null;
    purchase_type: PurchaseType | null;
    date: string;
    received_date: string | null;
    payment_date: string | null;
    invoice_number: string | null;
    supplier_id: string | null;
    user_id: string | null;
    is_finalized?: boolean;
    products?: Pick<Product, 'name'>;
}

export interface GroupedPurchase {
    invoice_number: string;
    date: string;
    supplier: string;
    status: PurchaseStatus;
    payment_status: PaymentStatus;
    purchase_type: PurchaseType;
    items: Purchase[];
    total_base: number;
    total_vat: number;
    total_discount: number;
    grand_total: number;
}

export interface SupplierReturn {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number | null;
    total_price: number | null;
    vat_amount: number | null;
    discount_amount: number | null;
    is_discounted: boolean | null;
    reason: string | null;
    date: string;
    invoice_number: string | null;
    products?: Pick<Product, 'name'>;
}
