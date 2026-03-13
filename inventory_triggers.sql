-- 1. Create inventory_adjustments table
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    type TEXT NOT NULL, -- 'Reconciliation', 'Damage', 'Expiration', 'Manual'
    previous_stock NUMERIC NOT NULL,
    actual_stock NUMERIC NOT NULL,
    difference NUMERIC NOT NULL,
    reason TEXT,
    adjusted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to inventory_adjustments" 
ON inventory_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Trigger Function for Sales
CREATE OR REPLACE FUNCTION handle_sale_stock_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE products 
        SET stock_available = stock_available - NEW.quantity
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE products 
        SET stock_available = stock_available + OLD.quantity - NEW.quantity
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE products 
        SET stock_available = stock_available + OLD.quantity
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger Function for Purchases
CREATE OR REPLACE FUNCTION handle_purchase_stock_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'received') THEN
        UPDATE products 
        SET stock_available = stock_available + NEW.quantity
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only update if status changes to 'received' or if quantity changes while 'received'
        IF (OLD.status != 'received' AND NEW.status = 'received') THEN
            UPDATE products SET stock_available = stock_available + NEW.quantity WHERE id = NEW.product_id;
        ELSIF (OLD.status = 'received' AND NEW.status != 'received') THEN
            UPDATE products SET stock_available = stock_available - OLD.quantity WHERE id = OLD.product_id;
        ELSIF (OLD.status = 'received' AND NEW.status = 'received') THEN
            UPDATE products SET stock_available = stock_available - OLD.quantity + NEW.quantity WHERE id = NEW.product_id;
        END IF;
    ELSIF (TG_OP = 'DELETE' AND OLD.status = 'received') THEN
        UPDATE products 
        SET stock_available = stock_available - OLD.quantity
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply Triggers
DROP TRIGGER IF EXISTS tr_sale_stock_update ON sales;
CREATE TRIGGER tr_sale_stock_update
AFTER INSERT OR UPDATE OR DELETE ON sales
FOR EACH ROW EXECUTE FUNCTION handle_sale_stock_update();

DROP TRIGGER IF EXISTS tr_purchase_stock_update ON purchases;
CREATE TRIGGER tr_purchase_stock_update
AFTER INSERT OR UPDATE OR DELETE ON purchases
FOR EACH ROW EXECUTE FUNCTION handle_purchase_stock_update();

-- 5. Trigger Function for Customer Refunds
CREATE OR REPLACE FUNCTION handle_refund_stock_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE products 
        SET stock_available = stock_available + NEW.quantity
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE products 
        SET stock_available = stock_available - OLD.quantity + NEW.quantity
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE products 
        SET stock_available = stock_available - OLD.quantity
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger Function for Supplier Returns
CREATE OR REPLACE FUNCTION handle_return_stock_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE products 
        SET stock_available = stock_available - NEW.quantity
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE products 
        SET stock_available = stock_available + OLD.quantity - NEW.quantity
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE products 
        SET stock_available = stock_available + OLD.quantity
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Apply Refund/Return Triggers
DROP TRIGGER IF EXISTS tr_refund_stock_update ON customer_refunds;
CREATE TRIGGER tr_refund_stock_update
AFTER INSERT OR UPDATE OR DELETE ON customer_refunds
FOR EACH ROW EXECUTE FUNCTION handle_refund_stock_update();

DROP TRIGGER IF EXISTS tr_return_stock_update ON supplier_returns;
CREATE TRIGGER tr_return_stock_update
AFTER INSERT OR UPDATE OR DELETE ON supplier_returns
FOR EACH ROW EXECUTE FUNCTION handle_return_stock_update();
