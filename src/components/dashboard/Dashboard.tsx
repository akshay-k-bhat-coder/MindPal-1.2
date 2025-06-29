import React, { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { supabase } from '../../lib/supabase'
import { 
  Brain, 
  Calendar, 
  Heart, 
  MessageSquare, 
  Video, 
  TrendingUp,
  AlertCircle,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react'

interface DashboardStats {
  totalSessions: number
  completedTasks: number
  moodEntries: number
  avgMood: number
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const { isOnline, isSupabaseConnected, checkConnection } = useNetworkStatus()
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    completedTasks: 0,
    moodEntries: 0,
    avgMood: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardStats = async () => {
    if (!user || !isSupabaseConnected) {
      setLoading(false)
      return
    }

    try {
      setError(null)
      setLoading(true)

      // Fetch video sessions count
      const { count: sessionsCount, error: sessionsError } = await supabase
        .from('video_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError)
      }

      // Fetch completed tasks count
      const { count: tasksCount, error: tasksError } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true)

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError)
      }

      // Fetch mood entries
      const { data: moodData, error: moodError } = await supabase
        .from('mood_entries')
        .select('mood')
        .eq('user_id', user.id)

      if (moodError) {
        console.error('Error fetching mood entries:', moodError)
      }

      const moodEntries = moodData?.length || 0
      const avgMood = moodData?.length 
        ? moodData.reduce((sum, entry) => sum + entry.mood, 0) / moodData.length 
        : 0

      setStats({
        totalSessions: sessionsCount || 0,
        completedTasks: tasksCount || 0,
        moodEntries,
        avgMood: Math.round(avgMood * 10) / 10
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Failed to load dashboard data. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardStats()
  }, [user, isSupabaseConnected])

  const handleRetry = async () => {
    setLoading(true)
    await checkConnection()
    await fetchDashboardStats()
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Please sign in</h2>
          <p className="text-gray-600">You need to be signed in to view your dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome back!</h1>
              <p className="text-gray-600 mt-1">Here's your mental health journey overview</p>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              {isOnline ? (
                isSupabaseConnected ? (
                  <div className="flex items-center text-green-600">
                    <Wifi className="h-4 w-4 mr-1" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center text-yellow-600">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm">Connecting...</span>
                  </div>
                )
              ) : (
                <div className="flex items-center text-red-600">
                  <WifiOff className="h-4 w-4 mr-1" />
                  <span className="text-sm">Offline</span>
                </div>
              )}
              
              <button
                onClick={handleRetry}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
              <button
                onClick={handleRetry}
                className="ml-auto text-red-600 hover:text-red-800 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Video Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.totalSessions}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Video className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Tasks</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.completedTasks}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Mood Entries</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.moodEntries}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Heart className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Mood</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.avgMood > 0 ? `${stats.avgMood}/10` : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-blue-100 rounded-lg mr-4">
                <Video className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Video Consultation</h3>
                <p className="text-gray-600 text-sm">Start a session with AI therapist</p>
              </div>
            </div>
            <button 
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              disabled={!isSupabaseConnected}
            >
              Start Session
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-purple-100 rounded-lg mr-4">
                <Heart className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Track Mood</h3>
                <p className="text-gray-600 text-sm">Log your current mood</p>
              </div>
            </div>
            <button 
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
              disabled={!isSupabaseConnected}
            >
              Add Entry
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Voice AI</h3>
                <p className="text-gray-600 text-sm">Chat with voice assistant</p>
              </div>
            </div>
            <button 
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              disabled={!isSupabaseConnected}
            >
              Start Chat
            </button>
          </div>
        </div>

        {/* Offline Notice */}
        {!isOnline && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <WifiOff className="h-5 w-5 text-yellow-600 mr-2" />
              <p className="text-yellow-800">
                You're currently offline. Some features may not be available until you reconnect.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}