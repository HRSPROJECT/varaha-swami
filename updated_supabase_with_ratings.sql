-- =====================================================
-- RATING SYSTEM & SUGGESTIONS - ADD TO EXISTING DATABASE
-- =====================================================
-- Run this after your main supabase.sql file

-- =====================================================
-- NEW TABLES
-- =====================================================

-- Order ratings table
CREATE TABLE IF NOT EXISTS order_ratings (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_message TEXT,
  improvement_suggestion TEXT,
  UNIQUE(order_id)
);

-- Customer suggestions table  
CREATE TABLE IF NOT EXISTS customer_suggestions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suggestion_text TEXT NOT NULL,
  customer_name TEXT,
  is_read BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_order_ratings_order_id ON order_ratings(order_id);
CREATE INDEX IF NOT EXISTS idx_order_ratings_customer_id ON order_ratings(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_ratings_rating ON order_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_order_ratings_created_at ON order_ratings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_suggestions_customer_id ON customer_suggestions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_suggestions_is_read ON customer_suggestions(is_read);
CREATE INDEX IF NOT EXISTS idx_customer_suggestions_created_at ON customer_suggestions(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE order_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_suggestions ENABLE ROW LEVEL SECURITY;

-- Order ratings policies
CREATE POLICY "Customers can view their own ratings"
  ON order_ratings FOR SELECT
  USING (
    auth.uid() = customer_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

CREATE POLICY "Customers can insert ratings for delivered orders"
  ON order_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_ratings.order_id
      AND orders.customer_id = auth.uid()
      AND orders.status = 'delivered'
    )
  );

CREATE POLICY "Customers can update their own ratings"
  ON order_ratings FOR UPDATE
  USING (auth.uid() = customer_id);

-- Customer suggestions policies
CREATE POLICY "Users can view suggestions based on role"
  ON customer_suggestions FOR SELECT
  USING (
    auth.uid() = customer_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

CREATE POLICY "Customers can insert suggestions"
  ON customer_suggestions FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Owners can update suggestion read status"
  ON customer_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

-- =====================================================
-- VIEWS
-- =====================================================

CREATE OR REPLACE VIEW ratings_with_details AS
SELECT 
  r.*,
  p.full_name as customer_name,
  o.total_price as order_total,
  o.created_at as order_date
FROM order_ratings r
LEFT JOIN profiles p ON r.customer_id = p.id
LEFT JOIN orders o ON r.order_id = o.id
ORDER BY r.created_at DESC;

CREATE OR REPLACE VIEW suggestions_with_details AS
SELECT 
  s.*,
  p.full_name as customer_full_name
FROM customer_suggestions s
LEFT JOIN profiles p ON s.customer_id = p.id
ORDER BY s.created_at DESC;

GRANT SELECT ON ratings_with_details TO authenticated;
GRANT SELECT ON suggestions_with_details TO authenticated;

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_restaurant_stats()
RETURNS TABLE(
  total_ratings BIGINT,
  average_rating DECIMAL(3,2),
  five_star BIGINT,
  four_star BIGINT,
  three_star BIGINT,
  two_star BIGINT,
  one_star BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT,
    ROUND(AVG(rating), 2),
    COUNT(CASE WHEN rating = 5 THEN 1 END)::BIGINT,
    COUNT(CASE WHEN rating = 4 THEN 1 END)::BIGINT,
    COUNT(CASE WHEN rating = 3 THEN 1 END)::BIGINT,
    COUNT(CASE WHEN rating = 2 THEN 1 END)::BIGINT,
    COUNT(CASE WHEN rating = 1 THEN 1 END)::BIGINT
  FROM order_ratings;
END;
$$ LANGUAGE plpgsql;
