/*
  # Update MindPal Database Schema

  1. New Tables
    - `chat_sessions` - Individual chat sessions with AI
    - `chat_messages` - Messages within chat sessions
    - `mood_analytics` - Analytics and reports for mood data

  2. Updates
    - Add delete functionality for mood entries
    - Enhanced notification system
    - Chat session management

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Chat sessions table for managing conversations
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat sessions"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Chat messages table for individual messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('user', 'ai')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat messages"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Mood analytics table for reports
CREATE TABLE IF NOT EXISTS mood_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  analysis_type text NOT NULL CHECK (analysis_type IN ('mood_report', 'stress_analysis', 'emotion_summary')),
  analysis_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mood_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mood analytics"
  ON mood_analytics
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_analytics_user_id ON mood_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_analytics_session_id ON mood_analytics(session_id);

-- Update chat sessions updated_at trigger
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update chat session when new message is added
CREATE OR REPLACE FUNCTION update_chat_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions 
  SET updated_at = now() 
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update chat session timestamp
DROP TRIGGER IF EXISTS update_session_on_message ON chat_messages;
CREATE TRIGGER update_session_on_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_on_message();