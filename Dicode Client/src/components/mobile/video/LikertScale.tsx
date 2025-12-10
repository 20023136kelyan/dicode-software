import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface LikertScaleProps {
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  variant?: 'dark' | 'light';
  className?: string;
}

const LikertScale: React.FC<LikertScaleProps> = ({
  min = 1,
  max = 5,
  lowLabel = 'Strongly Disagree',
  highLabel = 'Strongly Agree',
  value,
  onChange,
  disabled = false,
  variant = 'dark',
  className = '',
}) => {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const isAnswered = value !== undefined;

  const isDark = variant === 'dark';

  const getButtonStyles = (optionValue: number) => {
    const isSelected = value === optionValue;

    if (isDark) {
      if (isSelected) {
        return 'bg-primary text-white scale-110 shadow-lg shadow-primary/50 border-primary';
      }
      if (isAnswered) {
        return 'bg-white/5 text-white/30 border-white/10';
      }
      return 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30';
    }

    // Light variant
    if (isSelected) {
      return 'bg-primary text-white scale-110 shadow-lg shadow-primary/30 border-primary';
    }
    if (isAnswered) {
      return 'bg-light-border/50 text-light-text-muted border-light-border';
    }
    return 'bg-light-card text-light-text border-light-border hover:bg-primary/5 hover:border-primary/30';
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Labels */}
      <div className={`flex justify-between text-sm mb-3 px-1 ${
        isDark ? 'text-white/50' : 'text-light-text-muted'
      }`}>
        <span className="max-w-[40%] text-left">{lowLabel}</span>
        <span className="max-w-[40%] text-right">{highLabel}</span>
      </div>

      {/* Scale buttons */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((optionValue, index) => (
          <motion.button
            key={optionValue}
            onClick={() => !disabled && !isAnswered && onChange(optionValue)}
            disabled={disabled || isAnswered}
            className={`
              aspect-square rounded-xl font-bold text-lg transition-all duration-200
              border-2
              ${getButtonStyles(optionValue)}
              ${disabled || isAnswered ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
            whileHover={!disabled && !isAnswered ? { scale: 1.05 } : undefined}
            whileTap={!disabled && !isAnswered ? { scale: 0.95 } : undefined}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            {value === optionValue ? (
              <Check size={20} className="mx-auto" strokeWidth={3} />
            ) : (
              optionValue
            )}
          </motion.button>
        ))}
      </div>

      {/* Selection indicator */}
      {isAnswered && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-3 text-center text-sm ${
            isDark ? 'text-white/60' : 'text-light-text-secondary'
          }`}
        >
          Answer saved
        </motion.div>
      )}
    </div>
  );
};

export default LikertScale;
