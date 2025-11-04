-- =====================================================
-- HELP & CONTACT SYSTEM - SQL SCHEMA
-- =====================================================

-- Restaurant contact information table
CREATE TABLE IF NOT EXISTS restaurant_contact (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  phone_number TEXT,
  whatsapp_number TEXT,
  email TEXT,
  address TEXT,
  working_hours TEXT DEFAULT '9:00 AM - 10:00 PM',
  is_active BOOLEAN DEFAULT TRUE
);

-- Insert default contact info (update as needed)
INSERT INTO restaurant_contact (phone_number, whatsapp_number, email, address) 
VALUES (
  '+91 9876543210',
  '+91 9876543210', 
  'contact@varahaswami.com',
  'Varaha Swami Restaurant, Main Street, City'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE restaurant_contact ENABLE ROW LEVEL SECURITY;

-- Everyone can view contact info
CREATE POLICY "Contact info is viewable by everyone"
  ON restaurant_contact FOR SELECT
  USING (is_active = true);

-- Only owners can update contact info
CREATE POLICY "Only owners can update contact info"
  ON restaurant_contact FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

-- Only owners can insert contact info
CREATE POLICY "Only owners can insert contact info"
  ON restaurant_contact FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_restaurant_contact_active ON restaurant_contact(is_active);

-- =====================================================
-- TRIGGER FOR UPDATED_AT
-- =====================================================

CREATE TRIGGER update_restaurant_contact_updated_at
  BEFORE UPDATE ON restaurant_contact
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
