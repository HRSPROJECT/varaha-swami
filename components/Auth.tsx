import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserRole } from '../types';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { GoogleIcon } from './icons';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true); // Default to login for faster UX
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const getRole = (email: string): UserRole => {
    if (email.toLowerCase() === import.meta.env.VITE_OWNER_EMAIL?.toLowerCase()) {
      return UserRole.Owner;
    }
    if (email.toLowerCase() === import.meta.env.VITE_DELIVERY_EMAIL?.toLowerCase()) {
      return UserRole.Delivery;
    }
    return UserRole.Customer;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const toastId = toast.loading(isLogin ? 'Signing in...' : 'Creating account...');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Logged in successfully!', { id: toastId });
      } else {
        // Sign up the user
        const { data: { user }, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { 
              full_name: fullName || email.split('@')[0],
              user_type: getRole(email)
            },
          },
        });
        
        if (error) throw error;
        if (!user) throw new Error("Signup successful, but no user object returned.");
        
        // Reduced wait time for better UX
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if profile was created by trigger
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        // If profile doesn't exist, create it manually (fallback)
        if (profileCheckError || !existingProfile) {
          const userRole = getRole(email);
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              full_name: fullName || email.split('@')[0],
              user_type: userRole
            });
          
          if (insertError) {
            console.error('Failed to create profile:', insertError);
            throw new Error(`Account created but profile setup failed: ${insertError.message}`);
          }
        } else if (existingProfile.user_type === UserRole.Customer) {
          // Update role if needed (for owner/delivery accounts)
          const userRole = getRole(email);
          if (userRole !== UserRole.Customer) {
            await supabase
              .from('profiles')
              .update({ user_type: userRole })
              .eq('id', user.id);
          }
        }
        
        toast.success('Account created! Signing you in...', { id: toastId });
        
        // Auto sign in after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        
        if (signInError) {
          console.warn('Auto sign-in failed:', signInError);
          setIsLogin(true);
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.error_description || error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    setLoading(true);
    
    // Detect if running in Android app
    const isAndroidApp = (window as any).isAndroidApp || navigator.userAgent.includes('wv');
    const redirectUrl = isAndroidApp 
      ? 'varahaswami://oauth/callback'
      : `${window.location.origin}/auth/callback`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleGoogleRedirect = async () => {
        const { data: { session }} = await supabase.auth.getSession();
        if (session && session.user.email) {
            // Check if profile exists
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('user_type')
              .eq('id', session.user.id)
              .maybeSingle();
            
            if (profileError && profileError.code === 'PGRST116') {
              // Profile doesn't exist, create it
              const role = getRole(session.user.email);
              await supabase.from('profiles').insert({
                id: session.user.id,
                full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
                user_type: role
              });
            } else if (profile && profile.user_type === UserRole.Customer) {
                const role = getRole(session.user.email);
                if (role !== UserRole.Customer) {
                    await supabase.from('profiles').update({ user_type: role }).eq('id', session.user.id);
                }
            }
        }
    }
    handleGoogleRedirect();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-gray-100 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            {isLogin ? 'Welcome Back!' : 'Create an Account'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            for <span className="font-semibold text-orange-600">Varaha Swami</span> Restaurant
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAuth}>
          {!isLogin && (
            <input
              type="text"
              required
              className="w-full px-4 py-3 text-gray-800 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
          <input
            type="email"
            required
            className="w-full px-4 py-3 text-gray-800 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={6}
            className="w-full px-4 py-3 text-gray-800 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-orange-400 transition-all duration-200"
          >
            {loading ? (
              <div className="flex justify-center items-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-gray-300" />
          <span className="flex-shrink mx-4 text-sm text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-300" />
        </div>
        
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full inline-flex justify-center items-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-200 transition-all"
        >
          <GoogleIcon className="w-5 h-5 mr-3" />
          Sign in with Google
        </button>
        
        <p className="text-sm text-center text-gray-600">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)} 
            className="ml-1 font-medium text-orange-600 hover:text-orange-500 focus:outline-none"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
