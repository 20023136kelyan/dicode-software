import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Flame } from 'lucide-react';
import { getTierColor } from '@/hooks/useLeaderboard';

interface PodiumUser {
  userId: string;
  name: string;
  avatar?: string;
  totalXp: number;
  level: number;
  levelTitle: string;
  levelTier: 'newcomer' | 'learner' | 'achiever' | 'expert' | 'master';
  rank: number;
  currentStreak?: number;
}

interface LeaderboardPodiumProps {
  users: PodiumUser[];
  currentUserId?: string;
  className?: string;
}

const LeaderboardPodium: React.FC<LeaderboardPodiumProps> = ({
  users,
  currentUserId,
  className = '',
}) => {
  // Ensure we have top 3, pad with empty if needed
  const topThree = [...users.slice(0, 3)];
  while (topThree.length < 3) {
    topThree.push({
      userId: `empty-${topThree.length}`,
      name: '---',
      totalXp: 0,
      level: 1,
      levelTitle: 'Newcomer',
      levelTier: 'newcomer',
      rank: topThree.length + 1,
    });
  }

  // Reorder for podium display: 2nd, 1st, 3rd
  const podiumOrder = [topThree[1], topThree[0], topThree[2]];

  const getRankColors = (rank: number) => {
    if (rank === 1) return { medal: 'text-yellow-500', bg: 'from-yellow-400 to-yellow-500', border: 'border-yellow-500' };
    if (rank === 2) return { medal: 'text-gray-400', bg: 'from-gray-300 to-gray-400', border: 'border-gray-400' };
    return { medal: 'text-amber-600', bg: 'from-amber-500 to-amber-600', border: 'border-amber-600' };
  };

  const getBarHeight = (rank: number) => {
    if (rank === 1) return 'h-28';
    if (rank === 2) return 'h-20';
    return 'h-16';
  };

  const getBarHeightPx = (rank: number) => {
    if (rank === 1) return 112;
    if (rank === 2) return 80;
    return 64;
  };

  const getBarDelay = (rank: number) => {
    if (rank === 1) return 0.2;
    if (rank === 2) return 0.1;
    return 0.3;
  };

  return (
    <div className={`flex items-end justify-center gap-2 pt-8 ${className}`}>
      {podiumOrder.map((user) => {
        const isCurrentUser = user.userId === currentUserId;
        const actualRank = user.rank;
        const colors = getRankColors(actualRank);
        const tierColors = getTierColor(user.levelTier);

        return (
          <motion.div
            key={user.userId}
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: getBarDelay(actualRank), duration: 0.4 }}
          >
            {/* Avatar */}
            <div className="relative mb-2">
              <div
                className={`
                  w-14 h-14 rounded-full border-3 flex items-center justify-center
                  ${colors.border} bg-light-card
                  ${isCurrentUser ? 'ring-2 ring-primary ring-offset-2 ring-offset-light-bg' : ''}
                `}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-light-text">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {/* Crown for #1 */}
              {actualRank === 1 && (
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2"
                >
                  <Crown size={24} className="text-yellow-500" fill="currentColor" />
                </motion.div>
              )}
              {/* Streak badge */}
              {user.currentStreak && user.currentStreak > 0 && (
                <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  <Flame size={10} />
                  {user.currentStreak}
                </div>
              )}
            </div>

            {/* Name */}
            <p className={`text-xs font-semibold text-center max-w-[72px] truncate
              ${isCurrentUser ? 'text-primary' : 'text-light-text'}`}>
              {isCurrentUser ? 'You' : user.name.split(' ')[0]}
            </p>

            {/* Level Badge */}
            <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-0.5 ${tierColors.bg} ${tierColors.text}`}>
              Lv.{user.level}
            </div>

            {/* XP */}
            <p className="text-xs text-light-text-muted mt-1 mb-2">
              {user.totalXp.toLocaleString()} XP
            </p>

            {/* Podium bar */}
            <motion.div
              className={`
                w-20 ${getBarHeight(actualRank)} rounded-t-2xl
                flex items-start justify-center pt-3
                bg-gradient-to-b ${colors.bg}
                shadow-lg
              `}
              initial={{ height: 0 }}
              animate={{ height: getBarHeightPx(actualRank) }}
              transition={{ delay: getBarDelay(actualRank), duration: 0.5, ease: 'easeOut' }}
            >
              <span className="text-white font-bold text-xl drop-shadow-sm">
                {actualRank}
              </span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default LeaderboardPodium;
