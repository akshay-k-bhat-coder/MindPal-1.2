import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Download, 
  Share2, 
  Clock, 
  TrendingUp, 
  Heart, 
  Brain,
  Star,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Target,
  Lightbulb,
  Calendar
} from 'lucide-react';
import { useSessionReports } from '../../hooks/useSessionReports';

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

interface SessionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: SessionReport | null;
}

export function SessionReportModal({ isOpen, onClose, report }: SessionReportModalProps) {
  const { shareReport, exportReport } = useSessionReports();

  if (!report) return null;

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:text-green-400';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400';
      case 'fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'brief': return 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400';
      default: return 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getEngagementColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:text-green-400';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'low': return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400';
      default: return 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const handleShare = () => {
    shareReport(report);
  };

  const handleExport = (format: 'json' | 'text') => {
    exportReport(report, format);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Video Session Report</h2>
                  <p className="text-purple-100">
                    Generated on {new Date(report.generated_at).toLocaleDateString()} at{' '}
                    {new Date(report.generated_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleShare}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors duration-200"
                    title="Share Report"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                  <div className="relative group">
                    <button className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors duration-200">
                      <Download className="h-5 w-5" />
                    </button>
                    <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      <button
                        onClick={() => handleExport('json')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
                      >
                        Export as JSON
                      </button>
                      <button
                        onClick={() => handleExport('text')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg"
                      >
                        Export as Text
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors duration-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-8">
                {/* Session Overview */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <Clock className="h-6 w-6 text-blue-600" />
                    <span>Session Overview</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {report.report_data.duration_formatted}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Quality</p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getQualityColor(report.insights.session_quality)}`}>
                            {report.insights.session_quality}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Engagement</p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getEngagementColor(report.insights.engagement_level)}`}>
                            {report.insights.engagement_level}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mood Analysis */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <Heart className="h-6 w-6 text-pink-600" />
                    <span>Mood Analysis</span>
                  </h3>
                  <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-pink-100 dark:border-pink-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Sentiment</p>
                          <p className="text-lg font-semibold text-pink-700 dark:text-pink-400 capitalize">
                            {report.mood_analysis.overall_sentiment}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Emotional State</p>
                          <p className="text-lg font-semibold text-purple-700 dark:text-purple-400 capitalize">
                            {report.mood_analysis.emotional_state}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Stress Indicators</p>
                          <p className="text-lg font-semibold text-blue-700 dark:text-blue-400 capitalize">
                            {report.mood_analysis.stress_indicators}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Confidence Score</p>
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full"
                                style={{ width: `${report.mood_analysis.confidence_score * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {(report.mood_analysis.confidence_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Engagement Metrics */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                    <span>Engagement Metrics</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {report.engagement_metrics.total_interactions}
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-300">Total Interactions</p>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {report.engagement_metrics.session_completion_rate}%
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-300">Completion Rate</p>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                            {report.engagement_metrics.user_satisfaction_score}
                          </p>
                          <Star className="h-5 w-5 text-yellow-500" />
                        </div>
                        <p className="text-sm text-yellow-600 dark:text-yellow-300">User Satisfaction</p>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                            {report.engagement_metrics.ai_response_quality}
                          </p>
                          <Brain className="h-5 w-5 text-purple-500" />
                        </div>
                        <p className="text-sm text-purple-600 dark:text-purple-300">AI Quality</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Performance */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <Target className="h-6 w-6 text-green-600" />
                    <span>Technical Performance</span>
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2 mb-2">
                          {report.insights.technical_issues === 0 ? (
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-6 w-6 text-yellow-600" />
                          )}
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {report.insights.technical_issues}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Technical Issues</p>
                      </div>
                      
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          {report.engagement_metrics.average_response_time}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</p>
                      </div>
                      
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          {report.report_data.analytics_events.length}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Analytics Events</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <Lightbulb className="h-6 w-6 text-yellow-600" />
                    <span>Recommendations</span>
                  </h3>
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800">
                    <div className="space-y-3">
                      {report.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Session Timeline */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <Calendar className="h-6 w-6 text-indigo-600" />
                    <span>Session Timeline</span>
                  </h3>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Started:</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(report.report_data.started_at).toLocaleString()}
                        </span>
                      </div>
                      {report.report_data.ended_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ended:</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(report.report_data.ended_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Report Generated:</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(report.generated_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}