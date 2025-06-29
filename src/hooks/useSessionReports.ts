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

      const data = await withRetry(async () => {
        const { data, error } = await supabase.rpc('generate_session_report', {
          p_user_id: user.id,
          p_video_session_id: videoSessionId
        });

        if (error) {
          const isJWTError = await handleSupabaseError(error);
          if (!isJWTError) throw error;
          return null;
        }

        return data;
      });

      if (data) {
        // Fetch the generated report
        const reportData = await withRetry(async () => {
          const { data: report, error } = await supabase
            .from('session_reports')
            .select('*')
            .eq('id', data)
            .single();

          if (error) {
            const isJWTError = await handleSupabaseError(error);
            if (!isJWTError) throw error;
            return null;
          }

          return report;
        });

        if (reportData) {
          const newReport = reportData as SessionReport;
          setReports(prev => [newReport, ...prev]);
          setCurrentReport(newReport);
          toast.success('Session report generated successfully!');
          return newReport;
        }
      }
    } catch (error) {
      console.error('Error generating session report:', error);
      toast.error('Failed to generate session report');
    } finally {
      setGenerating(false);
    }

    return null;
  }, [user, handleSupabaseError, withRetry, isConnectedToSupabase]);

  const trackSessionEvent = useCallback(async (
    videoSessionId: string,
    eventType: SessionAnalytics['event_type'],
    eventData: any
  ): Promise<void> => {
    if (!user || !isConnectedToSupabase) return;

    try {
      await withRetry(async () => {
        const { error } = await supabase.rpc('track_session_event', {
          p_user_id: user.id,
          p_video_session_id: videoSessionId,
          p_event_type: eventType,
          p_event_data: eventData
        });

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