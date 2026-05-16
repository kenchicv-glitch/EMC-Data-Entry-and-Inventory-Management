export interface DscDay {
  id: string;
  date: string;           // 'YYYY-MM-DD'
  branch_id: string | null;
  status: 'open' | 'closed';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DscPurchaseItem {
  id: string;
  day_id: string;
  batch: 1 | 2 | 3;
  description: string;
  amount: number;
  sort_order: number;
  created_at: string;
}

export interface DscInvoiceItem {
  id: string;
  day_id: string;
  series: 'A' | 'B';
  header_invoice_no: string | null;
  line_invoice_no: string | null;
  qty: number;
  description: string;
  unit_price: number;
  is_cancelled: boolean;
  reference_id: string | null;
  sort_order: number;
  created_at: string;
  // computed
  amount?: number; // qty * unit_price
}

export interface DscDrItem {
  id: string;
  day_id: string;
  account_name: string;
  dr_number: string | null;
  qty: number;
  description: string;
  unit_price: number;
  reference_id: string | null;
  sort_order: number;
  created_at: string;
  amount?: number;
}

export interface DscOtsItem {
  id: string;
  day_id: string;
  qty: number;
  description: string;
  unit_price: number;
  reference_id: string | null;
  sort_order: number;
  created_at: string;
  amount?: number;
}

export interface DscExpenseEntry {
  id: string;
  day_id: string;
  description: string;
  amount: number;
  category: 'general' | 'salary';
  reference_id?: string;
  sort_order: number;
  created_at: string;
}

export interface DscReturnEntry {
  id: string;
  day_id: string;
  original_invoice_no: string | null;
  description: string;
  qty: number | null;
  unit_price: number | null;
  amount: number;
  reason: string | null;
  reference_id?: string;
  sort_order: number;
  created_at: string;
}

export interface DscSalaryEntry {
  id: string;
  day_id: string;
  employee_name: string;
  rate: number | null;
  days_worked: number | null;
  amount: number;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export type ArType = 'cash' | 'gcash' | 'dr' | 'ar2';

export interface DscArEntry {
  id: string;
  day_id: string;
  ar_type: ArType;
  account_name: string;
  dr_number: string | null;
  amount: number;
  reference_id: string | null;
  sort_order: number;
  created_at: string;
}

export type CollectionType =
  | 'cash'
  | 'gcash'
  | 'bank_psb'
  | 'bank_mbtc'
  | 'cheque'
  | 'zaldy'
  | 'cashplus'
  | 'milcorp';

export interface DscCollection {
  id: string;
  day_id: string;
  collection_type: CollectionType;
  reference: string | null;
  amount: number;
  reference_id: string | null;
  created_at: string;
}

export interface DscCashDenomination {
  id: string;
  day_id: string;
  denomination: number;
  count: number;
}

export interface DscSiSummary {
  id: string;
  day_id: string;
  book_label: string;
  si_range_start: string | null;
  si_range_end: string | null;
  total: number;
  sort_order: number;
  created_at: string;
}

// Aggregated daily view (used in DscDailyPage)
export interface DscDayFull {
  day: DscDay;
  purchases: DscPurchaseItem[];
  invoicesA: DscInvoiceItem[];
  invoicesB: DscInvoiceItem[];
  drItems: DscDrItem[];
  otsItems: DscOtsItem[];
  salaryEntries: DscSalaryEntry[]; // Legacy - will move to expenseEntries
  expenseEntries: DscExpenseEntry[];
  returnEntries: DscReturnEntry[];
  arEntries: DscArEntry[];
  collections: DscCollection[];
  cashDenominations: DscCashDenomination[];
  siSummaries: DscSiSummary[];
}

// Monthly summary row (mirrors EMC3 SUMMARY sheet columns)
export interface DscMonthlySummaryRow {
  date: string;
  cash: number;
  cash_out: number;
  chq_sales: number;
  gcash: number;
  bank_transfer: number;
  p1_3rv1: number;
  p1_3rv2: number;
  p1_emc1: number;
  p1_mc: number;
  p1_repack: number;
  p1_others: number;
  total_purchases_1: number;
  p2_3rv1: number;
  p2_3rv2: number;
  p2_emc1: number;
  p2_emc2: number;
  total_purchases_2: number;
  total_purchases_3: number;
  expenses: number;
  mda: number;
  sa_withdrawal: number;
  bir_check: number;
  salary_check: number;
  ar_mc_salary: number;
  ar_cash_3rv1: number;
  ar_cash_3rv2: number;
  ar_cash_emc1: number;
  ar_cash_edna: number;
  ar_cash_misc: number;
  total_ar_cash: number;
  ar1_emc2: number;
  ar1_emc1: number;
  ar1_3rv1: number;
  ar1_3rv2: number;
  ar1_ate_edna: number;
  ar1_others: number;
  total_ar1: number;
  ar2: number;
  ar2_others: number;
  total_sales: number;
  net_sales: number;
  coll_cash: number;
  coll_gcash: number;
  coll_bank_psb: number;
  coll_bank_mbtc: number;
  coll_cheque: number;
  coll_zaldy: number;
  coll_cashplus: number;
  coll_milcorp: number;
  total_deposit: number;
  receipt: number;
  unrecorded_short: number;
}
