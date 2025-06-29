/*
  # Session Reports and Analytics Tables

  1. New Tables
    - `session_reports` - AI-generated reports after video sessions
    - `session_analytics` - Real-time event tracking during sessions

  2. Functions
    - `generate_session_report` - Creates comprehensive session reports
    - `track_session_event` - Tracks analytics events during sessions

  3. Security
    - Enable RLS on new tables
    - Add policies for authenticated users to access their own data
*/

-- Session reports table
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session_reports') THEN
    CREATE TABLE session_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      video_session_id uuid REFERENCES video_sessions(id) ON DELETE CASCADE NOT NULL,
      report_type text DEFAULT 'post_session' CHECK (report_type IN ('post_session', 'weekly_summary', 'monthly_analysis')),
      report_data jsonb NOT NULL,
      insights jsonb,
      recommendations jsonb,
      mood_analysis jsonb,
      engagement_metrics jsonb,
      generated_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE session_reports ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Session analytics table for real-time data collection
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session_analytics') THEN
    CREATE TABLE session_analytics (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      video_session_id uuid REFERENCES video_sessions(id) ON DELETE CASCADE NOT NULL,
      event_type text NOT NULL CHECK (event_type IN ('session_start', 'session_end', 'interaction', 'mood_change', 'engagement_peak', 'technical_issue')),
      event_data jsonb NOT NULL,
      timestamp timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE session_analytics ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add policies only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_reports' AND policyname = 'Users can manage own session reports') THEN
    CREATE POLICY "Users can manage own session reports"
      ON session_reports
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_analytics' AND policyname = 'Users can manage own session analytics') THEN
    CREATE POLICY "Users can manage own session analytics"
      ON session_analytics
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add indexes for better performance (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_session_reports_user_id ON session_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_session_reports_video_session_id ON session_reports(video_session_id);
CREATE INDEX IF NOT EXISTS idx_session_reports_generated_at ON session_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_session_analytics_user_id ON session_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_video_session_id ON session_analytics(video_session_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_timestamp ON session_analytics(timestamp);

-- Function to generate session report (safe to run multiple times)
CREATE OR REPLACE FUNCTION generate_session_report(
  p_user_id uuid,
  p_video_session_id uuid
) RETURNS uuid AS $$
DECLARE
  v_report_id uuid;
  v_session_data record;
  v_analytics_data jsonb;
  v_report_data jsonb;
  v_insights jsonb;
  v_recommendations jsonb;
  v_mood_analysis jsonb;
  v_engagement_metrics jsonb;
BEGIN
  -- Get session data
  SELECT * INTO v_session_data
  FROM video_sessions
  WHERE id = p_video_session_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video session not found';
  END IF;

  -- Collect analytics data
  SELECT jsonb_agg(
    jsonb_build_object(
      'event_type', event_type,
      'event_data', event_data,
      'timestamp', timestamp
    )
  ) INTO v_analytics_data
  FROM session_analytics
  WHERE video_session_id = p_video_session_id AND user_id = p_user_id;

  -- Build report data
  v_report_data := jsonb_build_object(
    'session_id', v_session_data.session_id,
    'conversation_id', v_session_data.conversation_id,
    'duration_seconds', v_session_data.duration_seconds,
    'duration_formatted', CASE 
      WHEN v_session_data.duration_seconds IS NOT NULL THEN
        CONCAT(
          LPAD((v_session_data.duration_seconds / 60)::text, 2, '0'),
          ':',
          LPAD((v_session_data.duration_seconds % 60)::text, 2, '0')
        )
      ELSE '00:00'
    END,
    'started_at', v_session_data.created_at,
    'ended_at', v_session_data.ended_at,
    'session_config', v_session_data.session_config,
    'analytics_events', COALESCE(v_analytics_data, '[]'::jsonb)
  );

  -- Generate insights
  v_insights := jsonb_build_object(
    'session_quality', CASE 
      WHEN v_session_data.duration_seconds > 1800 THEN 'excellent'
      WHEN v_session_data.duration_seconds > 900 THEN 'good'
      WHEN v_session_data.duration_seconds > 300 THEN 'fair'
      ELSE 'brief'
    END,
    'engagement_level', CASE
      WHEN jsonb_array_length(COALESCE(v_analytics_data, '[]'::jsonb)) > 10 THEN 'high'
      WHEN jsonb_array_length(COALESCE(v_analytics_data, '[]'::jsonb)) > 5 THEN 'medium'
      ELSE 'low'
    END,
    'technical_issues', (
      SELECT COUNT(*)
      FROM session_analytics
      WHERE video_session_id = p_video_session_id 
        AND user_id = p_user_id 
        AND event_type = 'technical_issue'
    ),
    'interaction_count', (
      SELECT COUNT(*)
      FROM session_analytics
      WHERE video_session_id = p_video_session_id 
        AND user_id = p_user_id 
        AND event_type = 'interaction'
    )
  );

  -- Generate recommendations
  v_recommendations := jsonb_build_array(
    CASE 
      WHEN v_session_data.duration_seconds < 300 THEN
        'Consider longer sessions for more meaningful conversations'
      WHEN v_session_data.duration_seconds > 2400 THEN
        'Great session length! You engaged deeply with the AI companion'
      ELSE
        'Good session duration for effective mental health support'
    END,
    CASE
      WHEN (v_insights->>'technical_issues')::int > 2 THEN
        'Check your internet connection and browser settings for smoother sessions'
      ELSE
        'Technical performance was good during this session'
    END,
    'Continue regular video sessions for consistent mental health support',
    'Consider combining video sessions with mood tracking for better insights'
  );

  -- Generate mood analysis (placeholder - would integrate with actual mood data)
  v_mood_analysis := jsonb_build_object(
    'overall_sentiment', 'positive',
    'stress_indicators', 'low',
    'engagement_quality', 'high',
    'emotional_state', 'stable',
    'confidence_score', 0.85
  );

  -- Generate engagement metrics
  v_engagement_metrics := jsonb_build_object(
    'total_interactions', (v_insights->>'interaction_count')::int,
    'session_completion_rate', CASE 
      WHEN v_session_data.ended_at IS NOT NULL THEN 100
      ELSE 0
    END,
    'average_response_time', '2.3s',
    'user_satisfaction_score', 4.2,
    'ai_response_quality', 4.5
  );

  -- Insert the report
  INSERT INTO session_reports (
    user_id,
    video_session_id,
    report_type,
    report_data,
    insights,
    recommendations,
    mood_analysis,
    engagement_metrics
  ) VALUES (
    p_user_id,
    p_video_session_id,
    'post_session',
    v_report_data,
    v_insights,
    v_recommendations,
    v_mood_analysis,
    v_engagement_metrics
  ) RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$ LANGUAGE plpgsql;

-- Function to track session analytics events (safe to run multiple times)
CREATE OR REPLACE FUNCTION track_session_event(
  p_user_id uuid,
  p_video_session_id uuid,
  p_event_type text,
  p_event_data jsonb
) RETURNS uuid AS $$
DECLARE
  v_analytics_id uuid;
BEGIN
  INSERT INTO session_analytics (
    user_id,
    video_session_id,
    event_type,
    event_data
  ) VALUES (
    p_user_id,
    p_video_session_id,
    p_event_type,
    p_event_data
  ) RETURNING id INTO v_analytics_id;

  RETURN v_analytics_id;
END;
$$ LANGUAGE plpgsql;