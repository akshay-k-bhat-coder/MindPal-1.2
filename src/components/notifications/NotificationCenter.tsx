import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  Check, 
  Clock, 
  Heart, 
  CheckSquare, 
  BarChart3,
  Award,
  AlertTriangle,
  Settings,
  Trash2,
  MarkAsRead,
  Filter
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread' | 'task' | 'mood' | 'system'>('all');

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_reminder':
        return <CheckSquare className="h-5 w-5 text-blue-600" />;
      case 'mood_reminder':
        return <Heart className="h-5 w-5 text-pink-600" />;
      case 'daily_summary':
        return <BarChart3 className="h-5 w-5 text-purple-600" />;
      case 'session_report':
        return <BarChart3 className="h-5 w-5 text-green-600" />;
      case 'achievement':
        return <Award className="h-5 w-5 text-yellow-600" />;
      case 'system_alert':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'task_reminder':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'mood_reminder':
        return 'border-l-pink-500 bg-pink-50 dark:bg-pink-900/20';
      case 'daily_summary':
        return 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/20';
      case 'session_report':
        return 'border-l-green-500 bg-green-50 dark:bg-green-900/20';
      case 'achievement':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'system_alert':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20';
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString);
    
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy h:mm a');
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.sent;
      case 'task':
        return notification.type === 'task_reminder';
      case 'mood':
        return notification.type === 'mood_reminder';
      case 'system':
        return notification.type === 'system_alert' || notification.type === 'achievement';
      default:
        return true;
    }
  });

  const handleNotificationClick = (notification: any) => {
    if (!notification.sent) {
      markNotificationAsRead(notification.id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'task_reminder':
        window.location.hash = '/tasks';
        break;
      case 'mood_reminder':
        window.location.hash = '/mood';
        break;
      case 'session_report':
        window.location.hash = '/video';
        break;
      default:
        window.location.hash = '/dashboard';
    }
    
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Notification Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Bell className="h-6 w-6" />
                  <h2 className="text-xl font-bold">Notifications</h2>
                  {unreadCount > 0 && (
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex space-x-2 overflow-x-auto">
                {[
                  { key: 'all', label: 'All', count: notifications.length },
                  { key: 'unread', label: 'Unread', count: unreadCount },
                  { key: 'task', label: 'Tasks', count: notifications.filter(n => n.type === 'task_reminder').length },
                  { key: 'mood', label: 'Mood', count: notifications.filter(n => n.type === 'mood_reminder').length },
                  { key: 'system', label: 'System', count: notifications.filter(n => n.type === 'system_alert' || n.type === 'achievement').length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key as any)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
                      filter === tab.key
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            {notifications.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={clearAllNotifications}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center space-x-1"
                      >
                        <MarkAsRead className="h-4 w-4" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                  <Bell className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No notifications</p>
                  <p className="text-sm text-center">
                    {filter === 'unread' 
                      ? "You're all caught up! No unread notifications."
                      : "You'll see your notifications here when they arrive."
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredNotifications.map((notification, index) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200 border-l-4 ${getNotificationColor(notification.type)} ${
                        !notification.sent ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${
                                !notification.sent 
                                  ? 'text-gray-900 dark:text-white' 
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                {formatNotificationTime(notification.scheduled_for)}
                              </p>
                            </div>
                            
                            <div className="flex items-center space-x-1 ml-2">
                              {!notification.sent && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors duration-200"
                                title="Delete notification"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                onClick={() => {
                  window.location.hash = '/settings';
                  onClose();
                }}
                className="w-full flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
              >
                <Settings className="h-4 w-4" />
                <span>Notification Settings</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}