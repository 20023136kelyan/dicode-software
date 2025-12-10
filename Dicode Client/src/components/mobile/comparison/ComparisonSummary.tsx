import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Trophy, Target } from 'lucide-react';
import Card from '../shared/Card';

interface ComparisonSummaryProps {
  yourScore: number;
  teamAverage: number;
  percentile: number; // e.g., 25 means "Top 25%"
  totalResponses?: number;
  className?: string;
}

const ComparisonSummary: React.FC<ComparisonSummaryProps> = ({
  yourScore,
  teamAverage,
  percentile,
  totalResponses,
  className = '',
}) => {
  const difference = yourScore - teamAverage;
  const isAbove = difference > 0;
  const isEqual = Math.abs(difference) < 0.1;

  const getPercentileColor = () => {
    if (percentile <= 10) return 'text-accent';
    if (percentile <= 25) return 'text-success';
    if (percentile <= 50) return 'text-primary';
    return 'text-light-text-secondary';
  };

  const getPercentileLabel = () => {
    if (percentile <= 10) return 'Outstanding!';
    if (percentile <= 25) return 'Excellent';
    if (percentile <= 50) return 'Above Average';
    if (percentile <= 75) return 'Average';
    return 'Room to Grow';
  };

  return (
    <Card className={`bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 ${className}`}>
      <div className="text-center space-y-4">
        {/* Percentile Banner */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
        >
          <Trophy size={18} className={getPercentileColor()} />
          <span className={`font-bold ${getPercentileColor()}`}>
            Top {percentile}%
          </span>
          <span className="text-light-text-secondary text-sm">
            of your team
          </span>
        </motion.div>

        {/* Score Comparison */}
        <div className="flex items-center justify-center gap-8">
          {/* Your Score */}
          <div className="text-center">
            <motion.div
              className="text-4xl font-bold text-primary"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              {yourScore.toFixed(1)}
            </motion.div>
            <p className="text-xs text-light-text-muted mt-1">Your Score</p>
          </div>

          {/* Comparison Indicator */}
          <div className="flex flex-col items-center">
            {isEqual ? (
              <Minus size={24} className="text-light-text-muted" />
            ) : isAbove ? (
              <TrendingUp size={24} className="text-success" />
            ) : (
              <TrendingDown size={24} className="text-warning" />
            )}
            <span className={`text-xs font-medium ${
              isEqual ? 'text-light-text-muted' :
              isAbove ? 'text-success' : 'text-warning'
            }`}>
              {isEqual ? 'Same' : isAbove ? `+${difference.toFixed(1)}` : difference.toFixed(1)}
            </span>
          </div>

          {/* Team Average */}
          <div className="text-center">
            <motion.div
              className="text-4xl font-bold text-light-text-secondary"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              {teamAverage.toFixed(1)}
            </motion.div>
            <p className="text-xs text-light-text-muted mt-1">Team Avg</p>
          </div>
        </div>

        {/* Status Message */}
        <div className="flex items-center justify-center gap-2">
          <Target size={14} className="text-light-text-muted" />
          <p className="text-sm text-light-text-secondary">
            {getPercentileLabel()}
            {totalResponses && ` • ${totalResponses} responses`}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default ComparisonSummary;
