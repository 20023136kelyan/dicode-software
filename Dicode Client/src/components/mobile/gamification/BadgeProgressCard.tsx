import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

// Badge definition with trackable criteria
interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'completion' | 'level' | 'skill';
  requirement: number;
  getValue: (stats: BadgeStats) => number;
}

interface BadgeStats {
  currentStreak: number;
  completedCampaigns: number;
  level: number;
  maxSkillLevel: number;
  skillsAtLevel3Plus: number;
}

interface BadgeProgressCardProps {
  stats: BadgeStats;
  earnedBadgeIds: string[];
  className?: string;
}

// Trackable badges - IDs must match Cloud Functions BADGE_DEFINITIONS
const TRACKABLE_BADGES: BadgeDefinition[] = [
  // Completion Badges (first, since first-completion is easiest)
  { id: 'first-completion', name: 'First Steps', description: 'Complete your first campaign', icon: '🎯', category: 'completion', requirement: 1, getValue: (s) => s.completedCampaigns },
  { id: 'campaigns-5', name: 'Getting Started', description: 'Complete 5 campaigns', icon: '📖', category: 'completion', requirement: 5, getValue: (s) => s.completedCampaigns },
  { id: 'campaigns-10', name: 'Dedicated Learner', description: 'Complete 10 campaigns', icon: '📚', category: 'completion', requirement: 10, getValue: (s) => s.completedCampaigns },
  { id: 'campaigns-25', name: 'Knowledge Seeker', description: 'Complete 25 campaigns', icon: '🧠', category: 'completion', requirement: 25, getValue: (s) => s.completedCampaigns },
  { id: 'campaigns-50', name: 'Learning Champion', description: 'Complete 50 campaigns', icon: '🏅', category: 'completion', requirement: 50, getValue: (s) => s.completedCampaigns },
  
  // Streak Badges
  { id: 'streak-7', name: 'Week Warrior', description: '7-day streak', icon: '🔥', category: 'streak', requirement: 7, getValue: (s) => s.currentStreak },
  { id: 'streak-30', name: 'Month Master', description: '30-day streak', icon: '🔥', category: 'streak', requirement: 30, getValue: (s) => s.currentStreak },
  { id: 'streak-100', name: 'Streak Legend', description: '100-day streak', icon: '🏆', category: 'streak', requirement: 100, getValue: (s) => s.currentStreak },
  
  // Level Badges
  { id: 'level-5', name: 'Rising Star', description: 'Reach Level 5', icon: '⭐', category: 'level', requirement: 5, getValue: (s) => s.level },
  { id: 'level-10', name: 'Achiever', description: 'Reach Level 10', icon: '💫', category: 'level', requirement: 10, getValue: (s) => s.level },
  { id: 'level-20', name: 'Expert', description: 'Reach Level 20', icon: '💎', category: 'level', requirement: 20, getValue: (s) => s.level },
  { id: 'level-50', name: 'Master', description: 'Reach Level 50', icon: '👑', category: 'level', requirement: 50, getValue: (s) => s.level },
  
  // Skill Badges
  { id: 'skill-master', name: 'Skill Master', description: 'Reach Lv.5 in any skill', icon: '🏅', category: 'skill', requirement: 5, getValue: (s) => s.maxSkillLevel },
  { id: 'well-rounded', name: 'Well-Rounded', description: '5 skills at Lv.3+', icon: '🎓', category: 'skill', requirement: 5, getValue: (s) => s.skillsAtLevel3Plus },
];

const BadgeProgressCard: React.FC<BadgeProgressCardProps> = ({
  stats,
  earnedBadgeIds,
  className = '',
}) => {
  // Find the closest unearned badge
  const closestBadge = useMemo(() => {
    const unearnedBadges = TRACKABLE_BADGES.filter(b => !earnedBadgeIds.includes(b.id));
    
    if (unearnedBadges.length === 0) {
      return null; // All badges earned!
    }
    
    // Calculate progress for each unearned badge
    const badgesWithProgress = unearnedBadges.map(badge => {
      const currentValue = badge.getValue(stats);
      const progress = Math.min((currentValue / badge.requirement) * 100, 100);
      const remaining = Math.max(badge.requirement - currentValue, 0);
      return { ...badge, currentValue, progress, remaining };
    });
    
    // Sort by progress (highest first), then by requirement (lowest first for ties)
    badgesWithProgress.sort((a, b) => {
      if (b.progress !== a.progress) return b.progress - a.progress;
      return a.requirement - b.requirement;
    });
    
    return badgesWithProgress[0];
  }, [stats, earnedBadgeIds]);

  if (!closestBadge) {
    // All badges earned - show congratulations
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Next Badge</h2>
        </div>
        <motion.div
          className="rounded-3xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 backdrop-blur-md p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-3xl">
              👑
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold">All Badges Earned!</p>
              <p className="text-white/60 text-sm">You've mastered everything</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const progressPercent = closestBadge.progress;

  // Category colors
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'streak': return 'from-orange-500 to-red-500';
      case 'completion': return 'from-blue-500 to-cyan-500';
      case 'level': return 'from-purple-500 to-pink-500';
      case 'skill': return 'from-green-500 to-emerald-500';
      default: return 'from-[#0077B3] to-[#00C2FF]';
    }
  };

  const categoryLabel = {
    streak: 'Streak',
    completion: 'Completion',
    level: 'Level',
    skill: 'Skill',
  }[closestBadge.category];

  return (
    <div className={className}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Next Badge</h2>
        <div className="flex items-center gap-1.5">
          <Trophy size={16} className="text-amber-500" />
          <span className="text-amber-500 text-sm font-medium">{categoryLabel}</span>
        </div>
      </div>

      {/* Badge Card */}
      <motion.div
        className="rounded-3xl bg-white/5 backdrop-blur-md p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Badge Info */}
        <div className="flex items-center gap-4 mb-4">
          {/* Badge Icon */}
          <motion.div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getCategoryColor(closestBadge.category)} flex items-center justify-center text-3xl`}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            {closestBadge.icon}
          </motion.div>
          
          {/* Badge Details */}
          <div className="flex-1">
            <p className="text-white font-semibold">{closestBadge.name}</p>
            <p className="text-white/60 text-sm">{closestBadge.description}</p>
          </div>
          
          {/* Progress Numbers */}
          <div className="text-right">
            <span className="text-[#00A3FF] font-bold text-lg">{closestBadge.currentValue}</span>
            <span className="text-slate-400 text-sm">/{closestBadge.requirement}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          {/* Background track */}
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            {/* Progress fill */}
            <motion.div
              className={`h-full bg-gradient-to-r ${getCategoryColor(closestBadge.category)} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          
          {/* Percentage label */}
          <div className="flex justify-between mt-2">
            <span className="text-white/40 text-xs">
              {closestBadge.remaining} more to go
            </span>
            <span className="text-white/60 text-xs font-medium">
              {Math.round(progressPercent)}%
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BadgeProgressCard;

