-- Drop dependent view first
DROP VIEW IF EXISTS orders_with_details;

-- Fix existing estimated_delivery_time column type and add new columns
ALTER TABLE orders DROP COLUMN IF EXISTS estimated_delivery_time;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_prep_time INTEGER; -- minutes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_time INTEGER; -- minutes

-- Update existing orders to have default values
UPDATE orders SET 
  estimated_prep_time = 20,
  estimated_delivery_time = 15
WHERE estimated_prep_time IS NULL;

-- Recreate the view with new columns
CREATE OR REPLACE VIEW orders_with_details AS
SELECT 
  o.*,
  c.full_name as customer_name,
  c.phone as customer_phone,
  d.full_name as delivery_boy_name,
  d.phone as delivery_boy_phone
FROM orders o
LEFT JOIN profiles c ON o.customer_id = c.id
LEFT JOIN profiles d ON o.delivery_boy_id = d.id;

-- Grant access to view
GRANT SELECT ON orders_with_details TO authenticated;
