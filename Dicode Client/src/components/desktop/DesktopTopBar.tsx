import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, User, Flame } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { useUserStatsWithFallback } from '@/hooks/useUserStats';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { useEmployeeNotifications, convertToUINotification } from '@/hooks/useEmployeeNotifications';

interface DesktopTopBarProps {
  title: string;
  onNotificationsClick: () => void;
  unreadNotificationCount: number;
}

export const DesktopTopBar: React.FC<DesktopTopBarProps> = ({
  title,
  onNotificationsClick,
  unreadNotificationCount,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openSearch, searchQuery, setSearchQuery, isSearchOpen } = useGlobalSearch();

  // Get enrollments for stats
  const { enrollments } = useUserEnrollmentsRealtime(user?.id || '');
  const { stats: streakStats } = useUserStatsWithFallback(user?.id || '', enrollments);

  const handleSearchClick = () => {
    openSearch();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!isSearchOpen) {
      openSearch();
    }
  };

  return (
    <div className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-white/5">
      <div className="flex items-center gap-4">
        <img src="/dicode_logo.png" alt="DiCode" className="h-8 w-auto" />
        <div className="h-5 w-px bg-white/10"></div>
        <h1 className="text-white font-semibold">{title}</h1>
      </div>

      <div className="flex-1 max-w-lg mx-8">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={handleSearchChange}
            onClick={handleSearchClick}
            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10 focus:bg-white/10 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Streak indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
          <Flame size={16} className="text-orange-400" />
          <span className="text-orange-300 font-bold text-sm">{streakStats.currentStreak}</span>
        </div>
        {/* Level badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
          <span className="text-blue-400 font-bold text-sm">Lv {streakStats.level}</span>
        </div>
        {/* Notifications bell */}
        <button
          onClick={onNotificationsClick}
          className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Bell size={20} className="text-white/70" />
          {unreadNotificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate('/employee/profile')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <User size={20} className="text-white/70" />
        </button>
      </div>
    </div>
  );
};

export default DesktopTopBar;
