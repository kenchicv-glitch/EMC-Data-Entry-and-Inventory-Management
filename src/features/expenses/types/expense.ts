export interface Expense {
    id: string;
    category: string;
    description: string | null;
    amount: number;
    date: string | null;
    invoice_number: string | null;
    user_id: string | null;
}
