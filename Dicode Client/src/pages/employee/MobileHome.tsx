import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import {
  Avatar,
  StreakCard,
  PracticeAICard,
  BadgeProgressCard,
  ContinueLearningCard,
  NotificationsSheet,
} from '@/components/mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useCopilot } from '@/contexts/CopilotContext';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { useUserStatsWithFallback, useBadgesRealtime, useSkillScoresRealtime } from '@/hooks/useUserStats';
import { useEmployeeNotifications, convertToUINotification } from '@/hooks/useEmployeeNotifications';
import { getPublishedCampaigns, getVideo, recalculateBadges } from '@/lib/firestore';
import type { Campaign, CopilotContext as CopilotContextType } from '@/types';
import AICopilot from '@/components/shared/AICopilot';

const getFormattedDate = () => {
  const today = new Date();
  return today.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
};

const MobileHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOpen: isCopilotOpen, setIsOpen: setIsCopilotOpen } = useCopilot();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Get real-time notifications
  const {
    notifications: rawNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useEmployeeNotifications(user?.id || '');

  // Convert to UI format
  const notifications = useMemo(() =>
    rawNotifications.map(convertToUINotification),
    [rawNotifications]
  );

  // Get enrollments
  const { enrollments, isLoading: isLoadingEnrollments } = useUserEnrollmentsRealtime(user?.id || '');

  // Get server-computed streak data with client fallback while functions update
  const {
    stats: streakStats,
    isLoading: isLoadingStreak,
  } = useUserStatsWithFallback(user?.id || '', enrollments);

  // Get badges for progress tracking
  const { badges: userBadges } = useBadgesRealtime(user?.id || '');
  const earnedBadgeIds = useMemo(() => userBadges.map(b => b.id), [userBadges]);

  // Get skill scores for badge progress
  const { skillScores } = useSkillScoresRealtime(user?.id || '');

  // Calculate badge progress stats
  const badgeStats = useMemo(() => {
    const completedCampaigns = enrollments.filter(e => e.status === 'completed').length;
    const skillsArray = Object.values(skillScores.skills || {});
    const maxSkillLevel = skillsArray.length > 0
      ? Math.max(...skillsArray.map(s => s.level || 1))
      : 0;
    const skillsAtLevel3Plus = skillsArray.filter(s => (s.level || 1) >= 3).length;

    return {
      currentStreak: streakStats.currentStreak,
      completedCampaigns,
      level: streakStats.level,
      maxSkillLevel,
      skillsAtLevel3Plus,
    };
  }, [enrollments, skillScores, streakStats]);

  // Copilot context for employee
  const copilotContext: CopilotContextType = useMemo(() => ({
    userRole: 'employee',
    currentPage: 'home',
    organizationId: user?.organization || '',
    learningContext: {
      streakStatus: {
        current: streakStats.currentStreak,
        atRisk: streakStats.streakAtRisk,
      },
    },
  }), [user?.organization, streakStats.currentStreak, streakStats.streakAtRisk]);

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      if (!user) return;
      setIsLoadingCampaigns(true);
      try {
        const data = await getPublishedCampaigns(
          user.organization,
          user.department,
          user.id,
          user.cohortIds
        );
        setCampaigns(data);
      } catch (error) {
        console.error('Failed to load campaigns:', error);
      } finally {
        setIsLoadingCampaigns(false);
      }
    };

    loadCampaigns();
  }, [user]);

  // Recalculate badges once per session (to catch any missed badges)
  useEffect(() => {
    if (!user?.id) return;

    // Only run once per session
    const sessionKey = `badges_recalculated_${user.id}`;
    if (sessionStorage.getItem(sessionKey)) return;

    recalculateBadges(user.id)
      .then((result) => {
        if (result.newBadges.length > 0) {
          console.log('🏆 Awarded missing badges:', result.newBadges);
        }
        sessionStorage.setItem(sessionKey, 'true');
      })
      .catch((err) => {
        console.error('Failed to recalculate badges:', err);
      });
  }, [user?.id]);

  // Fetch thumbnail for the featured campaign
  useEffect(() => {
    const fetchThumbnail = async () => {
      // Get the campaign that will be shown in the card
      const inProgressEnrollment = enrollments.find(e => e.status === 'in-progress');
      let targetCampaign: Campaign | undefined;

      if (inProgressEnrollment) {
        targetCampaign = campaigns.find(c => c.id === inProgressEnrollment.campaignId);
      } else {
        // First available campaign
        const enrolledIds = new Set(enrollments.map(e => e.campaignId));
        targetCampaign = campaigns.find(c => !enrolledIds.has(c.id)) || campaigns[0];
      }

      if (targetCampaign?.items?.[0]?.videoId) {
        try {
          const video = await getVideo(targetCampaign.items[0].videoId);
          if (video?.thumbnailUrl) {
            setThumbnailUrl(video.thumbnailUrl);
          }
        } catch (error) {
          console.error('Failed to fetch thumbnail:', error);
        }
      }
    };

    if (campaigns.length > 0 && !isLoadingEnrollments) {
      fetchThumbnail();
    }
  }, [campaigns, enrollments, isLoadingEnrollments]);

  // Determine learning card state
  const learningCardData = useMemo(() => {
    if (isLoadingCampaigns || isLoadingEnrollments) {
      return { state: 'loading' as const, campaign: null, enrollment: null };
    }

    // No campaigns at all
    if (campaigns.length === 0) {
      return { state: 'empty' as const, campaign: null, enrollment: null };
    }

    // Build a list of campaigns with their actual status
    type CampaignStatus = 'not-started' | 'in-progress' | 'completed';
    const campaignsWithStatus: Array<{
      campaign: Campaign;
      enrollment: typeof enrollments[0] | null;
      actualStatus: CampaignStatus;
    }> = campaigns.map(campaign => {
      const enrollment = enrollments.find(e => e.campaignId === campaign.id) || null;

      if (!enrollment) {
        return { campaign, enrollment: null, actualStatus: 'not-started' as CampaignStatus };
      }

      // Calculate actual status from enrollment data
      const totalModules = campaign.metadata?.computed?.totalItems ?? campaign.items?.length ?? 0;
      const completedModules =
        enrollment.completedModules ??
        Object.values(enrollment.moduleProgress || {}).filter((m) => m.completed).length;

      let actualStatus: CampaignStatus = 'not-started';
      if (enrollment.status === 'completed' || (totalModules > 0 && completedModules >= totalModules)) {
        actualStatus = 'completed';
      } else if (enrollment.status === 'in-progress' || completedModules > 0) {
        actualStatus = 'in-progress';
      }

      return { campaign, enrollment, actualStatus };
    });

    // Priority 1: Find in-progress campaign
    const inProgress = campaignsWithStatus.find(c => c.actualStatus === 'in-progress');
    if (inProgress) {
      return {
        state: 'continue' as const,
        campaign: inProgress.campaign,
        enrollment: inProgress.enrollment
      };
    }

    // Priority 2: Find not-started campaign (truly new)
    const notStarted = campaignsWithStatus.find(c => c.actualStatus === 'not-started');
    if (notStarted) {
      return {
        state: 'jump-in' as const,
        campaign: notStarted.campaign,
        enrollment: notStarted.enrollment
      };
    }

    // Priority 3: Show most recently completed campaign
    const completedCampaigns = campaignsWithStatus
      .filter(c => c.actualStatus === 'completed')
      .sort((a, b) => {
        const aDate = a.enrollment?.completedAt ? new Date(a.enrollment.completedAt).getTime() : 0;
        const bDate = b.enrollment?.completedAt ? new Date(b.enrollment.completedAt).getTime() : 0;
        return bDate - aDate;
      });

    if (completedCampaigns.length > 0) {
      return {
        state: 'completed' as const,
        campaign: completedCampaigns[0].campaign,
        enrollment: completedCampaigns[0].enrollment
      };
    }

    // Fallback - shouldn't reach here, but show first campaign
    const first = campaignsWithStatus[0];
    return {
      state: first.actualStatus === 'completed'
        ? 'completed' as const
        : first.actualStatus === 'in-progress'
          ? 'continue' as const
          : 'jump-in' as const,
      campaign: first.campaign,
      enrollment: first.enrollment
    };
  }, [campaigns, enrollments, isLoadingCampaigns, isLoadingEnrollments]);

  const handleLearningCardPress = () => {
    if (learningCardData.campaign) {
      navigate(`/employee/campaign/${learningCardData.campaign.id}`);
    } else {
      navigate('/employee/learn');
    }
  };

  const isLoading = isLoadingCampaigns || isLoadingEnrollments || isLoadingStreak;

  return (
    <div className="min-h-screen lg:hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 lg:hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f14]/95 to-transparent backdrop-blur-md" />
        <div className="relative flex items-center justify-between px-4 py-4">
          {/* Left: Avatar + Greeting */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/employee/profile')}>
              <Avatar src={user?.avatar} name={user?.name} size="lg" />
            </button>
            <div className="flex flex-col justify-center">
              <p className="text-sm text-white/50">
                {getFormattedDate()}
              </p>
              <p className="text-xl font-bold text-white">
                Hi, {user?.name?.split(' ')[0]}!
              </p>
            </div>
          </div>

          {/* Right: Notification */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Bell size={22} className="text-white/70" strokeWidth={1.8} />
            {/* Notification badge */}
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-semibold text-white">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="lg:hidden">
        <div className="px-4 pt-2 pb-0 space-y-4">
          {/* Streak Card */}
          <StreakCard
            currentStreak={streakStats.currentStreak}
            streakDays={streakStats.streakDays}
          />

          {/* Practice with AI Card */}
          <PracticeAICard onStart={() => setIsCopilotOpen(true)} />

          {/* Badge Progress */}
          <BadgeProgressCard
            stats={badgeStats}
            earnedBadgeIds={earnedBadgeIds}
          />

          {/* Continue Learning / Jump In / Empty State */}
          {!isLoading && learningCardData.state !== 'loading' && (
            <ContinueLearningCard
              campaign={learningCardData.campaign}
              enrollment={learningCardData.enrollment}
              state={learningCardData.state}
              thumbnailUrl={thumbnailUrl}
              onPress={handleLearningCardPress}
            />
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-3">
              <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
              <div className="h-28 bg-white/10 rounded-3xl animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* AI Copilot */}
      <AICopilot
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        context={copilotContext}
      />

      {/* Notifications Sheet */}
      <NotificationsSheet
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={markAllAsRead}
        onNotificationClick={(notification) => {
          // Mark as read when clicked
          markAsRead(notification.id);
          // Close sheet and navigate based on type or actionUrl
          setIsNotificationsOpen(false);

          if (notification.actionUrl) {
            navigate(notification.actionUrl);
          } else if (notification.type === 'campaign') {
            navigate('/employee/learn');
          }
        }}
      />
    </div>
  );
};

export default MobileHome;
