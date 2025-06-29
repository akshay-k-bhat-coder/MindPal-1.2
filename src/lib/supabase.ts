import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
}

// Check if we have valid Supabase configuration
const hasValidConfig = !!(supabaseUrl && 
                         supabaseAnonKey && 
                         supabaseUrl !== 'https://placeholder.supabase.co' && 
                         supabaseAnonKey !== 'placeholder-key' &&
                         supabaseUrl.includes('supabase.co'))

// Create Supabase client with enhanced error handling
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: hasValidConfig,
      persistSession: hasValidConfig,
      detectSessionInUrl: false,
      flowType: 'pkce',
      retryAttempts: hasValidConfig ? 3 : 0,
    },
    global: {
      headers: {
        'X-Client-Info': 'mindpal-app@1.0.0'
      },
      // Enhanced fetch with better error handling
      fetch: (url, options = {}) => {
        // If we don't have valid config, reject immediately
        if (!hasValidConfig) {
          return Promise.reject(new Error('Supabase not configured'))
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId)
        }).catch(error => {
          // Enhanced error handling for common network issues
          if (error.name === 'AbortError') {
            throw new Error('Request timeout - please check your internet connection')
          }
          if (error.message?.includes('fetch')) {
            throw new Error('Network error - unable to connect to Supabase')
          }
          throw error
        })
      }
    },
    realtime: {
      params: {
        eventsPerSecond: hasValidConfig ? 3 : 0
      },
      heartbeatIntervalMs: hasValidConfig ? 30000 : 0,
      reconnectAfterMs: hasValidConfig ? (tries: number) => Math.min(tries * 1000, 10000) : () => 0
    },
    db: {
      schema: 'public'
    }
  }
)

// Enhanced connection test with better error handling
export const testSupabaseConnection = async (): Promise<boolean> => {
  // Return false immediately if config is invalid
  if (!hasValidConfig) {
    console.warn('Supabase configuration is invalid or missing')
    return false
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    // Simple health check that doesn't require authentication
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    return response.ok || response.status === 401 // 401 is OK, means API is reachable
  } catch (err: any) {
    console.error('Supabase connection test failed:', err)
    
    // Check for specific connection errors
    if (err.name === 'AbortError' || 
        err.message?.includes('fetch') || 
        err.message?.includes('network') ||
        err.message?.includes('ENOTFOUND') ||
        err.message?.includes('timeout')) {
      return false
    }
    
    return false
  }
}

// Check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return hasValidConfig
}

// Add connection health monitoring
let connectionHealthy = hasValidConfig
let lastHealthCheck = Date.now()

export const getConnectionHealth = () => ({
  healthy: connectionHealthy,
  lastCheck: lastHealthCheck,
  configured: hasValidConfig
})

// Only run health checks if properly configured
if (hasValidConfig) {
  // Initial health check
  testSupabaseConnection().then(result => {
    connectionHealthy = result
    lastHealthCheck = Date.now()
  })

  // Periodic health check (runs every 5 minutes)
  setInterval(async () => {
    try {
      const isHealthy = await testSupabaseConnection()
      connectionHealthy = isHealthy
      lastHealthCheck = Date.now()
    } catch (error) {
      connectionHealthy = false
      lastHealthCheck = Date.now()
    }
  }, 300000) // 5 minutes
}