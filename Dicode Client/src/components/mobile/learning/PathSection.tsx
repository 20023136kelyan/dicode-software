import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Lock, CheckCircle } from 'lucide-react';

interface PathSectionProps {
  title: string;
  subtitle?: string;
  progress: number; // 0-100
  totalModules: number;
  completedModules: number;
  isLocked?: boolean;
  unlockRequirement?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

const PathSection: React.FC<PathSectionProps> = ({
  title,
  subtitle,
  progress,
  totalModules,
  completedModules,
  isLocked = false,
  unlockRequirement,
  children,
  defaultExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isComplete = completedModules >= totalModules;

  return (
    <div className={`${className}`}>
      {/* Section Header */}
      <motion.button
        onClick={() => !isLocked && setIsExpanded(!isExpanded)}
        className={`
          w-full flex items-center gap-3 p-4
          bg-light-card rounded-xl border border-light-border
          ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        `}
        whileTap={!isLocked ? { scale: 0.98 } : undefined}
      >
        {/* Status Icon */}
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
            ${isComplete ? 'bg-success/10' : isLocked ? 'bg-light-border/50' : 'bg-primary/10'}
          `}
        >
          {isLocked ? (
            <Lock size={20} className="text-light-text-muted" />
          ) : isComplete ? (
            <CheckCircle size={20} className="text-success" />
          ) : (
            <span className="text-primary font-bold text-sm">
              {Math.round(progress)}%
            </span>
          )}
        </div>

        {/* Title & Progress */}
        <div className="flex-1 text-left">
          <h3 className={`font-semibold ${isLocked ? 'text-light-text-muted' : 'text-light-text'}`}>
            {title}
          </h3>
          {isLocked ? (
            <p className="text-xs text-light-text-muted">
              {unlockRequirement || 'Complete previous section to unlock'}
            </p>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-light-border rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${isComplete ? 'bg-success' : 'bg-primary'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <span className="text-xs text-light-text-muted">
                {completedModules}/{totalModules}
              </span>
            </div>
          )}
        </div>

        {/* Expand Icon */}
        {!isLocked && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={20} className="text-light-text-muted" />
          </motion.div>
        )}
      </motion.button>

      {/* Section Content */}
      <AnimatePresence>
        {isExpanded && !isLocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-6 pb-4 flex flex-col items-center">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PathSection;
