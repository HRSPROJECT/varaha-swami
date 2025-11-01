// Test script to check menu permissions
// Run with: node test-permissions.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPermissions() {
  console.log('🔍 Testing menu permissions...\n');

  try {
    // Test 1: Check if we can read menu items
    console.log('1. Testing menu read access...');
    const { data: menuItems, error: readError } = await supabase
      .from('menu_items')
      .select('*')
      .limit(1);
    
    if (readError) {
      console.error('❌ Read error:', readError.message);
    } else {
      console.log('✅ Can read menu items:', menuItems?.length || 0, 'items found');
    }

    // Test 2: Check profiles table
    console.log('\n2. Testing profiles access...');
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_type, full_name')
      .eq('user_type', 'owner');
    
    if (profileError) {
      console.error('❌ Profile error:', profileError.message);
    } else {
      console.log('✅ Owner profiles found:', profiles);
    }

    // Test 3: Try to insert a test menu item (will fail without auth)
    console.log('\n3. Testing menu insert (should fail - no auth)...');
    const { data: insertData, error: insertError } = await supabase
      .from('menu_items')
      .insert({
        name: 'Test Item',
        price: 10.00,
        category: 'Test',
        is_available: true
      });
    
    if (insertError) {
      console.log('✅ Insert correctly failed (no auth):', insertError.message);
    } else {
      console.log('⚠️ Insert succeeded without auth (unexpected):', insertData);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPermissions();
