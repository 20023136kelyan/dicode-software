import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or icon name
  earned: boolean;
  earnedAt?: Date | string;
  progress?: number; // 0-100 for partially earned
  requirement?: string;
}

interface BadgeGridProps {
  badges: Badge[];
  onBadgeClick?: (badge: Badge) => void;
  columns?: 4 | 5 | 6;
  showNames?: boolean;
  className?: string;
}

const BadgeGrid: React.FC<BadgeGridProps> = ({
  badges,
  onBadgeClick,
  columns = 5,
  showNames = false,
  className = '',
}) => {
  const gridCols = {
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-3 ${className}`}>
      {badges.map((badge, index) => (
        <motion.button
          key={badge.id}
          onClick={() => onBadgeClick?.(badge)}
          className={`
            flex flex-col items-center
            ${badge.earned ? 'opacity-100' : 'opacity-40'}
          `}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: badge.earned ? 1 : 0.4, scale: 1 }}
          transition={{ delay: index * 0.03 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Badge Icon */}
          <div
            className={`
              w-14 h-14 rounded-xl
              flex items-center justify-center
              ${badge.earned
                ? 'bg-gradient-to-br from-accent/20 to-primary/20 border-2 border-accent/30'
                : 'bg-light-border/50 border-2 border-light-border'
              }
              relative overflow-hidden
            `}
          >
            {badge.earned ? (
              <span className="text-2xl">{badge.icon}</span>
            ) : (
              <Lock size={20} className="text-light-text-muted" />
            )}

            {/* Progress ring for partially earned */}
            {!badge.earned && badge.progress !== undefined && badge.progress > 0 && (
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 56 56"
              >
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="rgba(99, 102, 241, 0.3)"
                  strokeWidth="3"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="rgb(99, 102, 241)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${badge.progress * 1.508} 150.8`}
                />
              </svg>
            )}
          </div>

          {/* Badge Name */}
          {showNames && (
            <p className={`
              mt-1 text-xs text-center max-w-[60px] truncate
              ${badge.earned ? 'text-light-text' : 'text-light-text-muted'}
            `}>
              {badge.name}
            </p>
          )}
        </motion.button>
      ))}
    </div>
  );
};

export default BadgeGrid;
