import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, Trophy, BookOpen, Sparkles, Clock } from 'lucide-react';
import BottomSheet from './BottomSheet';

export interface Notification {
  id: string;
  type: 'achievement' | 'reminder' | 'campaign' | 'streak' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAllRead?: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'achievement':
      return <Trophy size={18} className="text-amber-400" />;
    case 'reminder':
      return <Clock size={18} className="text-blue-400" />;
    case 'campaign':
      return <BookOpen size={18} className="text-emerald-400" />;
    case 'streak':
      return <Sparkles size={18} className="text-orange-400" />;
    case 'system':
    default:
      return <Bell size={18} className="text-white/60" />;
  }
};

const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const NotificationsSheet: React.FC<NotificationsSheetProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onNotificationClick,
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} className="bg-black !h-screen !max-h-screen !rounded-none">
      {/* Header */}
      <div className="px-6 pt-2 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white text-xl font-bold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-500 text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && onMarkAllRead && (
          <motion.button
            onClick={onMarkAllRead}
            className="px-4 py-2 rounded-full border border-white/20 text-white/70 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
            whileTap={{ scale: 0.95 }}
          >
            <Check size={14} />
            Mark all read
          </motion.button>
        )}
      </div>

      {/* Notifications List */}
      <div className="px-4 pb-24 flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-16"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Bell size={28} className="text-white/30" />
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">All caught up!</h3>
            <p className="text-white/50 text-sm text-center max-w-[200px]">
              You have no new notifications at the moment.
            </p>
          </motion.div>
        ) : (
          <div className="divide-y divide-white/10">
            {notifications.map((notification, index) => (
              <motion.button
                key={notification.id}
                onClick={() => onNotificationClick?.(notification)}
                className="w-full px-2 py-4 text-left"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`font-medium text-[15px] ${notification.read ? 'text-white/70' : 'text-white'}`}>
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-[#00A3FF] flex-shrink-0 mt-2" />
                      )}
                    </div>
                    <p className="text-white/50 text-sm mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-white/30 text-xs mt-2">
                      {getTimeAgo(notification.timestamp)}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default NotificationsSheet;
