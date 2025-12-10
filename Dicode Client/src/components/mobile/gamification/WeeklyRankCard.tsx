import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import Card from '../shared/Card';

interface WeeklyRankCardProps {
  rank: number;
  totalParticipants: number;
  teamName?: string;
  trend: 'up' | 'down' | 'same';
  trendAmount: number;
  onViewBoard: () => void;
  className?: string;
}

const WeeklyRankCard: React.FC<WeeklyRankCardProps> = ({
  rank,
  totalParticipants,
  teamName = 'your team',
  trend,
  trendAmount,
  onViewBoard,
  className = '',
}) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp size={14} className="text-success" />;
    if (trend === 'down') return <TrendingDown size={14} className="text-error" />;
    return <Minus size={14} className="text-light-text-muted" />;
  };

  const getTrendText = () => {
    if (trend === 'up') return `Up ${trendAmount} spot${trendAmount > 1 ? 's' : ''}`;
    if (trend === 'down') return `Down ${trendAmount} spot${trendAmount > 1 ? 's' : ''}`;
    return 'Same as last week';
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-success';
    if (trend === 'down') return 'text-error';
    return 'text-light-text-muted';
  };

  return (
    <Card
      className={`bg-accent/5 border-accent/20 ${className}`}
      interactive
      onClick={onViewBoard}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Trophy size={24} className="text-accent" />
          </div>
          <div>
            <p className="text-sm text-light-text-secondary">This Week</p>
            <p className="text-xl font-bold text-light-text">
              #{rank} <span className="text-sm font-normal text-light-text-muted">of {totalParticipants}</span>
            </p>
            <p className={`text-xs flex items-center gap-1 ${getTrendColor()}`}>
              {getTrendIcon()}
              {getTrendText()}
            </p>
          </div>
        </div>
        <ChevronRight size={20} className="text-light-text-muted" />
      </div>
    </Card>
  );
};

export default WeeklyRankCard;
