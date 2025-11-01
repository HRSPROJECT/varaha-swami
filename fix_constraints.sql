-- =====================================================
-- Fix Foreign Key Constraints and Online Status
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. Add is_online column if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;

-- 2. Create function to check if menu item can be deleted
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

-- 3. Create safer delete policy for menu items
DROP POLICY IF EXISTS "Authenticated owners can delete menu items" ON menu_items;

CREATE POLICY "Owners can delete unused menu items"
  ON menu_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
    AND can_delete_menu_item(id)
  );

-- 4. Add soft delete option (mark as deleted instead of actual delete)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 5. Create view for active menu items (not deleted)
CREATE OR REPLACE VIEW active_menu_items AS
SELECT * FROM menu_items 
WHERE is_deleted = FALSE;

-- 6. Grant permissions
GRANT SELECT ON active_menu_items TO authenticated;
GRANT EXECUTE ON FUNCTION can_delete_menu_item(BIGINT) TO authenticated;

-- 7. Update menu items query to exclude deleted items
-- (This will be handled in the frontend code)

-- 8. Create function to soft delete menu items
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

GRANT EXECUTE ON FUNCTION soft_delete_menu_item(BIGINT) TO authenticated;
