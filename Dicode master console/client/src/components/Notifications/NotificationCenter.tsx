'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationCenter, NotificationItem } from '@/contexts/NotificationCenterContext';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  CheckCheck,
  Video,
  Megaphone,
  Calendar,
  Users,
  AlertTriangle,
  Loader2,
  X,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Icon mapping for notification types
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'video_generation_complete':
    case 'video_generation_progress':
      return Video;
    case 'video_generation_failed':
      return AlertTriangle;
    case 'campaign_published':
    case 'campaign_starting':
    case 'campaign_ending':
      return Megaphone;
    case 'team_activity':
      return Users;
    case 'system_alert':
      return AlertTriangle;
    default:
      return Bell;
  }
};

// Color mapping for notification types
const getNotificationColor = (type: string, priority: string) => {
  if (priority === 'high') {
    return 'bg-rose-100 text-rose-600';
  }
  switch (type) {
    case 'video_generation_complete':
      return 'bg-emerald-100 text-emerald-600';
    case 'video_generation_progress':
      return 'bg-sky-100 text-sky-600';
    case 'video_generation_failed':
      return 'bg-rose-100 text-rose-600';
    case 'campaign_published':
      return 'bg-violet-100 text-violet-600';
    case 'campaign_starting':
    case 'campaign_ending':
      return 'bg-amber-100 text-amber-600';
    case 'team_activity':
      return 'bg-sky-100 text-sky-600';
    case 'system_alert':
      return 'bg-amber-100 text-amber-600';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

function NotificationItemComponent({
  notification,
  onMarkRead,
  onDelete,
  onClick,
}: {
  notification: NotificationItem;
  onMarkRead: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const Icon = getNotificationIcon(notification.type);
  const colorClass = getNotificationColor(notification.type, notification.priority);
  const isProgress = notification.type === 'video_generation_progress';

  return (
    <div
      className={cn(
        'group relative flex gap-3 p-3 transition-colors cursor-pointer',
        notification.read ? 'bg-white' : 'bg-sky-50/50',
        'hover:bg-slate-50'
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', colorClass)}>
        {isProgress ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', notification.read ? 'text-slate-700' : 'font-medium text-slate-900')}>
            {notification.title}
          </p>
          {!notification.read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{notification.message}</p>
        
        {/* Progress bar */}
        {isProgress && notification.progress !== undefined && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${notification.progress}%` }}
            />
          </div>
        )}

        {/* Actor and timestamp */}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
          {notification.actorName && (
            <>
              <span>{notification.actorName}</span>
              <span>•</span>
            </>
          )}
          <span>{formatDistanceToNow(notification.createdAt, { addSuffix: true })}</span>
        </div>
      </div>

      {/* Actions (show on hover) */}
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!notification.read && notification.source === 'firestore' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Mark as read"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        {notification.source === 'firestore' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotificationCenter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification: NotificationItem) => {
    // Mark as read
    if (!notification.read && notification.source === 'firestore') {
      await markAsRead(notification.id);
    }

    // Navigate if there's an action URL
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
      setIsOpen(false);
    } else if (notification.resourceType === 'video' || notification.type.includes('video')) {
      router.push('/videos');
      setIsOpen(false);
    } else if (notification.resourceType === 'campaign') {
      router.push('/campaigns');
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Bell className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-900">No notifications</p>
                <p className="mt-1 text-xs text-slate-500">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <NotificationItemComponent
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markAsRead(notification.id)}
                    onDelete={() => removeNotification(notification.id)}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2">
              <p className="text-center text-xs text-slate-400">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                {unreadCount > 0 && ` • ${unreadCount} unread`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

