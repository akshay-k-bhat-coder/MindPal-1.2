import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Check Supabase connectivity
  const checkSupabaseConnection = async () => {
    try {
      const { error } = await supabase.from('profiles').select('count').limit(1)
      const connected = !error
      setIsSupabaseConnected(connected)
      setLastChecked(new Date())
      return connected
    } catch (err) {
      console.error('Supabase connection check failed:', err)
      setIsSupabaseConnected(false)
      setLastChecked(new Date())
      return false
    }
  }

  // Retry mechanism for async operations
  const withRetry = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        console.warn(`Attempt ${attempt} failed:`, error)

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
      }
    }

    throw lastError!
  }

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Check Supabase connection when coming back online
      checkSupabaseConnection()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setIsSupabaseConnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check
    if (navigator.onLine) {
      checkSupabaseConnection()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Periodic connectivity check
  useEffect(() => {
    if (!isOnline) return

    const interval = setInterval(() => {
      checkSupabaseConnection()
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [isOnline])

  return {
    isOnline,
    isSupabaseConnected,
    lastChecked,
    checkConnection: checkSupabaseConnection,
    withRetry
  }
}