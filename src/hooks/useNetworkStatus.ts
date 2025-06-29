import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true) // Start optimistic
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  // Check Supabase connectivity with timeout and proper error handling
  const checkSupabaseConnection = useCallback(async (): Promise<boolean> => {
    if (isChecking) return isSupabaseConnected // Prevent concurrent checks
    
    try {
      setIsChecking(true)
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      })
      
      // Try a simple query with timeout
      const queryPromise = supabase
        .from('profiles')
        .select('count')
        .limit(1)
        .single()
      
      const { error } = await Promise.race([queryPromise, timeoutPromise])
      
      const connected = !error || error.code === 'PGRST116' // PGRST116 is "no rows returned" which means connection works
      setIsSupabaseConnected(connected)
      setLastChecked(new Date())
      
      return connected
    } catch (err) {
      console.warn('Supabase connection check failed:', err)
      setIsSupabaseConnected(false)
      setLastChecked(new Date())
      return false
    } finally {
      setIsChecking(false)
    }
  }, [isChecking, isSupabaseConnected])

  // Retry mechanism for async operations with exponential backoff
  const withRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error)

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError
        }

        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }, [])

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Back online')
      setIsOnline(true)
      // Check Supabase connection when coming back online
      setTimeout(() => {
        checkSupabaseConnection()
      }, 1000) // Small delay to let network stabilize
    }

    const handleOffline = () => {
      console.log('Network: Gone offline')
      setIsOnline(false)
      setIsSupabaseConnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check only if online
    if (navigator.onLine) {
      // Delay initial check to avoid blocking app startup
      setTimeout(() => {
        checkSupabaseConnection()
      }, 2000)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkSupabaseConnection])

  // Periodic connectivity check (less frequent to avoid spam)
  useEffect(() => {
    if (!isOnline) return

    const interval = setInterval(() => {
      // Only check if we think we're disconnected or haven't checked recently
      const shouldCheck = !isSupabaseConnected || 
        !lastChecked || 
        (Date.now() - lastChecked.getTime()) > 60000 // 1 minute

      if (shouldCheck) {
        checkSupabaseConnection()
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [isOnline, isSupabaseConnected, lastChecked, checkSupabaseConnection])

  return {
    isOnline,
    isSupabaseConnected,
    lastChecked,
    isChecking,
    checkConnection: checkSupabaseConnection,
    withRetry
  }
}