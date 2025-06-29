import { useState, useEffect } from 'react'
import { supabase, testSupabaseConnection } from '../lib/supabase'
import { useAuth } from './useAuth'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  scheduled_for: string
  sent: boolean
  created_at: string
}

interface TaskNotification {
  id: string
  task_id: string
  notification_type: string
  scheduled_for: string
  sent: boolean
  email_sent: boolean
  created_at: string
}

interface NotificationSettings {
  id: string
  user_id: string
  enabled: boolean
  reminder_minutes: number
  overdue_enabled: boolean
  completion_reminders: boolean
  email_notifications: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
}

export const useNotifications = () => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [taskNotifications, setTaskNotifications] = useState<TaskNotification[]>([])
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('testing')

  // Test connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      setConnectionStatus('testing')
      const isConnected = await testSupabaseConnection()
      setConnectionStatus(isConnected ? 'connected' : 'disconnected')
      
      if (!isConnected) {
        setError('Unable to connect to the database. Please check your internet connection.')
        setLoading(false)
      }
    }
    
    checkConnection()
  }, [])

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user || connectionStatus !== 'connected') return

    try {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching notifications:', fetchError)
        setError('Failed to load notifications')
        return
      }

      setNotifications(data || [])
    } catch (err) {
      console.error('Network error fetching notifications:', err)
      setError('Network error. Please check your connection.')
    }
  }

  // Fetch task notifications
  const fetchTaskNotifications = async () => {
    if (!user || connectionStatus !== 'connected') return

    try {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('task_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching task notifications:', fetchError)
        setError('Failed to load task notifications')
        return
      }

      setTaskNotifications(data || [])
    } catch (err) {
      console.error('Network error fetching task notifications:', err)
      setError('Network error. Please check your connection.')
    }
  }

  // Fetch notification settings
  const fetchSettings = async () => {
    if (!user || connectionStatus !== 'connected') return

    try {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('task_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching notification settings:', fetchError)
        setError('Failed to load notification settings')
        return
      }

      setSettings(data || null)
    } catch (err) {
      console.error('Network error fetching settings:', err)
      setError('Network error. Please check your connection.')
    }
  }

  // Update notification settings
  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    if (!user || connectionStatus !== 'connected') {
      setError('Cannot update settings: not connected to database')
      return false
    }

    try {
      setError(null)
      const { data, error: updateError } = await supabase
        .from('task_notification_settings')
        .upsert({
          user_id: user.id,
          ...newSettings,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (updateError) {
        console.error('Error updating notification settings:', updateError)
        setError('Failed to update notification settings')
        return false
      }

      setSettings(data)
      return true
    } catch (err) {
      console.error('Network error updating settings:', err)
      setError('Network error. Please check your connection.')
      return false
    }
  }

  // Mark notification as sent
  const markAsSent = async (notificationId: string, isTaskNotification = false) => {
    if (connectionStatus !== 'connected') {
      setError('Cannot mark notification as sent: not connected to database')
      return false
    }

    try {
      setError(null)
      const table = isTaskNotification ? 'task_notifications' : 'notifications'
      const { error: updateError } = await supabase
        .from(table)
        .update({ sent: true })
        .eq('id', notificationId)

      if (updateError) {
        console.error('Error marking notification as sent:', updateError)
        setError('Failed to update notification status')
        return false
      }

      // Update local state
      if (isTaskNotification) {
        setTaskNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, sent: true } : n)
        )
      } else {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, sent: true } : n)
        )
      }

      return true
    } catch (err) {
      console.error('Network error marking notification as sent:', err)
      setError('Network error. Please check your connection.')
      return false
    }
  }

  // Get pending notifications
  const getPendingNotifications = () => {
    const now = new Date()
    const pending = [
      ...notifications.filter(n => !n.sent && new Date(n.scheduled_for) <= now),
      ...taskNotifications.filter(n => !n.sent && new Date(n.scheduled_for) <= now)
    ]
    return pending.sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
  }

  // Load data when user changes or connection is established
  useEffect(() => {
    if (user && connectionStatus === 'connected') {
      setLoading(true)
      Promise.all([
        fetchNotifications(),
        fetchTaskNotifications(),
        fetchSettings()
      ]).finally(() => {
        setLoading(false)
      })
    } else if (!user) {
      setNotifications([])
      setTaskNotifications([])
      setSettings(null)
      setLoading(false)
    }
  }, [user, connectionStatus])

  // Set up real-time subscriptions when connected
  useEffect(() => {
    if (!user || connectionStatus !== 'connected') return

    const notificationsSubscription = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchNotifications()
      )
      .subscribe()

    const taskNotificationsSubscription = supabase
      .channel('task_notifications')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_notifications', filter: `user_id=eq.${user.id}` },
        () => fetchTaskNotifications()
      )
      .subscribe()

    return () => {
      notificationsSubscription.unsubscribe()
      taskNotificationsSubscription.unsubscribe()
    }
  }, [user, connectionStatus])

  return {
    notifications,
    taskNotifications,
    settings,
    loading,
    error,
    connectionStatus,
    updateSettings,
    markAsSent,
    getPendingNotifications,
    refetch: () => {
      if (user && connectionStatus === 'connected') {
        fetchNotifications()
        fetchTaskNotifications()
        fetchSettings()
      }
    }
  }
}