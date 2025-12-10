import React from 'react';
import { motion } from 'framer-motion';
import { Clock, BookOpen } from 'lucide-react';
import Button from '../shared/Button';

interface CampaignProgressCardProps {
  title: string;
  totalModules: number;
  completedModules: number;
  estimatedMinutes?: number;
  thumbnailUrl?: string;
  onContinue: () => void;
  className?: string;
}

const CampaignProgressCard: React.FC<CampaignProgressCardProps> = ({
  title,
  totalModules,
  completedModules,
  estimatedMinutes,
  thumbnailUrl,
  onContinue,
  className = '',
}) => {
  const progress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;
  const isComplete = completedModules >= totalModules;

  return (
    <div className={`bg-light-card rounded-2xl border border-light-border overflow-hidden ${className}`}>
      {/* Header with progress ring */}
      <div className="relative p-6 bg-gradient-to-br from-primary/10 to-accent/10 flex flex-col items-center">
        {/* Progress Ring */}
        <div className="relative w-24 h-24 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="8"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={isComplete ? '#10B981' : '#6366F1'}
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ strokeDasharray: '0 251.2' }}
              animate={{ strokeDasharray: `${progress * 2.512} 251.2` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${isComplete ? 'text-success' : 'text-primary'}`}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        <h2 className="text-lg font-bold text-light-text text-center">{title}</h2>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-2 text-sm text-light-text-secondary">
          <div className="flex items-center gap-1">
            <BookOpen size={14} />
            <span>{totalModules} modules</span>
          </div>
          {estimatedMinutes && (
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>~{estimatedMinutes} min</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 py-4 border-t border-light-border">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-light-text-secondary">Progress</span>
          <span className="font-medium text-light-text">
            {completedModules} of {totalModules} complete
          </span>
        </div>
        <div className="h-2 bg-light-border rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isComplete ? 'bg-success' : 'bg-primary'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Action */}
      <div className="px-6 pb-6">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onContinue}
          leftIcon={isComplete ? undefined : <BookOpen size={18} />}
        >
          {isComplete ? 'Review Campaign' : 'Continue Learning'}
        </Button>
      </div>
    </div>
  );
};

export default CampaignProgressCard;
