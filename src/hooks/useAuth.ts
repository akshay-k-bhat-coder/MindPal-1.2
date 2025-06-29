import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Get initial session with error handling
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('Error getting initial session:', error);
          // Don't throw error for session retrieval issues
        }
        
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to get initial session:', error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes with error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('Auth state changed:', event);
      
      try {
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle specific auth events
        if (event === 'SIGNED_OUT') {
          // Clear any cached data
          localStorage.removeItem('supabase.auth.token');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        } else if (event === 'SIGNED_IN') {
          console.log('User signed in successfully');
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      
      if (error) {
        // Provide user-friendly error messages
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and click the confirmation link before signing in.');
        } else if (error.message.includes('Too many requests')) {
          throw new Error('Too many login attempts. Please wait a few minutes before trying again.');
        }
        throw error;
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });
      
      if (error) {
        // Provide user-friendly error messages
        if (error.message.includes('User already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        } else if (error.message.includes('Password should be')) {
          throw new Error('Password must be at least 6 characters long.');
        } else if (error.message.includes('Invalid email')) {
          throw new Error('Please enter a valid email address.');
        }
        throw error;
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.warn('Sign out error:', error);
        // Even if there's an error, clear local state
      }
      
      // Clear local state regardless of API response
      setUser(null);
      
      // Clear any cached data
      localStorage.removeItem('supabase.auth.token');
      
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      // Still clear local state
      setUser(null);
      return { error };
    }
  };

  const handleSupabaseError = async (error: any): Promise<boolean> => {
    if (!error) return false;

    // Check for JWT expiry or auth errors
    if (error?.message?.includes('JWT expired') || 
        error?.code === 'PGRST301' || 
        (error?.status === 401 && error?.message?.includes('JWT')) ||
        error?.message?.includes('refresh_token_not_found')) {
      
      console.warn('Authentication expired, signing out user');
      
      // Don't show error toast for JWT expiry - handle gracefully
      try {
        await signOut();
      } catch (signOutError) {
        console.error('Error during automatic sign out:', signOutError);
      }
      
      // Show a user-friendly message
      setTimeout(() => {
        toast.error('Your session has expired. Please sign in again.');
      }, 100);
      
      return true; // Indicates this was a JWT expiry error
    }
    
    return false; // Not a JWT expiry error
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    handleSupabaseError,
  };
}