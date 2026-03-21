import type { Product } from '../../inventory/types/product';

export interface Sale {
    id: string;
    transaction_label: string | null;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    vat_amount: number | null;
    discount_amount: number | null;
    is_discounted: boolean | null;
    cost_price: number | null;
    delivery_fee: number | null;
    date: string;
    invoice_number: string | null;
    customer_id: string | null;
    user_id: string | null;
    customer_name: string | null;
    fulfillment_status: 'pickup' | 'delivered' | 'out' | null;
    payment_mode: string | null;
    is_os: boolean | null;
    or_number: string | null;
    branch_id: string;
    edited_at: string | null;
    invoice_type: 'A' | 'B' | null;
    products?: Pick<Product, 'name' | 'brand'>;
}

export interface GroupedSale {
    invoice_number: string;
    date: string;
    customer_name: string;
    fulfillment_status: 'pickup' | 'delivered' | 'out';
    payment_mode: string;
    items: Sale[];
    is_os: boolean;
    edited_at: string | null;
    invoice_type: 'A' | 'B';
    transaction_label: string | null;
    full_name: string;
    total_base: number;
    total_vat: number;
    total_discount: number;
    delivery_fee: number;
    grand_total: number;
    customer_id: string | null;
}

export interface CustomerRefund {
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
    branch_id: string;
    user_id: string | null;
    products?: Pick<Product, 'name'>;
}
