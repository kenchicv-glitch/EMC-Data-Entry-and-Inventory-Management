export interface Expense {
    id: string;
    category: string;
    description: string | null;
    amount: number;
    date: string | null;
    invoice_number: string | null;
    branch_id: string;
    user_id: string | null;
}
