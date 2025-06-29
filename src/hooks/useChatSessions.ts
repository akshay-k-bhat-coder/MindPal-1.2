import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { useEncryption } from './useEncryption';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string;
  session_id: string;
  message_type: 'user' | 'ai';
  content: string;
  created_at: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

interface MoodAnalysis {
  overall_mood: 'positive' | 'negative' | 'neutral';
  emotions: string[];
  stress_level: 'low' | 'medium' | 'high';
  recommendations: string[];
  summary: string;
}

export function useChatSessions() {
  const { user, handleSupabaseError } = useAuth();
  const { withRetry, isConnectedToSupabase } = useNetworkStatus();
  const { storeEncryptedData } = useEncryption();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    if (!isConnectedToSupabase) {
      setLoading(false);
      return;
    }

    try {
      const data = await withRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(20)
            .abortSignal(controller.signal);

          clearTimeout(timeoutId);

          if (error) {
            const isJWTError = await handleSupabaseError(error);
            if (!isJWTError) throw error;
            return null;
          }

          return data;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }, 1, 2000); // Single retry with longer delay

      setSessions(data || []);
    } catch (error: any) {
      console.error('Error loading chat sessions:', error);
      
      // Don't show error for abort errors or network issues
      if (!error.name?.includes('AbortError') && 
          !error.message?.includes('signal is aborted') &&
          isConnectedToSupabase) {
        toast.error('Failed to load chat sessions');
      }
    } finally {
      setLoading(false);
    }
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

  const loadMessages = useCallback(async (sessionId: string) => {
    if (!user || !isSupabaseConfigured() || !isConnectedToSupabase) return;

    try {
      const data = await withRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .abortSignal(controller.signal);

          clearTimeout(timeoutId);

          if (error) {
            const isJWTError = await handleSupabaseError(error);
            if (!isJWTError) throw error;
            return null;
          }

          return data;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }, 1, 2000);

      setMessages(data || []);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      
      if (!error.name?.includes('AbortError') && 
          !error.message?.includes('signal is aborted') &&
          isConnectedToSupabase) {
        toast.error('Failed to load messages');
      }
    }
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

  const createNewSession = async (title?: string) => {
    if (!user || !isSupabaseConfigured() || !isConnectedToSupabase) {
      if (!isConnectedToSupabase) {
        toast.error('Cannot create session - no connection to server');
      }
      return null;
    }

    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert([{
            user_id: user.id,
            title: title || `Chat ${new Date().toLocaleDateString()}`,
          }])
          .select()
          .single();

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      }, 1, 2000);

      if (data) {
        const newSession = data;
        setSessions(prev => [newSession, ...prev]);
        setCurrentSession(newSession);
        setMessages([]);
        
        toast.success('New chat session created!');
        return newSession;
      }
    } catch (error: any) {
      console.error('Error creating session:', error);
      
      if (!error.name?.includes('AbortError') && 
          !error.message?.includes('signal is aborted')) {
        toast.error('Failed to create new session');
      }
    }
    
    return null;
  };

  const addMessage = async (sessionId: string, messageType: 'user' | 'ai', content: string) => {
    if (!user || !isSupabaseConfigured() || !isConnectedToSupabase) {
      if (!isConnectedToSupabase) {
        toast.error('Cannot send message - no connection to server');
      }
      return null;
    }

    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert([{
            session_id: sessionId,
            user_id: user.id,
            message_type: messageType,
            content,
          }])
          .select()
          .single();

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      }, 1, 2000);

      if (data) {
        const newMessage = data;
        setMessages(prev => [...prev, newMessage]);

        // Store encrypted data if it's sensitive
        if (messageType === 'user') {
          try {
            await storeEncryptedData('chat_message', content);
          } catch (error) {
            console.warn('Failed to store encrypted data:', error);
          }
        }

        return newMessage;
      }
    } catch (error: any) {
      console.error('Error adding message:', error);
      
      if (!error.name?.includes('AbortError') && 
          !error.message?.includes('signal is aborted')) {
        toast.error('Failed to save message');
      }
    }
    
    return null;
  };

  const deleteSession = async (sessionId: string) => {
    if (!user || !isSupabaseConfigured() || !isConnectedToSupabase) {
      if (!isConnectedToSupabase) {
        toast.error('Cannot delete session - no connection to server');
      }
      return;
    }

    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('chat_sessions')
          .delete()
          .eq('id', sessionId)
          .eq('user_id', user.id);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return;
        }
      }, 1, 2000);

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }

      toast.success('Chat session deleted');
    } catch (error: any) {
      console.error('Error deleting session:', error);
      
      if (!error.name?.includes('AbortError') && 
          !error.message?.includes('signal is aborted')) {
        toast.error('Failed to delete session');
      }
    }
  };

  const updateSessionTitle = async (sessionId: string, title: string) => {
    if (!user || !isSupabaseConfigured() || !isConnectedToSupabase) {
      if (!isConnectedToSupabase) {
        toast.error('Cannot update title - no connection to server');
      }
      return;
    }

    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('chat_sessions')
          .update({ title })
          .eq('id', sessionId)
          .eq('user_id', user.id);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return;
        }
      }, 1, 2000);

      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title } : s
      ));

      if (currentSession?.id === sessionId) {
        setCurrentSession(prev => prev ? { ...prev, title } : null);
      }

      toast.success('Session title updated');
    } catch (error: any) {
      console.error('Error updating session title:', error);
      
      if (!error.name?.includes('AbortError') && 
          !error.message?.includes('signal is aborted')) {
        toast.error('Failed to update title');
      }
    }
  };

  const generateMoodReport = async (sessionId: string): Promise<MoodAnalysis | null> => {
    if (!user || !isSupabaseConfigured() || !isConnectedToSupabase) {
      if (!isConnectedToSupabase) {
        toast.error('Cannot generate report - no connection to server');
      }
      return null;
    }

    try {
      // Get all messages from the session
      const messagesData = await withRetry(async () => {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('content, message_type')
          .eq('session_id', sessionId)
          .eq('user_id', user.id);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      }, 1, 2000);

      const userMessages = messagesData?.filter(m => m.message_type === 'user') || [];
      const conversationText = userMessages.map(m => m.content).join(' ');

      // Simple mood analysis (in production, you'd use a proper AI service)
      const analysis = analyzeMoodFromText(conversationText);

      // Store the analysis
      await withRetry(async () => {
        const { error } = await supabase
          .from('mood_analytics')
          .insert([{
            user_id: user.id,
            session_id: sessionId,
            analysis_type: 'mood_report',
            analysis_data: analysis,
          }]);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return;
        }
      }, 1, 2000);

      toast.success('Mood report generated!');
      return analysis;
    } catch (error: any) {
      console.error('Error generating mood report:', error);
      
      if (!error.name?.includes('AbortError') && 
          !error.message?.includes('signal is aborted')) {
        toast.error('Failed to generate mood report');
      }
      return null;
    }
  };

  const shareChatSession = async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const shareData = {
        title: `MindPal Chat: ${session.title}`,
        text: `Check out my conversation with MindPal AI`,
        url: window.location.href,
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.url}`);
        toast.success('Chat link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing session:', error);
      toast.error('Failed to share session');
    }
  };

  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      loadSessions();
    } else {
      setLoading(false);
    }
  }, [user, loadSessions]);

  return {
    sessions,
    currentSession,
    messages,
    loading,
    setCurrentSession,
    loadMessages,
    createNewSession,
    addMessage,
    deleteSession,
    updateSessionTitle,
    generateMoodReport,
    shareChatSession,
  };
}

// Simple mood analysis function (replace with proper AI service in production)
function analyzeMoodFromText(text: string): MoodAnalysis {
  const positiveWords = ['happy', 'good', 'great', 'excellent', 'wonderful', 'amazing', 'love', 'joy', 'excited'];
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'depressed', 'worried', 'anxious'];
  const stressWords = ['stress', 'pressure', 'overwhelmed', 'busy', 'tired', 'exhausted', 'deadline'];

  const words = text.toLowerCase().split(/\s+/);
  
  const positiveCount = words.filter(word => positiveWords.includes(word)).length;
  const negativeCount = words.filter(word => negativeWords.includes(word)).length;
  const stressCount = words.filter(word => stressWords.includes(word)).length;

  let overall_mood: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (positiveCount > negativeCount) overall_mood = 'positive';
  else if (negativeCount > positiveCount) overall_mood = 'negative';

  const emotions: string[] = [];
  if (positiveCount > 0) emotions.push('happiness', 'contentment');
  if (negativeCount > 0) emotions.push('sadness', 'frustration');
  if (stressCount > 0) emotions.push('stress', 'anxiety');

  const stress_level: 'low' | 'medium' | 'high' = 
    stressCount > 3 ? 'high' : stressCount > 1 ? 'medium' : 'low';

  const recommendations: string[] = [];
  if (overall_mood === 'negative') {
    recommendations.push('Consider practicing mindfulness or meditation');
    recommendations.push('Reach out to friends or family for support');
  }
  if (stress_level === 'high') {
    recommendations.push('Take regular breaks throughout your day');
    recommendations.push('Try deep breathing exercises');
  }

  const summary = `Based on your conversation, you seem to be feeling ${overall_mood} with a ${stress_level} stress level. ${emotions.length > 0 ? `Main emotions detected: ${emotions.join(', ')}.` : ''}`;

  return {
    overall_mood,
    emotions,
    stress_level,
    recommendations,
    summary,
  };
}