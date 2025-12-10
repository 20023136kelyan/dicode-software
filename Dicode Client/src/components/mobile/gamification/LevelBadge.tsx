import React from 'react';
import { motion } from 'framer-motion';

interface LevelBadgeProps {
  level: number;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  showTitle?: boolean;
  className?: string;
}

const getLevelTitle = (level: number): string => {
  if (level <= 5) return 'Beginner';
  if (level <= 15) return 'Learner';
  if (level <= 30) return 'Practitioner';
  if (level <= 50) return 'Expert';
  return 'Master';
};

const getLevelColor = (level: number): string => {
  if (level <= 5) return 'from-slate-400 to-slate-500';
  if (level <= 15) return 'from-emerald-400 to-emerald-500';
  if (level <= 30) return 'from-blue-400 to-blue-500';
  if (level <= 50) return 'from-purple-400 to-purple-500';
  return 'from-amber-400 to-amber-500';
};

const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  title,
  size = 'md',
  showTitle = true,
  className = '',
}) => {
  const levelTitle = title || getLevelTitle(level);
  const gradientColor = getLevelColor(level);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-xl',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.div
        className={`rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center font-bold text-white shadow-lg ${sizeClasses[size]}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {level}
      </motion.div>
      {showTitle && (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-light-text">Level {level}</span>
          <span className="text-xs text-light-text-secondary">{levelTitle}</span>
        </div>
      )}
    </div>
  );
};

export default LevelBadge;
