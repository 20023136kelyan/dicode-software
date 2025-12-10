import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, MessageCircle, Target, TrendingUp } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';

type InsightType = 'strength' | 'improvement' | 'tip' | 'general';

interface AIInsightCardProps {
  insight: string;
  type?: InsightType;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const AIInsightCard: React.FC<AIInsightCardProps> = ({
  insight,
  type = 'general',
  actionLabel = 'Ask AI Coach',
  onAction,
  className = '',
}) => {
  const getTypeConfig = () => {
    switch (type) {
      case 'strength':
        return {
          icon: TrendingUp,
          bgClass: 'from-success/5 to-success/10',
          borderClass: 'border-success/20',
          iconClass: 'bg-success/10 text-success',
          label: 'Strength',
        };
      case 'improvement':
        return {
          icon: Target,
          bgClass: 'from-warning/5 to-warning/10',
          borderClass: 'border-warning/20',
          iconClass: 'bg-warning/10 text-warning',
          label: 'Area to Improve',
        };
      case 'tip':
        return {
          icon: Sparkles,
          bgClass: 'from-accent/5 to-accent/10',
          borderClass: 'border-accent/20',
          iconClass: 'bg-accent/10 text-accent',
          label: 'Pro Tip',
        };
      default:
        return {
          icon: Sparkles,
          bgClass: 'from-primary/5 to-primary/10',
          borderClass: 'border-primary/20',
          iconClass: 'bg-primary/10 text-primary',
          label: 'AI Insight',
        };
    }
  };

  const config = getTypeConfig();
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`bg-gradient-to-br ${config.bgClass} ${config.borderClass} ${className}`}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.iconClass}`}>
              <Icon size={16} />
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <span className="text-xs font-medium text-light-text-secondary">
                {config.label}
              </span>
            </div>
          </div>

          {/* Insight Text */}
          <p className="text-sm text-light-text leading-relaxed">
            "{insight}"
          </p>

          {/* Action Button */}
          {onAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAction}
              rightIcon={<ChevronRight size={16} />}
              className="w-full justify-between text-primary hover:bg-primary/10"
            >
              <div className="flex items-center gap-2">
                <MessageCircle size={14} />
                <span>{actionLabel}</span>
              </div>
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

export default AIInsightCard;
