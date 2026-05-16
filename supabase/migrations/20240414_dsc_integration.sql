-- Migration: Create DSC Expenses & Returns Tables
-- Date: 2026-04-14

-- Create dsc_expenses table
CREATE TABLE IF NOT EXISTS public.dsc_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id UUID NOT NULL REFERENCES public.dsc_days(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'general', -- 'general' or 'salary'
    reference_id UUID, -- For syncing from Systems expenses
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create dsc_returns table
CREATE TABLE IF NOT EXISTS public.dsc_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id UUID NOT NULL REFERENCES public.dsc_days(id) ON DELETE CASCADE,
    original_invoice_no TEXT,
    description TEXT NOT NULL,
    qty DECIMAL(12, 3),
    unit_price DECIMAL(12, 2),
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    reason TEXT,
    reference_id UUID, -- For syncing from Systems customer_refunds
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS dsc_expenses_day_id_idx ON public.dsc_expenses(day_id);
CREATE INDEX IF NOT EXISTS dsc_returns_day_id_idx ON public.dsc_returns(day_id);

-- Enable RLS
ALTER TABLE public.dsc_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsc_returns ENABLE ROW LEVEL SECURITY;

-- Add Public Access Policies (Matching project boilerplate)
CREATE POLICY "Allow all access to dsc_expenses" ON public.dsc_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to dsc_returns" ON public.dsc_returns FOR ALL USING (true) WITH CHECK (true);
