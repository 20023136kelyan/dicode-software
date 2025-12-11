import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Flame } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { useEmployeeNotifications } from '@/hooks/useEmployeeNotifications';
import { useUserStatsRealtime, useUserStatsWithFallback } from '@/hooks/useUserStats';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import Avatar from '@/components/shared/Avatar';

interface DesktopHeaderProps {
    onNotificationClick?: () => void;
}

const DesktopHeader: React.FC<DesktopHeaderProps> = ({ onNotificationClick }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { openSearch } = useGlobalSearch();
    const [searchQuery, setSearchQuery] = useState('');

    // Notifications
    const { unreadCount } = useEmployeeNotifications(user?.id || '');

    // User Stats
    // Using the same hooks as Home.tsx to ensure consistent data
    const { enrollments } = useUserEnrollmentsRealtime(user?.id || '');
    // Calculate specific stats if needed, or use the wrapper that handles fallback
    // For the header we primarily need level, streak, xp, xpToNextLevel
    // useUserStatsWithFallback returns { stats, loading, error }
    const { stats: streakStats } = useUserStatsWithFallback(user?.id || '', enrollments);

    // Helper to calculate XP progress for the ring
    const xpProgress = useMemo(() => {
        if (!streakStats.xpToNextLevel) return 0;
        return Math.min(100, (streakStats.xpInCurrentLevel / streakStats.xpToNextLevel) * 100);
    }, [streakStats.xpInCurrentLevel, streakStats.xpToNextLevel]);

    return (
        <div className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-[#050608]/80 backdrop-blur-xl border-b border-white/5 z-20 sticky top-0">
            <div className="flex items-center gap-4">
                {/* Placeholder for potential left-side content or breadcrumbs */}
            </div>

            <div className="flex-1 max-w-lg mx-8 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onClick={openSearch}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-16 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10 focus:bg-white/10 transition-all cursor-pointer"
                        readOnly // Make readOnly since it triggers the modal
                    />
                    {/* Cmd+K hint */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-white/30 text-xs pointer-events-none">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-sans">⌘</kbd>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-sans">K</kbd>
                    </div>
                </div>

                {/* Notifications bell */}
                <button
                    onClick={onNotificationClick}
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
                            strokeDasharray={`${Math.min(100.5, xpProgress * 1.005)} 100.5`}
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
    );
};

export default DesktopHeader;
