/*
  # Fix Migration - Skip Existing Objects
  
  This migration safely adds missing tables and policies without conflicts
*/

-- Enable necessary extensions (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Check and create missing tables only

-- Tasks table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks') THEN
    CREATE TABLE tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      title text NOT NULL,
      description text,
      completed boolean DEFAULT false,
      priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      category text DEFAULT 'personal',
      due_date timestamptz,
      reminder_enabled boolean DEFAULT false,
      reminder_time timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Mood entries table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mood_entries') THEN
    CREATE TABLE mood_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      mood integer NOT NULL CHECK (mood >= 1 AND mood <= 10),
      emoji text NOT NULL,
      notes text,
      created_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Voice sessions table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'voice_sessions') THEN
    CREATE TABLE voice_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      transcript text NOT NULL,
      ai_response text NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- User settings table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_settings') THEN
    CREATE TABLE user_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
      theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
      language text DEFAULT 'en',
      voice_speed text DEFAULT 'normal' CHECK (voice_speed IN ('slow', 'normal', 'fast')),
      ai_personality text DEFAULT 'supportive' CHECK (ai_personality IN ('supportive', 'professional', 'friendly', 'motivational')),
      task_reminders boolean DEFAULT true,
      mood_reminders boolean DEFAULT true,
      daily_summary boolean DEFAULT true,
      email_notifications boolean DEFAULT false,
      data_sharing boolean DEFAULT false,
      analytics boolean DEFAULT true,
      voice_recordings boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Notifications table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
    CREATE TABLE notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      type text NOT NULL CHECK (type IN ('task_reminder', 'mood_reminder', 'daily_summary')),
      title text NOT NULL,
      message text NOT NULL,
      scheduled_for timestamptz NOT NULL,
      sent boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Encrypted data table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'encrypted_data') THEN
    CREATE TABLE encrypted_data (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      data_type text NOT NULL,
      encrypted_content text NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE encrypted_data ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Chat sessions table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
    CREATE TABLE chat_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      title text NOT NULL DEFAULT 'New Chat',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Chat messages table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
    CREATE TABLE chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      message_type text NOT NULL CHECK (message_type IN ('user', 'ai')),
      content text NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Mood analytics table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mood_analytics') THEN
    CREATE TABLE mood_analytics (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
      analysis_type text NOT NULL CHECK (analysis_type IN ('mood_report', 'stress_analysis', 'emotion_summary')),
      analysis_data jsonb NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE mood_analytics ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Video sessions table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'video_sessions') THEN
    CREATE TABLE video_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      session_id text NOT NULL,
      conversation_id text,
      is_pro_session boolean DEFAULT false,
      session_config jsonb,
      duration_seconds integer DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      ended_at timestamptz
    );
    
    ALTER TABLE video_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add missing policies (only if they don't exist)

-- Tasks policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Users can manage own tasks') THEN
    CREATE POLICY "Users can manage own tasks" ON tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Mood entries policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mood_entries' AND policyname = 'Users can manage own mood entries') THEN
    CREATE POLICY "Users can manage own mood entries" ON mood_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Voice sessions policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_sessions' AND policyname = 'Users can manage own voice sessions') THEN
    CREATE POLICY "Users can manage own voice sessions" ON voice_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- User settings policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can manage own settings') THEN
    CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Notifications policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can read own notifications') THEN
    CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Encrypted data policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'encrypted_data' AND policyname = 'Users can manage own encrypted data') THEN
    CREATE POLICY "Users can manage own encrypted data" ON encrypted_data FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Chat sessions policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'Users can manage own chat sessions') THEN
    CREATE POLICY "Users can manage own chat sessions" ON chat_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Chat messages policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Users can manage own chat messages') THEN
    CREATE POLICY "Users can manage own chat messages" ON chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Mood analytics policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mood_analytics' AND policyname = 'Users can manage own mood analytics') THEN
    CREATE POLICY "Users can manage own mood analytics" ON mood_analytics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Video sessions policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'video_sessions' AND policyname = 'Users can manage own video sessions') THEN
    CREATE POLICY "Users can manage own video sessions" ON video_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_id ON mood_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_created_at ON mood_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for) WHERE NOT sent;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_analytics_user_id ON mood_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_analytics_session_id ON mood_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_user_id ON video_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_created_at ON video_sessions(created_at);

-- Create functions (safe to run multiple times)
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_chat_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions 
  SET updated_at = now() 
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (drop and recreate to avoid conflicts)
DROP TRIGGER IF EXISTS create_user_settings_trigger ON profiles;
CREATE TRIGGER create_user_settings_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_settings();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_session_on_message ON chat_messages;
CREATE TRIGGER update_session_on_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_on_message();