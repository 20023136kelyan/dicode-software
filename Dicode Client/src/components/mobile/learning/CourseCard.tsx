import React from 'react';
import { motion } from 'framer-motion';
import { Heart, BookOpen, Clock, Play } from 'lucide-react';

type GradientVariant = 'blue' | 'purple' | 'orange' | 'pink' | 'teal';

interface CourseCardProps {
  title: string;
  lessonCount: number;
  thumbnailUrl?: string;
  progress?: number;
  variant?: GradientVariant;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showPlayButton?: boolean;
  instructor?: string;
  duration?: string;
}

const gradientStyles: Record<GradientVariant, string> = {
  blue: 'bg-gradient-to-br from-[#60A5FA] to-[#2563EB]',
  purple: 'bg-gradient-to-br from-[#A78BFA] to-[#7C3AED]',
  orange: 'bg-gradient-to-br from-[#FDBA74] to-[#EA580C]',
  pink: 'bg-gradient-to-br from-[#F9A8D4] to-[#DB2777]',
  teal: 'bg-gradient-to-br from-[#5EEAD4] to-[#0D9488]',
};

const CourseCard: React.FC<CourseCardProps> = ({
  title,
  lessonCount,
  thumbnailUrl,
  progress,
  variant = 'blue',
  isFavorite = false,
  onFavoriteToggle,
  onClick,
  size = 'md',
  showPlayButton = false,
  instructor,
  duration,
}) => {
  const sizeClasses = {
    sm: 'w-36',
    md: 'w-44',
    lg: 'w-full',
  };

  const heightClasses = {
    sm: 'h-28',
    md: 'h-32',
    lg: 'h-40',
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} flex-shrink-0 cursor-pointer`}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
    >
      {/* Card with gradient */}
      <div
        className={`${heightClasses[size]} ${gradientStyles[variant]} rounded-2xl relative overflow-hidden shadow-card`}
      >
        {/* Background image or pattern */}
        {thumbnailUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
          />
        ) : (
          // Decorative elements when no thumbnail
          <div className="absolute inset-0">
            <div className="absolute top-3 right-3 w-16 h-16 rounded-full bg-white/20" />
            <div className="absolute bottom-4 left-4 w-10 h-10 rounded-full bg-white/10" />
          </div>
        )}

        {/* Favorite button */}
        {onFavoriteToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle();
            }}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/30 backdrop-blur-sm hover:bg-white/40 transition-colors z-10"
          >
            <Heart
              size={16}
              className={isFavorite ? 'fill-white text-white' : 'text-white'}
            />
          </button>
        )}

        {/* Play button overlay */}
        {showPlayButton && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
              <Play size={20} className="text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {/* Progress bar at bottom */}
        {progress !== undefined && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Course info */}
      <div className="mt-3 space-y-1">
        <h3 className="font-semibold text-light-text text-sm line-clamp-2 leading-tight">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-light-text-muted text-xs">
          <BookOpen size={12} />
          <span>{lessonCount} lessons</span>
          {duration && (
            <>
              <span className="text-light-border">•</span>
              <Clock size={12} />
              <span>{duration}</span>
            </>
          )}
        </div>
        {instructor && (
          <p className="text-light-text-secondary text-xs">{instructor}</p>
        )}
      </div>
    </motion.div>
  );
};

export default CourseCard;
