-- SKU Reformatting Migration
-- Adds variant_type, size, and legacy_sku columns to products table
-- Backfills legacy_sku from current breadcrumb-style sku values

-- 1. Add new columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_type TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS size TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS legacy_sku TEXT DEFAULT NULL;

-- 2. Backfill legacy_sku from current breadcrumb SKUs (before they get overwritten)
UPDATE products
SET legacy_sku = sku
WHERE sku IS NOT NULL
  AND sku LIKE '% > %';

-- 3. Create index on sku for faster lookups during migration
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
