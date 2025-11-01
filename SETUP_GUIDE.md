# 🚀 Varaha Swami Food Delivery - Complete Setup Guide

## ✅ What's Already Done

1. ✅ `.env` file created with your Supabase credentials
2. ✅ `supabase.sql` schema file created
3. ✅ All React components are built and ready
4. ✅ TypeScript types defined
5. ✅ Improved Auth component with fallback profile creation

---

## 📋 Step-by-Step Setup Instructions

### Step 1: Verify Supabase Database Setup

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to SQL Editor** (left sidebar)
3. **Run the schema file**:
   - Copy the contents of `supabase.sql`
   - Paste into the SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter
4. **Verify tables were created**:
   - Go to "Table Editor" (left sidebar)
   - You should see: `profiles`, `menu_items`, `orders`, `order_items`

### Step 2: Disable Email Confirmation (For Testing)

1. Go to **Authentication → Settings** in Supabase
2. Scroll to **Email Auth**
3. **Disable "Confirm email"** toggle (this allows instant login without email verification)
4. Click **Save**

### Step 3: Test Database Connection

Run the test script to verify everything is working:

```bash
node test-connection.js
```

This will check:
- ✅ Database connection
- ✅ All tables exist
- ✅ Menu items are loaded
- ✅ User signup and profile creation works

### Step 4: Start the Application

```bash
npm run dev
```

The app should start at: http://localhost:5173/

---

## 🔧 Troubleshooting Common Issues

### Issue 1: "Failed to create user: Database error"

**Cause**: The automatic profile creation trigger isn't working

**Solution**:
1. Make sure you ran the entire `supabase.sql` file
2. Check if the trigger exists:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```
3. If missing, run these commands in Supabase SQL Editor:
   ```sql
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS TRIGGER 
   SECURITY DEFINER
   SET search_path = public
   AS $$
   BEGIN
     INSERT INTO public.profiles (id, full_name, user_type)
     VALUES (
       NEW.id,
       COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
       COALESCE((NEW.raw_user_meta_data->>'user_type')::user_role, 'customer')
     );
     RETURN NEW;
   EXCEPTION
     WHEN others THEN
       RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

**Backup Solution**: The updated Auth component now has fallback logic that creates the profile manually if the trigger fails.

### Issue 2: Can't sign in after signup

**Cause**: Email confirmation is enabled

**Solution**: 
1. Go to Supabase Dashboard → Authentication → Settings
2. Disable "Confirm email" toggle
3. Or check your email for the confirmation link

### Issue 3: Menu items not showing

**Cause**: Sample data wasn't inserted

**Solution**: Run this in Supabase SQL Editor:
```sql
INSERT INTO menu_items (name, description, price, is_available, category) VALUES
  ('Margherita Pizza', 'Classic pizza with tomato sauce, mozzarella, and basil', 12.99, true, 'Pizza'),
  ('Pepperoni Pizza', 'Pizza topped with pepperoni and cheese', 14.99, true, 'Pizza'),
  ('Chicken Burger', 'Grilled chicken burger with lettuce and mayo', 8.99, true, 'Burgers'),
  ('Veggie Burger', 'Vegetarian burger with grilled vegetables', 7.99, true, 'Burgers'),
  ('Caesar Salad', 'Fresh romaine lettuce with caesar dressing', 6.99, true, 'Salads'),
  ('French Fries', 'Crispy golden french fries', 3.99, true, 'Sides'),
  ('Coke', 'Chilled Coca-Cola', 1.99, true, 'Beverages'),
  ('Lasagna', 'Layered pasta with meat sauce and cheese', 13.99, true, 'Pasta')
ON CONFLICT DO NOTHING;
```

### Issue 4: Location/Map not working

**Cause**: Browser location permissions not granted

**Solution**:
1. Click the location icon in your browser's address bar
2. Allow location access
3. Refresh the page

---

## 👥 User Roles

The app supports 3 user types:

### 1. **Customer** (Default)
- Browse menu
- Add items to cart
- Place orders (delivery or pickup)
- Track orders in real-time
- **Test**: Sign up with any email (e.g., `customer@test.com`)

### 2. **Owner** (Restaurant Manager)
- View all orders in kanban board
- Update order status (confirm, preparing, ready)
- Manage orders workflow
- **Test**: Sign up with `owner@example.com`

### 3. **Delivery** (Delivery Person)
- View available orders
- Accept delivery orders
- Track location in real-time
- Mark orders as delivered
- **Test**: Sign up with `delivery@example.com`

---

## 🧪 Testing the Complete Flow

### Test Scenario 1: Customer Orders Food

1. **Sign up** as customer: `customer@test.com` / `password123`
2. Allow **location access** when prompted
3. Browse the **Menu** tab
4. Add items to cart (click "Add" button)
5. Go to **Cart** tab
6. Click "Place Delivery Order" or "Place Pickup Order"
7. Go to **Orders** tab to see your order

### Test Scenario 2: Owner Processes Order

1. **Sign up** as owner: `owner@example.com` / `password123`
2. You'll see the order in "New Orders" column
3. Click **"Confirm Order"**
4. Order moves to "In Progress"
5. Click **"Start Preparing"**
6. Click **"Ready for Pickup"**
7. Order moves to "Ready for Pickup" column

### Test Scenario 3: Delivery Picks Up Order

1. **Sign up** as delivery: `delivery@example.com` / `password123`
2. Allow **location access**
3. Click **"Go Online"** button
4. See the order in "Available for Pickup"
5. Click **"Accept Delivery"**
6. Order appears in "My Deliveries → In Progress"
7. Click **"Mark as Delivered"**

### Test Scenario 4: Customer Tracks Order

1. As customer, go to **Orders** tab
2. When delivery picks up the order, a **"Track Order"** button appears
3. Click it to see **real-time map** with:
   - 🔴 Restaurant location
   - 🟢 Your location
   - 🔵 Delivery person's location (updates in real-time)

---

## 🗂️ Project Structure

```
varaha-swami-food-delivery/
├── components/
│   ├── Auth.tsx                 # Login/Signup page
│   ├── icons.tsx                # SVG icons
│   ├── customer/
│   │   └── CustomerView.tsx     # Customer dashboard
│   ├── delivery/
│   │   └── DeliveryView.tsx     # Delivery dashboard
│   ├── owner/
│   │   └── OwnerView.tsx        # Owner dashboard
│   └── shared/
│       ├── Loading.tsx          # Loading spinner
│       └── Map.tsx              # Real-time tracking map
├── hooks/
│   └── useAuth.tsx              # Authentication hook
├── lib/
│   ├── supabaseClient.ts        # Supabase config
│   └── utils.ts                 # Utility functions
├── .env                         # Environment variables
├── supabase.sql                 # Database schema
├── test-connection.js           # Connection test script
├── types.ts                     # TypeScript types
└── App.tsx                      # Main app component
```

---

## 🔑 Environment Variables

Your `.env` file contains:

```env
VITE_SUPABASE_URL=https://bswmtfskxolrtyzqsngp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_OWNER_EMAIL=owner@example.com
VITE_DELIVERY_EMAIL=delivery@example.com
VITE_SHOP_LAT=28.6139
VITE_SHOP_LON=77.2090
VITE_DELIVERY_RADIUS_KM=3
```

---

## 📊 Database Schema

### Tables:
1. **profiles** - User profiles (customer/owner/delivery)
2. **menu_items** - Restaurant menu
3. **orders** - Customer orders
4. **order_items** - Items in each order

### Security:
- ✅ Row Level Security (RLS) enabled
- ✅ Users can only see their own data
- ✅ Owners can see all orders
- ✅ Delivery can see assigned orders

---

## 🎯 Next Steps

1. **Run the test script**: `node test-connection.js`
2. **Start the dev server**: `npm run dev`
3. **Test all 3 user types**
4. **Check browser console** for any errors
5. **Check Supabase logs** if issues persist

---

## 🆘 Still Having Issues?

1. **Check browser console** (F12) for errors
2. **Check Supabase logs**: Dashboard → Logs
3. **Verify RLS policies**: Dashboard → Authentication → Policies
4. **Test connection**: Run `node test-connection.js`

---

## ✨ Features

- 🔐 **Secure Authentication** (Email/Password + Google OAuth)
- 🍕 **Dynamic Menu** with categories
- 🛒 **Shopping Cart** with quantity management
- 📍 **Location-based Delivery** (checks if customer is within radius)
- 🗺️ **Real-time Tracking** with Leaflet maps
- 📱 **Responsive Design** (works on mobile/tablet/desktop)
- 🔔 **Real-time Updates** (order status changes appear instantly)
- 🎨 **Modern UI** with Framer Motion animations
- 🚀 **Fast Performance** with React 19 + Vite

---

**Good luck! 🎉**
