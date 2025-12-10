import React from 'react';
import { motion } from 'framer-motion';
import Card from '../shared/Card';
import { Flame } from 'lucide-react';

interface StreakCalendarProps {
  streakDays: boolean[]; // Array of 7 booleans for current week (Mon-Sun)
  currentStreak: number;
  compact?: boolean;
  className?: string;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const StreakCalendar: React.FC<StreakCalendarProps> = ({
  streakDays,
  currentStreak,
  compact = false,
  className = '',
}) => {
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const todayIndex = today === 0 ? 6 : today - 1; // Convert to Mon=0 format

  if (compact) {
    return (
      <Card className={`bg-streak/5 border-streak/20 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-streak" fill="currentColor" />
            <span className="font-semibold text-light-text">Streak</span>
          </div>
          <span className="text-2xl font-bold text-streak">{currentStreak}</span>
        </div>
        <div className="flex justify-between">
          {DAYS.map((day, index) => {
            const isComplete = streakDays[index];
            const isFuture = index > todayIndex;
            const isToday = index === todayIndex;

            return (
              <div key={index} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-light-text-muted">{day}</span>
                <motion.div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isComplete
                      ? 'bg-streak'
                      : isFuture
                      ? 'bg-light-border/30'
                      : isToday
                      ? 'bg-light-border ring-2 ring-streak/30'
                      : 'bg-light-border/50'
                  }`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {isComplete && (
                    <Flame size={12} className="text-white" fill="currentColor" />
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
        {currentStreak > 0 && (
          <p className="text-xs text-streak mt-2">
            {currentStreak} day streak! Don't break it!
          </p>
        )}
      </Card>
    );
  }

  // Full calendar view (for profile page)
  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-light-text">Streak History</h3>
        <div className="flex items-center gap-1 text-streak">
          <Flame size={18} fill="currentColor" />
          <span className="font-bold">{currentStreak}</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day) => (
          <div key={day} className="text-center text-xs text-light-text-muted font-medium">
            {day}
          </div>
        ))}
        {streakDays.map((isComplete, index) => {
          const isFuture = index > todayIndex;
          const isToday = index === todayIndex;

          return (
            <motion.div
              key={index}
              className={`aspect-square rounded-lg flex items-center justify-center ${
                isComplete
                  ? 'bg-success'
                  : isFuture
                  ? 'bg-light-border/20'
                  : isToday
                  ? 'bg-light-border ring-2 ring-primary/30'
                  : 'bg-light-border/50'
              }`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.03 }}
            >
              {isComplete && (
                <Flame size={14} className="text-white" fill="currentColor" />
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-light-text-muted">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success" />
          <span>Complete</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-light-border/50" />
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-light-border/20" />
          <span>Future</span>
        </div>
      </div>
    </Card>
  );
};

export default StreakCalendar;
