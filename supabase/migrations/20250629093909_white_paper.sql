-- Task notification settings table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_notification_settings') THEN
    CREATE TABLE task_notification_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
      enabled boolean DEFAULT true,
      reminder_minutes integer DEFAULT 30,
      overdue_enabled boolean DEFAULT true,
      completion_reminders boolean DEFAULT true,
      email_notifications boolean DEFAULT false,
      quiet_hours_enabled boolean DEFAULT true,
      quiet_hours_start text DEFAULT '22:00',
      quiet_hours_end text DEFAULT '08:00',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    ALTER TABLE task_notification_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Task notifications table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_notifications') THEN
    CREATE TABLE task_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      notification_type text NOT NULL CHECK (notification_type IN ('reminder', 'overdue', 'completion_reminder')),
      scheduled_for timestamptz NOT NULL,
      sent boolean DEFAULT false,
      email_sent boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add policies only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_notification_settings' AND policyname = 'Users can manage own notification settings') THEN
    CREATE POLICY "Users can manage own notification settings"
      ON task_notification_settings
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_notifications' AND policyname = 'Users can manage own task notifications') THEN
    CREATE POLICY "Users can manage own task notifications"
      ON task_notifications
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add indexes for better performance (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_task_notifications_task_id ON task_notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_id ON task_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_scheduled_for ON task_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_task_notifications_pending ON task_notifications(scheduled_for) WHERE NOT sent;

-- Function to create task notification settings (safe to run multiple times)
CREATE OR REPLACE FUNCTION create_task_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger for task notification settings (safe to run multiple times)
DROP TRIGGER IF EXISTS update_task_notification_settings_updated_at ON task_notification_settings;
CREATE TRIGGER update_task_notification_settings_updated_at
  BEFORE UPDATE ON task_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to create task notification settings when profile is created (safe to run multiple times)
DROP TRIGGER IF EXISTS create_task_notification_settings_trigger ON profiles;
CREATE TRIGGER create_task_notification_settings_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_task_notification_settings();