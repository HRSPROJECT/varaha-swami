import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { Profile, AuthContextType, UserRole } from '../types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const getRole = (email: string): UserRole => {
    if (email.toLowerCase() === import.meta.env.VITE_OWNER_EMAIL?.toLowerCase()) {
      return UserRole.Owner;
    }
    if (email.toLowerCase() === import.meta.env.VITE_DELIVERY_EMAIL?.toLowerCase()) {
      return UserRole.Delivery;
    }
    return UserRole.Customer;
  };

  const fetchOrCreateProfile = async (userId: string, userEmail: string): Promise<Profile | null> => {
    try {
      console.log('Fetching profile for user:', userId);
      
      // Faster timeout for better UX
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const { data: profileData, error: profileError } = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as any;

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      if (profileData) {
        console.log('✅ Profile found:', profileData);
        return profileData as Profile;
      }

      // Profile doesn't exist, create it quickly
      console.log('⚠️ Profile not found, creating new profile...');
      const userRole = getRole(userEmail);
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: userEmail.split('@')[0],
          user_type: userRole
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating profile:', insertError);
        return null;
      }

      console.log('✅ Profile created successfully:', newProfile);
      return newProfile as Profile;
    } catch (error: any) {
      console.error('❌ Unexpected error in fetchOrCreateProfile:', error.message);
      return null;
    }
  };

  useEffect(() => {
    // Prevent multiple initializations
    if (initialized) return;
    
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth...');
        
        // Check localStorage first for instant loading
        const cachedSession = localStorage.getItem('user_session');
        const cachedProfile = localStorage.getItem('user_profile');
        
        if (cachedSession && cachedProfile) {
          try {
            const sessionData = JSON.parse(cachedSession);
            const profileData = JSON.parse(cachedProfile);
            
            // Check if session is still valid (not expired)
            const now = Math.floor(Date.now() / 1000);
            if (sessionData.expires_at && sessionData.expires_at > now) {
              // Set cached data immediately
              setSession(sessionData);
              setUser(sessionData.user);
              setProfile(profileData);
              setLoading(false);
              setInitialized(true);
              
              console.log('✅ Loaded from cache - no reload needed');
              return; // Skip server check if we have valid cache
            } else {
              console.log('⚠️ Cached session expired, clearing cache');
              localStorage.removeItem('user_session');
              localStorage.removeItem('user_profile');
            }
          } catch (e) {
            localStorage.removeItem('user_session');
            localStorage.removeItem('user_profile');
          }
        }
        
        // Only check server if no valid cache
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (error) {
          console.error('❌ Error getting session:', error);
          setLoading(false);
          setInitialized(true);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const profileData = await fetchOrCreateProfile(session.user.id, session.user.email || '');
          
          if (isMounted && profileData) {
            setProfile(profileData);
            // Cache for next time
            localStorage.setItem('user_session', JSON.stringify(session));
            localStorage.setItem('user_profile', JSON.stringify(profileData));
          }
        }
        
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    // Handle page visibility changes (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && initialized) {
        console.log('👁️ Tab became visible - checking auth state');
        // Only refresh if we don't have valid cached data
        const cachedSession = localStorage.getItem('user_session');
        if (!cachedSession && !session) {
          // Only re-initialize if we have no session data
          setInitialized(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth state changed:', event);
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user && event === 'SIGNED_IN') {
          const profileData = await fetchOrCreateProfile(session.user.id, session.user.email || '');
          
          if (isMounted && profileData) {
            setProfile(profileData);
            // Update cache
            localStorage.setItem('user_session', JSON.stringify(session));
            localStorage.setItem('user_profile', JSON.stringify(profileData));
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          localStorage.removeItem('user_session');
          localStorage.removeItem('user_profile');
        }
      }
    );

    return () => {
      console.log('🧹 Cleaning up auth provider');
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      authListener?.subscription.unsubscribe();
    };
  }, []); // Remove dependencies to prevent re-initialization

  const signOut = async () => {
    console.log('👋 Signing out...');
    await supabase.auth.signOut();
    localStorage.removeItem('user_profile');
    localStorage.removeItem('user_session');
    setSession(null);
    setUser(null);
    setProfile(null);
    setInitialized(false); // Allow re-initialization
  };

  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
