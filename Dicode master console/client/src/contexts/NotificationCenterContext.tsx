'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useJobTracker } from './JobTrackerContext';
import { useNotification } from './NotificationContext';
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
} from '@/lib/firestore';
import type { AppNotification, NotificationType, NotificationPriority, ActivityResourceType } from '@/lib/types';

// Combined notification item (from Firestore or local jobs)
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  read: boolean;
  actorName?: string;
  resourceId?: string;
  resourceType?: ActivityResourceType | 'job';
  resourceName?: string;
  actionUrl?: string;
  progress?: number;
  createdAt: Date;
  source: 'firestore' | 'job';
}

interface NotificationCenterContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  createSystemNotification: (params: {
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    resourceId?: string;
    resourceType?: ActivityResourceType | 'job';
    resourceName?: string;
    actionUrl?: string;
  }) => Promise<void>;
}

const NotificationCenterContext = createContext<NotificationCenterContextType | undefined>(undefined);

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { jobs } = useJobTracker();
  const toast = useNotification();
  const [firestoreNotifications, setFirestoreNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const previousNotificationIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Subscribe to Firestore notifications
  useEffect(() => {
    if (!user?.uid) {
      setFirestoreNotifications([]);
      setIsLoading(false);
      previousNotificationIds.current = new Set();
      isInitialLoad.current = true;
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
      // Check for new notifications and show toast
      if (!isInitialLoad.current) {
        notifications.forEach((notification) => {
          if (notification.id && !previousNotificationIds.current.has(notification.id) && !notification.read) {
            // Show toast for new notification
            const toastType = notification.priority === 'high' ? 'error' : 
                             notification.type === 'video_generation_complete' ? 'success' :
                             notification.type === 'campaign_published' ? 'success' : 'info';
            toast.showNotification(toastType, notification.title, notification.message);
          }
        });
      }

      // Update the set of known notification IDs
      previousNotificationIds.current = new Set(
        notifications.map((n) => n.id).filter((id): id is string => !!id)
      );
      isInitialLoad.current = false;

      setFirestoreNotifications(notifications);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, toast]);

  // Convert job tracker jobs to notification items
  const jobNotifications: NotificationItem[] = jobs.map((job) => {
    const isComplete = job.status === 'completed';
    const isError = job.status === 'error';
    const isRunning = job.status === 'running' || job.status === 'pending';

    // Calculate overall progress
    const shotNumbers = Object.keys(job.progress).map(Number);
    const totalProgress = shotNumbers.length > 0
      ? shotNumbers.reduce((sum, n) => sum + (job.progress[n] || 0), 0) / shotNumbers.length
      : 0;

    let type: NotificationType = 'video_generation_progress';
    let title = 'Generating video...';
    let message = `${Math.round(totalProgress)}% complete`;

    if (isComplete) {
      type = 'video_generation_complete';
      title = 'Video generation complete';
      message = 'Your video is ready to view';
    } else if (isError) {
      type = 'video_generation_failed';
      title = 'Video generation failed';
      message = job.error || 'An error occurred during generation';
    }

    return {
      id: `job-${job.taskId}`,
      type,
      title,
      message,
      priority: isError ? 'high' : 'normal',
      read: isComplete || isError ? false : true, // Progress notifications are "read"
      resourceType: 'job' as const,
      resourceId: job.taskId,
      progress: isRunning ? totalProgress : undefined,
      createdAt: new Date(job.createdAt),
      source: 'job' as const,
    };
  });

  // Convert Firestore notifications to notification items
  const persistedNotifications: NotificationItem[] = firestoreNotifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    priority: n.priority,
    read: n.read,
    actorName: n.actorName,
    resourceId: n.resourceId,
    resourceType: n.resourceType,
    resourceName: n.resourceName,
    actionUrl: n.actionUrl,
    progress: n.progress,
    createdAt: n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt),
    source: 'firestore' as const,
  }));

  // Combine and sort by date
  const notifications = [...jobNotifications, ...persistedNotifications].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    // Only mark Firestore notifications as read
    if (!id.startsWith('job-')) {
      await markNotificationRead(id);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (user?.uid) {
      await markAllNotificationsRead(user.uid);
    }
  }, [user?.uid]);

  const removeNotification = useCallback(async (id: string) => {
    // Only delete Firestore notifications
    if (!id.startsWith('job-')) {
      await deleteNotification(id);
    }
  }, []);

  const createSystemNotification = useCallback(async (params: {
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    resourceId?: string;
    resourceType?: ActivityResourceType | 'job';
    resourceName?: string;
    actionUrl?: string;
  }) => {
    if (!user?.uid) return;

    await createNotification({
      userId: user.uid,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority || 'normal',
      resourceId: params.resourceId,
      resourceType: params.resourceType,
      resourceName: params.resourceName,
      actionUrl: params.actionUrl,
    });
  }, [user?.uid]);

  return (
    <NotificationCenterContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        removeNotification,
        createSystemNotification,
      }}
    >
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) {
    throw new Error('useNotificationCenter must be used within NotificationCenterProvider');
  }
  return context;
}

