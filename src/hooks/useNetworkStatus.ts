import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true) // Start optimistic
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  // Simple and reliable Supabase connection test
  const checkSupabaseConnection = useCallback(async (): Promise<boolean> => {
    if (isChecking) return isSupabaseConnected
    
    try {
      setIsChecking(true)
      
      // Use the simplest possible query with a short timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      // Just check if we can reach Supabase at all
      const { error } = await supabase.auth.getSession()
      
      clearTimeout(timeoutId)
      
      // If we get here without throwing, connection is working
      setIsSupabaseConnected(true)
      setLastChecked(new Date())
      return true
    } catch (err: any) {
      console.warn('Supabase connection check failed:', err)
      
      // Only mark as disconnected for actual network errors
      if (err.name === 'AbortError' || err.message?.includes('fetch')) {
        setIsSupabaseConnected(false)
        setLastChecked(new Date())
        return false
      }
      
      // For other errors (like auth errors), assume connection is OK
      setIsSupabaseConnected(true)
      setLastChecked(new Date())
      return true
    } finally {
      setIsChecking(false)
    }
  }, [isChecking, isSupabaseConnected])

  // Simplified retry mechanism
  const withRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    baseDelay: number = 500
  ): Promise<T> => {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on auth errors or client errors
        if (error instanceof Error && (
          error.message.includes('JWT') ||
          error.message.includes('401') ||
          error.message.includes('403')
        )) {
          throw error
        }

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError
        }

        // Wait before retrying
        const delay = baseDelay * Math.pow(1.5, attempt - 1)
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
      setIsSupabaseConnected(true) // Assume Supabase is also back
    }

    const handleOffline = () => {
      console.log('Network: Gone offline')
      setIsOnline(false)
      setIsSupabaseConnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check - but don't block if it fails
    if (navigator.onLine) {
      setTimeout(() => {
        checkSupabaseConnection().catch(() => {
          // Ignore errors on initial check
        })
      }, 1000)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkSupabaseConnection])

  // Less aggressive periodic checking
  useEffect(() => {
    if (!isOnline) return

    const interval = setInterval(() => {
      // Only check if we think we're disconnected or haven't checked recently
      const shouldCheck = !isSupabaseConnected || 
        !lastChecked || 
        (Date.now() - lastChecked.getTime()) > 120000 // 2 minutes

      if (shouldCheck && !isChecking) {
        checkSupabaseConnection().catch(() => {
          // Ignore errors in periodic checks
        })
      }
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [isOnline, isSupabaseConnected, lastChecked, isChecking, checkSupabaseConnection])

  return {
    isOnline,
    isSupabaseConnected,
    lastChecked,
    isChecking,
    checkConnection: checkSupabaseConnection,
    withRetry
  }
}