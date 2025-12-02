'use client';

import { useEffect } from 'react';
import { Notification } from '@/contexts/NotificationContext';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface ToastNotificationProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

export default function ToastNotification({
  notification,
  onRemove,
}: ToastNotificationProps) {
  const { id, type, title, message } = notification;

  const icons = {
    success: <CheckCircleIcon className="w-6 h-6 text-emerald-500" />,
    error: <XCircleIcon className="w-6 h-6 text-red-500" />,
    warning: <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />,
    info: <InformationCircleIcon className="w-6 h-6 text-sky-500" />,
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-sky-50 border-sky-200',
  };

  const textColors = {
    success: 'text-emerald-900',
    error: 'text-red-900',
    warning: 'text-amber-900',
    info: 'text-sky-900',
  };

  return (
    <div
      className={`${bgColors[type]} border rounded-xl p-4 shadow-lg animate-fadeIn min-w-[320px] max-w-md`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">{icons[type]}</div>
        <div className="flex-1">
          <h4 className={`text-sm font-semibold ${textColors[type]} mb-1`}>
            {title}
          </h4>
          {message && (
            <p className={`text-sm ${textColors[type]} opacity-80`}>{message}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(id)}
          className={`flex-shrink-0 ${textColors[type]} opacity-60 hover:opacity-100 transition-opacity`}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
