import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Bell, Flame, Zap, X, MessageSquare, Trophy, Star, Target, TrendingUp, ChevronRight, type LucideIcon } from 'lucide-react';
import { DesktopSidebar, type ActivePage } from './DesktopSidebar';
import { GlobalSearchOverlay } from './GlobalSearchOverlay';
import Avatar from '@/components/shared/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { useUserStatsWithFallback } from '@/hooks/useUserStats';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { useEmployeeNotifications, convertToUINotification } from '@/hooks/useEmployeeNotifications';

// Helper to format time ago
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

export interface BreadcrumbItem {
  label: string;
  path?: string; // If provided, this breadcrumb is clickable
  icon?: LucideIcon; // Optional icon for the first breadcrumb
}

interface DesktopLayoutProps {
  activePage: ActivePage;
  children: React.ReactNode;
  title: string;
  breadcrumbs?: BreadcrumbItem[]; // Optional breadcrumb trail (replaces title display)
  showXp?: boolean; // Show XP badge (for Rank page)
  showBackButton?: boolean; // Show back navigation button (deprecated - use breadcrumbs instead)
  rightContent?: React.ReactNode; // Custom content on the right side of badges
  searchValue?: string; // Controlled search value (for inline search)
  onSearchChange?: (value: string) => void; // Callback for inline search
  onAICopilotClick?: () => void;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  activePage,
  children,
  title,
  breadcrumbs,
  showXp = false,
  showBackButton = false,
  rightContent,
  searchValue,
  onSearchChange,
  onAICopilotClick,
}) => {
  // Use inline search if callbacks provided, otherwise use global overlay
  const useInlineSearch = onSearchChange !== undefined;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global search
  const { openSearch, searchQuery, setSearchQuery, isSearchOpen } = useGlobalSearch();

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (useInlineSearch) {
          // Focus the search input for inline search (Learn page)
          searchInputRef.current?.focus();
        } else {
          // Open the global search overlay
          openSearch();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [useInlineSearch, openSearch]);

  // Get enrollments for stats
  const { enrollments } = useUserEnrollmentsRealtime(user?.id || '');
  const { stats: streakStats } = useUserStatsWithFallback(user?.id || '', enrollments);

  // Notifications
  const {
    notifications: rawNotifications,
    markAsRead,
    markAllAsRead,
  } = useEmployeeNotifications(user?.id || '');

  const notifications = useMemo(
    () => rawNotifications.map(convertToUINotification),
    [rawNotifications]
  );

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayedNotifications = notificationFilter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  const handleSearchClick = () => {
    if (!useInlineSearch) {
      openSearch();
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (useInlineSearch) {
      onSearchChange(e.target.value);
    } else {
      setSearchQuery(e.target.value);
      if (!isSearchOpen) {
        openSearch();
      }
    }
  };

  // Determine which search value to display
  const displaySearchValue = useInlineSearch ? (searchValue || '') : searchQuery;

  return (
    <div className="hidden lg:flex h-screen overflow-hidden bg-[#050608]">
      <DesktopSidebar
        activePage={activePage}
        onAICopilotClick={onAICopilotClick}
      />

      {/* Main Area with curved corner */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#050608] rounded-tl-3xl">
        {/* Top Bar */}
        <div className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-white/5">
          {/* Breadcrumb / Title */}
          <div className="flex items-center gap-2 text-sm">
            {breadcrumbs && breadcrumbs.length > 0 ? (
              breadcrumbs.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <div key={item.label} className="flex items-center gap-2">
                    {index > 0 && (
                      <ChevronRight size={14} className="text-white/30" />
                    )}
                    {isLast ? (
                      <span className="flex items-center gap-2 font-semibold text-white">
                        {index === 0 && Icon && <Icon size={18} className="text-white/60" />}
                        {item.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => item.path && navigate(item.path)}
                        className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                      >
                        {index === 0 && Icon && <Icon size={18} />}
                        {item.label}
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <h1 className="text-white font-semibold">{title}</h1>
            )}
          </div>

          <div className="flex-1 max-w-lg mx-8 flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search campaigns..."
                value={displaySearchValue}
                onChange={handleSearchChange}
                onClick={handleSearchClick}
                className="w-full pl-11 pr-16 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10 focus:bg-white/10 transition-all"
              />
              {/* Cmd+K hint */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-white/30 text-xs pointer-events-none">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-sans">⌘</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-sans">K</kbd>
              </div>
            </div>
            {/* Notifications bell */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            >
              <Bell size={20} className="text-white/70" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Custom right content */}
          {rightContent}

          {/* User stats container - clickable to profile */}
          <button
            onClick={() => navigate('/employee/profile')}
            className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-white/5 transition-all"
          >
            {/* Streak indicator */}
            <div className="flex items-center gap-1.5">
              <Flame size={16} className="text-orange-400" />
              <span className="text-orange-300 font-bold text-sm">{streakStats.currentStreak}</span>
            </div>
            {/* Level badge */}
            <span className="text-blue-400 font-bold text-sm">Lv {streakStats.level}</span>
            {/* XP badge - optional */}
            {showXp && (
              <div className="flex items-center gap-1.5">
                <Zap size={16} className="text-purple-400" />
                <span className="text-purple-300 font-bold text-sm">{streakStats.totalXp.toLocaleString()}</span>
              </div>
            )}
            {/* Avatar with circular progress ring */}
            <div className="relative">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="2"
                />
                {/* Progress circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${(streakStats.xpInCurrentLevel / streakStats.xpToNextLevel) * 100.5} 100.5`}
                />
              </svg>
              <div className="absolute inset-1">
                <Avatar
                  src={user?.avatar}
                  name={user?.name}
                  size="sm"
                />
              </div>
            </div>
          </button>
        </div>

        {/* Page Content */}
        {children}
      </div>

      {/* Global Search Overlay */}
      <GlobalSearchOverlay />

      {/* Desktop Notifications Side Panel */}
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
              <div className="flex-1 overflow-y-auto">
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
    </div>
  );
};

export default DesktopLayout;
