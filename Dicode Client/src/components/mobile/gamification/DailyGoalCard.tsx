import React from 'react';
import { motion } from 'framer-motion';
import { Target, Clock, Sparkles, CheckCircle2 } from 'lucide-react';

interface DailyGoalCardProps {
  completed: number;
  target: number;
  hoursLeft?: number;
  className?: string;
}

const DailyGoalCard: React.FC<DailyGoalCardProps> = ({
  completed,
  target,
  hoursLeft,
  className = '',
}) => {
  const isComplete = completed >= target;
  const progress = Math.min((completed / target) * 100, 100);

  return (
    <motion.div
      className={`relative overflow-hidden rounded-3xl bg-white border border-light-border p-5 shadow-card ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Background decoration */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-streak/10 rounded-full blur-2xl pointer-events-none" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isComplete ? 'bg-success/10' : 'bg-streak/10'}`}>
              {isComplete ? (
                <CheckCircle2 size={20} className="text-success" />
              ) : (
                <Target size={20} className="text-streak" />
              )}
            </div>
            <span className="font-semibold text-light-text">Today's Focus</span>
          </div>
          {hoursLeft !== undefined && !isComplete && (
            <div className="flex items-center gap-1.5 rounded-full bg-light-bg px-3 py-1.5 text-xs font-medium text-light-text-secondary">
              <Clock size={12} />
              <span>{hoursLeft}h left</span>
            </div>
          )}
        </div>

        {/* Goal text */}
        <h3 className="text-xl font-bold text-light-text mb-1">
          {isComplete
            ? '🎉 Goal achieved!'
            : `Complete ${target} module${target > 1 ? 's' : ''} today`}
        </h3>
        <p className="text-sm text-light-text-secondary mb-5">
          {isComplete
            ? 'Amazing work! Keep the momentum going.'
            : `Finish ${target - completed} more to keep your streak.`}
        </p>

        {/* Progress section */}
        <div className="flex items-center gap-4">
          {/* Circular progress */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="3"
              />
              <motion.path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={isComplete ? '#22C55E' : '#F59E0B'}
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ strokeDasharray: '0 100' }}
                animate={{ strokeDasharray: `${progress} 100` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-light-text">{completed}</span>
              <span className="text-xs text-light-text-muted">of {target}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex-1">
            <div className="h-3 w-full overflow-hidden rounded-full bg-light-bg">
              <motion.div
                className={`h-full rounded-full ${isComplete ? 'bg-success' : 'bg-streak'}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-light-text-muted">
              <span>{completed} completed</span>
              <span>{target} target</span>
            </div>
          </div>
        </div>

        {/* Tip */}
        {!isComplete && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-streak/5 rounded-xl">
            <Sparkles size={16} className="text-streak" />
            <span className="text-sm text-light-text-secondary">
              Hit your goal to keep the flame bonus!
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DailyGoalCard;
