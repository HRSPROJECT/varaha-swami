-- =====================================================
-- Fix SQL Constraint Error - Run in Supabase SQL Editor
-- =====================================================

-- 1. Add is_online column if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;

-- 2. Add is_deleted column if not exists  
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 3. Create function to check if menu item can be deleted
CREATE OR REPLACE FUNCTION can_delete_menu_item(item_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    order_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO order_count
    FROM order_items
    WHERE menu_item_id = item_id;
    
    RETURN order_count = 0;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to soft delete menu items
CREATE OR REPLACE FUNCTION soft_delete_menu_item(item_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    can_hard_delete BOOLEAN;
BEGIN
    -- Check if item can be hard deleted
    SELECT can_delete_menu_item(item_id) INTO can_hard_delete;
    
    IF can_hard_delete THEN
        -- Hard delete if no orders reference it
        DELETE FROM menu_items WHERE id = item_id;
        RETURN TRUE;
    ELSE
        -- Soft delete if orders reference it
        UPDATE menu_items 
        SET is_deleted = TRUE, is_available = FALSE 
        WHERE id = item_id;
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Update existing owner profile (replace email with your actual owner email)
UPDATE profiles 
SET user_type = 'owner' 
WHERE id IN (
  SELECT auth.uid() FROM auth.users 
  WHERE email = 'owner@example.com'
);

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION can_delete_menu_item(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_menu_item(BIGINT) TO authenticated;

-- 7. Verify setup
SELECT 'Setup completed successfully' as status;
