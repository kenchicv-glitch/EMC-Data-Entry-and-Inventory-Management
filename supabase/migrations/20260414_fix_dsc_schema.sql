-- Migration: Add Missing Reference IDs for DSC Sync
-- Date: 2026-04-14

DO $$ 
BEGIN 
    -- 1. dsc_invoice_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dsc_invoice_items' AND column_name='reference_id') THEN
        ALTER TABLE public.dsc_invoice_items ADD COLUMN reference_id UUID;
    END IF;

    -- 2. dsc_dr_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dsc_dr_items' AND column_name='reference_id') THEN
        ALTER TABLE public.dsc_dr_items ADD COLUMN reference_id UUID;
    END IF;

    -- 3. dsc_ots_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dsc_ots_items' AND column_name='reference_id') THEN
        ALTER TABLE public.dsc_ots_items ADD COLUMN reference_id UUID;
    END IF;

    -- 4. dsc_collections
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dsc_collections' AND column_name='reference_id') THEN
        ALTER TABLE public.dsc_collections ADD COLUMN reference_id UUID;
    END IF;

    -- 5. dsc_purchases
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dsc_purchase_items' AND column_name='reference_id') THEN
        ALTER TABLE public.dsc_purchase_items ADD COLUMN reference_id UUID;
    END IF;

END $$;
