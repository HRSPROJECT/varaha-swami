-- Add promotional banners table (run this if the table doesn't exist)

CREATE TABLE IF NOT EXISTS promotional_banners (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  offer_text TEXT,
  valid_until TIMESTAMP WITH TIME ZONE
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_promotional_banners_active ON promotional_banners(is_active, display_order);

-- Enable RLS
ALTER TABLE promotional_banners ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Active banners are viewable by everyone"
  ON promotional_banners FOR SELECT
  USING (is_active = true);

CREATE POLICY "Only owners can manage banners"
  ON promotional_banners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );
