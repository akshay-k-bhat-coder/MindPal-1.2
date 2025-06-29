import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables:', {
    url: supabaseUrl ? 'present' : 'missing',
    key: supabaseKey ? 'present' : 'missing'
  });
  throw new Error('Supabase configuration is incomplete. Please check your environment variables.');
}

// Validate URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  console.error('Invalid Supabase URL format:', supabaseUrl);
  throw new Error('Invalid Supabase URL format. Expected format: https://[project-id].supabase.co');
}

// Create client with proper error handling
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'mindpal-app'
    }
  }
});

// Test connection function
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      console.warn('Supabase connection test failed:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Supabase connection test error:', error);
    return false;
  }
};

// Simplified database types - no complex type generation needed
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name?: string;
          avatar_url?: string;
          timezone?: string;
          phone?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          avatar_url?: string;
          timezone?: string;
          phone?: string;
        };
        Update: {
          full_name?: string;
          avatar_url?: string;
          timezone?: string;
          phone?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description?: string;
          completed: boolean;
          priority: 'low' | 'medium' | 'high';
          category: string;
          due_date?: string;
          reminder_enabled: boolean;
          reminder_time?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          description?: string;
          completed?: boolean;
          priority?: 'low' | 'medium' | 'high';
          category?: string;
          due_date?: string;
          reminder_enabled?: boolean;
          reminder_time?: string;
        };
        Update: {
          title?: string;
          description?: string;
          completed?: boolean;
          priority?: 'low' | 'medium' | 'high';
          category?: string;
          due_date?: string;
          reminder_enabled?: boolean;
          reminder_time?: string;
        };
      };
      mood_entries: {
        Row: {
          id: string;
          user_id: string;
          mood: number;
          emoji: string;
          notes?: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          mood: number;
          emoji: string;
          notes?: string;
        };
        Update: {
          mood?: number;
          emoji?: string;
          notes?: string;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title?: string;
        };
        Update: {
          title?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          message_type: 'user' | 'ai';
          content: string;
          created_at: string;
        };
        Insert: {
          session_id: string;
          user_id: string;
          message_type: 'user' | 'ai';
          content: string;
        };
        Update: {
          content?: string;
        };
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          theme?: 'light' | 'dark' | 'auto';
          language?: string;
          voice_speed?: 'slow' | 'normal' | 'fast';
          ai_personality?: 'supportive' | 'professional' | 'friendly' | 'motivational';
          task_reminders?: boolean;
          mood_reminders?: boolean;
          daily_summary?: boolean;
          email_notifications?: boolean;
          data_sharing?: boolean;
          analytics?: boolean;
          voice_recordings?: boolean;
        };
        Update: {
          theme?: 'light' | 'dark' | 'auto';
          language?: string;
          voice_speed?: 'slow' | 'normal' | 'fast';
          ai_personality?: 'supportive' | 'professional' | 'friendly' | 'motivational';
          task_reminders?: boolean;
          mood_reminders?: boolean;
          daily_summary?: boolean;
          email_notifications?: boolean;
          data_sharing?: boolean;
          analytics?: boolean;
          voice_recordings?: boolean;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'task_reminder' | 'mood_reminder' | 'daily_summary';
          title: string;
          message: string;
          scheduled_for: string;
          sent: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          type: 'task_reminder' | 'mood_reminder' | 'daily_summary';
          title: string;
          message: string;
          scheduled_for: string;
          sent?: boolean;
        };
        Update: {
          sent?: boolean;
        };
      };
      encrypted_data: {
        Row: {
          id: string;
          user_id: string;
          data_type: string;
          encrypted_content: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          data_type: string;
          encrypted_content: string;
        };
        Update: {
          encrypted_content?: string;
        };
      };
      video_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          conversation_id?: string;
          is_pro_session?: boolean;
          session_config?: any;
          duration_seconds?: number;
          created_at: string;
          ended_at?: string;
        };
        Insert: {
          user_id: string;
          session_id: string;
          conversation_id?: string;
          is_pro_session?: boolean;
          session_config?: any;
          duration_seconds?: number;
          ended_at?: string;
        };
        Update: {
          ended_at?: string;
          duration_seconds?: number;
        };
      };
    };
  };
}