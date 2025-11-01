-- =====================================================
-- Fix Menu CRUD Operations - Run in Supabase SQL Editor
-- =====================================================

-- First, let's check what's wrong and fix it

-- Drop existing policies
DROP POLICY IF EXISTS "Only owners can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Only owners can update menu items" ON menu_items;
DROP POLICY IF EXISTS "Only owners can delete menu items" ON menu_items;

-- Create simpler, more reliable policies
CREATE POLICY "Owners can insert menu items"
  ON menu_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

CREATE POLICY "Owners can update menu items"
  ON menu_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

CREATE POLICY "Owners can delete menu items"
  ON menu_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

-- Also ensure the owner profile exists and is set correctly
-- Replace 'owner@example.com' with your actual owner email
UPDATE profiles 
SET user_type = 'owner' 
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email = 'owner@example.com'
);

-- Grant necessary permissions
GRANT ALL ON menu_items TO authenticated;
GRANT ALL ON profiles TO authenticated;

-- Test query to verify owner status (run this to check)
-- SELECT p.id, p.user_type, u.email 
-- FROM profiles p 
-- JOIN auth.users u ON p.id = u.id 
-- WHERE u.email = 'owner@example.com';
