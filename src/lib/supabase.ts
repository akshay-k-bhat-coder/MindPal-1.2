import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
}

// Create Supabase client with optimized settings for stability
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      // Add retry configuration
      retryAttempts: 3,
    },
    global: {
      headers: {
        'X-Client-Info': 'mindpal-app@1.0.0'
      },
      // Add fetch configuration for better error handling
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          // Increase timeout to prevent hanging requests - changed from 30s to 60s
          signal: AbortSignal.timeout(60000), // 60 second timeout
        });
      }
    },
    realtime: {
      params: {
        eventsPerSecond: 3 // Reduce to prevent overwhelming
      },
      // Add heartbeat for connection stability
      heartbeatIntervalMs: 30000,
      reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000)
    },
    db: {
      schema: 'public'
    }
  }
)

// Enhanced connection test with better error handling
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    // Use a simple, lightweight test
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const { error } = await supabase.auth.getSession()
    
    clearTimeout(timeoutId)
    
    if (error && error.message.includes('fetch')) {
      return false
    }
    
    return true
  } catch (err: any) {
    console.error('Supabase connection test failed:', err)
    
    // Check for specific connection errors
    if (err.name === 'AbortError' || 
        err.message?.includes('fetch') || 
        err.message?.includes('network') ||
        err.code === 'ENOTFOUND') {
      return false
    }
    
    // For other errors (like auth errors), assume connection is OK
    return true
  }
}

// Check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && 
           supabaseAnonKey && 
           supabaseUrl !== 'https://placeholder.supabase.co' && 
           supabaseAnonKey !== 'placeholder-key' &&
           supabaseUrl.includes('supabase.co'))
}

// Add connection health monitoring
let connectionHealthy = true
let lastHealthCheck = Date.now()

export const getConnectionHealth = () => ({
  healthy: connectionHealthy,
  lastCheck: lastHealthCheck
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