import React from 'react';
import { motion } from 'framer-motion';
import { Clock, MessageSquare, Play, CheckCircle2, Lock } from 'lucide-react';

interface ChallengeCardProps {
  title: string;
  description: string;
  duration: string;
  questionCount: number;
  status: 'locked' | 'available' | 'in-progress' | 'completed';
  accentColor?: 'orange' | 'blue' | 'purple' | 'pink' | 'teal';
  onClick?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const accentColors = {
  orange: {
    dot: 'bg-course-orange',
    light: 'bg-course-orange/10',
    text: 'text-course-orange',
    border: 'border-course-orange/30',
  },
  blue: {
    dot: 'bg-course-blue',
    light: 'bg-course-blue/10',
    text: 'text-course-blue',
    border: 'border-course-blue/30',
  },
  purple: {
    dot: 'bg-course-purple',
    light: 'bg-course-purple/10',
    text: 'text-course-purple',
    border: 'border-course-purple/30',
  },
  pink: {
    dot: 'bg-course-pink',
    light: 'bg-course-pink/10',
    text: 'text-course-pink',
    border: 'border-course-pink/30',
  },
  teal: {
    dot: 'bg-course-teal',
    light: 'bg-course-teal/10',
    text: 'text-course-teal',
    border: 'border-course-teal/30',
  },
};

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  title,
  description,
  duration,
  questionCount,
  status,
  accentColor = 'orange',
  onClick,
  isFirst = false,
  isLast = false,
}) => {
  const colors = accentColors[accentColor];
  const isActive = status === 'available' || status === 'in-progress';
  const isCompleted = status === 'completed';
  const isLocked = status === 'locked';

  return (
    <div className="flex gap-4">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        {/* Top line */}
        {!isFirst && (
          <div className={`w-0.5 h-4 ${isCompleted ? colors.dot : 'bg-light-border'}`} />
        )}
        
        {/* Dot */}
        <div
          className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
            isCompleted
              ? colors.dot
              : isActive
              ? `${colors.dot} ring-4 ring-opacity-20`
              : 'bg-light-border'
          }`}
          style={isActive ? { boxShadow: `0 0 0 4px ${accentColor === 'orange' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)'}` } : {}}
        >
          {isCompleted && <CheckCircle2 size={10} className="text-white" />}
        </div>
        
        {/* Bottom line */}
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[60px] ${isCompleted ? colors.dot : 'bg-light-border'}`} />
        )}
      </div>

      {/* Card content */}
      <motion.div
        className={`flex-1 bg-white rounded-2xl p-4 border shadow-soft mb-3 ${
          isActive 
            ? `${colors.border} hover:shadow-card` 
            : isLocked 
            ? 'border-light-border opacity-60' 
            : 'border-light-border'
        } ${isActive ? 'cursor-pointer' : ''}`}
        onClick={isActive ? onClick : undefined}
        whileTap={isActive ? { scale: 0.98 } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-semibold text-base ${isLocked ? 'text-light-text-muted' : 'text-light-text'}`}>
                {title}
              </h3>
              {isCompleted && (
                <CheckCircle2 size={16} className="text-success flex-shrink-0" />
              )}
              {isLocked && (
                <Lock size={14} className="text-light-text-muted flex-shrink-0" />
              )}
            </div>
            <p className="text-light-text-muted text-sm line-clamp-2 mb-3">{description}</p>
            
            {/* Stats */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-1.5 text-xs ${isActive ? colors.text : 'text-light-text-secondary'}`}>
                <Clock size={14} />
                <span>{duration}</span>
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${isActive ? colors.text : 'text-light-text-secondary'}`}>
                <MessageSquare size={14} />
                <span>{questionCount} Questions</span>
              </div>
            </div>
          </div>

          {/* Play button for active challenges */}
          {isActive && (
            <div className={`w-11 h-11 rounded-xl ${colors.dot} flex items-center justify-center flex-shrink-0 shadow-soft`}>
              <Play size={18} className="text-white fill-white ml-0.5" />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ChallengeCard;
