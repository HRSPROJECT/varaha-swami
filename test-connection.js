// Test script to verify Supabase connection and database setup
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bswmtfskxolrtyzqsngp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzd210ZnNreG9scnR5enFzbmdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MTg5NDEsImV4cCI6MjA3NTk5NDk0MX0.czL-bXmsqs9x7xmUx0tIXGf8N7HDuNN5KHDm6PazrNQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Testing Supabase Connection...\n');

async function testConnection() {
  try {
    // Test 1: Check if we can connect to Supabase
    console.log('1️⃣ Testing basic connection...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.log('❌ Connection failed:', healthError.message);
      console.log('   Details:', healthError);
      return;
    }
    console.log('✅ Connection successful!\n');

    // Test 2: Check if tables exist
    console.log('2️⃣ Checking if tables exist...');
    const tables = ['profiles', 'menu_items', 'orders', 'order_items'];
    
    for (const table of tables) {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ Table '${table}' error:`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }
    console.log('');

    // Test 3: Check menu items
    console.log('3️⃣ Checking menu items...');
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('*');
    
    if (menuError) {
      console.log('❌ Error fetching menu items:', menuError.message);
    } else {
      console.log(`✅ Found ${menuItems?.length || 0} menu items`);
      if (menuItems && menuItems.length > 0) {
        console.log('   Sample item:', menuItems[0].name);
      }
    }
    console.log('');

    // Test 4: Test signup
    console.log('4️⃣ Testing user signup...');
    const testEmail = `test${Date.now()}@example.com`;
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'test123456',
      options: {
        data: { full_name: 'Test User' }
      }
    });

    if (signupError) {
      console.log('❌ Signup error:', signupError.message);
      console.log('   Details:', signupError);
    } else {
      console.log('✅ Signup successful!');
      console.log('   User ID:', signupData.user?.id);
      
      // Check if profile was created
      if (signupData.user) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for trigger
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', signupData.user.id)
          .single();
        
        if (profileError) {
          console.log('❌ Profile not created automatically:', profileError.message);
          console.log('   This is the main issue! The trigger is not working.');
        } else {
          console.log('✅ Profile created automatically!');
          console.log('   Profile:', profile);
        }
      }
    }
    console.log('');

    console.log('🎉 Test completed!\n');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testConnection();
