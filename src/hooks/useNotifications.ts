import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: 'task_reminder' | 'mood_reminder' | 'daily_summary';
  title: string;
  message: string;
  scheduled_for: string;
  sent: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user, handleSupabaseError } = useAuth();
  const { isConnectedToSupabase, withRetry } = useNetworkStatus();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

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
        toast.success('Notifications enabled!');
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

  const scheduleNotification = async (
    type: 'task_reminder' | 'mood_reminder' | 'daily_summary',
    title: string,
    message: string,
    scheduledFor: Date
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

      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('notifications')
          .insert([{
            user_id: user.id,
            type,
            title,
            message,
            scheduled_for: scheduledFor.toISOString(),
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

      if (data) {
        setNotifications(prev => [...prev, data]);
        
        // Schedule browser notification
        const timeUntilNotification = scheduledFor.getTime() - Date.now();
        
        if (timeUntilNotification > 0) {
          setTimeout(() => {
            if (permission === 'granted') {
              const notification = new Notification(title, {
                body: message,
                icon: '/vite.svg',
                badge: '/vite.svg',
                tag: `mindpal-${type}`,
                requireInteraction: true,
              });

              notification.onclick = () => {
                window.focus();
                notification.close();
              };

              // Auto close after 10 seconds
              setTimeout(() => notification.close(), 10000);
            }
          }, timeUntilNotification);
        }

        toast.success(`${title} scheduled successfully!`);
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
      toast.error('Failed to schedule notification');
    }
  };

  const scheduleTaskReminder = async (taskTitle: string, dueDate: Date) => {
    const reminderTime = new Date(dueDate.getTime() - 30 * 60 * 1000); // 30 minutes before
    
    if (reminderTime <= new Date()) {
      toast.error('Cannot schedule reminder for past dates');
      return;
    }

    await scheduleNotification(
      'task_reminder',
      'Task Reminder',
      `Don't forget: ${taskTitle}`,
      reminderTime
    );
  };

  const scheduleMoodReminder = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
    
    await scheduleNotification(
      'mood_reminder',
      'Mood Check-in',
      'How are you feeling today? Take a moment to log your mood.',
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
      'Review your day and see how you did with your tasks and mood.',
      today
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
          .order('scheduled_for', { ascending: false });

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      });

      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

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

  useEffect(() => {
    if (user && isConnectedToSupabase) {
      loadNotifications();
    }
  }, [user, loadNotifications, isConnectedToSupabase]);

  return {
    notifications,
    permission,
    scheduleNotification,
    scheduleTaskReminder,
    scheduleMoodReminder,
    scheduleDailySummary,
    requestNotificationPermission,
    deleteNotification,
  };
}