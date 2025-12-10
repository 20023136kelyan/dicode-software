import React from 'react';
import { motion } from 'framer-motion';
import { Play, Check, Lock, Clock, ChevronRight } from 'lucide-react';

export type ModuleStatus = 'completed' | 'current' | 'available' | 'locked';

interface ModuleListItemProps {
  index: number;
  title: string;
  duration?: string;
  status: ModuleStatus;
  progress?: number;
  onClick?: () => void;
  className?: string;
}

const ModuleListItem: React.FC<ModuleListItemProps> = ({
  index,
  title,
  duration,
  status,
  progress = 0,
  onClick,
  className = '',
}) => {
  const isInteractive = status !== 'locked';

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center">
            <Check size={16} className="text-white" strokeWidth={3} />
          </div>
        );
      case 'current':
        return (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center relative">
            {/* Progress ring */}
            {progress > 0 && (
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 0.88} 88`}
                />
              </svg>
            )}
            <Play size={14} className="text-white ml-0.5" fill="currentColor" />
          </div>
        );
      case 'available':
        return (
          <div className="w-8 h-8 rounded-full bg-light-border flex items-center justify-center">
            <span className="text-sm font-medium text-light-text-muted">{index}</span>
          </div>
        );
      case 'locked':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-light-border/50 flex items-center justify-center">
            <Lock size={14} className="text-light-text-muted" />
          </div>
        );
    }
  };

  return (
    <motion.button
      onClick={isInteractive ? onClick : undefined}
      className={`
        w-full flex items-center gap-3 p-3
        bg-light-card rounded-xl border border-light-border
        ${isInteractive ? 'cursor-pointer active:bg-light-border/30' : 'cursor-not-allowed opacity-60'}
        transition-colors duration-200
        ${status === 'current' ? 'border-primary/30 bg-primary/5' : ''}
        ${className}
      `}
      whileTap={isInteractive ? { scale: 0.98 } : undefined}
      disabled={!isInteractive}
    >
      {/* Status Icon */}
      {getStatusIcon()}

      {/* Content */}
      <div className="flex-1 text-left">
        <p
          className={`
            font-medium text-sm
            ${status === 'locked' ? 'text-light-text-muted' : 'text-light-text'}
          `}
        >
          {title}
        </p>
        {duration && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock size={12} className="text-light-text-muted" />
            <span className="text-xs text-light-text-muted">{duration}</span>
          </div>
        )}
      </div>

      {/* Chevron */}
      {isInteractive && (
        <ChevronRight size={18} className="text-light-text-muted" />
      )}
    </motion.button>
  );
};

export default ModuleListItem;
