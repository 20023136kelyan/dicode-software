import React from 'react';
import { motion } from 'framer-motion';
import { Target, Star, Flame, Trophy, Check } from 'lucide-react';
import Card from '../shared/Card';

export interface Challenge {
  id: string;
  title: string;
  description?: string;
  progress: number;
  target: number;
  xpReward: number;
  type: 'modules' | 'streak' | 'xp' | 'custom';
  isComplete: boolean;
}

interface WeeklyChallengeProps {
  challenge: Challenge;
  onClick?: () => void;
  className?: string;
}

const WeeklyChallenge: React.FC<WeeklyChallengeProps> = ({
  challenge,
  onClick,
  className = '',
}) => {
  const progressPercent = Math.min((challenge.progress / challenge.target) * 100, 100);
  const isComplete = challenge.isComplete;

  const getIcon = () => {
    switch (challenge.type) {
      case 'modules':
        return <Target size={18} className="text-primary" />;
      case 'streak':
        return <Flame size={18} className="text-streak" />;
      case 'xp':
        return <Star size={18} className="text-accent" />;
      default:
        return <Trophy size={18} className="text-primary" />;
    }
  };

  const getProgressColor = () => {
    if (isComplete) return 'bg-success';
    switch (challenge.type) {
      case 'streak':
        return 'bg-streak';
      case 'xp':
        return 'bg-accent';
      default:
        return 'bg-primary';
    }
  };

  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={`${isComplete ? 'border-success/30 bg-success/5' : ''} ${className}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`
          w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
          ${isComplete ? 'bg-success/10' : 'bg-primary/10'}
        `}>
          {isComplete ? (
            <Check size={20} className="text-success" strokeWidth={3} />
          ) : (
            getIcon()
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`font-medium ${isComplete ? 'text-success' : 'text-light-text'}`}>
              {challenge.title}
            </h4>
            <span className={`text-xs font-medium ${isComplete ? 'text-success' : 'text-primary'}`}>
              +{challenge.xpReward} XP
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-light-border rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${getProgressColor()}`}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="text-xs text-light-text-muted whitespace-nowrap">
              {challenge.progress}/{challenge.target}
            </span>
          </div>

          {challenge.description && (
            <p className="text-xs text-light-text-muted mt-1">{challenge.description}</p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default WeeklyChallenge;
