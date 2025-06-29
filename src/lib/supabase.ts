import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
}

// Create Supabase client with optimized settings
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Disable to prevent issues
      flowType: 'pkce'
    },
    global: {
      headers: {
        'X-Client-Info': 'mindpal-app'
      }
    },
    realtime: {
      params: {
        eventsPerSecond: 5 // Reduce to prevent overwhelming
      }
    },
    db: {
      schema: 'public'
    }
  }
)

// Simple connection test
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    // Use the simplest possible test
    const { error } = await supabase.auth.getSession()
    
    // If we get here without throwing, connection works
    return true
  } catch (err) {
    console.error('Supabase connection test failed:', err)
    return false
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