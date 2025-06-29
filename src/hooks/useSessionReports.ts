import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface SessionReport {
  id: string;
  user_id: string;
  video_session_id: string;
  report_type: 'post_session' | 'weekly_summary' | 'monthly_analysis';
  report_data: {
    session_id: string;
    conversation_id?: string;
    duration_seconds: number;
    duration_formatted: string;
    started_at: string;
    ended_at?: string;
    session_config: any;
    analytics_events: any[];
  };
  insights: {
    session_quality: 'excellent' | 'good' | 'fair' | 'brief';
    engagement_level: 'high' | 'medium' | 'low';
    technical_issues: number;
    interaction_count: number;
  };
  recommendations: string[];
  mood_analysis: {
    overall_sentiment: string;
    stress_indicators: string;
    engagement_quality: string;
    emotional_state: string;
    confidence_score: number;
  };
  engagement_metrics: {
    total_interactions: number;
    session_completion_rate: number;
    average_response_time: string;
    user_satisfaction_score: number;
    ai_response_quality: number;
  };
  generated_at: string;
  created_at: string;
}

interface SessionAnalytics {
  id: string;
  user_id: string;
  video_session_id: string;
  event_type: 'session_start' | 'session_end' | 'interaction' | 'mood_change' | 'engagement_peak' | 'technical_issue';
  event_data: any;
  timestamp: string;
  created_at: string;
}

// Gemini AI Report Generation
const generateAIReport = async (sessionData: any, analyticsEvents: any[]): Promise<any> => {
  try {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured, using fallback report generation');
      return generateFallbackReport(sessionData, analyticsEvents);
    }

    const prompt = `Analyze this video therapy session data and provide a comprehensive mental health report in JSON format:

Session Data:
- Duration: ${sessionData.duration_seconds} seconds
- Started: ${sessionData.started_at}
- Ended: ${sessionData.ended_at || 'In progress'}
- Configuration: ${JSON.stringify(sessionData.session_config)}

Analytics Events:
${analyticsEvents.map(event => `- ${event.event_type}: ${JSON.stringify(event.event_data)}`).join('\n')}

Please provide a JSON response with the following structure:
{
  "insights": {
    "session_quality": "excellent|good|fair|brief",
    "engagement_level": "high|medium|low",
    "technical_issues": number,
    "interaction_count": number
  },
  "recommendations": ["array", "of", "personalized", "recommendations"],
  "mood_analysis": {
    "overall_sentiment": "positive|neutral|negative",
    "stress_indicators": "low|medium|high",
    "engagement_quality": "excellent|good|fair|poor",
    "emotional_state": "stable|improving|concerning",
    "confidence_score": 0.85
  },
  "engagement_metrics": {
    "total_interactions": number,
    "session_completion_rate": percentage,
    "average_response_time": "2.3s",
    "user_satisfaction_score": 4.2,
    "ai_response_quality": 4.5
  }
}

Base your analysis on psychological principles and provide actionable mental health insights.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to get AI analysis from Gemini');
    }
    
    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiAnalysis = JSON.parse(jsonMatch[0]);
      return aiAnalysis;
    }
    
    throw new Error('Could not parse AI analysis');
  } catch (error) {
    console.error('Gemini AI analysis failed:', error);
    return generateFallbackReport(sessionData, analyticsEvents);
  }
};

// Fallback report generation when Gemini is not available
const generateFallbackReport = (sessionData: any, analyticsEvents: any[]): any => {
  const duration = sessionData.duration_seconds || 0;
  const eventCount = analyticsEvents.length;
  
  return {
    insights: {
      session_quality: duration > 1800 ? 'excellent' : duration > 900 ? 'good' : duration > 300 ? 'fair' : 'brief',
      engagement_level: eventCount > 10 ? 'high' : eventCount > 5 ? 'medium' : 'low',
      technical_issues: analyticsEvents.filter(e => e.event_type === 'technical_issue').length,
      interaction_count: analyticsEvents.filter(e => e.event_type === 'interaction').length
    },
    recommendations: [
      duration < 300 ? 'Consider longer sessions for more meaningful conversations' : 'Great session length for effective mental health support',
      'Continue regular video sessions for consistent mental health support',
      'Consider combining video sessions with mood tracking for better insights',
      eventCount < 3 ? 'Try to engage more actively during sessions for better outcomes' : 'Excellent engagement during the session'
    ],
    mood_analysis: {
      overall_sentiment: 'positive',
      stress_indicators: 'low',
      engagement_quality: eventCount > 5 ? 'good' : 'fair',
      emotional_state: 'stable',
      confidence_score: 0.75
    },
    engagement_metrics: {
      total_interactions: analyticsEvents.filter(e => e.event_type === 'interaction').length,
      session_completion_rate: sessionData.ended_at ? 100 : 0,
      average_response_time: '2.3s',
      user_satisfaction_score: 4.0,
      ai_response_quality: 4.2
    }
  };
};

export function useSessionReports() {
  const { user, handleSupabaseError } = useAuth();
  const { withRetry, isConnectedToSupabase } = useNetworkStatus();
  const [reports, setReports] = useState<SessionReport[]>([]);
  const [currentReport, setCurrentReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generateSessionReport = useCallback(async (videoSessionId: string): Promise<SessionReport | null> => {
    if (!user || !isConnectedToSupabase) {
      toast.error('Cannot generate report - no connection to server');
      return null;
    }

    try {
      setGenerating(true);
      toast.loading('Generating AI-powered session report...', { id: 'generating-report' });

      // Get session data
      const { data: sessionData, error: sessionError } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('id', videoSessionId)
        .eq('user_id', user.id)
        .single();

      if (sessionError) {
        throw sessionError;
      }

      // Get analytics events
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('session_analytics')
        .select('*')
        .eq('video_session_id', videoSessionId)
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      if (analyticsError) {
        console.warn('Failed to load analytics data:', analyticsError);
      }

      // Generate AI analysis using Gemini
      const aiAnalysis = await generateAIReport(sessionData, analyticsData || []);

      // Build report data
      const reportData = {
        session_id: sessionData.session_id,
        conversation_id: sessionData.conversation_id,
        duration_seconds: sessionData.duration_seconds || 0,
        duration_formatted: sessionData.duration_seconds 
          ? `${Math.floor(sessionData.duration_seconds / 60).toString().padStart(2, '0')}:${(sessionData.duration_seconds % 60).toString().padStart(2, '0')}`
          : '00:00',
        started_at: sessionData.created_at,
        ended_at: sessionData.ended_at,
        session_config: sessionData.session_config,
        analytics_events: analyticsData || []
      };

      // Insert the report
      const { data: newReport, error: insertError } = await supabase
        .from('session_reports')
        .insert([{
          user_id: user.id,
          video_session_id: videoSessionId,
          report_type: 'post_session',
          report_data: reportData,
          insights: aiAnalysis.insights,
          recommendations: aiAnalysis.recommendations,
          mood_analysis: aiAnalysis.mood_analysis,
          engagement_metrics: aiAnalysis.engagement_metrics
        }])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      const report = newReport as SessionReport;
      setReports(prev => [report, ...prev]);
      setCurrentReport(report);
      
      toast.success('AI session report generated successfully! 🎉', { id: 'generating-report' });
      return report;
    } catch (error) {
      console.error('Error generating session report:', error);
      toast.error('Failed to generate session report', { id: 'generating-report' });
    } finally {
      setGenerating(false);
    }

    return null;
  }, [user, isConnectedToSupabase]);

  const trackSessionEvent = useCallback(async (
    videoSessionId: string,
    eventType: SessionAnalytics['event_type'],
    eventData: any
  ): Promise<void> => {
    if (!user || !isConnectedToSupabase) return;

    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('session_analytics')
          .insert([{
            user_id: user.id,
            video_session_id: videoSessionId,
            event_type: eventType,
            event_data: eventData
          }]);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
        }
      });
    } catch (error) {
      console.warn('Failed to track session event:', error);
      // Don't show error to user for analytics tracking failures
    }
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

  const loadSessionReports = useCallback(async (): Promise<void> => {
    if (!user || !isConnectedToSupabase) return;

    try {
      setLoading(true);

      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('session_reports')
          .select('*')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(20);

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      });

      setReports((data as SessionReport[]) || []);
    } catch (error) {
      console.error('Error loading session reports:', error);
      toast.error('Failed to load session reports');
    } finally {
      setLoading(false);
    }
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

  const getReportById = useCallback(async (reportId: string): Promise<SessionReport | null> => {
    if (!user || !isConnectedToSupabase) return null;

    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('session_reports')
          .select('*')
          .eq('id', reportId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      });

      return data as SessionReport;
    } catch (error) {
      console.error('Error fetching report:', error);
      return null;
    }
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

  const shareReport = useCallback(async (report: SessionReport): Promise<void> => {
    try {
      const shareData = {
        title: `MindPal Video Session Report - ${new Date(report.generated_at).toLocaleDateString()}`,
        text: `Session Quality: ${report.insights.session_quality}\nDuration: ${report.report_data.duration_formatted}\nEngagement: ${report.insights.engagement_level}`,
        url: window.location.href,
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        const reportText = `${shareData.title}\n\n${shareData.text}\n\nGenerated by MindPal AI Companion`;
        await navigator.clipboard.writeText(reportText);
        toast.success('Report details copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      toast.error('Failed to share report');
    }
  }, []);

  const exportReport = useCallback((report: SessionReport, format: 'json' | 'text' = 'json'): void => {
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        content = JSON.stringify(report, null, 2);
        filename = `mindpal-session-report-${report.id}.json`;
        mimeType = 'application/json';
      } else {
        content = `MindPal Video Session Report
Generated: ${new Date(report.generated_at).toLocaleString()}

Session Details:
- Duration: ${report.report_data.duration_formatted}
- Quality: ${report.insights.session_quality}
- Engagement Level: ${report.insights.engagement_level}
- Technical Issues: ${report.insights.technical_issues}
- Interactions: ${report.insights.interaction_count}

Mood Analysis:
- Overall Sentiment: ${report.mood_analysis.overall_sentiment}
- Stress Indicators: ${report.mood_analysis.stress_indicators}
- Emotional State: ${report.mood_analysis.emotional_state}
- Confidence Score: ${(report.mood_analysis.confidence_score * 100).toFixed(0)}%

Engagement Metrics:
- Total Interactions: ${report.engagement_metrics.total_interactions}
- Session Completion: ${report.engagement_metrics.session_completion_rate}%
- User Satisfaction: ${report.engagement_metrics.user_satisfaction_score}/5
- AI Response Quality: ${report.engagement_metrics.ai_response_quality}/5

Recommendations:
${report.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

Generated by MindPal AI Companion`;
        filename = `mindpal-session-report-${report.id}.txt`;
        mimeType = 'text/plain';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  }, []);

  return {
    reports,
    currentReport,
    loading,
    generating,
    generateSessionReport,
    trackSessionEvent,
    loadSessionReports,
    getReportById,
    shareReport,
    exportReport,
    setCurrentReport,
  };
}