import React from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Star, Crown, Gift } from 'lucide-react';

export type PathNodeStatus = 'completed' | 'current' | 'locked' | 'reward';

interface PathNodeProps {
  status: PathNodeStatus;
  title: string;
  subtitle?: string;
  progress?: number; // 0-100 for current node
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const PathNode: React.FC<PathNodeProps> = ({
  status,
  title,
  subtitle,
  progress = 0,
  onClick,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-14 h-14',
    md: 'w-18 h-18',
    lg: 'w-22 h-22',
  };

  const iconSizes = {
    sm: 20,
    md: 26,
    lg: 32,
  };

  const getNodeStyles = () => {
    switch (status) {
      case 'completed':
        return 'bg-success border-success/30 shadow-success/20';
      case 'current':
        return 'bg-primary border-primary/30 shadow-primary/30 ring-4 ring-primary/20';
      case 'reward':
        return 'bg-streak border-streak/30 shadow-streak/20';
      case 'locked':
      default:
        return 'bg-light-border/50 border-light-border shadow-none';
    }
  };

  const getIcon = () => {
    const iconSize = iconSizes[size];
    switch (status) {
      case 'completed':
        return <Check size={iconSize} className="text-white" strokeWidth={3} />;
      case 'current':
        return <Star size={iconSize} className="text-white" fill="currentColor" />;
      case 'reward':
        return <Gift size={iconSize} className="text-white" />;
      case 'locked':
      default:
        return <Lock size={iconSize} className="text-light-text-muted" />;
    }
  };

  const isInteractive = status !== 'locked';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <motion.button
        onClick={isInteractive ? onClick : undefined}
        className={`
          ${sizeClasses[size]}
          rounded-full border-2
          flex items-center justify-center
          shadow-lg
          ${getNodeStyles()}
          ${isInteractive ? 'cursor-pointer' : 'cursor-not-allowed'}
          transition-all duration-200
          relative overflow-hidden
        `}
        whileHover={isInteractive ? { scale: 1.05 } : undefined}
        whileTap={isInteractive ? { scale: 0.95 } : undefined}
        animate={status === 'current' ? { scale: [1, 1.03, 1] } : undefined}
        transition={status === 'current' ? { repeat: Infinity, duration: 2 } : undefined}
        disabled={!isInteractive}
      >
        {/* Progress ring for current node */}
        {status === 'current' && progress > 0 && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.89} 289`}
            />
          </svg>
        )}
        {getIcon()}
      </motion.button>

      {/* Title */}
      <p
        className={`
          mt-2 text-center font-medium max-w-[100px]
          ${status === 'locked' ? 'text-light-text-muted' : 'text-light-text'}
          ${size === 'sm' ? 'text-xs' : 'text-sm'}
        `}
      >
        {title}
      </p>

      {/* Subtitle / Progress text */}
      {subtitle && (
        <p className="text-xs text-light-text-muted text-center mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default PathNode;
