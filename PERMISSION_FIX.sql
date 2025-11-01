-- =====================================================
-- COMPREHENSIVE MENU PERMISSIONS FIX
-- Copy and paste this ENTIRE script into Supabase SQL Editor
-- =====================================================

-- Step 1: Check current owner setup
DO $$
DECLARE
    owner_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO owner_count 
    FROM profiles 
    WHERE user_type = 'owner';
    
    RAISE NOTICE 'Current owner profiles: %', owner_count;
END $$;

-- Step 2: Ensure owner profile exists (replace with your email)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'owner@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Step 3: Create/update owner profile
INSERT INTO profiles (id, full_name, user_type)
SELECT id, 'Restaurant Owner', 'owner'
FROM auth.users 
WHERE email = 'owner@example.com'
ON CONFLICT (id) DO UPDATE SET user_type = 'owner';

-- Step 4: Drop all existing menu policies
DROP POLICY IF EXISTS "Menu items are viewable by everyone" ON menu_items;
DROP POLICY IF EXISTS "Only owners can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Only owners can update menu items" ON menu_items;
DROP POLICY IF EXISTS "Only owners can delete menu items" ON menu_items;
DROP POLICY IF EXISTS "Owners can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Owners can update menu items" ON menu_items;
DROP POLICY IF EXISTS "Owners can delete menu items" ON menu_items;

-- Step 5: Create simple, working policies
CREATE POLICY "Anyone can view menu items"
  ON menu_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated owners can insert menu items"
  ON menu_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

CREATE POLICY "Authenticated owners can update menu items"
  ON menu_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

CREATE POLICY "Authenticated owners can delete menu items"
  ON menu_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

-- Step 6: Grant necessary permissions
GRANT ALL ON menu_items TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT USAGE ON SEQUENCE menu_items_id_seq TO authenticated;

-- Step 7: Test the setup
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Check if owner profile exists
    SELECT INTO test_result 
        p.id, p.user_type, u.email 
    FROM profiles p 
    JOIN auth.users u ON p.id = u.id 
    WHERE u.email = 'owner@example.com';
    
    IF FOUND THEN
        RAISE NOTICE 'Owner profile found: % (%) - %', test_result.email, test_result.id, test_result.user_type;
    ELSE
        RAISE NOTICE 'No owner profile found!';
    END IF;
END $$;

-- Step 8: Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'menu_items'
ORDER BY policyname;
