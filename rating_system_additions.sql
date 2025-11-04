-- =====================================================
-- RATING SYSTEM & SUGGESTIONS - SQL ADDITIONS
-- =====================================================

-- Add these tables to your existing supabase.sql file

-- =====================================================
-- NEW TABLES
-- =====================================================

-- Order ratings table
CREATE TABLE order_ratings (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_message TEXT,
  improvement_suggestion TEXT,
  UNIQUE(order_id) -- One rating per order
);

-- Customer suggestions table
CREATE TABLE customer_suggestions (
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

CREATE INDEX idx_order_ratings_order_id ON order_ratings(order_id);
CREATE INDEX idx_order_ratings_customer_id ON order_ratings(customer_id);
CREATE INDEX idx_order_ratings_rating ON order_ratings(rating);
CREATE INDEX idx_order_ratings_created_at ON order_ratings(created_at DESC);
CREATE INDEX idx_customer_suggestions_customer_id ON customer_suggestions(customer_id);
CREATE INDEX idx_customer_suggestions_is_read ON customer_suggestions(is_read);
CREATE INDEX idx_customer_suggestions_created_at ON customer_suggestions(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
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

CREATE POLICY "Customers can insert ratings for their delivered orders"
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
CREATE POLICY "Customers can view their own suggestions"
  ON customer_suggestions FOR SELECT
  USING (
    auth.uid() = customer_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

CREATE POLICY "Customers can insert their own suggestions"
  ON customer_suggestions FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Only owners can update suggestion read status"
  ON customer_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'owner'
    )
  );

-- =====================================================
-- VIEWS FOR EASY DATA ACCESS
-- =====================================================

-- View for ratings with customer and order details
CREATE OR REPLACE VIEW ratings_with_details AS
SELECT 
  r.*,
  p.full_name as customer_name,
  p.phone as customer_phone,
  o.total_price as order_total,
  o.created_at as order_date,
  o.order_type
FROM order_ratings r
LEFT JOIN profiles p ON r.customer_id = p.id
LEFT JOIN orders o ON r.order_id = o.id
ORDER BY r.created_at DESC;

-- View for suggestions with customer details
CREATE OR REPLACE VIEW suggestions_with_details AS
SELECT 
  s.*,
  p.full_name as customer_full_name,
  p.phone as customer_phone
FROM customer_suggestions s
LEFT JOIN profiles p ON s.customer_id = p.id
ORDER BY s.created_at DESC;

-- Grant access to views
GRANT SELECT ON ratings_with_details TO authenticated;
GRANT SELECT ON suggestions_with_details TO authenticated;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get average rating for the restaurant
CREATE OR REPLACE FUNCTION get_restaurant_average_rating()
RETURNS DECIMAL(3,2) AS $$
DECLARE
  avg_rating DECIMAL(3,2);
BEGIN
  SELECT ROUND(AVG(rating), 2) INTO avg_rating
  FROM order_ratings;
  
  RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get rating statistics
CREATE OR REPLACE FUNCTION get_rating_stats()
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
    COUNT(*)::BIGINT as total_ratings,
    ROUND(AVG(rating), 2) as average_rating,
    COUNT(CASE WHEN rating = 5 THEN 1 END)::BIGINT as five_star,
    COUNT(CASE WHEN rating = 4 THEN 1 END)::BIGINT as four_star,
    COUNT(CASE WHEN rating = 3 THEN 1 END)::BIGINT as three_star,
    COUNT(CASE WHEN rating = 2 THEN 1 END)::BIGINT as two_star,
    COUNT(CASE WHEN rating = 1 THEN 1 END)::BIGINT as one_star
  FROM order_ratings;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Sample ratings (uncomment to add test data)
/*
INSERT INTO order_ratings (order_id, customer_id, rating, review_message, improvement_suggestion) VALUES
  (1, (SELECT id FROM profiles WHERE user_type = 'customer' LIMIT 1), 5, 'Excellent food and fast delivery!', NULL),
  (2, (SELECT id FROM profiles WHERE user_type = 'customer' LIMIT 1), 4, 'Good taste but delivery was a bit slow', 'Please improve delivery time'),
  (3, (SELECT id FROM profiles WHERE user_type = 'customer' LIMIT 1), 5, 'Amazing pizza! Will order again', NULL);

INSERT INTO customer_suggestions (customer_id, suggestion_text, customer_name) VALUES
  ((SELECT id FROM profiles WHERE user_type = 'customer' LIMIT 1), 'Please add more vegetarian options to the menu', 'John Doe'),
  ((SELECT id FROM profiles WHERE user_type = 'customer' LIMIT 1), 'It would be great to have a loyalty program', 'Jane Smith');
*/
