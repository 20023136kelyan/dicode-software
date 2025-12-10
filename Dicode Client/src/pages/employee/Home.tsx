import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Search, Play, Check, ChevronRight, Globe, Building2, Sparkles, Bot, Shield, Users, Handshake, Heart, Lightbulb, MessageCircle, Layers, Star, Home as HomeIcon, LogOut, Flame, Trophy, Target, TrendingUp, BarChart3, Bell, Zap, Award, Inbox, X, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { getPublishedCampaigns, getVideo } from '@/lib/firestore';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { useUserStatsWithFallback, updateLastCelebratedLevel, useBadgesRealtime, useSkillScoresRealtime } from '@/hooks/useUserStats';
import { useEmployeeNotifications, convertToUINotification } from '@/hooks/useEmployeeNotifications';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import type { Campaign, CampaignEnrollment } from '@/types';
import AICopilot from '@/components/shared/AICopilot';
import Avatar from '@/components/shared/Avatar';
import { Skeleton } from '@/components/shared/Skeleton';
import { DesktopSidebar, GlobalSearchOverlay } from '@/components/desktop';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import confetti from 'canvas-confetti';
import MobileHome from './MobileHome';

// User stats types for gamification
interface UserStats {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  modulesCompleted: number;
  averageScore: number;
  badges: string[];
  dailyGoal: {
    target: number;
    completed: number;
  };
}

// Level titles based on XP thresholds
const getLevelTitle = (level: number): string => {
  if (level <= 5) return 'Beginner';
  if (level <= 15) return 'Learner';
  if (level <= 30) return 'Practitioner';
  if (level <= 50) return 'Expert';
  return 'Master';
};

// Calculate level from total XP
const calculateLevel = (totalXP: number): { level: number; currentXP: number; xpToNextLevel: number } => {
  // Level thresholds: each level requires progressively more XP
  const xpPerLevel = 100; // Base XP per level
  const level = Math.floor(totalXP / xpPerLevel) + 1;
  const currentXP = totalXP % xpPerLevel;
  const xpToNextLevel = xpPerLevel;
  return { level, currentXP, xpToNextLevel };
};

// Helper to format time ago
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15
    } as const
  }
};

// Competency color gradients - muted enterprise palette
const competencyStyles: Record<
  string,
  {
    gradient: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }
> = {
  'Foster Psychological Safety': { gradient: 'from-slate-600 to-slate-700', icon: Shield },
  'Establish Prosocial Norms': { gradient: 'from-blue-600 to-blue-700', icon: Users },
  'Build Trust': { gradient: 'from-emerald-600 to-emerald-700', icon: Handshake },
  'Promote Inclusion': { gradient: 'from-amber-600 to-amber-700', icon: Heart },
  'Encourage Growth Mindset': { gradient: 'from-indigo-600 to-indigo-700', icon: Lightbulb },
  'Develop Empathy': { gradient: 'from-rose-600 to-rose-700', icon: MessageCircle },
  'Strengthen Communication': { gradient: 'from-cyan-600 to-cyan-700', icon: Layers },
  'Foster Collaboration': { gradient: 'from-teal-600 to-teal-700', icon: Star },
};

const getCompetencyGradient = (competency: string): string => {
  return competencyStyles[competency]?.gradient || 'from-slate-500 to-slate-600';
};

// Gradient colors for competency cards (from Learn.tsx)
const cardGradients = [
  'from-orange-400 to-orange-500',
  'from-blue-400 to-blue-500',
  'from-sky-400 to-sky-500',
  'from-purple-400 to-purple-500',
  'from-pink-400 to-pink-500',
  'from-green-400 to-green-500',
];

// Professional emojis for competencies
const competencyEmojis = [
  '📊', '💡', '🎯', '🧠', '📈', '🤝', '💬', '🏆',
  '⚡', '🔑', '📚', '🎓', '💪', '🌟', '🧭', '🔍',
  '📝', '🎨', '🛠️', '🌱', '🎪', '🧩', '📣', '🔬',
];

// Get consistent emoji for a skill name using hash
const getCompetencyEmoji = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % competencyEmojis.length;
  return competencyEmojis[index];
};

const EmployeeHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);

  // Global search
  const { openSearch } = useGlobalSearch();

  // Cmd+K / Ctrl+K keyboard shortcut for global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  // Real-time enrollments hook
  const { enrollments, isLoading: isLoadingEnrollments } = useUserEnrollmentsRealtime(user?.id || '');
  const { stats: streakStats } = useUserStatsWithFallback(user?.id || '', enrollments);

  // Real-time badges and skill scores (for feature parity with mobile)
  const { badges: userBadges } = useBadgesRealtime(user?.id || '');
  const { skillScores } = useSkillScoresRealtime(user?.id || '');

  // Real-time notifications
  const {
    notifications: rawNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useEmployeeNotifications(user?.id || '');

  // Convert notifications to UI format
  const notifications = useMemo(() =>
    rawNotifications.map(convertToUINotification),
    [rawNotifications]
  );

  // Leaderboard data
  const { leaderboard } = useLeaderboard(user?.organization || '', user?.id || '');

  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');
  const displayedNotifications = notificationFilter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [mobileNavTab, setMobileNavTab] = useState<'home' | 'progress' | 'profile'>('home');
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ previousLevel: number; newLevel: number; xpEarned: number } | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [newBadges, setNewBadges] = useState<any[]>([]);

  // Track previous XP for calculating XP earned
  const prevTotalXpRef = useRef(streakStats.totalXp);
  const prevLevelRef = useRef(streakStats.level);

  // Detect level-up - only show when level actually increases during session
  useEffect(() => {
    // Skip if stats haven't loaded yet or no user
    if (!user?.id || streakStats.level === 0) {
      return;
    }

    // Check session storage for levels we've already celebrated this session
    const sessionCelebratedKey = `levelup_session_${user.id}`;
    const sessionCelebrated = parseInt(sessionStorage.getItem(sessionCelebratedKey) || '0', 10);

    // Initialize refs on first load
    if (prevLevelRef.current === 0) {
      prevLevelRef.current = streakStats.level;
      prevTotalXpRef.current = streakStats.totalXp;

      // Store current level in session to prevent re-showing on navigation
      if (sessionCelebrated < streakStats.level) {
        sessionStorage.setItem(sessionCelebratedKey, streakStats.level.toString());
      }

      // Also update Firestore if needed (but don't show modal on initial load)
      const lastCelebratedLevel = streakStats.lastCelebratedLevel || 0;
      if (lastCelebratedLevel < streakStats.level) {
        updateLastCelebratedLevel(user.id, streakStats.level);
      }
      return;
    }

    // Real level-up detection: level increased since last render
    if (streakStats.level > prevLevelRef.current && streakStats.level > sessionCelebrated) {
      const xpEarned = streakStats.totalXp - prevTotalXpRef.current;

      setLevelUpData({
        previousLevel: prevLevelRef.current,
        newLevel: streakStats.level,
        xpEarned: xpEarned > 0 ? xpEarned : streakStats.xpInCurrentLevel + 100,
      });
      setShowLevelUpModal(true);

      // Update both session storage and Firestore
      sessionStorage.setItem(sessionCelebratedKey, streakStats.level.toString());
      updateLastCelebratedLevel(user.id, streakStats.level);

      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.5 }
      });
    }

    prevLevelRef.current = streakStats.level;
    prevTotalXpRef.current = streakStats.totalXp;
  }, [streakStats.level, streakStats.totalXp, streakStats.xpInCurrentLevel, streakStats.lastCelebratedLevel, user?.id]);

  // Calculate user stats from server-computed streakStats
  const userStats: UserStats = useMemo(() => {
    const completedModules = enrollments.reduce((acc, e) => acc + (e.completedModules || 0), 0);

    // Calculate XP progress within current level
    const xpPerLevel = streakStats.level <= 10 ? 100 : streakStats.level <= 25 ? 200 : streakStats.level <= 50 ? 400 : 800;
    const currentXP = streakStats.xpInCurrentLevel || 0;

    return {
      level: streakStats.level,
      currentXP,
      xpToNextLevel: streakStats.xpToNextLevel || xpPerLevel,
      totalXP: streakStats.totalXp,
      currentStreak: streakStats.currentStreak,
      longestStreak: streakStats.longestStreak,
      modulesCompleted: completedModules,
      averageScore: 0, // Would need to compute from responses
      badges: [], // Badges now tracked separately
      dailyGoal: {
        target: 1,
        completed: streakStats.completedToday ? 1 : 0
      }
    };
  }, [streakStats, enrollments]);
  const [selectedCompetency, setSelectedCompetency] = useState<string>('All');
  const [inProgressOnly, setInProgressOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'organization' | 'dicode'>('all');
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cmd+K Search Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load published campaigns (enrollments are handled by real-time hook)
  const loadData = React.useCallback(async () => {
    if (!user) return;

    setIsLoadingCampaigns(true);
    try {
      const campaignsData = await getPublishedCampaigns(
        user.organization,
        user.department,
        user.id,
        user.cohortIds
      );

      setCampaigns(campaignsData);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, [user?.organization, user?.department, user?.id, user?.cohortIds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Convert campaigns to module format
  const campaignModules = useMemo(() => {
    return campaigns.map((campaign) => {
      const totalVideos = campaign.metadata.computed?.totalItems ?? campaign.items?.length ?? 0;
      return {
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        duration: `${totalVideos} videos`,
        competencies: campaign.metadata.tags || [campaign.skillFocus],
        totalVideos,
        source: campaign.source || 'organization',
        items: campaign.items, // Include items for thumbnail access
        endDate: campaign.schedule?.endDate, // Include end date for display
        // Include computed metrics for display
        estimatedMinutes: campaign.metadata.computed?.estimatedMinutes ?? 0,
        totalXP: campaign.metadata.computed?.totalXP ?? 0,
      };
    });
  }, [campaigns]);

  // Use real campaigns only - no mock fallback
  const modules = campaignModules;

  const competencyFilters = useMemo(() => {
    const unique = new Set<string>();
    modules.forEach((module) => {
      module.competencies.forEach((competency) => {
        if (competency) {
          unique.add(competency);
        }
      });
    });

    return ['All', ...Array.from(unique)];
  }, [modules]);

  const sourceFilterOptions = useMemo(
    () =>
      [
        { label: 'All Sources', value: 'all' as const, icon: Globe },
        { label: 'Your Org', value: 'organization' as const, icon: Building2 },
        { label: 'DI Code', value: 'dicode' as const, icon: Sparkles },
      ] satisfies { label: string; value: 'all' | 'organization' | 'dicode'; icon: LucideIcon }[],
    []
  );

  // Calculate progress for each module from Firestore enrollments
  const modulesWithProgress = useMemo(() => {
    return modules.map((module) => {
      // Find enrollment for this campaign
      const enrollment = enrollments.find(e => e.campaignId === module.id);

      let completionPercentage = 0;
      let completed = false;
      let nextVideoIndex = 0;

      let status: CampaignEnrollment['status'] = 'not-started';
      if (enrollment) {
        status = enrollment.status;
        const completedModules =
          enrollment.completedModules ??
          Object.values(enrollment.moduleProgress || {}).filter((m) => m.completed).length;
        completionPercentage =
          module.totalVideos === 0
            ? 0
            : Math.round((completedModules / module.totalVideos) * 100);
        completed = module.totalVideos > 0 && completionPercentage === 100;
        nextVideoIndex = completedModules; // Next video is at the index of completed count
      }

      return {
        ...module,
        completionPercentage,
        completed,
        status,
        nextVideoIndex,
        completedAt: enrollment?.completedAt,
      };
    });
  }, [modules, enrollments]);

  useEffect(() => {
    if (!competencyFilters.includes(selectedCompetency)) {
      setSelectedCompetency('All');
    }
  }, [competencyFilters, selectedCompetency]);

  // Fetch video thumbnails for in-progress campaigns (only fetch next video's thumbnail)
  useEffect(() => {
    const fetchThumbnails = async () => {
      const thumbnailMap: Record<string, string> = {};

      for (const module of modulesWithProgress) {
        // Only fetch thumbnail for in-progress modules
        if (module.status === 'in-progress' && !module.completed && module.items) {
          const nextVideoId = module.items[module.nextVideoIndex]?.videoId;
          if (nextVideoId) {
            try {
              const videoData = await getVideo(nextVideoId);
              if (videoData?.thumbnailUrl) {
                thumbnailMap[module.id] = videoData.thumbnailUrl;
              }
            } catch (error) {
              // Silent fail for thumbnail fetch
            }
          }
        }
      }

      setVideoThumbnails(thumbnailMap);
    };

    if (modulesWithProgress.length > 0) {
      fetchThumbnails();
    }
  }, [modulesWithProgress]);

  const filteredModulesWithProgress = useMemo(() => {
    let filtered = modulesWithProgress;

    // Filter by competency
    if (selectedCompetency !== 'All') {
      filtered = filtered.filter((module) =>
        module.competencies.includes(selectedCompetency)
      );
    }

    // Filter by status
    if (inProgressOnly) {
      filtered = filtered.filter((module) => module.status === 'in-progress');
    }

    // Filter by source
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((module) =>
        sourceFilter === 'organization'
          ? module.source === 'organization'
          : module.source !== 'organization'
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((module) =>
        module.title.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query) ||
        module.competencies.some((comp) => comp.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [modulesWithProgress, selectedCompetency, searchQuery, inProgressOnly, sourceFilter]);

  const inProgressModules = useMemo(
    () => filteredModulesWithProgress.filter((module) => module.status === 'in-progress' && !module.completed),
    [filteredModulesWithProgress]
  );

  const completedModules = useMemo(
    () => filteredModulesWithProgress.filter((module) => module.completed || module.status === 'completed'),
    [filteredModulesWithProgress]
  );

  const notStartedModules = useMemo(
    () => filteredModulesWithProgress.filter((module) =>
      module.status !== 'in-progress' &&
      module.status !== 'completed' &&
      !module.completed &&
      module.completionPercentage === 0
    ),
    [filteredModulesWithProgress]
  );

  // Extract competencies with campaign counts (from Learn.tsx)
  const competencies = useMemo(() => {
    const startedCampaignIds = new Set(enrollments.map(e => e.campaignId));
    const skillMap = new Map<string, { campaignIds: Set<string>; notStartedCount: number }>();

    campaigns.forEach(campaign => {
      const campaignCompetencies = campaign.metadata?.tags?.length
        ? campaign.metadata.tags
        : campaign.skillFocus
          ? [campaign.skillFocus]
          : [];

      const isNotStarted = !startedCampaignIds.has(campaign.id);

      campaignCompetencies.forEach(competency => {
        if (competency) {
          if (!skillMap.has(competency)) {
            skillMap.set(competency, { campaignIds: new Set(), notStartedCount: 0 });
          }
          const data = skillMap.get(competency)!;
          data.campaignIds.add(campaign.id);
          if (isNotStarted) {
            data.notStartedCount++;
          }
        }
      });
    });

    return Array.from(skillMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.campaignIds.size,
        notStartedCount: data.notStartedCount,
      }))
      .sort((a, b) => {
        if (a.notStartedCount !== b.notStartedCount) {
          return b.notStartedCount - a.notStartedCount;
        }
        return b.count - a.count;
      });
  }, [campaigns, enrollments]);

  const handleCompetencyClick = (competencyName: string) => {
    navigate(`/employee/learn/competency/${encodeURIComponent(competencyName)}`);
  };

  const inProgressIds = useMemo(() => new Set(inProgressModules.map((module) => module.id)), [inProgressModules]);

  const organizationModules = useMemo(
    () =>
      filteredModulesWithProgress.filter(
        (module) => module.source === 'organization' && !inProgressIds.has(module.id)
      ),
    [filteredModulesWithProgress, inProgressIds]
  );

  const dicodeModules = useMemo(
    () =>
      filteredModulesWithProgress.filter(
        (module) => module.source !== 'organization' && !inProgressIds.has(module.id)
      ),
    [filteredModulesWithProgress, inProgressIds]
  );

  const sections = [
    { title: 'In Progress', data: inProgressModules, layout: 'carousel' as const },
    { title: 'Your Organization', data: organizationModules, layout: 'grid' as const },
    { title: 'DI Code Collections', data: dicodeModules, layout: 'grid' as const },
  ].filter((section) => section.data.length > 0);

  const handleModuleCardClick = (moduleId: string, _forceNavigate = false) => {
    // Always navigate to the module player page
    navigate(`/employee/module/${moduleId}`);
  };

  const renderModuleCard = (
    module: typeof modulesWithProgress[number],
    highlightInProgress = false,
    forceNavigate = false
  ) => {
    const isCarouselCard = highlightInProgress;
    const gradient = getCompetencyGradient(module.competencies[0] || '');
    const thumbnail = videoThumbnails[module.id];

    const formatEndDate = (endDate: Date | string | number | undefined) => {
      if (!endDate) return null;
      const date = new Date(endDate);
      const day = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      return { day, month };
    };

    const endDateFormatted = module.source === 'organization' ? formatEndDate(module.endDate) : null;

    // Use precomputed estimatedMinutes from campaign metadata
    const durationMinutes = module.estimatedMinutes || 0;
    const durationText = durationMinutes > 0 ? `${durationMinutes} mins` : '';

    return (
      <motion.div
        layout
        variants={itemVariants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        key={module.id}
        onClick={() => handleModuleCardClick(module.id, forceNavigate)}
        className="relative overflow-hidden rounded-3xl border border-white/10 p-4 hover:border-white/30 transition-colors cursor-pointer"
      >
        {isCarouselCard && thumbnail ? (
          <>
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${thumbnail})` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        )}

        <div className="relative z-10">
          {isCarouselCard ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-1">In Progress</p>
                  <h3 className="text-white text-lg font-semibold truncate">{module.title}</h3>
                  <p className="text-white/60 text-sm mt-1">{module.competencies[0]}</p>
                </div>
                <ArrowRight size={18} className="text-white/70" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-2">
                  <span>Completion</span>
                  <span>{module.completionPercentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full rounded-full bg-white" style={{ width: `${module.completionPercentage}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-4">
              {endDateFormatted ? (
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex flex-col items-center justify-center flex-shrink-0`}
                >
                  <div className="text-2xl font-bold text-white leading-none">{endDateFormatted.day}</div>
                  <div className="text-[10px] font-semibold text-white/80 leading-none mt-0.5">{endDateFormatted.month}</div>
                </div>
              ) : (
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                  <BookOpen size={20} className="text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                  {module.source === 'organization' ? 'Org Campaign' : 'DI Code'}
                </p>
                <h3 className="text-white text-lg font-semibold truncate">{module.title}</h3>
                <p className="text-white/50 text-sm">{module.competencies[0]}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-white/60">
                  {module.totalVideos > 0 && <span>{module.totalVideos} {module.totalVideos === 1 ? 'module' : 'modules'}</span>}
                  {durationText && (
                    <>
                      {module.totalVideos > 0 && <span>•</span>}
                      <span>{durationText}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center text-white/20 group-hover:text-primary transition-colors">
                <ArrowRight size={24} />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderDesktopHomeFeed = () => {
    // Determine hero card state (like mobile ContinueLearningCard)
    type HeroState = 'continue' | 'jump-in' | 'completed' | 'empty';

    const getHeroCardData = (): {
      state: HeroState;
      module: typeof inProgressModules[0] | null;
      thumbnail: string | null;
    } => {
      // Priority 1: In-progress campaign
      if (inProgressModules.length > 0) {
        const module = inProgressModules[0];
        return {
          state: 'continue',
          module,
          thumbnail: videoThumbnails[module.id] || null,
        };
      }

      // Priority 2: Not-started campaign (jump-in)
      const notStartedModules = modulesWithProgress.filter(m => m.status === 'not-started');
      if (notStartedModules.length > 0) {
        const module = notStartedModules[0];
        return {
          state: 'jump-in',
          module,
          thumbnail: videoThumbnails[module.id] || null,
        };
      }

      // Priority 3: Completed campaign (most recent)
      const completedModules = modulesWithProgress
        .filter(m => m.status === 'completed')
        .sort((a, b) => {
          const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return bDate - aDate;
        });
      if (completedModules.length > 0) {
        const module = completedModules[0];
        return {
          state: 'completed',
          module,
          thumbnail: videoThumbnails[module.id] || null,
        };
      }

      // No campaigns
      return { state: 'empty', module: null, thumbnail: null };
    };

    const heroData = getHeroCardData();
    const { state: heroState, module: heroModule, thumbnail: heroThumbnail } = heroData;

    // Get state-specific content for hero card
    const getHeroContent = () => {
      switch (heroState) {
        case 'continue':
          return {
            label: 'IN PROGRESS',
            labelIcon: <Play size={12} fill="currentColor" />,
            labelColor: 'text-blue-400',
            subtitle: `Module ${(heroModule?.nextVideoIndex || 0) + 1} of ${heroModule?.totalVideos || 0}`,
            buttonText: 'Continue',
            showProgress: true,
          };
        case 'jump-in':
          return {
            label: 'NEW CAMPAIGN',
            labelIcon: <BookOpen size={12} />,
            labelColor: 'text-emerald-400',
            subtitle: `${heroModule?.totalVideos || 0} modules to complete`,
            buttonText: 'Start',
            showProgress: false,
          };
        case 'completed':
          return {
            label: 'COMPLETED',
            labelIcon: <Check size={12} />,
            labelColor: 'text-emerald-400',
            subtitle: `All ${heroModule?.totalVideos || 0} modules finished`,
            buttonText: 'Review',
            showProgress: true,
          };
        default:
          return {
            label: '',
            labelIcon: null,
            labelColor: '',
            subtitle: '',
            buttonText: '',
            showProgress: false,
          };
      }
    };

    const heroContent = getHeroContent();

    if (isLoadingCampaigns || isLoadingEnrollments) {
      return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl bg-white/5" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <div key={j} className="bg-white/5 rounded-2xl border border-white/5 p-4 space-y-4">
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (!sections.length) {
      return (
        <div className="flex-1 flex items-center justify-center text-center px-8">
          <div>
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={32} className="text-white/30" />
            </div>
            <h3 className="text-white text-xl font-semibold mb-2">No campaigns available</h3>
            <p className="text-white/50 max-w-md">
              Your learning campaigns will appear here once assigned. Check back soon!
            </p>
          </div>
        </div>
      );
    }

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Hero Card - Works like mobile ContinueLearningCard */}
        {!searchQuery && heroState !== 'empty' && heroModule && (
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.005 }}
            onClick={() => navigate(`/employee/module/${heroModule.id}`)}
            className="relative overflow-hidden rounded-2xl cursor-pointer group min-h-[240px]"
          >
            {/* Background */}
            {heroThumbnail ? (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url(${heroThumbnail})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/60" />
              </>
            ) : (
              <>
                <div className={`absolute inset-0 ${heroState === 'completed'
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-800'
                  : heroState === 'jump-in'
                    ? 'bg-gradient-to-br from-purple-600 to-purple-800'
                    : 'bg-gradient-to-br from-blue-600 to-blue-800'
                  }`} />
                {/* Decorative icon when no thumbnail */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
                  <BookOpen size={200} className="text-white" />
                </div>
              </>
            )}

            {/* Content */}
            <div className="relative p-8 flex items-center justify-between h-full">
              <div className="space-y-3 max-w-xl">
                <div className={`flex items-center gap-2 ${heroContent.labelColor} text-xs font-bold uppercase tracking-widest`}>
                  {heroContent.labelIcon}
                  <span>{heroContent.label}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {heroModule.title}
                </h2>
                <p className="text-white/60 text-sm line-clamp-2">
                  {heroContent.subtitle}
                </p>
                {heroContent.showProgress && (
                  <div className="flex items-center gap-4 pt-1">
                    <div className="flex-1 max-w-xs h-2 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${heroModule.completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-white/70 font-medium">{heroModule.completionPercentage}%</span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 group-hover:bg-white/30 transition-all">
                  {heroState === 'completed' ? (
                    <Check size={24} className="text-white" />
                  ) : heroState === 'jump-in' ? (
                    <ArrowRight size={24} className="text-white" />
                  ) : (
                    <Play size={24} fill="white" className="text-white" />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State - No campaigns */}
        {!searchQuery && heroState === 'empty' && (
          <motion.div
            variants={itemVariants}
            className="relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 p-8"
          >
            <div className="flex flex-col items-center justify-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                <Inbox size={28} className="text-white/40" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Looking empty here</h3>
              <p className="text-sm text-white/50 max-w-[300px]">
                Your organization hasn't assigned you any learning campaigns yet.
              </p>
            </div>
          </motion.div>
        )}

        {/* Competencies Section - like mobile Learn page */}
        {!searchQuery && competencies.length > 0 && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-semibold">Competencies</h2>
              <button
                onClick={() => navigate('/employee/learn/competencies')}
                className="text-blue-400 text-sm font-medium flex items-center gap-1 hover:text-blue-300"
              >
                See all
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {competencies.slice(0, 4).map((competency, index) => (
                <motion.button
                  key={competency.name}
                  onClick={() => handleCompetencyClick(competency.name)}
                  className={`w-full aspect-[2.2/1] rounded-2xl bg-gradient-to-br ${cardGradients[index % cardGradients.length]} p-5 flex flex-col justify-between text-left relative overflow-hidden`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* Background Emoji */}
                  <span className="absolute -bottom-6 -right-4 text-9xl opacity-20 select-none pointer-events-none">
                    {getCompetencyEmoji(competency.name)}
                  </span>

                  {/* Favorite button */}
                  <div className="flex justify-end relative z-10">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Heart size={20} className="text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10">
                    <h3 className="text-white font-bold text-2xl leading-tight mb-1.5">
                      {competency.name}
                    </h3>
                    <p className="text-white/90 text-base font-medium">
                      {competency.count} {competency.count === 1 ? 'campaign' : 'campaigns'}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Campaign Sections */}
        <div className="space-y-8">
          {sections.map((section) => {
            const isCarousel = section.layout === 'carousel';
            // Skip "In Progress" section if we already show continue hero
            if (section.title === 'In Progress' && heroModule && heroState === 'continue' && !searchQuery) return null;

            return (
              <div key={section.title} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-white text-lg font-semibold">{section.title}</h2>
                  {section.data.length > 3 && (
                    <button
                      onClick={() => {
                        if (section.title === 'In Progress') navigate('/employee/learn?status=in-progress');
                        else if (section.title === 'Your Organization') navigate('/employee/learn?source=organization');
                        else if (section.title === 'DI Code Collections') navigate('/employee/learn?source=dicode');
                      }}
                      className="text-white/50 text-sm hover:text-white/70 transition-colors"
                    >
                      See all →
                    </button>
                  )}
                </div>
                <motion.div
                  layout
                  className={
                    isCarousel
                      ? 'flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-2 px-2'
                      : 'grid gap-4 md:grid-cols-4'
                  }
                >
                  {section.data.map((module) => (
                    <div className={isCarousel ? 'min-w-[300px] flex-shrink-0' : ''} key={module.id}>
                      {renderModuleCard(module, isCarousel)}
                    </div>
                  ))}
                </motion.div>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  };


  const renderSections = () => {
    if (!sections.length) {
      let title = 'No campaigns found';
      let description = 'Try adjusting your filters to see more results.';

      if (searchQuery) {
        title = `No results for "${searchQuery}"`;
        description = 'Check your spelling or try a different search term.';
      } else if (inProgressOnly) {
        title = 'No campaigns in progress';
        description = 'Start a new campaign from the "All" view to see it here.';
      } else if (sourceFilter !== 'all') {
        title = `No ${sourceFilter} campaigns`;
        description = 'Try selecting a different source filter.';
      } else if (selectedCompetency) {
        title = `No campaigns for ${selectedCompetency}`;
        description = 'Try selecting a different competency to see other learning paths.';
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center min-h-[60vh]">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
            <Search size={32} className="text-white/40" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
          <p className="text-white/60 max-w-md mx-auto">{description}</p>
          {(searchQuery || inProgressOnly || sourceFilter !== 'all' || selectedCompetency) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setInProgressOnly(false);
                setSourceFilter('all');
                setSelectedCompetency('');
              }}
              className="mt-6 px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      );
    }

    return sections.map((section) => {
      const isCarousel = section.layout === 'carousel';
      return (
        <div key={section.title} className="space-y-3">
          {section.title !== 'In Progress' && <SectionHeading title={section.title} />}
          <div
            className={
              isCarousel
                ? 'flex gap-4 overflow-x-auto overflow-visible scrollbar-hide -mx-4 px-4'
                : 'grid gap-4 md:grid-cols-4'
            }
          >
            {section.data.map((module) => (
              <div className={isCarousel ? 'min-w-[280px] flex-shrink-0' : ''} key={module.id}>
                {renderModuleCard(module, isCarousel, true)}
              </div>
            ))}
          </div>
        </div>
      );
    });
  };


  // Mobile view (redesigned - clean light style like reference)
  // NOTE: This function is deprecated - MobileHome component is used instead
  const renderMobileView = () => {
    // Card colors matching the reference image
    const cardColors = [
      { bg: 'bg-orange-400', text: 'text-white' },
      { bg: 'bg-blue-500', text: 'text-white' },
      { bg: 'bg-indigo-600', text: 'text-white' },
      { bg: 'bg-emerald-500', text: 'text-white' },
      { bg: 'bg-rose-500', text: 'text-white' },
      { bg: 'bg-violet-500', text: 'text-white' },
    ];

    // Get modules that haven't been started
    const localNotStartedModules = filteredModulesWithProgress.filter((module) =>
      module.status !== 'in-progress' &&
      module.status !== 'completed' &&
      !module.completed &&
      module.completionPercentage === 0
    );

    // Get all modules for featured section (not started ones)
    const featuredModules = localNotStartedModules.length > 0
      ? localNotStartedModules.slice(0, 6)
      : modules.slice(0, 6);

    return (
      <div className="min-h-screen flex flex-col lg:hidden" style={{ backgroundColor: '#0a0a0a' }}>
        {/* Dark Header */}
        <div className="px-5 pt-6 pb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar with gradient border */}
              <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-br from-blue-400 to-cyan-400">
                <div className="w-full h-full rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-semibold">{user?.name?.charAt(0) || 'U'}</span>
                  )}
                </div>
              </div>
              <div>
                <h1 className="text-white font-semibold text-lg">{user?.name || 'User'}</h1>
                <p className="text-gray-400 text-sm">{getLevelTitle(userStats.level)}</p>
              </div>
            </div>
            {/* Bell icon */}
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
          </div>
        </div>

        {/* White Content Card */}
        <div className="flex-1 bg-gray-50 rounded-t-[32px] overflow-hidden">
          <div className="h-full overflow-y-auto pb-24">
            {/* Search Section */}
            <div className="px-5 pt-6">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search campaigns"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-[15px]"
                  />
                </div>
                <button className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" x2="20" y1="6" y2="6" />
                    <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
                    <line x1="4" x2="20" y1="12" y2="12" />
                    <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
                    <line x1="4" x2="20" y1="18" y2="18" />
                    <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              </div>

              {/* Recent Tags */}
              <div className="flex items-center gap-3 mt-4 overflow-x-auto scrollbar-hide">
                <span className="text-gray-400 text-sm flex-shrink-0">Recent</span>
                {['design', 'economy', 'art'].map((tag) => (
                  <button
                    key={tag}
                    className="px-4 py-1.5 rounded-full bg-gray-800 text-white text-sm font-medium flex-shrink-0"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingCampaigns || isLoadingEnrollments ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : modules.length === 0 ? (
              <div className="flex items-center justify-center py-20 px-5">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={28} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">No Campaigns Yet</h3>
                  <p className="text-gray-500 text-sm">Your campaigns will appear here once assigned.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Featured Campaigns */}
                {featuredModules.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between px-5 mb-4">
                      <h2 className="text-[22px] font-bold text-gray-900">Featured campaigns</h2>
                      <button className="text-blue-500 text-sm font-medium">See all</button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-2">
                      {featuredModules.map((module, idx) => {
                        const color = cardColors[idx % cardColors.length];
                        const thumbnail = videoThumbnails[module.id];

                        return (
                          <motion.div
                            key={module.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate(`/employee/campaign/${module.id}`)}
                            className={`flex-shrink-0 w-[140px] h-[180px] ${color.bg} rounded-[20px] p-3.5 cursor-pointer relative overflow-hidden`}
                          >
                            {/* Favorite */}
                            <button
                              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Heart size={14} className="text-white" />
                            </button>

                            <div className="h-full flex flex-col">
                              <div className="flex-1">
                                <h3 className="text-white font-bold text-[15px] leading-tight pr-6">
                                  {module.title.length > 15 ? module.title.slice(0, 15) + '...' : module.title}
                                </h3>
                                <p className="text-white/70 text-xs mt-1">
                                  {module.totalVideos} lessons
                                </p>
                              </div>

                              {/* Bottom image */}
                              <div className="flex justify-end mt-2">
                                {thumbnail ? (
                                  <img src={thumbnail} alt="" className="w-14 h-14 rounded-xl object-cover" />
                                ) : (
                                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                                    <BookOpen size={20} className="text-white/80" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ongoing */}
                {inProgressModules.length > 0 && (
                  <div className="mt-6 px-5">
                    <h2 className="text-[22px] font-bold text-gray-900 mb-4">Ongoing</h2>
                    <div className="space-y-3">
                      {inProgressModules.map((module, idx) => {
                        const thumbnail = videoThumbnails[module.id];
                        const color = cardColors[idx % cardColors.length];

                        return (
                          <motion.div
                            key={module.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate(`/employee/campaign/${module.id}`)}
                            className="bg-white rounded-2xl p-4 cursor-pointer shadow-sm"
                          >
                            <div className="flex gap-3.5">
                              {/* Circle thumbnail */}
                              <div className={`w-12 h-12 rounded-full ${color.bg} flex-shrink-0 overflow-hidden flex items-center justify-center`}>
                                {thumbnail ? (
                                  <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <BookOpen size={20} className="text-white" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0 pr-2">
                                    <h3 className="font-semibold text-gray-900 text-[15px] truncate">
                                      {module.title}
                                    </h3>
                                    <p className="text-gray-400 text-sm truncate">
                                      Module {(module.nextVideoIndex || 0) + 1} of {module.totalVideos}
                                    </p>
                                  </div>
                                  <button
                                    className="text-gray-300 p-0.5 flex-shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                      <circle cx="12" cy="5" r="2" />
                                      <circle cx="12" cy="12" r="2" />
                                      <circle cx="12" cy="19" r="2" />
                                    </svg>
                                  </button>
                                </div>

                                <div className="mt-2.5">
                                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                                    <span>{module.totalVideos} lessons</span>
                                    <span>{module.completionPercentage}% complete</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gray-900 rounded-full"
                                      style={{ width: `${module.completionPercentage}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Completed */}
                {completedModules.length > 0 && (
                  <div className="mt-6 px-5 pb-4">
                    <h2 className="text-[22px] font-bold text-gray-900 mb-4">Completed</h2>
                    <div className="space-y-3">
                      {completedModules.slice(0, 3).map((module) => {
                        const thumbnail = videoThumbnails[module.id];

                        return (
                          <motion.div
                            key={module.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate(`/employee/campaign/${module.id}`)}
                            className="bg-white rounded-2xl p-4 cursor-pointer shadow-sm"
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-12 h-12 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center">
                                <Check size={20} className="text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-[15px] truncate">{module.title}</h3>
                                <p className="text-gray-400 text-sm">{module.totalVideos} lessons</p>
                              </div>
                              <ArrowRight size={18} className="text-gray-300 flex-shrink-0" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="fixed bottom-0 left-0 right-0 bg-white px-4 py-2.5 lg:hidden safe-area-bottom">
          <div className="flex items-center justify-around">
            <button
              onClick={() => setMobileNavTab('home')}
              className={`flex items-center gap-2 h-10 px-4 rounded-full transition-colors ${mobileNavTab === 'home' ? 'bg-gray-900 text-white' : 'text-gray-400'
                }`}
            >
              <HomeIcon size={20} />
              {mobileNavTab === 'home' && <span className="text-sm font-medium">Home</span>}
            </button>
            <button onClick={() => navigate('/employee/comparison')} className="h-10 px-3 text-gray-400">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>
            <button onClick={() => navigate('/employee/analytics')} className="h-10 px-3 text-gray-400">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button onClick={() => navigate('/employee/profile')} className="h-10 px-3 text-gray-400">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Stats sidebar for desktop
  const renderStatsSidebar = () => {
    const progressPercent = userStats.xpToNextLevel > 0
      ? Math.round((userStats.currentXP / userStats.xpToNextLevel) * 100)
      : 0;

    return (
      <div className="w-72 flex-shrink-0 bg-[#090909] rounded-3xl border border-white/5 p-5 overflow-y-auto">
        {/* User Level Card */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-white text-xl font-bold">{userStats.level}</span>
            </div>
            <div>
              <p className="text-white font-semibold">Level {userStats.level}</p>
              <p className="text-white/50 text-sm">{getLevelTitle(userStats.level)}</p>
            </div>
          </div>

          {/* XP Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">XP Progress</span>
              <span className="text-white font-medium">{userStats.currentXP}/{userStats.xpToNextLevel}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
              />
            </div>
            <p className="text-white/40 text-xs">{userStats.xpToNextLevel - userStats.currentXP} XP to next level</p>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-4 border border-orange-500/20 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-orange-400" />
              <span className="text-white font-semibold">Streak</span>
            </div>
            <span className="text-2xl font-bold text-orange-400">{userStats.currentStreak}</span>
          </div>
          <p className="text-white/50 text-sm">
            {userStats.currentStreak > 0
              ? `Keep it up! Best: ${userStats.longestStreak} days`
              : 'Complete a module to start your streak!'}
          </p>
        </div>

        {/* Today's Goal */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-2xl p-4 border border-emerald-500/20 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target size={20} className="text-emerald-400" />
              <span className="text-white font-semibold">Today's Goal</span>
            </div>
          </div>
          <p className="text-white/70 text-sm mb-3">Complete {userStats.dailyGoal.target} module</p>
          <div className="flex gap-2">
            {Array.from({ length: userStats.dailyGoal.target }, (_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full ${i < userStats.dailyGoal.completed
                  ? 'bg-emerald-400'
                  : 'bg-white/20'
                  }`}
              />
            ))}
          </div>
          <p className="text-white/40 text-xs mt-2">
            {userStats.dailyGoal.completed >= userStats.dailyGoal.target
              ? '✓ Goal achieved!'
              : `${userStats.dailyGoal.target - userStats.dailyGoal.completed} more to go`}
          </p>
        </div>

        {/* Top Competencies (from skill scores) */}
        {skillScores?.competencyScores && Object.keys(skillScores.competencyScores).length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium">Top Competencies</h3>
              <button
                onClick={() => navigate('/employee/profile')}
                className="text-blue-400 text-xs hover:text-blue-300 transition-colors"
              >
                View All
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(skillScores.competencyScores)
                .sort(([, a], [, b]) => (b.level || 1) - (a.level || 1))
                .slice(0, 3)
                .map(([name, data]) => {
                  const level = data.level || 1;
                  const maxLevel = 5;
                  const progress = ((level - 1) / (maxLevel - 1)) * 100;
                  return (
                    <div key={name} className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-medium truncate flex-1 mr-2">{name}</span>
                        <span className="text-white/60 text-xs px-2 py-0.5 rounded-full bg-white/10">
                          Lv.{level}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="space-y-3">
          <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium">Your Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={14} className="text-white/40" />
                <span className="text-white/50 text-xs">Modules</span>
              </div>
              <p className="text-white text-xl font-bold">{userStats.modulesCompleted}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-white/40" />
                <span className="text-white/50 text-xs">Avg Score</span>
              </div>
              <p className="text-white text-xl font-bold">{userStats.averageScore}%</p>
            </div>
            <button
              onClick={() => navigate('/employee/badges')}
              className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <Award size={14} className="text-white/40" />
                <span className="text-white/50 text-xs">Badges</span>
              </div>
              <p className="text-white text-xl font-bold">{userBadges.length}</p>
            </button>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-white/40" />
                <span className="text-white/50 text-xs">Total XP</span>
              </div>
              <p className="text-white text-xl font-bold">{userStats.totalXP}</p>
            </div>
          </div>
        </div>

        {/* Leaderboard Preview */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white/50 text-xs uppercase tracking-wider font-medium">Leaderboard</h3>
            <button
              onClick={() => navigate('/employee/rank')}
              className="text-blue-400 text-xs hover:text-blue-300 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((entry, index) => {
              const isCurrentUser = entry.userId === user?.id;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 p-2 rounded-xl ${isCurrentUser ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/5'
                    }`}
                >
                  <span className={`w-6 text-center font-bold ${index === 0 ? 'text-yellow-400' :
                    index === 1 ? 'text-gray-300' :
                      index === 2 ? 'text-orange-400' :
                        'text-white/50'
                    }`}>
                    {index + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                    {entry.avatar ? (
                      <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/60 text-xs font-medium">
                        {entry.name?.charAt(0) || '?'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                      {isCurrentUser ? 'You' : entry.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-white/60">
                    <Zap size={12} />
                    <span className="text-xs font-medium">{entry.totalXp || 0}</span>
                  </div>
                </div>
              );
            })}
            {leaderboard.length === 0 && (
              <p className="text-white/40 text-sm text-center py-4">No leaderboard data yet</p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 pt-6 border-t border-white/10 space-y-2">
          <button
            onClick={() => navigate('/employee/comparison')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 hover:text-white transition-all"
          >
            <BarChart3 size={18} />
            <span className="text-sm font-medium">View Analytics</span>
          </button>
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20"
          >
            <Bot size={18} />
            <span className="text-sm font-medium">AI Copilot</span>
          </button>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white/70 transition-all"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    );
  };

  const renderDesktopView = () => {
    return (
      <div className="hidden lg:flex h-screen overflow-hidden bg-[#0a0a0a]">
        {/* Left Navigation Sidebar */}
        <DesktopSidebar
          activePage="home"
          onHomeClick={() => navigate('/employee/home')}
          onAICopilotClick={() => setIsCopilotOpen(true)}
          isExpanded={isSidebarExpanded}
          onToggleExpand={setIsSidebarExpanded}
        />

        {/* Main Area with curved corner */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#050608] rounded-tl-3xl">
          {/* Top Bar */}
          <div className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-[#050608]/80 backdrop-blur-xl border-b border-white/5 z-20">
            <div className="flex items-center gap-4">
            </div>

            <div className="flex-1 max-w-lg mx-8 flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onClick={openSearch}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-16 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10 focus:bg-white/10 transition-all"
                />
                {/* Cmd+K hint */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-white/30 text-xs pointer-events-none">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-sans">⌘</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-sans">K</kbd>
                </div>
              </div>
              {/* Notifications bell */}
              <button
                onClick={() => setIsNotificationsOpen(true)}
                className="relative p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                <Bell size={20} className="text-white/70" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* User stats container - clickable to profile */}
            <button
              onClick={() => navigate('/employee/profile')}
              className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-white/5 transition-all"
            >
              {/* Streak indicator */}
              <div className="flex items-center gap-1.5">
                <Flame size={16} className="text-orange-400" />
                <span className="text-orange-300 font-bold text-sm">{userStats.currentStreak}</span>
              </div>
              {/* Level badge */}
              <span className="text-blue-400 font-bold text-sm">Lv {userStats.level}</span>
              {/* Avatar with circular progress ring */}
              <div className="relative">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                  {/* Background circle */}
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${(userStats.currentXP / userStats.xpToNextLevel) * 100.5} 100.5`}
                  />
                </svg>
                <div className="absolute inset-1">
                  <Avatar
                    src={user?.avatar}
                    name={user?.name}
                    size="sm"
                  />
                </div>
              </div>
            </button>
          </div>

          {/* Main Learning Area */}
          <div className="flex-1 flex overflow-hidden p-2 gap-2">
            <AnimatePresence mode="wait">
              <motion.div
                key="feed-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6"
              >
                {renderDesktopHomeFeed()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  };



  return (
    <>
      {/* Mobile View - New Duolingo-inspired UI */}
      <div className="lg:hidden">
        <MobileHome />
      </div>

      {/* Desktop View */}
      {renderDesktopView()}

      {/* Global Search Overlay */}
      <GlobalSearchOverlay />

      {/* AI Copilot */}
      {isCopilotOpen && (
        <AICopilot
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          context={{
            userRole: 'employee',
            learningContext: {
              currentCampaign: undefined,
              currentCampaignTitle: undefined,
              currentModule: undefined,
              currentModuleTitle: undefined,
              streakStatus: {
                current: userStats.currentStreak,
                atRisk: userStats.dailyGoal.completed < userStats.dailyGoal.target,
              },
              weakCompetencies: [],
              strongCompetencies: [],
            }
          }}
        />
      )}

      {/* Level Up Celebration Modal */}
      <AnimatePresence>
        {showLevelUpModal && levelUpData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowLevelUpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="relative bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-8 max-w-sm mx-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative elements */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/50"
                >
                  <Trophy size={40} className="text-yellow-900" />
                </motion.div>
              </div>

              <div className="mt-8 mb-6">
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-white/80 text-sm uppercase tracking-widest mb-2"
                >
                  Congratulations!
                </motion.p>
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-bold text-white mb-2"
                >
                  Level Up!
                </motion.h2>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                  className="flex items-center justify-center gap-4 my-6"
                >
                  <div className="text-white/60 text-2xl font-bold">
                    {levelUpData.previousLevel}
                  </div>
                  <ArrowRight size={24} className="text-white/40" />
                  <div className="text-white text-5xl font-bold">
                    {levelUpData.newLevel}
                  </div>
                </motion.div>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-white/70"
                >
                  You earned <span className="text-yellow-300 font-bold">+{levelUpData.xpEarned} XP</span>
                </motion.p>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-white/60 text-sm mt-2"
                >
                  {getLevelTitle(levelUpData.newLevel)}
                </motion.p>
              </div>

              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                onClick={() => setShowLevelUpModal(false)}
                className="px-8 py-3 rounded-full bg-white text-blue-600 font-bold hover:bg-white/90 transition-all"
              >
                Awesome!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge Earned Modal */}
      <AnimatePresence>
        {showBadgeModal && newBadges.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowBadgeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="relative bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-8 max-w-sm mx-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-white/80 text-sm uppercase tracking-widest mb-4"
              >
                Badge{newBadges.length > 1 ? 's' : ''} Unlocked!
              </motion.p>

              <div className="flex flex-wrap justify-center gap-4 my-6">
                {newBadges.map((badge, index) => (
                  <motion.div
                    key={badge.id}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2 + index * 0.1, type: "spring" }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-4xl mb-2">
                      {badge.icon}
                    </div>
                    <p className="text-white font-bold text-sm">{badge.name}</p>
                    <p className="text-white/60 text-xs max-w-[100px]">{badge.description}</p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => {
                  setShowBadgeModal(false);
                  setNewBadges([]);
                }}
                className="px-8 py-3 rounded-full bg-white text-orange-600 font-bold hover:bg-white/90 transition-all"
              >
                Collect
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Notifications Side Panel */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            {/* Side Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-[420px] bg-[#141414] border-l border-white/10 z-50 flex flex-col"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-2xl font-bold text-white">Notifications</h2>
                  <div className="flex items-center gap-3">
                    {notifications.some(n => !n.read) && (
                      <button
                        onClick={markAllAsRead}
                        className="text-sm text-white/60 hover:text-white underline underline-offset-2 transition-colors"
                      >
                        Mark all as read
                      </button>
                    )}
                    <button
                      onClick={() => setIsNotificationsOpen(false)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X size={20} className="text-white/50" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setNotificationFilter('all')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${notificationFilter === 'all'
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:bg-white/5'
                      }`}
                  >
                    All
                    {notifications.length > 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${notificationFilter === 'all' ? 'bg-white/20' : 'bg-white/10'
                        }`}>
                        {notifications.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setNotificationFilter('unread')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${notificationFilter === 'unread'
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:bg-white/5'
                      }`}
                  >
                    Unread
                    {unreadCount > 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${notificationFilter === 'unread' ? 'bg-white/20' : 'bg-white/10'
                        }`}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {displayedNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/40">
                    <Bell size={48} className="mb-3 opacity-50" />
                    <p>{notificationFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
                  </div>
                ) : (
                  <div>
                    {displayedNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => {
                          markAsRead(notification.id);
                          setIsNotificationsOpen(false);
                        }}
                        className={`w-full px-6 py-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 ${!notification.read ? 'bg-blue-500/5' : ''
                          }`}
                      >
                        <div className="flex gap-3">
                          {/* Icon/Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${notification.type === 'achievement' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                              notification.type === 'reminder' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                                notification.type === 'streak' ? 'bg-gradient-to-br from-orange-400 to-red-500' :
                                  notification.type === 'campaign' ? 'bg-gradient-to-br from-purple-400 to-purple-600' :
                                    'bg-gradient-to-br from-gray-400 to-gray-600'
                              }`}>
                              {notification.type === 'achievement' ? <Trophy size={20} className="text-white" /> :
                                notification.type === 'reminder' ? <Target size={20} className="text-white" /> :
                                  notification.type === 'streak' ? <TrendingUp size={20} className="text-white" /> :
                                    notification.type === 'campaign' ? <Star size={20} className="text-white" /> :
                                      <MessageSquare size={20} className="text-white" />}
                            </div>
                            {!notification.read && (
                              <div className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#141414]" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] text-white leading-snug">
                              <span className="font-semibold">{notification.title}</span>
                            </p>
                            <p className="text-[15px] text-white/70 mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-sm text-white/40 mt-1.5">
                              {formatTimeAgo(notification.timestamp)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default EmployeeHome;

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-white/80 text-sm font-semibold tracking-[0.35em] uppercase">{title}</h2>
    </div>
  );
}

