import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  // Improved Supabase connection test with better error handling
  const checkSupabaseConnection = useCallback(async (): Promise<boolean> => {
    if (isChecking || !isSupabaseConfigured()) {
      return isSupabaseConnected
    }
    
    try {
      setIsChecking(true)
      
      // Use a simple auth session check with shorter timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // Reduced to 3 seconds
      
      const { error } = await supabase.auth.getSession()
      
      clearTimeout(timeoutId)
      
      // Connection successful if no network errors
      const isConnected = !error || !error.message?.includes('fetch')
      setIsSupabaseConnected(isConnected)
      setLastChecked(new Date())
      return isConnected
    } catch (err: any) {
      console.warn('Supabase connection check failed:', err)
      
      // Only mark as disconnected for actual network/connection errors
      if (err.name === 'AbortError' || 
          err.message?.includes('fetch') || 
          err.message?.includes('network') ||
          err.code === 'ENOTFOUND') {
        setIsSupabaseConnected(false)
        setLastChecked(new Date())
        return false
      }
      
      // For auth errors or other issues, assume connection is OK
      setIsSupabaseConnected(true)
      setLastChecked(new Date())
      return true
    } finally {
      setIsChecking(false)
    }
  }, [isChecking, isSupabaseConnected])

  // Enhanced retry mechanism with exponential backoff and circuit breaker
  const withRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 2, // Reduced default retries
    baseDelay: number = 1000
  ): Promise<T> => {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on auth errors, client errors, or abort errors
        if (error instanceof Error && (
          error.message.includes('JWT') ||
          error.message.includes('401') ||
          error.message.includes('403') ||
          error.message.includes('PGRST301') ||
          error.name === 'AbortError' ||
          error.message.includes('signal is aborted')
        )) {
          throw error
        }

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500
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
      // Check Supabase connection after a delay
      setTimeout(() => {
        if (isSupabaseConfigured()) {
          checkSupabaseConnection().catch(() => {
            // Ignore errors
          })
        }
      }, 2000)
    }

    const handleOffline = () => {
      console.log('Network: Gone offline')
      setIsOnline(false)
      setIsSupabaseConnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial connection check with delay
    if (navigator.onLine && isSupabaseConfigured()) {
      setTimeout(() => {
        checkSupabaseConnection().catch(() => {
          // Ignore initial check errors
        })
      }, 1000)
    } else {
      setIsSupabaseConnected(false)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkSupabaseConnection])

  // Periodic connection monitoring with circuit breaker
  useEffect(() => {
    if (!isOnline || !isSupabaseConfigured()) return

    const interval = setInterval(() => {
      // Only check if we think we're disconnected or haven't checked recently
      const shouldCheck = !isSupabaseConnected || 
        !lastChecked || 
        (Date.now() - lastChecked.getTime()) > 300000 // 5 minutes

      if (shouldCheck && !isChecking) {
        checkSupabaseConnection().catch(() => {
          // Ignore periodic check errors
        })
      }
    }, 180000) // Check every 3 minutes (reduced frequency)

    return () => clearInterval(interval)
  }, [isOnline, isSupabaseConnected, lastChecked, isChecking, checkSupabaseConnection])

  return {
    isOnline,
    isSupabaseConnected,
    isConnectedToSupabase: isSupabaseConnected, // Alias for backward compatibility
    lastChecked,
    isChecking,
    checkConnection: checkSupabaseConnection,
    withRetry
  }
}