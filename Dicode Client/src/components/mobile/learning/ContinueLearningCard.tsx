import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ChevronRight, Play, CheckCircle, Inbox, ArrowRight } from 'lucide-react';
import type { Campaign, CampaignEnrollment } from '@/types';

type CardState = 'continue' | 'jump-in' | 'completed' | 'empty';

interface ContinueLearningCardProps {
  campaign?: Campaign | null;
  enrollment?: CampaignEnrollment | null;
  state: CardState;
  thumbnailUrl?: string | null;
  onPress: () => void;
  className?: string;
}

const ContinueLearningCard: React.FC<ContinueLearningCardProps> = ({
  campaign,
  enrollment,
  state,
  thumbnailUrl,
  onPress,
  className = '',
}) => {
  // Calculate progress - based on partial module completion (video + questions)
  const totalModules = campaign?.items?.length || enrollment?.totalModules || 0;
  const moduleProgressMap = enrollment?.moduleProgress || {};
  const completedModules = enrollment
    ? (enrollment.completedModules ??
       Object.values(moduleProgressMap).filter((m) => m.completed).length)
    : 0;
  
  // Calculate overall progress based on partial module progress (like CampaignDetails)
  const progressPercent = totalModules > 0 ? Math.round(
    (campaign?.items || []).reduce((sum, item) => {
      const moduleState = moduleProgressMap[item.id];
      if (!moduleState) return sum;
      
      const questionTarget = moduleState.questionTarget || 3;
      const progressRatio = ((moduleState.videoFinished ? 1 : 0) +
        Math.min(moduleState.questionsAnswered || 0, questionTarget)) /
        (questionTarget + 1);
      return sum + progressRatio;
    }, 0) / totalModules * 100
  ) : 0;

  // Determine if actually completed (all modules done)
  const isActuallyCompleted = totalModules > 0 && completedModules >= totalModules;

  // Check if user has started (any partial progress)
  const hasStarted = progressPercent > 0 || enrollment?.status === 'in-progress' || Object.keys(moduleProgressMap).length > 0;

  // Determine actual state based on progress (override passed state if needed)
  const actualState = (() => {
    // If progress shows completed, override to completed state
    if (isActuallyCompleted || enrollment?.status === 'completed') {
      return 'completed';
    }
    // If has any progress, should be continue state
    if (hasStarted) {
      return 'continue';
    }
    // Otherwise use the passed state
    return state;
  })();

  // Find the current module being worked on (first incomplete one)
  const currentModuleIndex = (campaign?.items || []).findIndex(item => {
    const moduleState = moduleProgressMap[item.id];
    return !moduleState?.completed;
  });
  const currentModuleNum = currentModuleIndex === -1 ? totalModules : currentModuleIndex + 1;

  // Get state-specific content
  const getStateContent = () => {
    switch (actualState) {
      case 'continue':
        return {
          sectionTitle: 'Continue Learning',
          label: 'IN PROGRESS',
          labelIcon: <Play size={10} fill="currentColor" />,
          subtitle: `Module ${currentModuleNum} of ${totalModules}`,
          labelColor: 'text-[#00A3FF]',
        };
      case 'jump-in':
        return {
          sectionTitle: 'Jump in Lessons',
          label: 'NEW CAMPAIGN',
          labelIcon: <BookOpen size={10} />,
          subtitle: `${totalModules} modules to complete`,
          labelColor: 'text-[#00A3FF]',
        };
      case 'completed':
        return {
          sectionTitle: 'Recent Achievement',
          label: 'COMPLETED',
          labelIcon: <CheckCircle size={10} />,
          subtitle: `All ${totalModules} modules finished`,
          labelColor: 'text-emerald-400',
        };
      default:
        return {
          sectionTitle: 'Jump in Lessons',
          label: '',
          labelIcon: null,
          subtitle: '',
          labelColor: 'text-[#00A3FF]',
        };
    }
  };

  const { sectionTitle, label, labelIcon, subtitle, labelColor } = getStateContent();

  // Empty state
  if (actualState === 'empty') {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Jump in Lessons</h2>
        </div>
        <motion.div
          className="min-h-[200px] rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col items-center justify-center text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <Inbox size={28} className="text-white/40" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Looking empty here</h3>
          <p className="text-sm text-white/50 max-w-[240px]">
            Your organization hasn't assigned you any learning campaigns yet.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">{sectionTitle}</h2>
        <button 
          onClick={onPress}
          className="flex items-center gap-1 text-sm font-medium text-white/50"
        >
          See all
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Card */}
      <motion.button
        onClick={onPress}
        className="group relative w-full min-h-[200px] rounded-3xl overflow-hidden text-left"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Background - Image or Gradient */}
        {thumbnailUrl ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url(${thumbnailUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/50" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
            {/* Decorative icon when no thumbnail */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
              <BookOpen size={200} className="text-white" />
            </div>
          </>
        )}

        {/* Content */}
        <div className="relative z-10 h-full min-h-[200px] p-6 flex flex-col">
          {/* Top: Label */}
          <div className={`flex items-center gap-2 ${labelColor} text-[10px] font-bold uppercase tracking-[0.2em]`}>
            {labelIcon}
            <span>{label}</span>
          </div>

          {/* Middle: Title & Subtitle */}
          <div className="mt-3 flex-1">
            <h3 className="text-white text-xl font-bold leading-tight line-clamp-2">
              {campaign?.title || 'Untitled Campaign'}
            </h3>
            <p className="text-white/60 text-sm mt-2">
              {subtitle}
            </p>
          </div>

          {/* Bottom: Progress */}
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between text-xs text-white/60 mb-2">
              <span>Completion</span>
              <span className="text-white font-semibold">{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Arrow indicator */}
          <div className="absolute top-6 right-6">
            <ArrowRight size={20} className="text-white/50 group-hover:text-white/80 transition-colors" />
          </div>
        </div>
      </motion.button>
    </div>
  );
};

export default ContinueLearningCard;
