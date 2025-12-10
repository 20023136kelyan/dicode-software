import React from 'react';
import { motion } from 'framer-motion';

interface Stat {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

interface StatsRowProps {
  stats: Stat[];
  className?: string;
}

const StatsRow: React.FC<StatsRowProps> = ({
  stats,
  className = '',
}) => {
  return (
    <div className={`flex items-stretch justify-center gap-2 ${className}`}>
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          className="flex-1 bg-light-card rounded-xl border border-light-border p-3 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          {stat.icon && (
            <div className="flex justify-center mb-1">
              {stat.icon}
            </div>
          )}
          <p className="text-lg font-bold text-light-text">{stat.value}</p>
          <p className="text-xs text-light-text-muted">{stat.label}</p>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsRow;
