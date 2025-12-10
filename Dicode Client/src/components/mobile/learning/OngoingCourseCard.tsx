import React from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, ChevronRight } from 'lucide-react';

interface OngoingCourseCardProps {
  title: string;
  instructor?: string;
  lessonCount: number;
  progress: number;
  thumbnailUrl?: string;
  iconEmoji?: string;
  iconBgColor?: string;
  onClick?: () => void;
  onMenuClick?: () => void;
}

const OngoingCourseCard: React.FC<OngoingCourseCardProps> = ({
  title,
  instructor,
  lessonCount,
  progress,
  thumbnailUrl,
  iconEmoji = '📚',
  iconBgColor = 'bg-course-purple/10',
  onClick,
  onMenuClick,
}) => {
  return (
    <motion.div
      className="bg-white rounded-2xl p-4 border border-light-border shadow-soft cursor-pointer hover:shadow-card hover:border-light-border-light transition-all"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-4">
        {/* Course icon/thumbnail */}
        <div
          className={`w-14 h-14 rounded-xl ${iconBgColor} flex items-center justify-center flex-shrink-0 overflow-hidden`}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl">{iconEmoji}</span>
          )}
        </div>

        {/* Course info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-light-text text-base line-clamp-1">
                {title}
              </h3>
              {instructor && (
                <p className="text-light-text-muted text-sm mt-0.5">{instructor}</p>
              )}
            </div>
            
            {/* Menu button */}
            {onMenuClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuClick();
                }}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-light-bg transition-colors flex-shrink-0"
              >
                <MoreHorizontal size={18} className="text-light-text-muted" />
              </button>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-light-text-secondary text-sm">
              {lessonCount} lessons
            </span>
            <span className="text-course-blue text-sm font-medium">
              {progress}% complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-light-bg rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-course-blue rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight size={20} className="text-light-text-muted flex-shrink-0" />
      </div>
    </motion.div>
  );
};

export default OngoingCourseCard;
