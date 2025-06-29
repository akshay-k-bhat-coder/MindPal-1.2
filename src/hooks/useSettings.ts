import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { supabase } from '../lib/supabase';
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

  const applyTheme = useCallback((theme: 'light' | 'dark' | 'auto') => {
    const root = document.documentElement;
    
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, []);

  const loadSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      // Apply default theme when no user
      applyTheme(defaultSettings.theme);
      return;
    }

    if (!isConnectedToSupabase) {
      setLoading(false);
      // Apply current settings theme when offline
      applyTheme(settings.theme);
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
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      }, 3, 1000);

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
          // Apply default theme if we can't create settings
          setSettings(defaultSettings);
          applyTheme(defaultSettings.theme);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Apply default settings on error
      setSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
      
      if (isConnectedToSupabase) {
        toast.error('Failed to load settings, using defaults');
      }
    } finally {
      setLoading(false);
    }
  }, [user, handleSupabaseError, creatingDefaults, saving, withRetry, isConnectedToSupabase, applyTheme, settings.theme]);

  const createDefaultSettings = async () => {
    if (!user || creatingDefaults || !isConnectedToSupabase) return;

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
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return;
        }
      }, 3, 1000);
      
      setSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
    } catch (error) {
      console.error('Error creating default settings:', error);
      // Still apply defaults locally
      setSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
      
      if (isConnectedToSupabase) {
        toast.error('Failed to create default settings');
      }
    } finally {
      setCreatingDefaults(false);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) {
      toast.error('Please sign in to save settings');
      return;
    }

    const updatedSettings = { ...settings, ...newSettings };
    
    // Apply theme immediately for better UX
    if (newSettings.theme) {
      applyTheme(newSettings.theme);
    }
    
    // Update local state immediately
    setSettings(updatedSettings);

    if (!isConnectedToSupabase) {
      toast.error('Settings saved locally. Will sync when connection is restored.');
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
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return;
        }
      }, 3, 1000);
      
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to save settings. Please try again.');
      
      // Revert local changes on error
      setSettings(settings);
      if (newSettings.theme) {
        applyTheme(settings.theme);
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSettings();
    } else {
      setLoading(false);
      setSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
    }
  }, [user, loadSettings]);

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