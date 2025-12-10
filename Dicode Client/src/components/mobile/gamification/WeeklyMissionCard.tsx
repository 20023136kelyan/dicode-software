import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Check } from 'lucide-react';

interface WeeklyMissionCardProps {
  missionTitle: string;
  currentPoints: number;
  targetPoints: number;
  hoursLeft: number;
  milestones?: number[]; // Array of point thresholds for milestones
  className?: string;
}

const WeeklyMissionCard: React.FC<WeeklyMissionCardProps> = ({
  missionTitle,
  currentPoints,
  targetPoints,
  hoursLeft,
  milestones = [10, 18, 25], // Default 3 milestones
  className = '',
}) => {
  const progressPercent = Math.min((currentPoints / targetPoints) * 100, 100);

  // Calculate milestone states
  const getMilestoneState = (milestone: number) => {
    if (currentPoints >= milestone) return 'completed';
    return 'locked';
  };

  // Find the current milestone (first incomplete one)
  const currentMilestoneIndex = milestones.findIndex(m => currentPoints < m);
  const isAtMilestone = milestones.some(m => currentPoints === m);

  return (
    <div className={className}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Weekly Mission</h2>
        <div className="flex items-center gap-1.5 text-amber-500">
          <div className="relative w-[18px] h-[18px] bg-amber-500 rounded-full flex items-center justify-center">
            {/* Clock hands only */}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 2V5L7 6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-medium">{hoursLeft} Hours Left</span>
        </div>
      </div>

      {/* Mission Card */}
      <motion.div
        className="rounded-3xl bg-white/5 backdrop-blur-md p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Mission Title and Progress */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-medium">{missionTitle}</p>
          <div className="text-right">
            <span className="text-[#00A3FF] font-bold text-lg">{currentPoints}</span>
            <span className="text-slate-400 text-sm">/{targetPoints}</span>
          </div>
        </div>

        {/* Progress Bar with Inline Milestones */}
        <div className="relative flex items-center gap-2">
          {/* Progress track and bar */}
          <div className="flex-1 relative">
            {/* Background track */}
            <div className="h-3 bg-slate-700 rounded-full" />
            
            {/* Progress fill */}
            <motion.div
              className="absolute top-0 left-0 h-3 bg-gradient-to-r from-[#0077B3] to-[#00C2FF] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />

            {/* Current position indicator (checkmark circle) */}
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-7 h-7 bg-gradient-to-b from-[#0077B3] to-[#00C2FF] rounded-full border-[3px] border-slate-900 flex items-center justify-center shadow-lg"
              initial={{ left: 0 }}
              animate={{ left: `calc(${Math.max(progressPercent, 5)}% - 14px)` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <Check size={14} className="text-white" strokeWidth={3} />
            </motion.div>
          </div>

          {/* Milestone markers */}
          {milestones.map((milestone, index) => {
            const state = getMilestoneState(milestone);
            
            return (
              <motion.div
                key={index}
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  state === 'completed'
                    ? 'bg-gradient-to-b from-[#0077B3] to-[#00C2FF]'
                    : 'bg-slate-700'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                {state === 'completed' ? (
                  <Check size={18} className="text-white" strokeWidth={3} />
                ) : (
                  <Lock size={16} className="text-slate-400" fill="currentColor" strokeWidth={0} />
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default WeeklyMissionCard;
