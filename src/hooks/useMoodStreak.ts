import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { supabase } from '../lib/supabase';

interface MoodEntry {
  id: string;
  mood: number;
  emoji: string;
  notes: string | null;
  created_at: string;
}

export function useMoodStreak() {
  const { user, handleSupabaseError } = useAuth();
  const { isSupabaseConnected, withRetry } = useNetworkStatus();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastEntryDate, setLastEntryDate] = useState<string | null>(null);
  
  // Use refs to prevent infinite re-renders
  const loadingRef = useRef(false);
  const subscriptionRef = useRef<any>(null);

  const calculateStreak = useCallback((entries: MoodEntry[]) => {
    if (!entries || entries.length === 0) {
      return { current: 0, longest: 0, lastEntry: null };
    }

    // Sort entries by date (newest first)
    const sortedEntries = entries.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Group entries by date (ignore time)
    const entriesByDate = new Map<string, MoodEntry[]>();
    sortedEntries.forEach(entry => {
      const dateKey = new Date(entry.created_at).toISOString().split('T')[0];
      if (!entriesByDate.has(dateKey)) {
        entriesByDate.set(dateKey, []);
      }
      entriesByDate.get(dateKey)!.push(entry);
    });

    const uniqueDates = Array.from(entriesByDate.keys()).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (uniqueDates.length > 0) {
      const mostRecentDate = uniqueDates[0];
      
      if (mostRecentDate === today || mostRecentDate === yesterday) {
        let checkDate = new Date(mostRecentDate);
        
        for (let i = 0; i < uniqueDates.length; i++) {
          const entryDate = uniqueDates[i];
          const expectedDate = checkDate.toISOString().split('T')[0];
          
          if (entryDate === expectedDate) {
            currentStreak++;
            checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
          } else {
            break;
          }
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    
    if (uniqueDates.length > 0) {
      tempStreak = 1;
      
      for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = new Date(uniqueDates[i]);
        const previousDate = new Date(uniqueDates[i - 1]);
        const dayDifference = Math.floor(
          (previousDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        
        if (dayDifference === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    const lastEntry = sortedEntries.length > 0 ? sortedEntries[0].created_at : null;

    return {
      current: currentStreak,
      longest: longestStreak,
      lastEntry
    };
  }, []);

  const loadMoodStreak = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current || !user || !isSupabaseConnected) {
      if (!user) {
        setLoading(false);
        setCurrentStreak(0);
        setLongestStreak(0);
        setLastEntryDate(null);
      }
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('mood_entries')
          .select('id, mood, emoji, notes, created_at')
          .eq('user_id', user.id)
          .gte('created_at', oneYearAgo.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      }, 3, 1000);

      if (data) {
        const streakData = calculateStreak(data);
        setCurrentStreak(streakData.current);
        setLongestStreak(streakData.longest);
        setLastEntryDate(streakData.lastEntry);
      } else {
        setCurrentStreak(0);
        setLongestStreak(0);
        setLastEntryDate(null);
      }
    } catch (error) {
      console.error('Error loading mood streak:', error);
      setCurrentStreak(0);
      setLongestStreak(0);
      setLastEntryDate(null);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user, isSupabaseConnected, withRetry, handleSupabaseError, calculateStreak]);

  // Load streak data when component mounts or user changes
  useEffect(() => {
    if (user && isSupabaseConnected) {
      loadMoodStreak();
    } else if (!user) {
      setLoading(false);
      setCurrentStreak(0);
      setLongestStreak(0);
      setLastEntryDate(null);
    }
  }, [user, isSupabaseConnected]); // Removed loadMoodStreak from deps to prevent infinite loop

  // Set up real-time subscription for mood entries
  useEffect(() => {
    // Clean up existing subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    if (!user || !isSupabaseConnected) return;

    const channel = supabase
      .channel(`mood_entries_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mood_entries',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Mood entry change detected:', payload);
          // Debounced reload to prevent rapid updates
          setTimeout(() => {
            if (!loadingRef.current) {
              loadMoodStreak();
            }
          }, 1000);
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user, isSupabaseConnected]); // Removed loadMoodStreak from deps

  const getStreakStatus = useCallback(() => {
    if (!lastEntryDate) {
      return {
        status: 'none',
        message: 'Start your mood tracking journey!',
        color: 'text-gray-500 dark:text-gray-400'
      };
    }

    const lastEntry = new Date(lastEntryDate);
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const lastEntryDateString = lastEntry.toISOString().split('T')[0];
    const todayString = today.toISOString().split('T')[0];
    const yesterdayString = yesterday.toISOString().split('T')[0];

    if (lastEntryDateString === todayString) {
      return {
        status: 'current',
        message: 'Great! You logged your mood today.',
        color: 'text-green-600 dark:text-green-400'
      };
    } else if (lastEntryDateString === yesterdayString) {
      return {
        status: 'yesterday',
        message: 'Log your mood today to continue your streak!',
        color: 'text-yellow-600 dark:text-yellow-400'
      };
    } else {
      return {
        status: 'broken',
        message: 'Your streak was broken. Start a new one today!',
        color: 'text-red-600 dark:text-red-400'
      };
    }
  }, [lastEntryDate]);

  const getDaysUntilMilestone = useCallback(() => {
    const milestones = [7, 14, 30, 60, 100, 365];
    const nextMilestone = milestones.find(milestone => milestone > currentStreak);
    
    if (nextMilestone) {
      return {
        days: nextMilestone - currentStreak,
        milestone: nextMilestone
      };
    }
    
    return null;
  }, [currentStreak]);

  const getStreakEmoji = useCallback(() => {
    if (currentStreak === 0) return '🌱';
    if (currentStreak < 7) return '🔥';
    if (currentStreak < 30) return '⚡';
    if (currentStreak < 100) return '🏆';
    return '👑';
  }, [currentStreak]);

  // Manual refresh function that can be called externally
  const refreshStreak = useCallback(() => {
    if (!loadingRef.current) {
      loadMoodStreak();
    }
  }, [loadMoodStreak]);

  return {
    currentStreak,
    longestStreak,
    loading,
    lastEntryDate,
    getStreakStatus,
    getDaysUntilMilestone,
    getStreakEmoji,
    refreshStreak
  };
}