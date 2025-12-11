import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EmployeeNotification } from '@/types';

const EMPLOYEE_NOTIFICATIONS_COLLECTION = 'employeeNotifications';
const MAX_NOTIFICATIONS = 50; // Limit to latest 50 notifications

export interface UseEmployeeNotificationsReturn {
  notifications: EmployeeNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

/**
 * Real-time hook to fetch employee notifications
 * Listens to the employeeNotifications collection filtered by userId
 */
export function useEmployeeNotifications(userId: string): UseEmployeeNotificationsReturn {
  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to notifications
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const notificationsRef = collection(db, EMPLOYEE_NOTIFICATIONS_COLLECTION);
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(MAX_NOTIFICATIONS)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notificationList: EmployeeNotification[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          notificationList.push({
            id: doc.id,
            userId: data.userId,
            organizationId: data.organizationId,
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority || 'normal',
            read: data.read || false,
            readAt: data.readAt,
            actionUrl: data.actionUrl,
            actionLabel: data.actionLabel,
            resourceType: data.resourceType,
            resourceId: data.resourceId,
            resourceName: data.resourceName,
            metadata: data.metadata,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : data.createdAt,
            expiresAt: data.expiresAt instanceof Timestamp
              ? data.expiresAt.toDate()
              : data.expiresAt,
          });
        });

        setNotifications(notificationList);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error listening to employee notifications:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!notificationId) return;

    try {
      const notificationRef = doc(db, EMPLOYEE_NOTIFICATIONS_COLLECTION, notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId || notifications.length === 0) return;

    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.read);

      unreadNotifications.forEach((notification) => {
        const notificationRef = doc(db, EMPLOYEE_NOTIFICATIONS_COLLECTION, notification.id);
        batch.update(notificationRef, {
          read: true,
          readAt: Timestamp.now(),
        });
      });

      await batch.commit();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  }, [userId, notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
  };
}

/**
 * Convert EmployeeNotification to the UI Notification format
 * Used by NotificationsSheet component
 */
export function convertToUINotification(notification: EmployeeNotification): {
  id: string;
  type: 'achievement' | 'reminder' | 'campaign' | 'streak' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
} {
  // Map EmployeeNotificationType to UI notification type
  let uiType: 'achievement' | 'reminder' | 'campaign' | 'streak' | 'system' = 'system';

  switch (notification.type) {
    case 'badge_earned':
    case 'level_up':
    case 'skill_mastered':
      uiType = 'achievement';
      break;
    case 'campaign_reminder':
      uiType = 'reminder';
      break;
    case 'campaign_completed':
    case 'new_campaign':
      uiType = 'campaign';
      break;
    case 'streak_milestone':
    case 'streak_at_risk':
    case 'streak_broken':
      uiType = 'streak';
      break;
    case 'welcome':
    case 'system':
    default:
      uiType = 'system';
      break;
  }

  // Determine action URL if not provided
  let actionUrl = notification.actionUrl;

  if (!actionUrl) {
    switch (notification.type) {
      case 'badge_earned':
      case 'level_up':
      case 'skill_mastered':
        actionUrl = '/employee/badges';
        break;
      case 'new_campaign':
      case 'campaign_reminder':
      case 'campaign_completed':
        if (notification.resourceId) {
          actionUrl = `/employee/campaign/${notification.resourceId}`;
        } else {
          actionUrl = '/employee/learn';
        }
        break;
      case 'streak_milestone':
      case 'streak_at_risk':
      case 'streak_broken':
        actionUrl = '/employee/profile';
        break;
      default:
        // Keep undefined or set default
        break;
    }
  }

  return {
    id: notification.id,
    type: uiType,
    title: notification.title,
    message: notification.message,
    timestamp: notification.createdAt instanceof Date
      ? notification.createdAt
      : new Date(notification.createdAt as string | number),
    read: notification.read,
    actionUrl,
  };
}

