-- Enable real-time for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- Grant real-time access
GRANT SELECT ON orders TO authenticated;
GRANT SELECT ON menu_items TO authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON order_items TO authenticated;
