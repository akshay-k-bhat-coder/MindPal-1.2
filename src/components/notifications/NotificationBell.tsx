import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationCenter } from './NotificationCenter';

export function NotificationBell() {
  const { unreadCount, permission } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const hasUnread = unreadCount > 0;

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="relative p-2 text-white/70 hover:text-white transition-colors duration-200 rounded-lg hover:bg-white/10"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={`${unreadCount} unread notifications`}
      >
        <motion.div
          animate={hasUnread ? { rotate: [0, 15, -15, 0] } : {}}
          transition={{ duration: 0.5, repeat: hasUnread ? Infinity : 0, repeatDelay: 3 }}
        >
          {hasUnread ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </motion.div>
        
        {/* Notification Badge */}
        <AnimatePresence>
          {hasUnread && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Permission Warning */}
        {permission !== 'granted' && (
          <motion.div
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            title="Click to enable notifications"
          />
        )}
      </motion.button>

      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}