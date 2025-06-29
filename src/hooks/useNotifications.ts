import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: 'task_reminder' | 'mood_reminder' | 'daily_summary' | 'session_report' | 'system_alert' | 'achievement';
  title: string;
  message: string;
  scheduled_for: string;
  sent: boolean;
  created_at: string;
  data?: any; // Additional notification data
}

interface TaskNotification {
  id: string;
  task_id: string;
  user_id: string;
  notification_type: 'reminder' | 'overdue' | 'completion_reminder';
  scheduled_for: string;
  sent: boolean;
  email_sent: boolean;
  created_at: string;
}

interface NotificationSettings {
  enabled: boolean;
  reminder_minutes: number;
  overdue_enabled: boolean;
  completion_reminders: boolean;
  email_notifications: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export function useNotifications() {
  const { user, handleSupabaseError } = useAuth();
  const { isConnectedToSupabase, withRetry } = useNetworkStatus();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [taskNotifications, setTaskNotifications] = useState<TaskNotification[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled: true,
    reminder_minutes: 30,
    overdue_enabled: true,
    completion_reminders: true,
    email_notifications: false,
    quiet_hours_enabled: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
  });
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        toast.success('Notifications enabled! 🔔');
        
        // Show a welcome notification
        showBrowserNotification(
          'MindPal Notifications Enabled',
          'You\'ll now receive reminders and updates to help with your mental health journey.',
          'system'
        );
        
        return true;
      } else {
        toast.error('Notifications permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  };

  const showBrowserNotification = useCallback((
    title: string,
    body: string,
    type: string = 'default',
    data?: any
  ) => {
    if (permission !== 'granted') return;

    // Check quiet hours
    if (notificationSettings.quiet_hours_enabled && isQuietHours()) {
      console.log('Notification suppressed due to quiet hours');
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: `mindpal-${type}`,
        requireInteraction: type === 'task_reminder' || type === 'mood_reminder',
        data: data,
        actions: type === 'task_reminder' ? [
          { action: 'complete', title: 'Mark Complete' },
          { action: 'snooze', title: 'Snooze 10min' }
        ] : undefined
      });

      notification.onclick = () => {
        window.focus();
        
        // Handle different notification types
        switch (type) {
          case 'task_reminder':
            window.location.hash = '/tasks';
            break;
          case 'mood_reminder':
            window.location.hash = '/mood';
            break;
          case 'session_report':
            window.location.hash = '/video';
            break;
          default:
            window.location.hash = '/dashboard';
        }
        
        notification.close();
      };

      // Auto close after 10 seconds for non-critical notifications
      if (type !== 'task_reminder' && type !== 'mood_reminder') {
        setTimeout(() => notification.close(), 10000);
      }
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  }, [permission, notificationSettings]);

  const isQuietHours = useCallback((): boolean => {
    if (!notificationSettings.quiet_hours_enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = notificationSettings.quiet_hours_start.split(':').map(Number);
    const [endHour, endMin] = notificationSettings.quiet_hours_end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }, [notificationSettings]);

  const scheduleNotification = async (
    type: Notification['type'],
    title: string,
    message: string,
    scheduledFor: Date,
    data?: any
  ) => {
    if (!user) {
      toast.error('Please sign in to schedule notifications');
      return;
    }

    if (!isConnectedToSupabase) {
      toast.error('Cannot schedule notification - no connection to server');
      return;
    }

    try {
      // Ensure we have notification permission
      if (permission !== 'granted') {
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) return;
      }

      const notificationData = await withRetry(async () => {
        const { data, error } = await supabase
          .from('notifications')
          .insert([{
            user_id: user.id,
            type,
            title,
            message,
            scheduled_for: scheduledFor.toISOString(),
            data: data || null,
          }])
          .select()
          .single();

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      });

      if (notificationData) {
        setNotifications(prev => [...prev, notificationData]);
        
        // Schedule browser notification
        const timeUntilNotification = scheduledFor.getTime() - Date.now();
        
        if (timeUntilNotification > 0 && timeUntilNotification < 24 * 60 * 60 * 1000) { // Within 24 hours
          setTimeout(() => {
            showBrowserNotification(title, message, type, data);
          }, timeUntilNotification);
        }

        toast.success(`${title} scheduled successfully! 🔔`);
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
      toast.error('Failed to schedule notification');
    }
  };

  const scheduleTaskReminder = async (taskId: string, taskTitle: string, dueDate: Date) => {
    if (!user || !isConnectedToSupabase) {
      toast.error('Cannot schedule task reminder - no connection to server');
      return;
    }

    const reminderTime = new Date(dueDate.getTime() - notificationSettings.reminder_minutes * 60 * 1000);
    
    if (reminderTime <= new Date()) {
      toast.error('Cannot schedule reminder for past dates');
      return;
    }

    try {
      // Schedule in task_notifications table
      const { data, error } = await supabase
        .from('task_notifications')
        .insert([{
          task_id: taskId,
          user_id: user.id,
          notification_type: 'reminder',
          scheduled_for: reminderTime.toISOString(),
        }])
        .select()
        .single();

      if (error) {
        const isJWTError = await handleSupabaseError(error);
        if (!isJWTError) throw error;
        return;
      }

      setTaskNotifications(prev => [...prev, data]);

      // Also schedule in general notifications
      await scheduleNotification(
        'task_reminder',
        'Task Reminder',
        `Don't forget: ${taskTitle}`,
        reminderTime,
        { task_id: taskId, task_title: taskTitle }
      );
    } catch (error) {
      console.error('Error scheduling task reminder:', error);
      toast.error('Failed to schedule task reminder');
    }
  };

  const scheduleMoodReminder = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
    
    await scheduleNotification(
      'mood_reminder',
      'Mood Check-in',
      'How are you feeling today? Take a moment to log your mood and reflect on your emotional state.',
      tomorrow
    );
  };

  const scheduleDailySummary = async () => {
    const today = new Date();
    today.setHours(20, 0, 0, 0); // 8 PM today
    
    // If it's already past 8 PM, schedule for tomorrow
    if (today <= new Date()) {
      today.setDate(today.getDate() + 1);
    }
    
    await scheduleNotification(
      'daily_summary',
      'Daily Summary',
      'Review your day and see how you did with your tasks, mood, and overall wellness.',
      today
    );
  };

  const scheduleSessionReportNotification = async (sessionId: string, reportData: any) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // 5 minutes from now
    
    await scheduleNotification(
      'session_report',
      'Video Session Report Ready',
      `Your AI-generated session report is ready! Quality: ${reportData.insights?.session_quality || 'Good'}, Duration: ${reportData.report_data?.duration_formatted || 'N/A'}`,
      now,
      { session_id: sessionId, report_data: reportData }
    );
  };

  const scheduleAchievementNotification = async (achievement: string, description: string) => {
    const now = new Date();
    
    await scheduleNotification(
      'achievement',
      `Achievement Unlocked: ${achievement}`,
      description,
      now
    );
  };

  const markTaskComplete = async (taskId: string) => {
    if (!user || !isConnectedToSupabase) return;

    try {
      // Cancel pending task notifications
      await supabase
        .from('task_notifications')
        .update({ sent: true })
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .eq('sent', false);

      // Show completion notification if enabled
      if (notificationSettings.completion_reminders) {
        showBrowserNotification(
          'Task Completed! 🎉',
          'Great job! You\'ve completed another task on your wellness journey.',
          'achievement'
        );
      }
    } catch (error) {
      console.error('Error updating task notifications:', error);
    }
  };

  const scheduleOverdueReminder = async (taskId: string, taskTitle: string) => {
    if (!notificationSettings.overdue_enabled) return;

    const now = new Date();
    now.setMinutes(now.getMinutes() + 60); // 1 hour from now
    
    await scheduleNotification(
      'task_reminder',
      'Overdue Task',
      `Task "${taskTitle}" is overdue. Consider completing it or rescheduling to stay on track.`,
      now,
      { task_id: taskId, task_title: taskTitle, is_overdue: true }
    );
  };

  const loadNotifications = useCallback(async () => {
    if (!user || !isConnectedToSupabase) return;

    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('scheduled_for', { ascending: false })
          .limit(50);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      });

      setNotifications(data || []);
      
      // Count unread notifications (not sent and scheduled for past)
      const unread = (data || []).filter(n => 
        !n.sent && new Date(n.scheduled_for) <= new Date()
      ).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

  const loadTaskNotifications = useCallback(async () => {
    if (!user || !isConnectedToSupabase) return;

    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('task_notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('scheduled_for', { ascending: false })
          .limit(50);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      });

      setTaskNotifications(data || []);
    } catch (error) {
      console.error('Error loading task notifications:', error);
    }
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

  const loadNotificationSettings = useCallback(async () => {
    if (!user || !isConnectedToSupabase) return;

    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('task_notification_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      });

      if (data) {
        setNotificationSettings({
          enabled: data.enabled,
          reminder_minutes: data.reminder_minutes,
          overdue_enabled: data.overdue_enabled,
          completion_reminders: data.completion_reminders,
          email_notifications: data.email_notifications,
          quiet_hours_enabled: data.quiet_hours_enabled,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
        });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

  const updateNotificationSettings = async (newSettings: Partial<NotificationSettings>) => {
    if (!user || !isConnectedToSupabase) {
      toast.error('Cannot update settings - no connection to server');
      return;
    }

    try {
      const updatedSettings = { ...notificationSettings, ...newSettings };
      
      await withRetry(async () => {
        const { error } = await supabase
          .from('task_notification_settings')
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
        }
      });

      setNotificationSettings(updatedSettings);
      toast.success('Notification settings updated!');
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error('Failed to update notification settings');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!isConnectedToSupabase) {
      toast.error('Cannot delete notification - no connection to server');
      return;
    }

    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return;
        }
      });

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    if (!isConnectedToSupabase) return;

    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('notifications')
          .update({ sent: true })
          .eq('id', notificationId);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
        }
      });

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, sent: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const clearAllNotifications = async () => {
    if (!user || !isConnectedToSupabase) return;

    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('notifications')
          .update({ sent: true })
          .eq('user_id', user.id)
          .eq('sent', false);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
        }
      });

      setNotifications(prev => prev.map(n => ({ ...n, sent: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    }
  };

  // Load data on mount
  useEffect(() => {
    if (user && isConnectedToSupabase) {
      loadNotifications();
      loadTaskNotifications();
      loadNotificationSettings();
    }
  }, [user, isConnectedToSupabase, loadNotifications, loadTaskNotifications, loadNotificationSettings]);

  // Check for due notifications every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      notifications.forEach(notification => {
        if (!notification.sent && new Date(notification.scheduled_for) <= now) {
          showBrowserNotification(
            notification.title,
            notification.message,
            notification.type,
            notification.data
          );
          markNotificationAsRead(notification.id);
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [notifications, showBrowserNotification, markNotificationAsRead]);

  return {
    // State
    notifications,
    taskNotifications,
    notificationSettings,
    permission,
    unreadCount,

    // Actions
    requestNotificationPermission,
    scheduleNotification,
    scheduleTaskReminder,
    scheduleMoodReminder,
    scheduleDailySummary,
    scheduleSessionReportNotification,
    scheduleAchievementNotification,
    scheduleOverdueReminder,
    markTaskComplete,
    updateNotificationSettings,
    deleteNotification,
    markNotificationAsRead,
    clearAllNotifications,

    // Utilities
    showBrowserNotification,
    isQuietHours,
  };
}