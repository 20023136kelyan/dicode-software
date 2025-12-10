import React from 'react';
import { Flame } from 'lucide-react';

interface StreakInlineProps {
  count: number;
  className?: string;
}

const StreakInline: React.FC<StreakInlineProps> = ({
  count,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Flame 
        size={20} 
        className="text-orange-500" 
        fill="currentColor"
        strokeWidth={1.5}
      />
      <span className="text-orange-500 font-semibold text-sm">
        {count} days streak
      </span>
    </div>
  );
};

export default StreakInline;

