-- Sample promotional banners data
-- Run this after setting up the main schema

INSERT INTO promotional_banners (title, description, image_url, offer_text, display_order, is_active) VALUES
('Grand Opening Special', 'Celebrate with us! Amazing discounts on all items', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800', '50% OFF', 1, true),
('Fresh & Delicious', 'Made with the finest ingredients daily', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800', 'FRESH DAILY', 2, true),
('Weekend Special', 'Special weekend menu with exclusive dishes', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800', 'WEEKEND ONLY', 3, true);
