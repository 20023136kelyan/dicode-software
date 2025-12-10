import React from 'react';
import { motion } from 'framer-motion';

interface XPBarProps {
  currentXP: number;
  xpToNextLevel: number;
  level: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const XPBar: React.FC<XPBarProps> = ({
  currentXP,
  xpToNextLevel,
  level,
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const progress = xpToNextLevel > 0 ? (currentXP / xpToNextLevel) * 100 : 0;

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-light-text-secondary">Level {level}</span>
          <span className="text-light-text-muted">
            {currentXP}/{xpToNextLevel} XP
          </span>
        </div>
      )}
      <div className={`w-full bg-light-border rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

export default XPBar;
