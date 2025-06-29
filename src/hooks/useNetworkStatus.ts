import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

interface NetworkStatus {
  isOnline: boolean;
  isConnectedToSupabase: boolean;
  lastChecked: Date | null;
  retryCount: number;
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isConnectedToSupabase: true, // Default to true to prevent blocking
    lastChecked: null,
    retryCount: 0,
  });

  const checkSupabaseConnection = useCallback(async (): Promise<boolean> => {
    // Get environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // Validate environment variables
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase environment variables not configured');
      return true; // Return true to prevent blocking the app
    }

    // Validate URL format
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
      console.warn('Invalid Supabase URL format:', supabaseUrl);
      return true; // Return true to prevent blocking the app
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Use the REST API health check endpoint
      const healthCheckUrl = `${supabaseUrl}/rest/v1/`;
      
      const response = await fetch(healthCheckUrl, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Accept both 200 (OK) and 401 (Unauthorized) as valid responses
      // 401 means the server is responding but we need proper auth
      const isConnected = response.ok || response.status === 401;
      
      if (!isConnected) {
        console.warn('Supabase connection check failed with status:', response.status);
      }
      
      return isConnected;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.warn('Supabase connection check timed out');
        } else {
          console.warn('Supabase connection check failed:', error.message);
        }
      }
      return true; // Return true to prevent blocking the app
    }
  }, []);

  const updateNetworkStatus = useCallback(async () => {
    const isOnline = navigator.onLine;
    let isConnectedToSupabase = true; // Default to true

    if (isOnline) {
      try {
        isConnectedToSupabase = await checkSupabaseConnection();
      } catch (error) {
        console.warn('Network status check failed:', error);
        isConnectedToSupabase = true; // Assume connection is OK if check fails
      }
    } else {
      isConnectedToSupabase = false;
    }

    setNetworkStatus(prev => ({
      ...prev,
      isOnline,
      isConnectedToSupabase,
      lastChecked: new Date(),
    }));

    return { isOnline, isConnectedToSupabase };
  }, [checkSupabaseConnection]);

  const retryConnection = useCallback(async () => {
    setNetworkStatus(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
    }));

    const status = await updateNetworkStatus();
    
    if (status.isOnline && status.isConnectedToSupabase) {
      toast.success('Connection restored!');
      setNetworkStatus(prev => ({ ...prev, retryCount: 0 }));
    }

    return status;
  }, [updateNetworkStatus]);

  const withRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Reset retry count on success
        if (attempt > 0) {
          setNetworkStatus(prev => ({ ...prev, retryCount: 0 }));
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff delay
        const backoffDelay = delay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError!;
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: true,
        lastChecked: new Date(),
      }));
      // Re-check Supabase connection when coming back online
      updateNetworkStatus().catch(console.warn);
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        isConnectedToSupabase: false,
        lastChecked: new Date(),
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check - but don't block if it fails
    updateNetworkStatus().catch(console.warn);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateNetworkStatus]);

  return {
    ...networkStatus,
    updateNetworkStatus,
    retryConnection,
    withRetry,
  };
}