import React from 'react';
import { motion } from 'framer-motion';
import { Play, BookOpen } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';

interface ContinueCardProps {
  campaignTitle: string;
  nextModuleTitle: string;
  progress: number;
  totalModules: number;
  completedModules: number;
  thumbnailUrl?: string;
  onContinue: () => void;
  className?: string;
}

const ContinueCard: React.FC<ContinueCardProps> = ({
  campaignTitle,
  nextModuleTitle,
  progress,
  totalModules,
  completedModules,
  thumbnailUrl,
  onContinue,
  className = '',
}) => {
  return (
    <Card
      className={`relative overflow-hidden ${className}`}
      padding="none"
    >
      {/* Background gradient or thumbnail */}
      {thumbnailUrl ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/80 to-primary/70" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-accent" />
      )}

      {/* Content */}
      <div className="relative p-5 text-white">
        {/* Label */}
        <div className="flex items-center gap-2 text-white/80 text-xs font-medium mb-2">
          <BookOpen size={14} />
          <span>CONTINUE WHERE YOU LEFT OFF</span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold mb-1">{campaignTitle}</h3>
        <p className="text-white/70 text-sm mb-4">Next: {nextModuleTitle}</p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="text-white/70 text-xs mt-1">
            {completedModules}/{totalModules} modules · {progress}% complete
          </p>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onContinue}
          variant="secondary"
          className="bg-white text-primary hover:bg-white/90"
          leftIcon={<Play size={16} fill="currentColor" />}
        >
          Continue
        </Button>
      </div>
    </Card>
  );
};

export default ContinueCard;
