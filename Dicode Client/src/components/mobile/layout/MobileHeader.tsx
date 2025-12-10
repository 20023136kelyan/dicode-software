import React from 'react';
import { Bell, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StreakBadge from '../gamification/StreakBadge';

interface MobileHeaderProps {
  streak?: number;
  showNotifications?: boolean;
  showSettings?: boolean;
  onNotificationClick?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  streak = 0,
  showNotifications = true,
  showSettings = false,
  onNotificationClick,
}) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 lg:hidden">
      {/* Background with blur */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-xl border-b border-light-border" />
      
      <div className="relative flex items-center justify-between h-14 px-4">
        {/* Left: Streak Badge */}
        <StreakBadge count={streak} />

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {showNotifications && (
            <button
              onClick={onNotificationClick}
              className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-light-bg transition-colors"
            >
              <Bell size={20} className="text-light-text-secondary" strokeWidth={1.8} />
            </button>
          )}
          {showSettings && (
            <button
              onClick={() => navigate('/employee/settings')}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-light-bg transition-colors"
            >
              <Settings size={20} className="text-light-text-secondary" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
