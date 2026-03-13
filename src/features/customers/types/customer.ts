export interface Customer {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    credit_limit: number;
    current_balance: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    branch_id: string | null;
}

export type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'current_balance'>;
export type CustomerUpdate = Partial<CustomerInsert>;
