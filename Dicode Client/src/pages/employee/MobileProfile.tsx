import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  Shield,
  Bell,
  HelpCircle,
  FileText,
  LogOut,
  Flame,
  Star,
  Zap,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStatsWithFallback, useSkillScoresRealtime, getSortedCompetencies, useBadgesRealtime, getRecentBadges } from '@/hooks/useUserStats';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { Avatar } from '@/components/mobile';
import type { CompetencyScoreAggregate } from '@/types';

// Menu item type
interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  danger?: boolean;
}

interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

const MobileProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Real-time enrollments and stats (consistent with MobileHome)
  const { enrollments, isLoading: isLoadingEnrollments } = useUserEnrollmentsRealtime(user?.id || '');
  const { stats: streakStats } = useUserStatsWithFallback(user?.id || '', enrollments);
  
  // Real-time skill scores from Cloud Function computations
  const { skillScores: skillScoresData, isLoading: isLoadingSkills } = useSkillScoresRealtime(user?.id || '');

  // Real-time badges from Cloud Function computations
  const { badges: userBadges, isLoading: isLoadingBadges } = useBadgesRealtime(user?.id || '');
  
  // Derive stats from real-time data
  const completedEnrollments = enrollments.filter((e) => e.status === 'completed');
  const completedModules = completedEnrollments.length;
  
  // Calculate activity stats (completions per time period)
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const completionsThisWeek = completedEnrollments.filter((e) => {
    if (!e.completedAt) return false;
    const completedDate = new Date(e.completedAt);
    return completedDate >= oneWeekAgo;
  }).length;
  
  const completionsThisMonth = completedEnrollments.filter((e) => {
    if (!e.completedAt) return false;
    const completedDate = new Date(e.completedAt);
    return completedDate >= oneMonthAgo;
  }).length;
  
  // User stats from server-computed data (XP, level from userStats collection)
  const userStats = {
          completedModules,
          totalModules: enrollments.length,
    totalXP: streakStats.totalXp,
    level: streakStats.level,
  };

  // Get sorted competencies from real-time data
  const topCompetencies: CompetencyScoreAggregate[] = getSortedCompetencies(skillScoresData.competencyScores);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get recent badges (up to 5)
  const recentBadges = getRecentBadges(userBadges, 5);

  const menuGroups: MenuGroup[] = [
    {
      title: 'Account',
      items: [
        { id: 'edit', label: 'Edit Profile', icon: User, onClick: () => navigate('/employee/edit-profile') },
        { id: 'security', label: 'Security', icon: Shield, onClick: () => navigate('/employee/security') },
        { id: 'notifications', label: 'Notifications', icon: Bell, onClick: () => navigate('/employee/notifications') },
      ],
    },
    {
      title: 'Support',
      items: [
        { id: 'help', label: 'Help Center', icon: HelpCircle, onClick: () => navigate('/employee/help') },
        { id: 'privacy', label: 'Privacy Policy', icon: FileText, onClick: () => navigate('/employee/privacy') },
      ],
    },
    {
      items: [
        { id: 'logout', label: 'Log Out', icon: LogOut, onClick: handleLogout, danger: true },
      ],
    },
  ];

  // Check if we have real competency data
  const hasRealCompetencyData = topCompetencies.length > 0;
  
  const isLoading = isLoadingEnrollments || isLoadingSkills || isLoadingBadges;
  
  // Level badge colors
  const getLevelColor = (level: number) => {
    switch (level) {
      case 5: return 'bg-yellow-500 text-black';
      case 4: return 'bg-purple-500 text-white';
      case 3: return 'bg-blue-500 text-white';
      case 2: return 'bg-green-500 text-white';
      default: return 'bg-white/20 text-white/70';
    }
  };

  // Calculate progress to next level based on score thresholds
  const getLevelProgress = (level: number, score: number) => {
    const thresholds: Record<number, { min: number; max: number }> = {
      1: { min: 0, max: 50 },    // Level 1 -> 2 requires score >= 50
      2: { min: 50, max: 65 },   // Level 2 -> 3 requires score >= 65
      3: { min: 65, max: 80 },   // Level 3 -> 4 requires score >= 80
      4: { min: 80, max: 90 },   // Level 4 -> 5 requires score >= 90
      5: { min: 90, max: 100 },  // Max level
    };
    
    const current = thresholds[level] || thresholds[1];
    const range = current.max - current.min;
    const progress = Math.min(100, Math.max(0, ((score - current.min) / range) * 100));
    const pointsToNext = level < 5 ? Math.max(0, current.max - score) : 0;
    
    return { progress, pointsToNext, nextLevel: level < 5 ? level + 1 : null };
  };

  return (
    <div className="min-h-screen lg:hidden pb-24 bg-black">

      {/* Sticky Profile Header */}
      <header className="sticky top-0 z-40 lg:hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f14]/95 to-transparent backdrop-blur-md" />
        <div className="relative px-4 pt-8 pb-4">
        {/* Top Row: Avatar + Info */}
        <div className="flex items-center gap-4 mb-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar
              src={user?.avatar}
              name={user?.name}
                size="lg"
            />
          </div>

          {/* Name & Info */}
          <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white truncate">{user?.name || 'User'}</h1>
                <span className="px-2 py-0.5 bg-[#00A3FF] text-white text-xs font-medium rounded-full">
                  Lv.{userStats.level}
                </span>
              </div>
            {user?.department && (
                <p className="text-white/40 text-sm mt-0.5">{user.department}</p>
            )}

            {/* Tags Row */}
              {(streakStats.currentStreak >= 7 || userStats.completedModules >= 10) && (
            <div className="flex flex-wrap gap-2 mt-3">
                  {streakStats.currentStreak >= 7 && (
                <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full flex items-center gap-1">
                  <Flame size={12} />
                  On Fire
                </span>
              )}
              {userStats.completedModules >= 10 && (
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
                  Top Learner
                </span>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Stats Row */}
          <div className="flex items-center justify-between py-3 px-2 bg-black/40 rounded-2xl border border-white/5">
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Star size={14} className="text-yellow-500" />
            </div>
            <p className="text-lg font-bold text-white">{userStats.level}</p>
            <p className="text-[10px] text-white/50">Level</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Flame size={14} className="text-orange-500" />
            </div>
              <p className="text-lg font-bold text-white">{streakStats.currentStreak}d</p>
            <p className="text-[10px] text-white/50">Streak</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Zap size={14} className="text-[#00A3FF]" />
            </div>
            <p className="text-lg font-bold text-white">{userStats.totalXP.toLocaleString()}</p>
            <p className="text-[10px] text-white/50">XP</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <BookOpen size={14} className="text-green-500" />
            </div>
            <p className="text-lg font-bold text-white">{userStats.completedModules}</p>
            <p className="text-[10px] text-white/50">Completed</p>
          </div>
        </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 pt-4 space-y-5">

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-40 bg-[#1a1a1a] rounded-2xl animate-pulse" />
            <div className="h-32 bg-[#1a1a1a] rounded-2xl animate-pulse" />
          </div>
        ) : (
          <>
            {/* Competency Progress */}
            <motion.div
              className="bg-[#1a1a1a] rounded-2xl p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-white font-semibold mb-4">Competency Progress</h2>
              {hasRealCompetencyData ? (
                <div className="space-y-4">
                  {topCompetencies.map((competency, index) => {
                    const { progress, pointsToNext, nextLevel } = getLevelProgress(competency.level, competency.currentScore);
                    
                    return (
                      <div key={competency.competencyId}>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="text-white">{competency.competencyName}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getLevelColor(competency.level)}`}>
                            Lv.{competency.level}
                          </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                            className="h-full bg-white rounded-full"
                        initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      />
                    </div>
                        <div className="flex justify-between text-[10px] text-white/30 mt-1">
                          <span>{competency.assessedSkillCount}/{competency.skillCount} skills assessed</span>
                          {nextLevel ? (
                            <span>{Math.round(pointsToNext)} pts to Lv.{nextLevel}</span>
                          ) : (
                            <span>Max level reached</span>
                          )}
                  </div>
              </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-white/50 text-sm">Complete video assessments to see your competency progress</p>
                  <p className="text-white/30 text-xs mt-1">Competencies are tracked automatically as you learn</p>
              </div>
              )}
            </motion.div>


            {/* Badges */}
            <motion.div
              className="bg-[#1a1a1a] rounded-2xl p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Badges</h2>
                <button
                  onClick={() => navigate('/employee/badges')}
                  className="text-[#00A3FF] text-sm font-medium flex items-center gap-1"
                >
                  View All
                  <ChevronRight size={16} />
                </button>
              </div>
              {recentBadges.length > 0 ? (
              <div className="grid grid-cols-5 gap-2">
                {recentBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="aspect-square bg-white/5 rounded-xl flex items-center justify-center text-2xl"
                      title={badge.name}
                  >
                    {badge.icon}
                  </div>
                ))}
              </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-white/50 text-sm">Complete campaigns to earn badges!</p>
                </div>
              )}
            </motion.div>

            {/* Activity Summary */}
            <motion.div
              className="bg-[#1a1a1a] rounded-2xl p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={18} className="text-[#00A3FF]" />
                <h2 className="text-white font-semibold">Activity</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{completionsThisWeek}</p>
                  <p className="text-xs text-white/50">This week</p>
                </div>
                <div className="text-center border-x border-white/10">
                  <p className="text-lg font-bold text-white">{completionsThisMonth}</p>
                  <p className="text-xs text-white/50">This month</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{completedModules}</p>
                  <p className="text-xs text-white/50">All time</p>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Menu */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {menuGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="bg-[#1a1a1a] rounded-2xl overflow-hidden">
              {group.title && (
                <p className="text-xs text-white/40 font-medium px-4 pt-3 pb-1">{group.title}</p>
              )}
              {group.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${
                      itemIndex < group.items.length - 1 ? 'border-b border-white/5' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      item.danger ? 'bg-red-500/10' : 'bg-white/5'
                    }`}>
                      <Icon size={18} className={item.danger ? 'text-red-500' : 'text-white/70'} />
                    </div>
                    <span className={`flex-1 text-left ${item.danger ? 'text-red-500' : 'text-white'}`}>
                      {item.label}
                    </span>
                    <ChevronRight size={18} className="text-white/30" />
                  </button>
                );
              })}
            </div>
          ))}
        </motion.div>

        {/* App Version */}
        <p className="text-center text-xs text-white/30 py-4">
          Dicode v1.0.0
        </p>
      </div>
    </div>
  );
};

export default MobileProfile;
