import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, FileText, Users } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  bgColor: string;
  iconColor: string;
  onClick: () => void;
}

interface QuickActionGridProps {
  onPractice: () => void;
  onReview: () => void;
  onCompare: () => void;
  className?: string;
}

const QuickActionGrid: React.FC<QuickActionGridProps> = ({
  onPractice,
  onReview,
  onCompare,
  className = '',
}) => {
  const actions: QuickAction[] = [
    {
      id: 'practice',
      label: 'Practice',
      icon: RotateCcw,
      bgColor: 'bg-course-blue/10',
      iconColor: 'text-course-blue',
      onClick: onPractice,
    },
    {
      id: 'review',
      label: 'Review',
      icon: FileText,
      bgColor: 'bg-course-purple/10',
      iconColor: 'text-course-purple',
      onClick: onReview,
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: Users,
      bgColor: 'bg-course-teal/10',
      iconColor: 'text-course-teal',
      onClick: onCompare,
    },
  ];

  return (
    <div className={`grid grid-cols-3 gap-3 ${className}`}>
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.id}
            onClick={action.onClick}
            className="relative flex flex-col items-center gap-3 p-4 rounded-2xl bg-white border border-light-border shadow-soft hover:shadow-card hover:border-light-border-light transition-all overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center`}>
              <Icon size={22} className={action.iconColor} strokeWidth={1.8} />
            </div>
            <span className="text-sm font-medium text-light-text">{action.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default QuickActionGrid;
