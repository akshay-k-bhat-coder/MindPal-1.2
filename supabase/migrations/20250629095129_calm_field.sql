/*
  # Remove notification system

  1. Drop notification-related tables
  2. Remove notification-related functions and triggers
  3. Clean up any references
*/

-- Drop notification tables
DROP TABLE IF EXISTS task_notifications CASCADE;
DROP TABLE IF EXISTS task_notification_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- Drop notification-related functions
DROP FUNCTION IF EXISTS create_task_notification_settings() CASCADE;

-- Remove notification-related triggers
DROP TRIGGER IF EXISTS create_task_notification_settings_trigger ON profiles;

-- Clean up any remaining notification-related indexes
DROP INDEX IF EXISTS idx_task_notifications_task_id;
DROP INDEX IF EXISTS idx_task_notifications_user_id;
DROP INDEX IF EXISTS idx_task_notifications_scheduled_for;
DROP INDEX IF EXISTS idx_task_notifications_pending;
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_scheduled;