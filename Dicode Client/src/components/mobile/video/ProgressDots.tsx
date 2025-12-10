import React from 'react';
import { motion } from 'framer-motion';

interface ProgressDotsProps {
  total: number;
  current: number;
  className?: string;
}

const ProgressDots: React.FC<ProgressDotsProps> = ({
  total,
  current,
  className = '',
}) => {
  // If many items, show abbreviated version
  const showAll = total <= 8;

  if (showAll) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {Array.from({ length: total }).map((_, index) => (
          <motion.div
            key={index}
            className={`
              h-1.5 rounded-full transition-all duration-300
              ${index === current
                ? 'bg-white w-6'
                : index < current
                ? 'bg-white/70 w-1.5'
                : 'bg-white/30 w-1.5'
              }
            `}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.05 }}
          />
        ))}
      </div>
    );
  }

  // Abbreviated version for many items
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-white text-sm font-medium">
        {current + 1}
      </span>
      <div className="flex items-center gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={`
              w-1.5 h-1.5 rounded-full
              ${i === 0 && current > 0 ? 'bg-white/70' : ''}
              ${i === 1 ? 'bg-white' : 'bg-white/30'}
              ${i === 2 && current < total - 1 ? 'bg-white/30' : ''}
            `}
          />
        ))}
      </div>
      <span className="text-white/60 text-sm">
        {total}
      </span>
    </div>
  );
};

export default ProgressDots;
