import { useState, useEffect, useCallback } from 'react';
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
      const dateKey = new Date(entry.created_at).toDateString();
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
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

    // Check if there's an entry today or yesterday to start the streak
    if (uniqueDates.length > 0) {
      const mostRecentDate = uniqueDates[0];
      
      if (mostRecentDate === today || mostRecentDate === yesterday) {
        // Start counting from the most recent entry
        let checkDate = new Date(mostRecentDate);
        
        for (let i = 0; i < uniqueDates.length; i++) {
          const entryDate = uniqueDates[i];
          const expectedDate = new Date(checkDate).toDateString();
          
          if (entryDate === expectedDate) {
            currentStreak++;
            // Move to previous day
            checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
          } else {
            // Gap found, stop counting
            break;
          }
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    
    if (uniqueDates.length > 0) {
      tempStreak = 1; // Start with first entry
      
      for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = new Date(uniqueDates[i]);
        const previousDate = new Date(uniqueDates[i - 1]);
        const dayDifference = Math.floor(
          (previousDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        
        if (dayDifference === 1) {
          // Consecutive day
          tempStreak++;
        } else {
          // Gap found, check if this is the longest streak so far
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1; // Reset streak
        }
      }
      
      // Don't forget to check the final streak
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
    if (!user || !isSupabaseConnected) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get all mood entries for the user (last 365 days to calculate streaks efficiently)
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
      });

      if (data) {
        const streakData = calculateStreak(data);
        setCurrentStreak(streakData.current);
        setLongestStreak(streakData.longest);
        setLastEntryDate(streakData.lastEntry);
      }
    } catch (error) {
      console.error('Error loading mood streak:', error);
      // Don't show error to user for streak calculation
    } finally {
      setLoading(false);
    }
  }, [user, isSupabaseConnected, withRetry, handleSupabaseError, calculateStreak]);

  // Load streak data when component mounts or user changes
  useEffect(() => {
    if (user && isSupabaseConnected) {
      loadMoodStreak();
    } else {
      setLoading(false);
    }
  }, [user, isSupabaseConnected, loadMoodStreak]);

  // Set up real-time subscription for mood entries
  useEffect(() => {
    if (!user || !isSupabaseConnected) return;

    const channel = supabase
      .channel('mood_entries_changes')
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
          // Reload streak calculation when mood entries change
          loadMoodStreak();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isSupabaseConnected, loadMoodStreak]);

  const getStreakStatus = useCallback(() => {
    if (!lastEntryDate) {
      return {
        status: 'none',
        message: 'Start your mood tracking journey!',
        color: 'text-gray-500'
      };
    }

    const lastEntry = new Date(lastEntryDate);
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const lastEntryDateString = lastEntry.toDateString();
    const todayString = today.toDateString();
    const yesterdayString = yesterday.toDateString();

    if (lastEntryDateString === todayString) {
      return {
        status: 'current',
        message: 'Great! You logged your mood today.',
        color: 'text-green-600'
      };
    } else if (lastEntryDateString === yesterdayString) {
      return {
        status: 'yesterday',
        message: 'Log your mood today to continue your streak!',
        color: 'text-yellow-600'
      };
    } else {
      return {
        status: 'broken',
        message: 'Your streak was broken. Start a new one today!',
        color: 'text-red-600'
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

  return {
    currentStreak,
    longestStreak,
    loading,
    lastEntryDate,
    getStreakStatus,
    getDaysUntilMilestone,
    getStreakEmoji,
    refreshStreak: loadMoodStreak
  };
}