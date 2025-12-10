import React from 'react';
import { motion } from 'framer-motion';
import { Medal, Flame, ChevronRight } from 'lucide-react';
import { getTierColor } from '@/hooks/useLeaderboard';

interface LeaderboardRowProps {
  rank: number;
  name: string;
  avatar?: string;
  totalXp: number;
  level: number;
  levelTier: 'newcomer' | 'learner' | 'achiever' | 'expert' | 'master';
  currentStreak?: number;
  isCurrentUser?: boolean;
  onClick?: () => void;
  className?: string;
}

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({
  rank,
  name,
  avatar,
  totalXp,
  level,
  levelTier,
  currentStreak = 0,
  isCurrentUser = false,
  onClick,
  className = '',
}) => {
  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-amber-600';
    return 'text-light-text-muted';
  };

  const tierColors = getTierColor(levelTier);

  return (
    <motion.button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3 rounded-2xl
        ${isCurrentUser
          ? 'bg-primary/10 border-2 border-primary/30'
          : 'bg-light-card border border-light-border hover:bg-light-border/30'}
        transition-colors duration-200
        ${className}
      `}
      whileTap={{ scale: 0.98 }}
    >
      {/* Rank */}
      <div className={`w-8 text-center flex-shrink-0 ${getMedalColor(rank)}`}>
        {rank <= 3 ? (
          <Medal size={22} className="mx-auto" fill="currentColor" />
        ) : (
          <span className="font-bold text-lg">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`
          w-11 h-11 rounded-full flex items-center justify-center
          ${isCurrentUser ? 'bg-primary/20 border-2 border-primary' : 'bg-light-border border-2 border-transparent'}
        `}>
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className={`font-bold text-sm ${isCurrentUser ? 'text-primary' : 'text-light-text'}`}>
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {/* Streak indicator */}
        {currentStreak > 0 && (
          <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-orange-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full">
            <Flame size={8} />
            {currentStreak}
          </div>
        )}
      </div>

      {/* Name & Level */}
      <div className="flex-1 text-left min-w-0">
        <p className={`font-semibold truncate ${isCurrentUser ? 'text-primary' : 'text-light-text'}`}>
          {isCurrentUser ? 'You' : name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierColors.bg} ${tierColors.text}`}>
            Lv.{level}
          </span>
        </div>
      </div>

      {/* XP */}
      <div className="text-right flex-shrink-0">
        <p className={`font-bold ${isCurrentUser ? 'text-primary' : 'text-light-text'}`}>
          {totalXp.toLocaleString()}
        </p>
        <p className="text-xs text-light-text-muted">XP</p>
      </div>

      {/* Arrow */}
      {onClick && (
        <ChevronRight size={18} className="text-light-text-muted flex-shrink-0" />
      )}
    </motion.button>
  );
};

export default LeaderboardRow;
