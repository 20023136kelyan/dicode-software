
import React, { useRef, useEffect } from 'react';
import {
    Bell,
    Check,
    AlertTriangle,
    UserPlus,
    Megaphone,
    Info,
    ExternalLink,
    ShieldAlert
} from 'lucide-react';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { useNavigate } from 'react-router-dom';
import type { AdminNotification, AdminNotificationType } from '@/types';

interface NotificationsPopoverProps {
    onClose: () => void;
}

const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
};

const getIcon = (type: AdminNotificationType) => {
    switch (type) {
        case 'system_alert': return <AlertTriangle className="text-red-400" size={16} />;
        case 'user_joined': return <UserPlus className="text-emerald-400" size={16} />;
        case 'campaign_status': return <Megaphone className="text-purple-400" size={16} />;
        case 'license_limit': return <ShieldAlert className="text-orange-400" size={16} />;
        default: return <Info className="text-blue-400" size={16} />;
    }
};

const getBgColor = (type: AdminNotificationType) => {
    switch (type) {
        case 'system_alert': return 'bg-red-500/10';
        case 'user_joined': return 'bg-emerald-500/10';
        case 'campaign_status': return 'bg-purple-500/10';
        case 'license_limit': return 'bg-orange-500/10';
        default: return 'bg-blue-500/10';
    }
};

const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({ onClose }) => {
    const { notifications, loading, markAsRead, markAllAsRead } = useAdminNotifications();
    const navigate = useNavigate();
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleNotificationClick = (notification: AdminNotification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        if (notification.link) {
            navigate(notification.link);
            onClose();
        }
    };

    return (
        <div
            ref={popoverRef}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-white/10 bg-[#1A1A1A] shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
        >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-semibold text-white">Notifications</h3>
                {notifications.some(n => !n.read) && (
                    <button
                        onClick={() => markAllAsRead()}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                        <Check size={12} /> Mark all read
                    </button>
                )}
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="p-8 text-center text-white/40 text-sm">Loading...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                            <Bell className="text-white/20" size={20} />
                        </div>
                        <p className="text-white/40 text-sm">No notifications yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`p-4 hover:bg-white/5 transition-colors cursor-pointer relative group ${!notification.read ? 'bg-white/[0.02]' : ''
                                    }`}
                            >
                                {!notification.read && (
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500" />
                                )}

                                <div className="flex gap-3">
                                    <div className={`mt-0.5 w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${getBgColor(notification.type)}`}>
                                        {getIcon(notification.type)}
                                    </div>

                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm font-medium ${!notification.read ? 'text-white' : 'text-white/60'}`}>
                                                {notification.title}
                                            </p>
                                            <span className="text-[10px] text-white/30 whitespace-nowrap">
                                                {notification.createdAt
                                                    ? getRelativeTime(notification.createdAt)
                                                    : 'Just now'}
                                            </span>
                                        </div>

                                        <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
                                            {notification.message}
                                        </p>

                                        {notification.link && (
                                            <div className="flex items-center gap-1 text-[10px] text-blue-400 font-medium mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                View Details <ExternalLink size={10} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPopover;
