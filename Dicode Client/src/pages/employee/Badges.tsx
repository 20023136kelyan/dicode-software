import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Lock, Flame, Bell, User, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBadgesRealtime, useUserStatsRealtime } from '@/hooks/useUserStats';
import { DesktopLayout } from '@/components/desktop';
import { NotificationsSheet } from '@/components/mobile';
import { useEmployeeNotifications, convertToUINotification } from '@/hooks/useEmployeeNotifications';
import AICopilot from '@/components/shared/AICopilot';
// All possible badges - IDs must match Cloud Functions BADGE_DEFINITIONS
const ALL_BADGES = [
  // Streak Badges
  { id: 'streak-7', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', category: 'streak' },
  { id: 'streak-30', name: 'Month Master', description: 'Maintain a 30-day streak', icon: '🔥', category: 'streak' },
  { id: 'streak-100', name: 'Streak Legend', description: 'Maintain a 100-day streak', icon: '🏆', category: 'streak' },

  // Completion Badges
  { id: 'first-completion', name: 'First Steps', description: 'Complete your first campaign', icon: '🎯', category: 'completion' },
  { id: 'campaigns-5', name: 'Getting Started', description: 'Complete 5 campaigns', icon: '📖', category: 'completion' },
  { id: 'campaigns-10', name: 'Dedicated Learner', description: 'Complete 10 campaigns', icon: '📚', category: 'completion' },
  { id: 'campaigns-25', name: 'Knowledge Seeker', description: 'Complete 25 campaigns', icon: '🧠', category: 'completion' },
  { id: 'campaigns-50', name: 'Learning Champion', description: 'Complete 50 campaigns', icon: '🏅', category: 'completion' },

  // Level Badges
  { id: 'level-5', name: 'Rising Star', description: 'Reach Level 5', icon: '⭐', category: 'level' },
  { id: 'level-10', name: 'Achiever', description: 'Reach Level 10', icon: '💫', category: 'level' },
  { id: 'level-20', name: 'Expert', description: 'Reach Level 20', icon: '💎', category: 'level' },
  { id: 'level-50', name: 'Master', description: 'Reach Level 50', icon: '👑', category: 'level' },

  // Skill Badges
  { id: 'skill-master', name: 'Skill Master', description: 'Reach Level 5 in any skill', icon: '🏅', category: 'skill' },
  { id: 'well-rounded', name: 'Well-Rounded', description: 'Reach Level 3+ in 5 different skills', icon: '🎓', category: 'skill' },

  // Special Badges
  { id: 'night-owl', name: 'Night Owl', description: 'Complete a campaign after 10pm', icon: '🦉', category: 'special' },
  { id: 'early-bird', name: 'Early Bird', description: 'Complete a campaign before 7am', icon: '🌅', category: 'special' },
];

const CATEGORY_LABELS: Record<string, string> = {
  streak: 'Streak Badges',
  completion: 'Completion Badges',
  level: 'Level Badges',
  skill: 'Skill Badges',
  special: 'Special Badges',
};

const Badges: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { badges: earnedBadges, isLoading } = useBadgesRealtime(user?.id || '');
  const { stats: userStats } = useUserStatsRealtime(user?.id || '');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const {
    notifications: rawNotifications,
    markAsRead,
    markAllAsRead,
  } = useEmployeeNotifications(user?.id || '');

  const notifications = rawNotifications.map(convertToUINotification);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Get earned badge IDs for quick lookup
  const earnedBadgeIds = new Set(earnedBadges.map(b => b.id));

  // Group badges by category
  const badgesByCategory = ALL_BADGES.reduce((acc, badge) => {
    if (!acc[badge.category]) {
      acc[badge.category] = [];
    }
    acc[badge.category].push({
      ...badge,
      earned: earnedBadgeIds.has(badge.id),
      earnedAt: earnedBadges.find(b => b.id === badge.id)?.earnedAt,
    });
    return acc;
  }, {} as Record<string, Array<typeof ALL_BADGES[0] & { earned: boolean; earnedAt?: any }>>);

  const earnedCount = earnedBadges.length;
  const totalCount = ALL_BADGES.length;

  // Desktop view renderer
  const renderDesktopView = () => {
    return (
      <DesktopLayout
        activePage="badges"
        title="Badges"
        breadcrumbs={[
          { label: 'Profile', path: '/employee/profile', icon: User },
          { label: 'Badges' }
        ]}
        rightContent={
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
            <Trophy size={16} className="text-purple-400" />
            <span className="text-purple-300 font-bold text-sm">{earnedCount}/{totalCount}</span>
          </div>
        }
        onAICopilotClick={() => setIsCopilotOpen(true)}
      >
        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto">
            {/* Progress Summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-[#00A3FF]/20 to-purple-500/20 rounded-2xl p-6 mb-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Trophy size={40} className="text-[#00A3FF]" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-1">Badges Earned</p>
                    <p className="text-4xl font-bold text-white">
                      {earnedCount} <span className="text-xl text-white/50">/ {totalCount}</span>
                    </p>
                    <p className="text-white/40 text-sm mt-1">
                      {totalCount - earnedCount} more to unlock
                    </p>
                  </div>
                </div>
                <div className="w-48">
                  <div className="flex justify-between text-sm text-white/40 mb-2">
                    <span>Progress</span>
                    <span>{Math.round((earnedCount / totalCount) * 100)}%</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#00A3FF] to-purple-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(earnedCount / totalCount) * 100}%` }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Badge Categories */}
            {isLoading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 bg-[#1a1a1a] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(badgesByCategory).map(([category, badges], categoryIndex) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: categoryIndex * 0.1 }}
                  >
                    <h2 className="text-white font-semibold text-lg mb-4">{CATEGORY_LABELS[category]}</h2>
                    <div className="grid grid-cols-6 gap-4">
                      {badges.map((badge, index) => (
                        <motion.div
                          key={badge.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: categoryIndex * 0.1 + index * 0.03 }}
                          className={`relative rounded-2xl p-4 flex flex-col items-center justify-center ${badge.earned
                            ? 'bg-[#1a1a1a] hover:bg-[#222]'
                            : 'bg-[#1a1a1a]/50'
                            } transition-colors cursor-pointer group`}
                        >
                          {/* Badge Icon */}
                          <span className={`text-5xl mb-2 ${badge.earned ? 'group-hover:scale-110 transition-transform' : 'grayscale opacity-30'}`}>
                            {badge.icon}
                          </span>

                          {/* Lock overlay for unearned */}
                          {!badge.earned && (
                            <div className="absolute top-3 right-3">
                              <Lock size={14} className="text-white/20" />
                            </div>
                          )}

                          {/* Badge name */}
                          <p className={`text-sm text-center font-medium ${badge.earned ? 'text-white' : 'text-white/30'
                            }`}>
                            {badge.name}
                          </p>

                          {/* Badge description */}
                          <p className={`text-xs text-center mt-1 ${badge.earned ? 'text-white/50' : 'text-white/20'
                            }`}>
                            {badge.description}
                          </p>

                          {/* Earned date */}
                          {badge.earned && badge.earnedAt && (
                            <p className="text-[10px] text-[#00A3FF] mt-2">
                              Earned {new Date(badge.earnedAt.toDate?.() || badge.earnedAt).toLocaleDateString()}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
        {isCopilotOpen && (
          <AICopilot
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
            context={{ userRole: 'employee' }}
          />
        )}
      </DesktopLayout>
    );
  };

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:block">
        {renderDesktopView()}
      </div>

      {/* Mobile View */}
      <div className="min-h-screen bg-black pb-24 lg:hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-white" />
            </button>
            <h1 className="text-lg font-semibold text-white">Badges</h1>
            <div className="w-10" />
          </div>
        </header>

        {/* Progress Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 bg-gradient-to-br from-[#00A3FF]/20 to-purple-500/20 rounded-2xl p-5"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
              <Trophy size={32} className="text-[#00A3FF]" />
            </div>
            <div>
              <p className="text-white/50 text-sm">Badges Earned</p>
              <p className="text-3xl font-bold text-white">
                {earnedCount} <span className="text-lg text-white/50">/ {totalCount}</span>
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#00A3FF] to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(earnedCount / totalCount) * 100}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
            />
          </div>
        </motion.div>

        {/* Badge Categories */}
        <div className="px-4 py-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-[#1a1a1a] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            Object.entries(badgesByCategory).map(([category, badges], categoryIndex) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: categoryIndex * 0.1 }}
              >
                <h2 className="text-white font-semibold mb-3">{CATEGORY_LABELS[category]}</h2>
                <div className="grid grid-cols-4 gap-3">
                  {badges.map((badge, index) => (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: categoryIndex * 0.1 + index * 0.05 }}
                      className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center p-2 ${badge.earned
                        ? 'bg-[#1a1a1a]'
                        : 'bg-[#1a1a1a]/50'
                        }`}
                    >
                      {/* Badge Icon */}
                      <span className={`text-3xl ${badge.earned ? '' : 'grayscale opacity-30'}`}>
                        {badge.icon}
                      </span>

                      {/* Lock overlay for unearned */}
                      {!badge.earned && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock size={16} className="text-white/20" />
                        </div>
                      )}

                      {/* Badge name */}
                      <p className={`text-[10px] text-center mt-1 leading-tight ${badge.earned ? 'text-white/70' : 'text-white/30'
                        }`}>
                        {badge.name}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default Badges;

