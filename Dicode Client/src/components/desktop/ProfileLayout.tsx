import React, { ReactNode, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    Bell,
    FileText,
    LogOut,
    MessageCircle,
    Shield,
    User,
    Bot,
    X,
    Trophy,
    Target,
    TrendingUp,
    Star,
    MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import AICopilot from '@/components/shared/AICopilot';
import { DesktopSidebar, DesktopHeader } from '@/components/desktop';
import { useEmployeeNotifications, convertToUINotification } from '@/hooks/useEmployeeNotifications';

interface ProfileLayoutProps {
    children: ReactNode;
    title?: string;
    onSectionClick?: (section: string) => void;
    activeSection?: string;
}

const ACCOUNT_NAV_ITEMS = [
    { label: 'Edit profile', id: 'edit-profile', icon: User, path: '/employee/edit-profile' },
    { label: 'Security', id: 'security', icon: Shield, path: '/employee/security' },
    { label: 'Notifications', id: 'notifications', icon: Bell, path: '/employee/notifications' },
];

const SUPPORT_NAV_ITEMS = [
    { label: 'Help Center', id: 'help', icon: MessageCircle, path: '/employee/help' },
    { label: 'Privacy Policy', id: 'privacy', icon: FileText, path: '/employee/privacy' },
];

// Helper to format time ago (duplicated for now to keep layout self-contained or move to utils later)
const formatTimeAgo = (date: Date): string => {
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

const ProfileLayout: React.FC<ProfileLayoutProps> = ({ children, onSectionClick, activeSection }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    // UI State
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');

    // Notifications Data
    const {
        notifications: rawNotifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
    } = useEmployeeNotifications(user?.id || '');

    const notifications = useMemo(() =>
        rawNotifications.map(convertToUINotification),
        [rawNotifications]
    );

    const displayedNotifications = notificationFilter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleBackClick = () => {
        navigate(-1);
    };

    const handleNavClick = (item: typeof ACCOUNT_NAV_ITEMS[0]) => {
        if (onSectionClick && item.path.includes('employee/')) {
            if (['edit-profile', 'security', 'notifications'].includes(item.id)) {
                onSectionClick(item.id);
                return;
            }
        }
        navigate(item.path);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
            {/* Global Sidebar (Desktop) */}
            <div className="hidden lg:block">
                <DesktopSidebar
                    activePage="profile"
                    onAICopilotClick={() => setIsCopilotOpen(true)}
                    isExpanded={isSidebarExpanded}
                    onToggleExpand={setIsSidebarExpanded}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#050608] lg:rounded-tl-3xl border-l border-white/5 relative">

                {/* Global Header */}
                <DesktopHeader
                    onNotificationClick={() => setIsNotificationsOpen(true)}
                />

                {/* Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Container */}
                    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">

                        {/* Profile Header / Back Button Area */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handleBackClick}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:border-white/30 hover:bg-white/10"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                        </div>

                        {/* Desktop Layout Split */}
                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Profile Sidebar */}
                            <aside className="hidden lg:block w-64 space-y-4 shrink-0">
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Account</p>
                                        <div className="mt-3 space-y-1">
                                            {ACCOUNT_NAV_ITEMS.map((item) => {
                                                const isActive = activeSection === item.id || location.pathname === item.path;
                                                return (
                                                    <button
                                                        key={item.label}
                                                        onClick={() => handleNavClick(item)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608] ${isActive
                                                            ? 'bg-white/10 text-white'
                                                            : 'text-white/60 hover:text-white hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <item.icon size={16} />
                                                        <span>{item.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="border-t border-white/10 pt-4 space-y-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Support</p>
                                            <div className="mt-3 space-y-1">
                                                {SUPPORT_NAV_ITEMS.map((item) => {
                                                    const isActive = location.pathname === item.path;
                                                    return (
                                                        <button
                                                            key={item.label}
                                                            onClick={() => navigate(item.path)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608] ${isActive
                                                                ? 'bg-white/10 text-white'
                                                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                                                }`}
                                                        >
                                                            <item.icon size={16} />
                                                            <span>{item.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setIsCopilotOpen(true)}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 shadow-sm transition hover:bg-blue-500/20"
                                        >
                                            <Bot size={16} />
                                            AI Copilot
                                        </button>

                                        <button
                                            onClick={handleLogout}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
                                        >
                                            <LogOut size={16} />
                                            Log out
                                        </button>
                                    </div>
                                </div>
                            </aside>

                            {/* Divider */}
                            <div className="hidden lg:block w-px bg-white/5 rounded-full self-stretch" />

                            {/* Main Content Area */}
                            <main className="flex-1 min-w-0">
                                {children}
                            </main>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notifications Side Panel */}
            <AnimatePresence>
                {isNotificationsOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsNotificationsOpen(false)}
                            className="fixed inset-0 bg-black/50 z-40"
                        />
                        {/* Side Panel */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed right-0 top-0 h-full w-[420px] bg-[#141414] border-l border-white/10 z-50 flex flex-col"
                        >
                            {/* Header */}
                            <div className="px-6 pt-6 pb-4">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-2xl font-bold text-white">Notifications</h2>
                                    <div className="flex items-center gap-3">
                                        {notifications.some(n => !n.read) && (
                                            <button
                                                onClick={markAllAsRead}
                                                className="text-sm text-white/60 hover:text-white underline underline-offset-2 transition-colors"
                                            >
                                                Mark all as read
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setIsNotificationsOpen(false)}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                        >
                                            <X size={20} className="text-white/50" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setNotificationFilter('all')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${notificationFilter === 'all'
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:bg-white/5'
                                            }`}
                                    >
                                        All
                                        {notifications.length > 0 && (
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${notificationFilter === 'all' ? 'bg-white/20' : 'bg-white/10'
                                                }`}>
                                                {notifications.length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setNotificationFilter('unread')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${notificationFilter === 'unread'
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:bg-white/5'
                                            }`}
                                    >
                                        Unread
                                        {unreadCount > 0 && (
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${notificationFilter === 'unread' ? 'bg-white/20' : 'bg-white/10'
                                                }`}>
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Notifications List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {displayedNotifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-white/40">
                                        <Bell size={48} className="mb-3 opacity-50" />
                                        <p>{notificationFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
                                    </div>
                                ) : (
                                    <div>
                                        {displayedNotifications.map((notification) => (
                                            <button
                                                key={notification.id}
                                                onClick={() => {
                                                    markAsRead(notification.id);
                                                    setIsNotificationsOpen(false);
                                                }}
                                                className={`w-full px-6 py-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 ${!notification.read ? 'bg-blue-500/5' : ''
                                                    }`}
                                            >
                                                <div className="flex gap-3">
                                                    {/* Icon/Avatar */}
                                                    <div className="relative flex-shrink-0">
                                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${notification.type === 'achievement' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                                                            notification.type === 'reminder' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                                                                notification.type === 'streak' ? 'bg-gradient-to-br from-orange-400 to-red-500' :
                                                                    notification.type === 'campaign' ? 'bg-gradient-to-br from-purple-400 to-purple-600' :
                                                                        'bg-gradient-to-br from-gray-400 to-gray-600'
                                                            }`}>
                                                            {notification.type === 'achievement' ? <Trophy size={20} className="text-white" /> :
                                                                notification.type === 'reminder' ? <Target size={20} className="text-white" /> :
                                                                    notification.type === 'streak' ? <TrendingUp size={20} className="text-white" /> :
                                                                        notification.type === 'campaign' ? <Star size={20} className="text-white" /> :
                                                                            <MessageSquare size={20} className="text-white" />}
                                                        </div>
                                                        {!notification.read && (
                                                            <div className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#141414]" />
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[15px] text-white leading-snug">
                                                            <span className="font-semibold">{notification.title}</span>
                                                        </p>
                                                        <p className="text-[15px] text-white/70 mt-0.5 line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                        <p className="text-sm text-white/40 mt-1.5">
                                                            {formatTimeAgo(notification.timestamp)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {isCopilotOpen && (
                <AICopilot
                    isOpen={isCopilotOpen}
                    onClose={() => setIsCopilotOpen(false)}
                    context={{ userRole: 'employee' }}
                />
            )}
        </div>
    );
};

export default ProfileLayout;
