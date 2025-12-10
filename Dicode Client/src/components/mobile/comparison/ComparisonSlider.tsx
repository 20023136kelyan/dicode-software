import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Card from '../shared/Card';

interface ComparisonSliderProps {
  question: string;
  yourScore: number;
  teamAverage: number;
  maxScore?: number;
  questionNumber?: number;
  className?: string;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  question,
  yourScore,
  teamAverage,
  maxScore = 5,
  questionNumber,
  className = '',
}) => {
  const yourPercent = (yourScore / maxScore) * 100;
  const teamPercent = (teamAverage / maxScore) * 100;
  const difference = yourScore - teamAverage;
  const isAbove = difference > 0.1;
  const isBelow = difference < -0.1;

  return (
    <Card className={className}>
      <div className="space-y-3">
        {/* Question */}
        <div className="flex items-start gap-3">
          {questionNumber && (
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-light-border flex items-center justify-center text-xs font-medium text-light-text-secondary">
              {questionNumber}
            </span>
          )}
          <p className="text-sm text-light-text leading-snug">
            "{question}"
          </p>
        </div>

        {/* Slider Visualization */}
        <div className="relative h-8 bg-light-border/50 rounded-full overflow-hidden">
          {/* Track marks */}
          <div className="absolute inset-0 flex justify-between px-2 items-center">
            {[1, 2, 3, 4, 5].map((num) => (
              <div
                key={num}
                className="w-px h-3 bg-light-border"
              />
            ))}
          </div>

          {/* Your score marker */}
          <motion.div
            className="absolute top-1 bottom-1 w-3 h-6 bg-primary rounded-full shadow-lg z-10"
            style={{ left: `calc(${yourPercent}% - 6px)` }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
          />

          {/* Team average marker */}
          <motion.div
            className="absolute top-1 bottom-1 w-3 h-6 bg-light-text-muted/50 rounded-full z-5"
            style={{ left: `calc(${teamPercent}% - 6px)` }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
          />

          {/* Connection line between markers */}
          <motion.div
            className={`absolute top-1/2 h-0.5 -translate-y-1/2 ${
              isAbove ? 'bg-success/50' : isBelow ? 'bg-warning/50' : 'bg-light-border'
            }`}
            style={{
              left: `${Math.min(yourPercent, teamPercent)}%`,
              width: `${Math.abs(yourPercent - teamPercent)}%`,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3 }}
          />
        </div>

        {/* Legend & Scores */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="text-light-text-secondary">You: {yourScore.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-light-text-muted/50" />
              <span className="text-light-text-secondary">Team: {teamAverage.toFixed(1)}</span>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
            isAbove ? 'bg-success/10 text-success' :
            isBelow ? 'bg-warning/10 text-warning' :
            'bg-light-border text-light-text-muted'
          }`}>
            {isAbove ? (
              <TrendingUp size={12} />
            ) : isBelow ? (
              <TrendingDown size={12} />
            ) : (
              <Minus size={12} />
            )}
            <span className="font-medium">
              {isAbove ? 'Above' : isBelow ? 'Below' : 'Average'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ComparisonSlider;
