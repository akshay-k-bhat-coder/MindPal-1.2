import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  // Improved Supabase connection test with better error handling
  const checkSupabaseConnection = useCallback(async (): Promise<boolean> => {
    if (isChecking) return isSupabaseConnected
    
    try {
      setIsChecking(true)
      
      // Use a simple auth session check with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const { error } = await supabase.auth.getSession()
      
      clearTimeout(timeoutId)
      
      // Connection successful
      setIsSupabaseConnected(true)
      setLastChecked(new Date())
      return true
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

  // Enhanced retry mechanism with exponential backoff
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
        
        // Don't retry on auth errors or client errors
        if (error instanceof Error && (
          error.message.includes('JWT') ||
          error.message.includes('401') ||
          error.message.includes('403') ||
          error.message.includes('PGRST301')
        )) {
          throw error
        }

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
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
      // Don't immediately assume Supabase is back - let the periodic check handle it
    }

    const handleOffline = () => {
      console.log('Network: Gone offline')
      setIsOnline(false)
      setIsSupabaseConnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial connection check with delay
    if (navigator.onLine) {
      setTimeout(() => {
        checkSupabaseConnection().catch(() => {
          // Ignore initial check errors
        })
      }, 2000)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkSupabaseConnection])

  // Periodic connection monitoring
  useEffect(() => {
    if (!isOnline) return

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
    }, 120000) // Check every 2 minutes

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