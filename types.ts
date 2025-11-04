import { Session, User } from '@supabase/supabase-js';

// Fix: Add global type definitions for Vite environment variables to resolve "Property 'env' does not exist on type 'ImportMeta'".
declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_SUPABASE_URL: string;
      readonly VITE_SUPABASE_ANON_KEY: string;
      readonly VITE_OWNER_EMAIL?: string;
      readonly VITE_DELIVERY_EMAIL?: string;
      readonly VITE_SHOP_LAT?: string;
      readonly VITE_SHOP_LON?: string;
      readonly VITE_DELIVERY_RADIUS_KM?: string;
      readonly VITE_OPENROUTE_API_KEY?: string;
    }
  }
}

export enum UserRole {
  Customer = 'customer',
  Owner = 'owner',
  Delivery = 'delivery',
}

export enum OrderStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Preparing = 'preparing',
  Ready = 'ready',
  PickedUp = 'picked_up',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

export enum OrderType {
  Delivery = 'delivery',
  Pickup = 'pickup',
}

export interface Profile {
  id: string;
  updated_at: string;
  full_name: string | null;
  avatar_url: string | null;
  user_type: UserRole;
  lat: number | null;
  lon: number | null;
  is_online?: boolean;
}

export interface MenuItem {
  id: number;
  created_at: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category: string | null;
  preparation_time_minutes: number | null;
  is_deleted?: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface Order {
  id: number;
  created_at: string;
  customer_id: string;
  delivery_boy_id: string | null;
  status: OrderStatus;
  total_price: number;
  customer_lat: number | null;
  customer_lon: number | null;
  order_type: OrderType;
  house_no: string;
  building_no: string | null;
  landmark: string | null;
  customer_phone: string;
  estimated_prep_time: number | null; // minutes
  estimated_delivery_time: number | null; // minutes
  order_items: OrderItem[];
  profiles: Profile; // For customer name
  delivery_boy_profile?: Profile; // For delivery boy info
  rating?: OrderRating; // Rating if exists
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  quantity: number;
  price: number;
  menu_items: MenuItem;
}

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export interface PromotionalBanner {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  image_url: string;
  is_active: boolean;
  display_order: number;
  offer_text: string | null;
  valid_until: string | null;
}

export interface OrderRating {
  id: number;
  created_at: string;
  order_id: number;
  customer_id: string;
  rating: number; // 1-5 stars
  review_message: string | null;
  improvement_suggestion: string | null;
}

export interface CustomerSuggestion {
  id: number;
  created_at: string;
  customer_id: string;
  suggestion_text: string;
  customer_name: string | null;
  is_read: boolean;
}

export interface RatingStats {
  total_ratings: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

export interface RestaurantContact {
  id: number;
  created_at: string;
  updated_at: string;
  phone_number: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  working_hours: string | null;
  is_active: boolean;
}