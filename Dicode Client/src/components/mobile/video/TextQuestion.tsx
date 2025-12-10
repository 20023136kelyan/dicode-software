import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Check, Loader2 } from 'lucide-react';

interface TextQuestionProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isSaving?: boolean;
  variant?: 'dark' | 'light';
  className?: string;
}

const TextQuestion: React.FC<TextQuestionProps> = ({
  value = '',
  onChange,
  placeholder = 'Type your thoughts here...',
  disabled = false,
  isSaving = false,
  variant = 'dark',
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(value);
  const isAnswered = value !== undefined && value !== '';

  // Sync local value with prop
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSubmit = () => {
    if (localValue.trim() && !disabled && !isAnswered) {
      onChange(localValue.trim());
    }
  };

  const isDark = variant === 'dark';

  const inputStyles = isDark
    ? 'bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-primary/50'
    : 'bg-light-card border-light-border text-light-text placeholder:text-light-text-muted focus:border-primary/50';

  const buttonStyles = isDark
    ? 'bg-primary hover:bg-primary/90 text-white'
    : 'bg-primary hover:bg-primary/90 text-white';

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={(e) => !disabled && !isAnswered && setLocalValue(e.target.value)}
          disabled={disabled || isAnswered}
          placeholder={isAnswered ? 'Your answer has been saved' : placeholder}
          className={`
            w-full min-h-[140px] p-4 pr-12 rounded-xl border-2
            text-base leading-relaxed resize-none
            focus:outline-none focus:ring-0 transition-all duration-200
            ${inputStyles}
            ${disabled || isAnswered ? 'cursor-not-allowed opacity-60' : ''}
          `}
        />

        {/* Character count */}
        {!isAnswered && localValue.length > 0 && (
          <div className={`absolute bottom-3 left-4 text-xs ${
            isDark ? 'text-white/40' : 'text-light-text-muted'
          }`}>
            {localValue.length} characters
          </div>
        )}

        {/* Status indicator */}
        {isAnswered && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-success flex items-center justify-center"
          >
            <Check size={18} className="text-white" strokeWidth={3} />
          </motion.div>
        )}
      </div>

      {/* Submit button */}
      {!isAnswered && (
        <motion.button
          onClick={handleSubmit}
          disabled={disabled || !localValue.trim() || isSaving}
          className={`
            mt-3 w-full py-3.5 rounded-xl font-semibold
            flex items-center justify-center gap-2
            transition-all duration-200
            ${buttonStyles}
            ${(!localValue.trim() || disabled) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          whileTap={{ scale: 0.98 }}
        >
          {isSaving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Send size={18} />
              Submit Answer
            </>
          )}
        </motion.button>
      )}

      {/* Saved confirmation */}
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

export default TextQuestion;
