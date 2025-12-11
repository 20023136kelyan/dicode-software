import React from 'react';
import { motion } from 'framer-motion';
import { Check, Flame } from 'lucide-react';

interface StreakCardProps {
  currentStreak: number;
  streakDays: boolean[]; // Array of 7 booleans for Mon-Sun
  className?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const StreakCard: React.FC<StreakCardProps> = ({
  currentStreak,
  streakDays,
  className = '',
}) => {
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1; // Convert to Mon=0 format

  const getStreakMessage = () => {
    if (currentStreak === 0) return "Start your streak today!";
    if (currentStreak === 1) return "1 Day streak, Great start!";
    if (currentStreak < 7) return `${currentStreak} Days streak, Keep going!`;
    if (currentStreak < 14) return `${currentStreak} Days streak, You're on fire!`;
    return `${currentStreak} Days streak, Unstoppable!`;
  };

  return (
    <motion.div
      className={`rounded-3xl bg-white/5 backdrop-blur-md p-4 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex gap-3 items-center">
        {/* Left: Flame with number */}
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center">
            <div className="relative">
              <Flame
                size={48}
                className="text-[#00A3FF] drop-shadow-[0_0_8px_rgba(0,163,255,0.4)]"
                fill="currentColor"
                strokeWidth={1}
              />
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg pt-2">
                {currentStreak}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Text */}
        <div className="flex-1 flex flex-col justify-center">
          <h3 className="text-white font-semibold text-lg">
            {getStreakMessage()}
          </h3>
          <p className="text-[#7BC4FF] text-sm mt-0.5">
            Every day counts!
          </p>
        </div>
      </div>

      {/* Weekly progress - right aligned */}
      <div className="flex items-center justify-end gap-2 mt-4">
        {DAYS.map((day, index) => {
          const isComplete = streakDays[index];
          const isToday = index === todayIndex;

          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <motion.div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${isComplete
                  ? 'bg-gradient-to-b from-[#0077B3] to-[#00C2FF]'
                  : isToday
                    ? 'bg-gradient-to-b from-[#0077B3]/50 to-[#00C2FF]/50'
                    : 'bg-white/10'
                  }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                {isComplete ? (
                  <Check size={14} className="text-white" strokeWidth={3} />
                ) : isToday ? (
                  <Flame size={12} className="text-white" fill="currentColor" />
                ) : null}
              </motion.div>
              <span className="text-[10px] text-[#7BC4FF]/80">{day}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default StreakCard;
