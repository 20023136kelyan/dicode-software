'use client';

import { useNotification } from '@/contexts/NotificationContext';
import ToastNotification from './ToastNotification';

export default function ToastContainer() {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <ToastNotification
            notification={notification}
            onRemove={removeNotification}
          />
        </div>
      ))}
    </div>
  );
}
