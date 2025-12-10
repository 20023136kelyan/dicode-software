import React from 'react';
import { Flame } from 'lucide-react';
import { motion } from 'framer-motion';

interface StreakBadgeProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animate?: boolean;
}

const StreakBadge: React.FC<StreakBadgeProps> = ({
  count,
  size = 'md',
  showLabel = false,
  animate = true,
}) => {
  const sizeClasses = {
    sm: 'h-7 px-2 gap-1 text-xs',
    md: 'h-9 px-3 gap-1.5 text-sm',
    lg: 'h-11 px-4 gap-2 text-base',
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  const isActive = count > 0;

  return (
    <motion.div
      className={`inline-flex items-center rounded-pill font-semibold ${sizeClasses[size]} ${
        isActive
          ? 'bg-streak/10 text-streak border border-streak/20'
          : 'bg-light-border/50 text-light-text-muted'
      }`}
      initial={animate ? { scale: 0.9, opacity: 0 } : false}
      animate={animate ? { scale: 1, opacity: 1 } : false}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Flame
        size={iconSizes[size]}
        className={isActive ? 'text-streak' : 'text-light-text-muted'}
        fill={isActive ? 'currentColor' : 'none'}
      />
      <span>{count}</span>
      {showLabel && (
        <span className="text-light-text-secondary font-normal ml-0.5">
          {count === 1 ? 'day' : 'days'}
        </span>
      )}
    </motion.div>
  );
};

export default StreakBadge;
