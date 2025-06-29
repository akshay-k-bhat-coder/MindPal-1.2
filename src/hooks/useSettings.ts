import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  voice_speed: 'slow' | 'normal' | 'fast';
  ai_personality: 'supportive' | 'professional' | 'friendly' | 'motivational';
  task_reminders: boolean;
  mood_reminders: boolean;
  daily_summary: boolean;
  email_notifications: boolean;
  data_sharing: boolean;
  analytics: boolean;
  voice_recordings: boolean;
}

const defaultSettings: UserSettings = {
  theme: 'dark', // Default to dark theme
  language: 'en',
  voice_speed: 'normal',
  ai_personality: 'supportive',
  task_reminders: true,
  mood_reminders: true,
  daily_summary: true,
  email_notifications: false,
  data_sharing: false,
  analytics: true,
  voice_recordings: true,
};

export function useSettings() {
  const { user, handleSupabaseError } = useAuth();
  const { withRetry, isConnectedToSupabase } = useNetworkStatus();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingDefaults, setCreatingDefaults] = useState(false);
  
  // Track error states to prevent spam
  const lastErrorTime = useRef<number>(0);
  const errorCooldown = 30000; // 30 seconds between error messages

  const applyTheme = useCallback((theme: 'light' | 'dark' | 'auto') => {
    const root = document.documentElement;
    
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, []);

  const showErrorToast = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastErrorTime.current > errorCooldown) {
      toast.error(message);
      lastErrorTime.current = now;
    }
  }, [errorCooldown]);

  const loadSettings = useCallback(async () => {
    // If no user or Supabase not configured, use defaults
    if (!user || !isSupabaseConfigured()) {
      setSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
      setLoading(false);
      return;
    }

    // If not connected to Supabase, use current settings
    if (!isConnectedToSupabase) {
      applyTheme(settings.theme);
      setLoading(false);
      return;
    }

    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          // Handle specific Supabase errors
          if (error.message?.includes('fetch') || 
              error.message?.includes('network') ||
              error.message?.includes('timeout')) {
            throw new Error('Network connection failed');
          }
          
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      }, 1, 2000); // Single retry with longer delay

      if (data) {
        const loadedSettings: UserSettings = {
          theme: data.theme || 'dark',
          language: data.language || 'en',
          voice_speed: data.voice_speed || 'normal',
          ai_personality: data.ai_personality || 'supportive',
          task_reminders: data.task_reminders ?? true,
          mood_reminders: data.mood_reminders ?? true,
          daily_summary: data.daily_summary ?? true,
          email_notifications: data.email_notifications ?? false,
          data_sharing: data.data_sharing ?? false,
          analytics: data.analytics ?? true,
          voice_recordings: data.voice_recordings ?? true,
        };
        setSettings(loadedSettings);
        applyTheme(loadedSettings.theme);
      } else {
        // Create default settings if they don't exist
        if (!creatingDefaults && !saving) {
          await createDefaultSettings();
        } else {
          setSettings(defaultSettings);
          applyTheme(defaultSettings.theme);
        }
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      
      // Use default settings on any error
      setSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
      
      // Only show error toast with cooldown to prevent spam
      if (isConnectedToSupabase && isSupabaseConfigured()) {
        if (error.message?.includes('Network connection failed')) {
          showErrorToast('Unable to connect to server. Using default settings.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user, handleSupabaseError, creatingDefaults, saving, withRetry, isConnectedToSupabase, applyTheme, settings.theme, showErrorToast]);

  const createDefaultSettings = async () => {
    if (!user || creatingDefaults || !isConnectedToSupabase || !isSupabaseConfigured()) {
      // Fallback to local defaults
      setSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
      return;
    }

    try {
      setCreatingDefaults(true);
      
      await withRetry(async () => {
        const { error } = await supabase
          .from('user_settings')
          .upsert([{ 
            user_id: user.id, 
            ...defaultSettings 
          }], {
            onConflict: 'user_id'
          });

        if (error) {
          if (error.message?.includes('fetch') || 
              error.message?.includes('network') ||
              error.message?.includes('timeout')) {
            throw new Error('Network connection failed');
          }
          
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return;
        }
      }, 1, 2000);
      
      setSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
    } catch (error: any) {
      console.error('Error creating default settings:', error);
      
      // Still apply defaults locally
      setSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
      
      // Only show error with cooldown
      if (isConnectedToSupabase && isSupabaseConfigured()) {
        if (error.message?.includes('Network connection failed')) {
          showErrorToast('Unable to connect to server. Settings saved locally.');
        }
      }
    } finally {
      setCreatingDefaults(false);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    
    // Apply theme immediately for better UX
    if (newSettings.theme) {
      applyTheme(newSettings.theme);
    }
    
    // Update local state immediately
    setSettings(updatedSettings);

    // If no user or Supabase not configured, only save locally
    if (!user || !isSupabaseConfigured()) {
      if (!isSupabaseConfigured()) {
        toast.success('Settings saved locally (Supabase not configured)');
      } else {
        toast.error('Please sign in to save settings');
      }
      return;
    }

    if (!isConnectedToSupabase) {
      // Don't show error for offline saves
      return;
    }

    try {
      setSaving(true);
      
      await withRetry(async () => {
        const { error } = await supabase
          .from('user_settings')
          .upsert([{ 
            user_id: user.id, 
            ...updatedSettings,
            updated_at: new Date().toISOString()
          }], {
            onConflict: 'user_id'
          });

        if (error) {
          if (error.message?.includes('fetch') || 
              error.message?.includes('network') ||
              error.message?.includes('timeout')) {
            throw new Error('Network connection failed');
          }
          
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return;
        }
      }, 1, 2000);
      
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      console.error('Error updating settings:', error);
      
      // Don't show error toast for settings updates to prevent spam
      // Settings are already saved locally, so user experience isn't affected
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user]); // Removed loadSettings from deps to prevent infinite loop

  // Listen for system theme changes when auto mode is enabled
  useEffect(() => {
    if (settings.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('auto');
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.theme, applyTheme]);

  // Apply theme on initial load
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme, applyTheme]);

  return {
    settings,
    loading,
    saving,
    updateSettings,
  };
}