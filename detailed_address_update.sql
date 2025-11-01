-- Drop dependent view first
DROP VIEW IF EXISTS orders_with_details;

-- Add detailed address fields to orders table
ALTER TABLE orders DROP COLUMN IF EXISTS customer_address;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS house_no TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS building_no TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS landmark TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '';

-- Update existing orders
UPDATE orders SET 
  house_no = 'Not specified',
  customer_phone = 'Not provided'
WHERE house_no = '' OR customer_phone = '';

-- Recreate the view with new columns (avoid naming conflicts)
CREATE OR REPLACE VIEW orders_with_details AS
SELECT 
  o.*,
  c.full_name as customer_name,
  c.phone as customer_profile_phone,
  d.full_name as delivery_boy_name,
  d.phone as delivery_boy_phone
FROM orders o
LEFT JOIN profiles c ON o.customer_id = c.id
LEFT JOIN profiles d ON o.delivery_boy_id = d.id;

-- Grant access to view
GRANT SELECT ON orders_with_details TO authenticated;
