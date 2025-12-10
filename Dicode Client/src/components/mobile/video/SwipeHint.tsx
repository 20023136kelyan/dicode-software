import React from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface SwipeHintProps {
  direction?: 'up' | 'down';
  text?: string;
  show?: boolean;
  className?: string;
}

const SwipeHint: React.FC<SwipeHintProps> = ({
  direction = 'up',
  text,
  show = true,
  className = '',
}) => {
  if (!show) return null;

  const Icon = direction === 'up' ? ChevronUp : ChevronDown;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`flex flex-col items-center gap-1 pointer-events-none ${className}`}
    >
      <motion.div
        animate={{
          y: direction === 'up' ? [0, -8, 0] : [0, 8, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Icon size={28} className="text-white/50" />
      </motion.div>
      {text && (
        <span className="text-xs text-white/40">{text}</span>
      )}
    </motion.div>
  );
};

export default SwipeHint;
