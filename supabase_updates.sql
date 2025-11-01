-- =====================================================
-- Varaha Swami Food Delivery - Schema Updates
-- Run these commands in Supabase SQL Editor
-- =====================================================

-- Add restaurant online status to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;

-- Add index for faster delivery person lookup
CREATE INDEX IF NOT EXISTS idx_profiles_delivery_online ON profiles(user_type, is_online) WHERE user_type = 'delivery';

-- Add function to auto-assign delivery person
CREATE OR REPLACE FUNCTION auto_assign_delivery_person(order_id_param BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  delivery_person_id UUID;
  order_type_val order_type;
BEGIN
  -- Get order type
  SELECT order_type INTO order_type_val FROM orders WHERE id = order_id_param;
  
  -- Only auto-assign for delivery orders
  IF order_type_val = 'delivery' THEN
    -- Find first available delivery person (prefer online, but accept offline)
    SELECT id INTO delivery_person_id 
    FROM profiles 
    WHERE user_type = 'delivery' 
    ORDER BY is_online DESC, created_at ASC 
    LIMIT 1;
    
    -- Update order with delivery person
    IF delivery_person_id IS NOT NULL THEN
      UPDATE orders 
      SET delivery_boy_id = delivery_person_id 
      WHERE id = order_id_param;
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-assign delivery when order becomes ready
CREATE OR REPLACE FUNCTION trigger_auto_assign_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'ready' and it's a delivery order
  IF NEW.status = 'ready' AND OLD.status != 'ready' AND NEW.order_type = 'delivery' THEN
    -- Only assign if no delivery person assigned yet
    IF NEW.delivery_boy_id IS NULL THEN
      PERFORM auto_assign_delivery_person(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS auto_assign_delivery_trigger ON orders;
CREATE TRIGGER auto_assign_delivery_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_assign_delivery();

-- Add index for faster order queries
CREATE INDEX IF NOT EXISTS idx_orders_status_type ON orders(status, order_type);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_boy_id, status) WHERE delivery_boy_id IS NOT NULL;

-- Update RLS policy for profiles to allow delivery status updates
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auto_assign_delivery_person(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_auto_assign_delivery() TO authenticated;
