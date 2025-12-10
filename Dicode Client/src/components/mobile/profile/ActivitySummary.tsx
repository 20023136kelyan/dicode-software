import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import Card from '../shared/Card';

interface ActivityPeriod {
  label: string;
  modules: number;
  xp: number;
  time?: string;
}

interface ActivitySummaryProps {
  periods: ActivityPeriod[];
  className?: string;
}

const ActivitySummary: React.FC<ActivitySummaryProps> = ({
  periods,
  className = '',
}) => {
  return (
    <Card className={className}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-primary" />
        <h3 className="font-semibold text-light-text">Activity</h3>
      </div>

      <div className="space-y-3">
        {periods.map((period, index) => (
          <motion.div
            key={period.label}
            className="flex items-center justify-between py-2 border-b border-light-border last:border-0"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <span className="text-sm text-light-text-secondary">{period.label}</span>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-sm font-medium text-light-text">
                  {period.modules} modules
                </span>
              </div>
              <div className="text-right min-w-[60px]">
                <span className="text-sm font-semibold text-primary">
                  {period.xp.toLocaleString()} XP
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

export default ActivitySummary;
