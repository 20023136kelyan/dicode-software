import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

interface PracticeAICardProps {
  onStart: () => void;
  className?: string;
}

const PracticeAICard: React.FC<PracticeAICardProps> = ({
  onStart,
  className = '',
}) => {
  return (
    <motion.div
      className={`rounded-3xl bg-gradient-to-br from-[#00A3FF] via-[#0090E0] to-[#1E3A5F] p-4 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-4">
        {/* Robot Icon */}
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Bot size={32} className="text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-base leading-tight">
            Di Copilot
          </h3>
          <p className="text-[#B8E0FF] text-sm mt-0.5">
            Explore scenarios and understand your results
          </p>
        </div>

        {/* Start Button */}
        <motion.button
          onClick={onStart}
          className="px-5 py-2 bg-white rounded-full text-[#1E3A5F] font-semibold text-sm flex-shrink-0"
          whileTap={{ scale: 0.95 }}
        >
          Ask
        </motion.button>
      </div>
    </motion.div>
  );
};

export default PracticeAICard;
